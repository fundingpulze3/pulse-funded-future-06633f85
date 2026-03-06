import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'
import { PurchaseConfirmationEmail } from '../_shared/email-templates/purchase-confirmation.tsx'
import { PasswordChangedEmail } from '../_shared/email-templates/password-changed.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_NAME = 'Funding Pulze'
const SITE_URL = 'https://fundingpulze.com'
const SENDER_DOMAIN = 'notify.fundingpulze.com'
const FROM_ADDRESS = `Funding Pulze <support@fundingpulze.com>`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { type, data } = body

    let html: string
    let text: string
    let subject: string

    switch (type) {
      case 'purchase_confirmation': {
        const props = {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipient: user.email!,
          challengeName: data.challengeName || '2 Step Challenge',
          accountSize: data.accountSize || '$50K',
          amountPaid: data.amountPaid || '$0',
        }
        html = await renderAsync(React.createElement(PurchaseConfirmationEmail, props))
        text = await renderAsync(React.createElement(PurchaseConfirmationEmail, props), { plainText: true })
        subject = '🎉 Your Funding Pulze challenge is confirmed!'
        break
      }

      case 'password_changed': {
        const props = {
          siteName: SITE_NAME,
          recipient: user.email!,
        }
        html = await renderAsync(React.createElement(PasswordChangedEmail, props))
        text = await renderAsync(React.createElement(PasswordChangedEmail, props), { plainText: true })
        subject = '🔒 Your password was changed'
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // Send via Lovable Email API
    const apiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured')
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { sendLovableEmail } = await import('npm:@lovable.dev/email-js')

    const result = await sendLovableEmail(
      {
        to: user.email!,
        from: FROM_ADDRESS,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: 'transactional',
      },
      { apiKey }
    )

    console.log('Transactional email sent', { type, email: user.email, message_id: result.message_id })

    return new Response(
      JSON.stringify({ success: true, message_id: result.message_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Transactional email error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
