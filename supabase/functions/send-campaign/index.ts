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

    // Verify caller is admin
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const { data: roleCheck } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { campaign_id } = await req.json()
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'campaign_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get campaign
    const { data: campaign, error: campErr } = await supabase.from('email_campaigns').select('*').eq('id', campaign_id).single()
    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (campaign.status === 'sent' || campaign.status === 'sending') {
      return new Response(JSON.stringify({ error: 'Campaign already sent/sending' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get contacts from group
    const { data: contacts, error: contactsErr } = await supabase
      .from('email_group_contacts')
      .select('*')
      .eq('group_id', campaign.group_id)
      .eq('subscribed', true)

    if (contactsErr || !contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ error: 'No contacts in group' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Update campaign status to sending
    await supabase.from('email_campaigns').update({ status: 'sending', total_recipients: contacts.length }).eq('id', campaign_id)

    // SMTP config
    const SMTP_HOST = Deno.env.get('SMTP_HOST')!
    const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '465')
    const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME')!
    const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD')!
    const SMTP_FROM = Deno.env.get('SMTP_FROM_ADDRESS') || 'support@fundingpulze.com'

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: { username: SMTP_USERNAME, password: SMTP_PASSWORD },
      },
    })

    const trackingBaseUrl = `${supabaseUrl}/functions/v1/email-tracking`
    let sentCount = 0
    let failCount = 0

    for (const contact of contacts) {
      try {
        // Build tracking pixel and wrapped links
        const trackingPixel = `<img src="${trackingBaseUrl}?type=open&cid=${campaign_id}&email=${encodeURIComponent(contact.email)}" width="1" height="1" style="display:none" />`

        // Replace links with tracking redirects
        let htmlWithTracking = campaign.html_content.replace(
          /href="(https?:\/\/[^"]+)"/g,
          (_: string, url: string) => `href="${trackingBaseUrl}?type=click&cid=${campaign_id}&email=${encodeURIComponent(contact.email)}&url=${encodeURIComponent(url)}"`
        )
        htmlWithTracking += trackingPixel

        await client.send({
          from: `Funding Pulze <${SMTP_FROM}>`,
          to: contact.email,
          subject: campaign.subject,
          html: htmlWithTracking,
        })

        // Log sent event
        await supabase.from('email_campaign_events').insert({
          campaign_id,
          contact_email: contact.email,
          event_type: 'sent',
        })
        sentCount++
      } catch (err) {
        console.error(`Failed to send to ${contact.email}:`, err)
        failCount++
      }
    }

    await client.close()

    // Update campaign status
    await supabase.from('email_campaigns').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      total_recipients: sentCount,
    }).eq('id', campaign_id)

    return new Response(JSON.stringify({ success: true, sent: sentCount, failed: failCount }), {
      status: 200,
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
