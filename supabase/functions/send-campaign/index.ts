import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const { data: roleCheck } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    const { data: adminCheck } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'administrator' })
    if (!roleCheck && !adminCheck) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { campaign_id } = await req.json()
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'campaign_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: campaign, error: campErr } = await supabase.from('email_campaigns').select('*').eq('id', campaign_id).single()
    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (campaign.status === 'sent' || campaign.status === 'sending') {
      return new Response(JSON.stringify({ error: 'Campaign already sent/sending' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Fetch ALL contacts using pagination (bypass 1000 row limit)
    const allContacts: any[] = []
    const PAGE_SIZE = 1000
    let offset = 0
    while (true) {
      const { data: batch, error: batchErr } = await supabase
        .from('email_group_contacts')
        .select('*')
        .eq('group_id', campaign.group_id)
        .eq('subscribed', true)
        .range(offset, offset + PAGE_SIZE - 1)

      if (batchErr || !batch || batch.length === 0) break
      allContacts.push(...batch)
      if (batch.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    if (allContacts.length === 0) {
      return new Response(JSON.stringify({ error: 'No contacts in group' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    await supabase.from('email_campaigns').update({ status: 'sending', total_recipients: allContacts.length }).eq('id', campaign_id)

    const SMTP_HOST = Deno.env.get('SMTP_HOST')!
    const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '465')
    const DEFAULT_FROM = Deno.env.get('SMTP_FROM_ADDRESS') || 'support@fundingpulze.com'
    const SUPPORT_SMTP_USERNAME = Deno.env.get('SMTP_USERNAME')!
    const SUPPORT_SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD')!
    const REQUESTED_FROM = (campaign.from_address || DEFAULT_FROM).trim()
    const isAdminSender = REQUESTED_FROM.toLowerCase().startsWith('admin@')
    const ADMIN_SMTP_USERNAME = Deno.env.get('SMTP_USERNAME_ADMIN') || REQUESTED_FROM
    const ADMIN_SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD_ADMIN') || ''

    if (!SUPPORT_SMTP_USERNAME || !SUPPORT_SMTP_PASSWORD) {
      return new Response(
        JSON.stringify({ error: 'Default SMTP credentials are not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let smtpUsername = isAdminSender ? ADMIN_SMTP_USERNAME : SUPPORT_SMTP_USERNAME
    let smtpPassword = isAdminSender ? ADMIN_SMTP_PASSWORD : SUPPORT_SMTP_PASSWORD
    let effectiveFrom = REQUESTED_FROM
    let fallbackWarning = ''

    if (!smtpPassword) {
      smtpUsername = SUPPORT_SMTP_USERNAME
      smtpPassword = SUPPORT_SMTP_PASSWORD
      effectiveFrom = DEFAULT_FROM
      if (isAdminSender) {
        fallbackWarning = `Admin sender credentials are missing, so this campaign was sent via ${DEFAULT_FROM}. Replies still route to ${REQUESTED_FROM}.`
      }
    }

    const createSmtpClient = (username: string, password: string) => new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: { username, password },
      },
    })

    const isSmtpAuthFailure = (error: unknown) => {
      const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
      return message.includes('535') || message.includes('authentication failed') || message.includes('auth failed')
    }

    const trackingBaseUrl = `${supabaseUrl}/functions/v1/email-tracking`
    let sentCount = 0
    let failCount = 0
    let lastErrorMessage = ''

    // Process in batches with a fresh SMTP connection per batch to avoid timeouts
    const BATCH_SIZE = 50
    for (let batchStart = 0; batchStart < allContacts.length; batchStart += BATCH_SIZE) {
      const batch = allContacts.slice(batchStart, batchStart + BATCH_SIZE)
      
      let client = createSmtpClient(smtpUsername, smtpPassword)

      const sentEvents: { campaign_id: string; contact_email: string; event_type: string; metadata?: Record<string, unknown> }[] = []

      for (const contact of batch) {
        try {
          const trackingPixel = `<img src="${trackingBaseUrl}?type=open&cid=${campaign_id}&email=${encodeURIComponent(contact.email)}" width="1" height="1" style="display:none" />`

          // Fix bare LF — SMTP requires CRLF line endings (RFC 2822)
          const sanitizedHtml = campaign.html_content.replace(/\r?\n/g, '\r\n')
          let htmlWithTracking = sanitizedHtml.replace(
            /href="(https?:\/\/[^"]+)"/g,
            (_: string, url: string) => `href="${trackingBaseUrl}?type=click&cid=${campaign_id}&email=${encodeURIComponent(contact.email)}&url=${encodeURIComponent(url)}"`
          )
          htmlWithTracking += trackingPixel

          const sendCurrentMessage = async () => {
            const messageId = `<${crypto.randomUUID()}@fundingpulze.com>`

            await client.send({
              from: `Funding Pulze <${effectiveFrom}>`,
              to: contact.email,
              subject: campaign.subject,
              html: htmlWithTracking,
              headers: {
                'Message-ID': messageId,
                'Reply-To': REQUESTED_FROM,
                'List-Unsubscribe': `<mailto:${REQUESTED_FROM}?subject=unsubscribe>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                'MIME-Version': '1.0',
              },
            })
          }

          await sendCurrentMessage()

          sentCount++
          sentEvents.push({
            campaign_id,
            contact_email: contact.email,
            event_type: 'sent',
          })

          // Small delay between sends to avoid rate limiting
          if (batch.length > 5) {
            await new Promise(r => setTimeout(r, 100))
          }
        } catch (err) {
          if (isAdminSender && effectiveFrom !== DEFAULT_FROM && isSmtpAuthFailure(err)) {
            console.warn(`Admin SMTP auth failed for ${REQUESTED_FROM}. Falling back to ${DEFAULT_FROM}.`)
            fallbackWarning = fallbackWarning || `Admin mailbox authentication failed, so this campaign was sent via ${DEFAULT_FROM}. Replies still route to ${REQUESTED_FROM}.`
            smtpUsername = SUPPORT_SMTP_USERNAME
            smtpPassword = SUPPORT_SMTP_PASSWORD
            effectiveFrom = DEFAULT_FROM

            try { await client.close() } catch {}
            client = createSmtpClient(smtpUsername, smtpPassword)

            try {
              const messageId = `<${crypto.randomUUID()}@fundingpulze.com>`

              await client.send({
                from: `Funding Pulze <${effectiveFrom}>`,
                to: contact.email,
                subject: campaign.subject,
                html: htmlWithTracking,
                headers: {
                  'Message-ID': messageId,
                  'Reply-To': REQUESTED_FROM,
                  'List-Unsubscribe': `<mailto:${REQUESTED_FROM}?subject=unsubscribe>`,
                  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                  'MIME-Version': '1.0',
                },
              })

              sentCount++
              sentEvents.push({
                campaign_id,
                contact_email: contact.email,
                event_type: 'sent',
              })

              if (batch.length > 5) {
                await new Promise(r => setTimeout(r, 100))
              }
              continue
            } catch (retryErr) {
              console.error(`Fallback send failed to ${contact.email}:`, retryErr)
              failCount++
              lastErrorMessage = retryErr instanceof Error ? retryErr.message : String(retryErr)
              continue
            }
          }

          console.error(`Failed to send to ${contact.email}:`, err)
          failCount++
          lastErrorMessage = err instanceof Error ? err.message : String(err)
        }
      }

      try { await client.close() } catch {}

      if (sentEvents.length > 0) {
        await supabase.from('email_campaign_events').insert(sentEvents)
      }

      // Update progress
      await supabase.from('email_campaigns').update({
        total_recipients: allContacts.length,
      }).eq('id', campaign_id)

      console.log(`Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: sent ${sentCount}/${allContacts.length}`)
    }

    const finalStatus = sentCount > 0 ? 'sent' : 'failed'

    await supabase.from('email_campaigns').update({
      status: finalStatus,
      sent_at: sentCount > 0 ? new Date().toISOString() : null,
      total_recipients: allContacts.length,
    }).eq('id', campaign_id)

    return new Response(JSON.stringify({
      success: failCount === 0,
      sent: sentCount,
      failed: failCount,
      warning: fallbackWarning || null,
      error: failCount > 0 ? lastErrorMessage || 'Campaign delivery failed' : null,
    }), {
      status: failCount === 0 ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Campaign send error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})