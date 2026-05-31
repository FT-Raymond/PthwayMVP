// supabase/functions/confirm-payment/index.ts
// Called when provider accepts a booking
// Captures the authorized PaymentIntent — money moves to provider

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return error(401, 'Missing auth header')

    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (!user) return error(401, 'Unauthorized')

    const { bookingId } = await req.json()
    if (!bookingId) return error(400, 'bookingId required')

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, provider_id, stripe_payment_intent_id, payment_status, amount_pence')
      .eq('id', bookingId)
      .single()

    if (!booking) return error(404, 'Booking not found')
    if (booking.provider_id !== user.id) return error(403, 'Not your booking')

    const paymentIntentId = booking.stripe_payment_intent_id

    // Handle free bookings
    if (!paymentIntentId || paymentIntentId === 'free') {
      await supabase
        .from('bookings')
        .update({ status: 'confirmed', payment_status: 'captured' })
        .eq('id', bookingId)

      return new Response(
        JSON.stringify({ success: true, free: true }),
        { headers: { ...cors, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Capture the authorized payment
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId)

    await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        payment_status: 'captured',
        amount_paid: booking.amount_pence / 100,
      })
      .eq('id', bookingId)

    return new Response(
      JSON.stringify({ success: true, paymentIntent: paymentIntent.id }),
      { headers: { ...cors, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error(err)
    return error(500, err instanceof Error ? err.message : 'Internal error')
  }
})

function error(status: number, message: string) {
  return new Response(
    JSON.stringify({ error: message }),
    { headers: { ...cors, 'Content-Type': 'application/json' }, status }
  )
}
