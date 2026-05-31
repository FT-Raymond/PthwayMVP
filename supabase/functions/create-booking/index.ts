import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
 
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
 
function errRes(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...cors, 'Content-Type': 'application/json' }, status,
  })
}
 
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
 
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
 
    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errRes(401, 'Missing auth')
 
    // Use service role for atomic operations but validate user first
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return errRes(401, 'Unauthorized')
 
    const supabase = createClient(supabaseUrl, serviceKey)
 
    const body = await req.json()
    const {
      opportunityId,
      startsAtUTC,   // ISO string in UTC
      endsAtUTC,     // ISO string in UTC
      answers = [],
      tzOffset = 0,
    } = body
 
    if (!opportunityId || !startsAtUTC || !endsAtUTC) {
      return errRes(400, 'opportunityId, startsAtUTC, endsAtUTC are required')
    }
 
    // 1. Load service
    const { data: opp } = await supabase
      .from('opportunities')
      .select('id, provider_id, price_pence, metadata, status, title')
      .eq('id', opportunityId)
      .single()
 
    if (!opp || opp.status !== 'active') return errRes(404, 'Service not found')
 
    const providerId = opp.provider_id
    const durationMins: number = opp.metadata?.duration ?? 60
    const pricePence: number = opp.price_pence ?? 0
    const feePence: number = pricePence > 0 ? Math.round(pricePence * 0.03 + 40) : 0
 
    const startsAt = new Date(startsAtUTC)
    const endsAt = new Date(endsAtUTC)
 
    // 2. Validate slot is not in the past
    if (startsAt <= new Date()) {
      return errRes(400, 'Cannot book a slot in the past')
    }
 
    // 3. Re-validate min notice (server-side)
    const { data: settings } = await supabase
      .from('provider_settings')
      .select('min_notice_hours')
      .eq('provider_id', providerId)
      .single()
 
    const minNoticeMs = ((settings?.min_notice_hours ?? 0) * 60 * 60 * 1000)
    if (startsAt.getTime() - Date.now() < minNoticeMs) {
      return errRes(400, 'Booking does not meet minimum notice requirement')
    }
 
    // 4. Check for overlapping bookings (atomic conflict check)
    // We use the DB GIST constraint as the final guard, but pre-check to give
    // a clean error message
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id')
      .eq('provider_id', providerId)
      .not('status', 'in', '("cancelled")')
      .lt('starts_at', endsAtUTC)
      .gt('ends_at', startsAtUTC)
      .limit(1)
 
    if (conflicts && conflicts.length > 0) {
      return errRes(409, 'This slot was just booked by someone else. Please choose another time.')
    }
 
    // 5. Insert booking — DB GIST constraint provides final atomicity
    const { data: booking, error: insertErr } = await supabase
      .from('bookings')
      .insert({
        provider_id: providerId,
        customer_id: user.id,
        opportunity_id: opportunityId,
        status: 'pending',
        payment_status: pricePence === 0 ? 'captured' : 'pending',
        amount_pence: pricePence,
        fee_pence: feePence,
        starts_at: startsAtUTC,
        ends_at: endsAtUTC,
        service_name: opp.title,
        duration_minutes: durationMins,
        booking_answers: answers,
        stripe_payment_intent_id: pricePence === 0 ? 'free' : null,
      })
      .select()
      .single()
 
    if (insertErr) {
      // GIST overlap constraint violation
      if (insertErr.code === '23P01' || insertErr.message.includes('overlap')) {
        return errRes(409, 'This slot was just taken. Please choose another time.')
      }
      console.error('Booking insert error:', insertErr)
      return errRes(500, insertErr.message)
    }
 
    return new Response(
      JSON.stringify({ booking, bookingId: booking.id }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
 
  } catch (e) {
    console.error('create-booking error:', e)
    return errRes(500, e instanceof Error ? e.message : 'Internal error')
  }
})
 