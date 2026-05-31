// supabase/functions/cancel-booking/index.ts
//
// Called by the client when a customer or provider cancels a booking.
// Handles:
//   1. Fetching booking + listing policy from DB
//   2. Calculating whether a cancellation fee applies
//   3. Partially capturing (fee) or fully cancelling the PaymentIntent via Stripe
//   4. Updating booking record in Supabase
//
// POST body: { bookingId: string, cancelledBy: 'customer' | 'provider' }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Parse request ──────────────────────────────────────────────────
    const { bookingId, cancelledBy } = await req.json() as {
      bookingId: string;
      cancelledBy: 'customer' | 'provider';
    };

    if (!bookingId || !cancelledBy) {
      return errorResponse(400, 'bookingId and cancelledBy are required');
    }

    // ── 2. Authenticate caller ────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse(401, 'Missing auth header');

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return errorResponse(401, 'Unauthorized');

    // ── 3. Fetch booking with listing policy ──────────────────────────────
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        customer_id,
        provider_id,
        slot_start,
        amount_pence,
        stripe_payment_intent_id,
        payment_status,
        opportunities (
          cancellation_window_hours,
          cancellation_fee_percent,
          cancellation_policy_label
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return errorResponse(404, 'Booking not found');
    }

    // ── 4. Authorisation check ────────────────────────────────────────────
    const isCustomer = booking.customer_id === user.id;
    const isProvider = booking.provider_id === user.id;

    if (!isCustomer && !isProvider) {
      return errorResponse(403, 'Not your booking');
    }
    if (cancelledBy === 'customer' && !isCustomer) {
      return errorResponse(403, 'Cannot cancel as customer');
    }
    if (cancelledBy === 'provider' && !isProvider) {
      return errorResponse(403, 'Cannot cancel as provider');
    }

    // ── 5. Idempotency check ──────────────────────────────────────────────
    if (['cancelled', 'fee_charged'].includes(booking.payment_status)) {
      return errorResponse(409, 'Booking already cancelled');
    }

    // ── 6. Calculate cancellation fee ─────────────────────────────────────
    const policy = booking.opportunities as {
      cancellation_window_hours: number;
      cancellation_fee_percent: number;
      cancellation_policy_label: string;
    };

    const now = Date.now();
    const apptMs = new Date(booking.slot_start).getTime();
    const hoursUntilAppointment = (apptMs - now) / (1000 * 60 * 60);

    // Provider-initiated cancellations never charge the customer
    const isWithinWindow =
      cancelledBy === 'customer' &&
      policy.cancellation_window_hours > 0 &&
      hoursUntilAppointment >= 0 &&
      hoursUntilAppointment < policy.cancellation_window_hours;

    const feePercent = isWithinWindow ? policy.cancellation_fee_percent : 0;
    const totalPence = booking.amount_pence ?? 0;
    const feeAmountPence = Math.round((totalPence * feePercent) / 100);

    // ── 7. Stripe action ──────────────────────────────────────────────────
    const paymentIntentId = booking.stripe_payment_intent_id;
    let stripeOutcome: 'captured_partial' | 'cancelled' | 'no_payment_intent';

    if (!paymentIntentId) {
      // Booking was never paid (e.g. cash/manual) — just mark cancelled
      stripeOutcome = 'no_payment_intent';
    } else if (feeAmountPence > 0) {
      // Partial capture: charge the cancellation fee, refund the rest
      // Stripe requires capture on uncaptured PaymentIntents.
      // We capture only the fee amount; the rest is automatically refunded.
      await stripe.paymentIntents.capture(paymentIntentId, {
        amount_to_capture: feeAmountPence,
      });
      stripeOutcome = 'captured_partial';
    } else {
      // No fee — cancel the PaymentIntent entirely (full refund / no charge)
      await stripe.paymentIntents.cancel(paymentIntentId);
      stripeOutcome = 'cancelled';
    }

    // ── 8. Update booking in Supabase ─────────────────────────────────────
    const newStatus = feeAmountPence > 0 ? 'fee_charged' : 'cancelled';

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        payment_status: newStatus,
        cancelled_at: new Date().toISOString(),
        cancellation_fee_charged: feeAmountPence,
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('DB update failed after Stripe action:', updateError);
      // Don't return error — Stripe action already completed
    }

    // ── 9. Return result ──────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        bookingId,
        stripeOutcome,
        feeCharged: {
          pence: feeAmountPence,
          formatted: formatPence(feeAmountPence),
        },
        refundAmount: {
          pence: totalPence - feeAmountPence,
          formatted: formatPence(totalPence - feeAmountPence),
        },
        isWithinWindow,
        cancelledBy,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err) {
    console.error('cancel-booking error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Internal error');
  }
});

function errorResponse(status: number, message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    }
  );
}

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}
