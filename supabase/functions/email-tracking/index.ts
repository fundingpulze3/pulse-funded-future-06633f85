import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { attachMongo } from "../_shared/mongo.ts";

// 1x1 transparent GIF
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b,
])

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const type = url.searchParams.get('type') // open or click
  const campaignId = url.searchParams.get('cid')
  const email = url.searchParams.get('email')
  const redirectUrl = url.searchParams.get('url')

  if (!type || !campaignId || !email) {
    return new Response('Missing params', { status: 400 })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    attachMongo(supabase);

    const userAgent = req.headers.get('user-agent') || ''
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''

    await supabase.from('email_campaign_events').insert({
      campaign_id: campaignId,
      contact_email: email,
      event_type: type,
      link_url: redirectUrl || null,
      user_agent: userAgent,
      ip_address: ip,
      metadata: {},
    })
  } catch (err) {
    console.error('Tracking error:', err)
  }

  if (type === 'click' && redirectUrl) {
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    })
  }

  // Return tracking pixel for opens
  return new Response(TRACKING_PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  })
})
