import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'
import { PurchaseConfirmationEmail } from '../_shared/email-templates/purchase-confirmation.tsx'
import { PasswordChangedEmail } from '../_shared/email-templates/password-changed.tsx'
import { CredentialsEmail } from '../_shared/email-templates/credentials.tsx'
import { DailyDDBreachEmail } from '../_shared/email-templates/daily-dd-breach.tsx'
import { MaxDDBreachEmail } from '../_shared/email-templates/max-dd-breach.tsx'
import { Phase1PassedEmail } from '../_shared/email-templates/phase1-passed.tsx'
import { Phase2PassedEmail } from '../_shared/email-templates/phase2-passed.tsx'
import { PayoutReceivedEmail } from '../_shared/email-templates/payout-received.tsx'
import { WelcomeEmail } from '../_shared/email-templates/welcome.tsx'
import { KYCApprovedEmail } from '../_shared/email-templates/kyc-approved.tsx'
import { KYCRejectedEmail } from '../_shared/email-templates/kyc-rejected.tsx'

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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Support both user token and service role calls
    let recipientEmail: string
    const token = authHeader.replace('Bearer ', '')
    
    // Try user auth first
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    
    const body = await req.json()
    const { type, data, recipientUserId, recipientOverride } = body

    // Direct override (for admin CC)
    if (recipientOverride) {
      recipientEmail = recipientOverride
    } else if (recipientUserId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('user_id', recipientUserId)
        .single()
      recipientEmail = profile?.email || ''
      
      if (!recipientEmail) {
        const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(recipientUserId)
        recipientEmail = targetUser?.email || ''
      }
    } else if (user) {
      recipientEmail = user.email!
    } else {
      return new Response(JSON.stringify({ error: 'No recipient found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: 'No recipient email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let html: string
    let text: string
    let subject: string

    const baseProps = { siteName: SITE_NAME, siteUrl: SITE_URL, recipient: recipientEmail }

    switch (type) {
      case 'purchase_confirmation': {
        const props = { ...baseProps, challengeName: data.challengeName || '2 Step Challenge', accountSize: data.accountSize || '$50K', amountPaid: data.amountPaid || '$0' }
        html = await renderAsync(React.createElement(PurchaseConfirmationEmail, props))
        text = await renderAsync(React.createElement(PurchaseConfirmationEmail, props), { plainText: true })
        subject = '🎉 Your Funding Pulze challenge is confirmed!'
        break
      }

      case 'password_changed': {
        html = await renderAsync(React.createElement(PasswordChangedEmail, { ...baseProps }))
        text = await renderAsync(React.createElement(PasswordChangedEmail, { ...baseProps }), { plainText: true })
        subject = '🔒 Your password was changed'
        break
      }

      case 'credentials': {
        const props = { ...baseProps, mt5Login: data.mt5Login, mt5Password: data.mt5Password, mt5Server: data.mt5Server || 'MetaQuotes-Demo', challengeName: data.challengeName || 'Trading Challenge', accountSize: data.accountSize || '' }
        html = await renderAsync(React.createElement(CredentialsEmail, props))
        text = await renderAsync(React.createElement(CredentialsEmail, props), { plainText: true })
        subject = '🚀 Your MT5 trading credentials are ready!'
        break
      }

      case 'daily_dd_breach': {
        const props = { ...baseProps, accountNumber: data.accountNumber, breachType: 'daily', breachValue: data.breachValue, limit: data.limit }
        html = await renderAsync(React.createElement(DailyDDBreachEmail, props))
        text = await renderAsync(React.createElement(DailyDDBreachEmail, props), { plainText: true })
        subject = `⚠️ Daily Drawdown Breach — Account #${data.accountNumber}`
        break
      }

      case 'max_dd_breach': {
        const props = { ...baseProps, accountNumber: data.accountNumber, breachType: 'max', breachValue: data.breachValue, limit: data.limit }
        html = await renderAsync(React.createElement(MaxDDBreachEmail, props))
        text = await renderAsync(React.createElement(MaxDDBreachEmail, props), { plainText: true })
        subject = `⚠️ Max Drawdown Breach — Account #${data.accountNumber}`
        break
      }

      case 'phase1_passed': {
        const props = { ...baseProps, accountNumber: data.accountNumber, profit: data.profit, profitPercent: data.profitPercent }
        html = await renderAsync(React.createElement(Phase1PassedEmail, props))
        text = await renderAsync(React.createElement(Phase1PassedEmail, props), { plainText: true })
        subject = `✅ Phase 1 Passed — Account #${data.accountNumber}`
        break
      }

      case 'phase2_passed': {
        const props = { ...baseProps, accountNumber: data.accountNumber, profit: data.profit, profitPercent: data.profitPercent }
        html = await renderAsync(React.createElement(Phase2PassedEmail, props))
        text = await renderAsync(React.createElement(Phase2PassedEmail, props), { plainText: true })
        subject = `🏆 Phase 2 Passed — You're Getting Funded! Account #${data.accountNumber}`
        break
      }

      case 'payout_received': {
        const props = { ...baseProps, accountNumber: data.accountNumber, payoutAmount: data.payoutAmount, payoutNumber: data.payoutNumber || '1' }
        html = await renderAsync(React.createElement(PayoutReceivedEmail, props))
        text = await renderAsync(React.createElement(PayoutReceivedEmail, props), { plainText: true })
        subject = `💰 Payout #${data.payoutNumber || '1'} Processed — ${data.payoutAmount}`
        break
      }

      case 'welcome': {
        const props = { ...baseProps, displayName: data.displayName || '' }
        html = await renderAsync(React.createElement(WelcomeEmail, props))
        text = await renderAsync(React.createElement(WelcomeEmail, props), { plainText: true })
        subject = '🎯 Welcome to Funding Pulze — Your Trading Journey Starts Now!'
        break
      }

      case 'kyc_approved': {
        const props = { ...baseProps, displayName: data.displayName || '' }
        html = await renderAsync(React.createElement(KYCApprovedEmail, props))
        text = await renderAsync(React.createElement(KYCApprovedEmail, props), { plainText: true })
        subject = '✅ KYC Approved — You\'re Fully Verified!'
        break
      }

      case 'kyc_rejected': {
        const props = { ...baseProps, displayName: data.displayName || '', reviewNote: data.reviewNote || '' }
        html = await renderAsync(React.createElement(KYCRejectedEmail, props))
        text = await renderAsync(React.createElement(KYCRejectedEmail, props), { plainText: true })
        subject = '⚠️ KYC Verification Update — Action Required'
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { sendLovableEmail } = await import('npm:@lovable.dev/email-js')

    const result = await sendLovableEmail(
      { to: recipientEmail, from: FROM_ADDRESS, sender_domain: SENDER_DOMAIN, subject, html, text, purpose: 'transactional', run_id: crypto.randomUUID() },
      { apiKey }
    )

    console.log('Transactional email sent', { type, email: recipientEmail, message_id: result.message_id })

    return new Response(
      JSON.stringify({ success: true, message_id: result.message_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Transactional email error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
