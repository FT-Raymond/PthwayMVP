import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:8081'

    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing auth' }), { headers: { ...cors, 'Content-Type': 'application/json' }, status: 401 })

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!)
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { ...cors, 'Content-Type': 'application/json' }, status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single()

    let accountId = profile?.stripe_account_id

    if (!accountId) {
      const createResp = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'type': 'express',
          'email': user.email ?? '',
          'capabilities[card_payments][requested]': 'true',
          'capabilities[transfers][requested]': 'true',
          'business_type': 'individual',
          'metadata[supabase_user_id]': user.id,
        }),
      })

      const account = await createResp.json()
      if (!createResp.ok) throw new Error(account.error?.message ?? 'Failed to create account')
      accountId = account.id

      await supabase.from('profiles').update({ stripe_account_id: accountId }).eq('id', user.id)
    }

    const linkResp = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'account': accountId,
        'refresh_url': `${appUrl}/provider/payouts?refresh=1`,
        'return_url': `${appUrl}/provider/payouts?success=1`,
        'type': 'account_onboarding',
      }),
    })

    const link = await linkResp.json()
    if (!linkResp.ok) throw new Error(link.error?.message ?? 'Failed to create link')

    return new Response(
      JSON.stringify({ url: link.url, accountId }),
      { headers: { ...cors, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err) {
    console.error('Error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { headers: { ...cors, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})