import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { attachMongo } from "../_shared/mongo.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-campaign-key',
}

const PAGE_SIZE = 1000
const SEND_BATCH_SIZE = 25
const SEND_DELAY_MS = 100
const ALL_USERS_GROUP_NAME = 'all users'

type CampaignRecipient = {
  email: string
  name?: string | null
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const normalizeEmail = (email: string) => email.trim().toLowerCase()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const isAllUsersGroup = (groupName?: string | null) => groupName?.trim().toLowerCase() === ALL_USERS_GROUP_NAME

const isSmtpAuthFailure = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('535') || message.includes('authentication failed') || message.includes('auth failed')
}

const buildTrackedHtml = (campaignHtml: string, trackingBaseUrl: string, campaignId: string, email: string) => {
  const trackingPixel = `<img src="${trackingBaseUrl}?type=open&cid=${campaignId}&email=${encodeURIComponent(email)}" width="1" height="1" style="display:none" />`
  const sanitizedHtml = campaignHtml.replace(/\r?\n/g, '\r\n')

  return sanitizedHtml.replace(
    /href="(https?:\/\/[^\"]+)"/g,
    (_: string, url: string) => `href="${trackingBaseUrl}?type=click&cid=${campaignId}&email=${encodeURIComponent(email)}&url=${encodeURIComponent(url)}"`
  ) + trackingPixel
}

async function fetchPaginated<T>(fetchPage: (from: number, to: number) => Promise<T[]>) {
  const rows: T[] = []
  let from = 0

  while (true) {
    const batch = await fetchPage(from, from + PAGE_SIZE - 1)
    if (!batch.length) break
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

async function fetchRecipients(supabase: ReturnType<typeof createClient>, campaign: { group_id: string | null }) {
  if (!campaign.group_id) return [] as CampaignRecipient[]

  const { data: group } = await supabase
    .from('email_groups')
    .select('id, name')
    .eq('id', campaign.group_id)
    .maybeSingle()

  if (isAllUsersGroup(group?.name)) {
    const profiles = await fetchPaginated(async (from, to) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('email, display_name')
        .not('email', 'is', null)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        console.error('Failed to load profile recipients:', error)
        return []
      }

      return data ?? []
    })

    const uniqueProfiles = new Map<string, CampaignRecipient>()
    for (const profile of profiles) {
      if (!profile.email) continue
      const email = normalizeEmail(profile.email)
      if (!email) continue
      uniqueProfiles.set(email, { email, name: profile.display_name ?? null })
    }

    return Array.from(uniqueProfiles.values())
  }

  const contacts = await fetchPaginated(async (from, to) => {
    const { data, error } = await supabase
      .from('email_group_contacts')
      .select('email, name')
      .eq('group_id', campaign.group_id)
      .eq('subscribed', true)
      .range(from, to)

    if (error) {
      console.error('Failed to load group contacts:', error)
      return []
    }

    return data ?? []
  })

  const uniqueContacts = new Map<string, CampaignRecipient>()
  for (const contact of contacts) {
    if (!contact.email) continue
    const email = normalizeEmail(contact.email)
    if (!email) continue
    uniqueContacts.set(email, { email, name: contact.name ?? null })
  }

  return Array.from(uniqueContacts.values())
}

async function fetchAttemptedEmails(supabase: ReturnType<typeof createClient>, campaignId: string) {
  const events = await fetchPaginated(async (from, to) => {
    const { data, error } = await supabase
      .from('email_campaign_events')
      .select('contact_email, event_type')
      .eq('campaign_id', campaignId)
      .in('event_type', ['sent', 'failed'])
      .range(from, to)

    if (error) {
      console.error('Failed to load attempted campaign events:', error)
      return []
    }

    return data ?? []
  })

  const sent = new Set<string>()
  const failed = new Set<string>()

  for (const event of events) {
    if (!event.contact_email) continue
    const email = normalizeEmail(event.contact_email)
    if (event.event_type === 'sent') sent.add(email)
    if (event.event_type === 'failed') failed.add(email)
  }

  return { sent, failed }
}

async function invokeNextBatch(supabaseUrl: string, internalKey: string, campaignId: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/send-campaign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-campaign-key': internalKey,
    },
    body: JSON.stringify({ campaign_id: campaignId }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to continue campaign batch: ${response.status} ${body}`)
  }
}

async function processCampaignChunk(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  supabaseKey: string,
  campaignId: string,
) {
  const { data: campaign, error: campaignError } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (campaignError || !campaign) {
    console.error('Campaign not found while processing batch:', campaignError)
    return
  }

  if (campaign.status === 'sent') return

  const allRecipients = await fetchRecipients(supabase, campaign)
  if (allRecipients.length === 0) {
    await supabase.from('email_campaigns').update({
      status: 'failed',
      sent_at: null,
      total_recipients: 0,
    }).eq('id', campaignId)
    return
  }

  const { sent: previouslySent, failed: previouslyFailed } = await fetchAttemptedEmails(supabase, campaignId)
  const attemptedEmails = new Set<string>([...previouslySent, ...previouslyFailed])
  const pendingRecipients = allRecipients.filter((recipient) => !attemptedEmails.has(recipient.email))

  await supabase.from('email_campaigns').update({
    status: 'sending',
    total_recipients: allRecipients.length,
    sent_at: null,
  }).eq('id', campaignId)

  if (pendingRecipients.length === 0) {
    await supabase.from('email_campaigns').update({
      status: previouslySent.size > 0 ? 'sent' : 'failed',
      sent_at: previouslySent.size > 0 ? new Date().toISOString() : null,
      total_recipients: allRecipients.length,
    }).eq('id', campaignId)
    return
  }

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
    throw new Error('Default SMTP credentials are not configured')
  }

  const createSmtpClient = (username: string, password: string) => new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: true,
      auth: { username, password },
    },
  })

  const trackingBaseUrl = `${supabaseUrl}/functions/v1/email-tracking`
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

  const batchRecipients = pendingRecipients.slice(0, SEND_BATCH_SIZE)
  const sentEvents: { campaign_id: string; contact_email: string; event_type: string; metadata?: Record<string, unknown> }[] = []
  const failedEvents: { campaign_id: string; contact_email: string; event_type: string; metadata?: Record<string, unknown> }[] = []

  let client = createSmtpClient(smtpUsername, smtpPassword)

  for (const recipient of batchRecipients) {
    const htmlWithTracking = buildTrackedHtml(campaign.html_content, trackingBaseUrl, campaignId, recipient.email)

    try {
      await client.send({
        from: `Funding Pulze <${effectiveFrom}>`,
        to: recipient.email,
        subject: campaign.subject,
        html: htmlWithTracking,
        headers: {
          'Message-ID': `<${crypto.randomUUID()}@fundingpulze.com>`,
          'Reply-To': REQUESTED_FROM,
          'List-Unsubscribe': `<mailto:${REQUESTED_FROM}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'MIME-Version': '1.0',
        },
      })

      sentEvents.push({
        campaign_id: campaignId,
        contact_email: recipient.email,
        event_type: 'sent',
      })
    } catch (error) {
      if (isAdminSender && effectiveFrom !== DEFAULT_FROM && isSmtpAuthFailure(error)) {
        console.warn(`Admin SMTP auth failed for ${REQUESTED_FROM}. Falling back to ${DEFAULT_FROM}.`)
        fallbackWarning = fallbackWarning || `Admin mailbox authentication failed, so this campaign was sent via ${DEFAULT_FROM}. Replies still route to ${REQUESTED_FROM}.`
        smtpUsername = SUPPORT_SMTP_USERNAME
        smtpPassword = SUPPORT_SMTP_PASSWORD
        effectiveFrom = DEFAULT_FROM

        try { await client.close() } catch {}
        client = createSmtpClient(smtpUsername, smtpPassword)

        try {
          await client.send({
            from: `Funding Pulze <${effectiveFrom}>`,
            to: recipient.email,
            subject: campaign.subject,
            html: htmlWithTracking,
            headers: {
              'Message-ID': `<${crypto.randomUUID()}@fundingpulze.com>`,
              'Reply-To': REQUESTED_FROM,
              'List-Unsubscribe': `<mailto:${REQUESTED_FROM}?subject=unsubscribe>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              'MIME-Version': '1.0',
            },
          })

          sentEvents.push({
            campaign_id: campaignId,
            contact_email: recipient.email,
            event_type: 'sent',
            metadata: { warning: fallbackWarning },
          })
        } catch (retryError) {
          console.error(`Fallback send failed to ${recipient.email}:`, retryError)
          failedEvents.push({
            campaign_id: campaignId,
            contact_email: recipient.email,
            event_type: 'failed',
            metadata: { error: retryError instanceof Error ? retryError.message : String(retryError) },
          })
        }
      } else {
        console.error(`Failed to send to ${recipient.email}:`, error)
        failedEvents.push({
          campaign_id: campaignId,
          contact_email: recipient.email,
          event_type: 'failed',
          metadata: { error: error instanceof Error ? error.message : String(error) },
        })
      }
    }

    if (batchRecipients.length > 5) {
      await sleep(SEND_DELAY_MS)
    }
  }

  try { await client.close() } catch {}

  if (sentEvents.length > 0) {
    await supabase.from('email_campaign_events').insert(sentEvents)
  }

  if (failedEvents.length > 0) {
    await supabase.from('email_campaign_events').insert(failedEvents)
  }

  const processedThisRun = previouslySent.size + previouslyFailed.size + batchRecipients.length
  const remaining = Math.max(allRecipients.length - processedThisRun, 0)

  await supabase.from('email_campaigns').update({
    total_recipients: allRecipients.length,
  }).eq('id', campaignId)

  console.log(`Campaign ${campaignId}: processed ${processedThisRun}/${allRecipients.length}${fallbackWarning ? ` (${fallbackWarning})` : ''}`)

  if (remaining > 0) {
    await invokeNextBatch(supabaseUrl, supabaseKey, campaignId)
    return
  }

  const finalSentCount = previouslySent.size + sentEvents.length
  await supabase.from('email_campaigns').update({
    status: finalSentCount > 0 ? 'sent' : 'failed',
    sent_at: finalSentCount > 0 ? new Date().toISOString() : null,
    total_recipients: allRecipients.length,
  }).eq('id', campaignId)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    attachMongo(supabase);
    const internalKey = req.headers.get('x-internal-campaign-key')
    const isInternalRequest = internalKey === supabaseKey

    if (!isInternalRequest) {
      if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

      const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
      const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
      if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

      const { data: roleCheck } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
      const { data: adminCheck } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'administrator' })
      if (!roleCheck && !adminCheck) return jsonResponse({ error: 'Forbidden' }, 403)
    }

    const { campaign_id } = await req.json()
    if (!campaign_id) return jsonResponse({ error: 'campaign_id required' }, 400)

    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('id, status')
      .eq('id', campaign_id)
      .single()

    if (campaignError || !campaign) return jsonResponse({ error: 'Campaign not found' }, 404)
    if (campaign.status === 'sent') return jsonResponse({ error: 'Campaign already sent' }, 400)

    EdgeRuntime.waitUntil(
      processCampaignChunk(supabase, supabaseUrl, supabaseKey, campaign_id).catch(async (error) => {
        console.error('Campaign send error:', error)
        await supabase.from('email_campaigns').update({ status: 'failed' }).eq('id', campaign_id)
      })
    )

    return jsonResponse({
      success: true,
      queued: true,
      message: isInternalRequest
        ? 'Campaign batch queued'
        : 'Campaign queued. Delivery is continuing in the background.',
    }, isInternalRequest ? 200 : 202)
  } catch (error) {
    console.error('Campaign send error:', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
