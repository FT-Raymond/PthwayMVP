// supabase/functions/request-refund/index.ts
// Handles both customer refund requests and provider refund approvals/denials

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

    const body = await req.json()
    const { action } = body

    // ── Customer creates refund request ──────────────────────────────────
    if (action === 'request') {
      const { bookingId, reason, message } = body

      const { data: booking } = await supabase
        .from('bookings')
        .select('id, customer_id, provider_id, amount_pence, stripe_payment_intent_id')
        .eq('id', bookingId)
        .single()

      if (!booking) return error(404, 'Booking not found')
      if (booking.customer_id !== user.id) return error(403, 'Not your booking')

      const { data: refund, error: insertError } = await supabase
        .from('refund_requests')
        .insert({
          booking_id: bookingId,
          customer_id: user.id,
          provider_id: booking.provider_id,
          reason,
          message,
          amount_pence: booking.amount_pence,
          status: 'pending',
        })
        .select()
        .single()

      if (insertError) return error(500, insertError.message)

      return new Response(
        JSON.stringify({ success: true, refundRequestId: refund.id }),
        { headers: { ...cors, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ── Provider approves refund ──────────────────────────────────────────
    if (action === 'approve') {
      const { refundRequestId, amountPence } = body

      const { data: refundReq } = await supabase
        .from('refund_requests')
        .select('*, bookings(stripe_payment_intent_id, amount_pence)')
        .eq('id', refundRequestId)
        .single()

      if (!refundReq) return error(404, 'Refund request not found')
      if (refundReq.provider_id !== user.id) return error(403, 'Not your booking')

      const paymentIntentId = (refundReq.bookings as any)?.stripe_payment_intent_id
      const refundAmount = amountPence ?? refundReq.amount_pence

      let stripeRefundId: string | null = null

      if (paymentIntentId && paymentIntentId !== 'free') {
        const stripeRefund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: refundAmount,
          reason: 'requested_by_customer',
        })
        stripeRefundId = stripeRefund.id
      }

      await supabase
        .from('refund_requests')
        .update({
          status: 'approved',
          stripe_refund_id: stripeRefundId,
          amount_pence: refundAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', refundRequestId)

      // Update booking payment status
      await supabase
        .from('bookings')
        .update({ payment_status: 'refunded' })
        .eq('id', refundReq.booking_id)

      return new Response(
        JSON.stringify({ success: true, stripeRefundId }),
        { headers: { ...cors, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ── Provider denies refund ────────────────────────────────────────────
    if (action === 'deny') {
      const { refundRequestId, responseNote } = body

      const { data: refundReq } = await supabase
        .from('refund_requests')
        .select('provider_id')
        .eq('id', refundRequestId)
        .single()

      if (!refundReq) return error(404, 'Refund request not found')
      if (refundReq.provider_id !== user.id) return error(403, 'Not your booking')

      await supabase
        .from('refund_requests')
        .update({
          status: 'denied',
          provider_response: responseNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', refundRequestId)

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...cors, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return error(400, 'Invalid action')
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
