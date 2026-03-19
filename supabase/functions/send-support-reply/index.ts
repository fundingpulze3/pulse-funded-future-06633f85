import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'
import nodemailer from 'npm:nodemailer@6.9.16'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM_ADDRESS = 'Funding Pulze Support <support@fundingpulze.com>'

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const smtpHost = Deno.env.get('SMTP_HOST')
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465')
    const smtpUsername = Deno.env.get('SMTP_USERNAME')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')
    const smtpFrom = Deno.env.get('SMTP_FROM_ADDRESS') || 'support@fundingpulze.com'

    if (!smtpHost || !smtpUsername || !smtpPassword) {
      return new Response(JSON.stringify({ error: 'SMTP credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { ticket_id, message, close_ticket } = body

    if (!ticket_id || !message) {
      return new Response(JSON.stringify({ error: 'ticket_id and message are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('help_support_tickets')
      .select('*')
      .eq('id', ticket_id)
      .single()

    if (ticketError || !ticket) {
      return new Response(JSON.stringify({ error: 'Ticket not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create SMTP transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: gmailEmail, pass: gmailAppPassword },
    })

    const replyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="https://rpshiyvndmnogbhbgmfm.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="Funding Pulze" style="height: 40px;" />
        </div>
        <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; border: 1px solid #e9ecef;">
          <h2 style="margin: 0 0 16px; color: #1a1a1a; font-size: 18px;">Re: ${ticket.subject}</h2>
          <div style="color: #495057; line-height: 1.7; white-space: pre-wrap; margin: 0 0 20px;">${message}</div>
          <div style="border-top: 1px solid #e9ecef; padding-top: 16px; margin-top: 16px;">
            <p style="color: #868e96; font-size: 13px; margin: 0;">
              Ticket Reference: #${ticket.id.slice(0, 8).toUpperCase()}<br/>
              Reply to this email to continue the conversation.
            </p>
          </div>
        </div>
        <p style="text-align: center; color: #adb5bd; font-size: 12px; margin-top: 30px;">
          © ${new Date().getFullYear()} Funding Pulze. All rights reserved.
        </p>
      </div>
    `

    // Build threading headers
    const mailOptions: Record<string, unknown> = {
      from: FROM_ADDRESS,
      to: ticket.email,
      subject: `Re: ${ticket.subject}`,
      html: replyHtml,
      text: `Re: ${ticket.subject}\n\n${message}\n\nTicket Reference: #${ticket.id.slice(0, 8).toUpperCase()}\nReply to this email to continue the conversation.\n\n© ${new Date().getFullYear()} Funding Pulze`,
    }

    // Add In-Reply-To for threading
    if (ticket.gmail_message_id) {
      mailOptions.inReplyTo = `<${ticket.gmail_message_id}>`
      mailOptions.references = `<${ticket.gmail_message_id}>`
    }

    const result = await transporter.sendMail(mailOptions)

    // Save reply as ticket message
    await supabaseAdmin.from('support_ticket_messages').insert({
      ticket_id,
      sender_type: 'support',
      sender_email: 'support@fundingpulze.com',
      sender_name: user.email?.split('@')[0] || 'Support',
      message,
      gmail_message_id: result.messageId?.replace(/[<>]/g, '') || null,
    })

    // Update ticket
    await supabaseAdmin
      .from('help_support_tickets')
      .update({
        last_reply_at: new Date().toISOString(),
        status: close_ticket ? 'closed' : 'in_progress',
      })
      .eq('id', ticket_id)

    console.log(`Support reply sent to ${ticket.email} for ticket ${ticket_id}`)

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: result.messageId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Send support reply error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
