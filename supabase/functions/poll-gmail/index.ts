import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'
import nodemailer from 'npm:nodemailer@6.9.16'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_NAME = 'Funding Pulze'
const FROM_ADDRESS = 'Funding Pulze Support <support@fundingpulze.com>'

// ─── Minimal IMAP client using Deno.connectTls ───
class SimpleIMAP {
  private conn!: Deno.TlsConn
  private buffer = ''
  private decoder = new TextDecoder()
  private encoder = new TextEncoder()
  private tagNum = 0

  async connect(host: string, port: number) {
    this.conn = await Deno.connectTls({ hostname: host, port })
    await this.readUntilLine((l) => l.startsWith('* OK'))
  }

  private nextTag() { return `T${++this.tagNum}` }

  private async rawRead(): Promise<string> {
    const buf = new Uint8Array(16384)
    const n = await this.conn.read(buf)
    if (n === null) throw new Error('Connection closed')
    return this.decoder.decode(buf.subarray(0, n))
  }

  private async readUntilLine(predicate: (line: string) => boolean): Promise<string[]> {
    const lines: string[] = []
    while (true) {
      if (!this.buffer.includes('\r\n')) {
        this.buffer += await this.rawRead()
        continue
      }
      const idx = this.buffer.indexOf('\r\n')
      const line = this.buffer.substring(0, idx)
      this.buffer = this.buffer.substring(idx + 2)
      lines.push(line)
      if (predicate(line)) break
    }
    return lines
  }

  private async sendCommand(cmd: string): Promise<string[]> {
    const tag = this.nextTag()
    const fullCmd = `${tag} ${cmd}\r\n`
    await this.conn.write(this.encoder.encode(fullCmd))
    
    const lines: string[] = []
    // Read until we get the tagged response
    while (true) {
      if (!this.buffer.includes('\r\n')) {
        this.buffer += await this.rawRead()
        continue
      }
      const idx = this.buffer.indexOf('\r\n')
      const line = this.buffer.substring(0, idx)
      this.buffer = this.buffer.substring(idx + 2)
      lines.push(line)
      
      // Check for literal {nnn}
      const litMatch = line.match(/\{(\d+)\}$/)
      if (litMatch) {
        const litLen = parseInt(litMatch[1])
        // Read literal bytes
        while (this.buffer.length < litLen) {
          this.buffer += await this.rawRead()
        }
        const literalData = this.buffer.substring(0, litLen)
        this.buffer = this.buffer.substring(litLen)
        lines.push(literalData)
      }
      
      if (line.startsWith(`${tag} `)) break
    }
    return lines
  }

  async login(user: string, pass: string) {
    const res = await this.sendCommand(`LOGIN "${user}" "${pass}"`)
    const last = res[res.length - 1]
    if (!last.includes('OK')) throw new Error('IMAP Login failed: ' + last)
  }

  async selectInbox() {
    await this.sendCommand('SELECT INBOX')
  }

  async searchUnseen(): Promise<number[]> {
    const res = await this.sendCommand('SEARCH UNSEEN')
    const searchLine = res.find(l => l.startsWith('* SEARCH'))
    if (!searchLine || searchLine.trim() === '* SEARCH') return []
    return searchLine.replace('* SEARCH', '').trim().split(/\s+/).map(Number).filter(n => !isNaN(n))
  }

  async fetchMessage(seq: number): Promise<string> {
    const res = await this.sendCommand(`FETCH ${seq} BODY[]`)
    // Find the literal data (follows the line with {nnn})
    for (let i = 0; i < res.length; i++) {
      if (res[i].match(/\{(\d+)\}/) && i + 1 < res.length) {
        return res[i + 1]
      }
    }
    // Fallback: join all non-tag lines
    return res.filter(l => !l.startsWith('T') && !l.startsWith('*')).join('\r\n')
  }

  async getUID(seq: number): Promise<string> {
    const res = await this.sendCommand(`FETCH ${seq} (UID)`)
    const uidLine = res.find(l => l.includes('UID'))
    const match = uidLine?.match(/UID\s+(\d+)/)
    return match ? match[1] : String(seq)
  }

  async markSeen(seq: number) {
    await this.sendCommand(`STORE ${seq} +FLAGS (\\Seen)`)
  }

  async logout() {
    try { await this.sendCommand('LOGOUT') } catch { /* ok */ }
    try { this.conn.close() } catch { /* ok */ }
  }
}

// ─── Decoding helpers ───
function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '') // soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function decodeBase64(str: string): string {
  try { return atob(str.replace(/\s/g, '')) } catch { return str }
}

function decodePartBody(body: string, encoding: string): string {
  const enc = encoding.toLowerCase().trim()
  if (enc === 'quoted-printable') return decodeQuotedPrintable(body)
  if (enc === 'base64') return decodeBase64(body)
  return body
}

function extractPartHeaders(partHeader: string): Record<string, string> {
  const unfolded = partHeader.replace(/\r?\n([ \t])/g, ' ')
  const h: Record<string, string> = {}
  for (const line of unfolded.split(/\r?\n/)) {
    const ci = line.indexOf(':')
    if (ci > 0) {
      h[line.substring(0, ci).trim().toLowerCase()] = line.substring(ci + 1).trim()
    }
  }
  return h
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Email Parser ───
function parseEmail(raw: string) {
  const headerEnd = raw.indexOf('\r\n\r\n')
  const headerSection = headerEnd > 0 ? raw.substring(0, headerEnd) : raw
  const bodySection = headerEnd > 0 ? raw.substring(headerEnd + 4) : ''

  // Unfold headers
  const unfolded = headerSection.replace(/\r\n([ \t])/g, ' ')

  const headers: Record<string, string> = {}
  for (const line of unfolded.split('\r\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim().toLowerCase()
      const value = line.substring(colonIdx + 1).trim()
      headers[key] = value
    }
  }

  // Parse From
  let fromName = ''
  let fromEmail = ''
  const fromHeader = headers['from'] || ''
  const fromMatch = fromHeader.match(/^"?([^"<]*)"?\s*<([^>]+)>/)
  if (fromMatch) {
    fromName = fromMatch[1].trim()
    fromEmail = fromMatch[2].trim()
  } else {
    fromEmail = fromHeader.trim()
  }

  // Extract body from potentially multipart message
  let body = bodySection
  const contentType = headers['content-type'] || ''
  const topEncoding = headers['content-transfer-encoding'] || ''

  if (contentType.includes('multipart')) {
    const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/)
    if (boundaryMatch) {
      const boundary = boundaryMatch[1]
      const parts = bodySection.split(`--${boundary}`)
      let foundText = false
      let foundHtml = false

      // First pass: look for text/plain
      for (const part of parts) {
        const partHeaderEnd = part.indexOf('\r\n\r\n')
        if (partHeaderEnd < 0) continue
        const partHeaders = extractPartHeaders(part.substring(0, partHeaderEnd))
        const pct = partHeaders['content-type'] || ''
        const pte = partHeaders['content-transfer-encoding'] || ''

        if (pct.includes('text/plain')) {
          body = decodePartBody(part.substring(partHeaderEnd + 4).trim(), pte)
          foundText = true
          break
        }
      }

      // Second pass: fall back to text/html → strip to text
      if (!foundText) {
        for (const part of parts) {
          const partHeaderEnd = part.indexOf('\r\n\r\n')
          if (partHeaderEnd < 0) continue
          const partHeaders = extractPartHeaders(part.substring(0, partHeaderEnd))
          const pct = partHeaders['content-type'] || ''
          const pte = partHeaders['content-transfer-encoding'] || ''

          if (pct.includes('text/html')) {
            const decoded = decodePartBody(part.substring(partHeaderEnd + 4).trim(), pte)
            body = stripHtmlToText(decoded)
            foundHtml = true
            break
          }
        }
      }
    }
  } else {
    // Single-part message: decode with top-level encoding
    body = decodePartBody(body, topEncoding)
    if (contentType.includes('text/html')) {
      body = stripHtmlToText(body)
    }
  }

  // Clean up trailing boundary markers
  body = body.replace(/--[^\r\n]+--\s*$/, '').trim()

  return {
    from: fromEmail,
    fromName: fromName || fromEmail.split('@')[0],
    subject: headers['subject'] || '(No Subject)',
    messageId: headers['message-id'] || '',
    inReplyTo: headers['in-reply-to'] || '',
    references: headers['references'] || '',
    date: headers['date'] || new Date().toISOString(),
    body: body.substring(0, 10000),
  }
}

// ─── Main handler ───
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const smtpHost = Deno.env.get('SMTP_HOST')
  const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465')
  const smtpUsername = Deno.env.get('SMTP_USERNAME')
  const smtpPassword = Deno.env.get('SMTP_PASSWORD')
  const smtpFrom = Deno.env.get('SMTP_FROM_ADDRESS') || 'support@fundingpulze.com'
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (!smtpHost || !smtpUsername || !smtpPassword) {
    return new Response(JSON.stringify({ error: 'SMTP credentials not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // SMTP transporter for sending auto-replies via company mail
  const smtpTransport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUsername, pass: smtpPassword },
  })

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const imap = new SimpleIMAP()
  let processed = 0
  let errors: string[] = []

  try {
    console.log('Connecting to company mail IMAP...')
    await imap.connect(smtpHost, 993)
    await imap.login(smtpUsername, smtpPassword)
    await imap.selectInbox()

    const unseenSeqs = await imap.searchUnseen()
    console.log(`Found ${unseenSeqs.length} unseen messages`)

    if (unseenSeqs.length === 0) {
      await imap.logout()
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Process max 20 per run to stay within time limits
    const toProcess = unseenSeqs.slice(0, 20)

    for (const seq of toProcess) {
      try {
        // Get UID to check if already processed
        const uid = await imap.getUID(seq)
        
        const { data: existing } = await supabase
          .from('processed_gmail_ids')
          .select('id')
          .eq('gmail_uid', uid)
          .maybeSingle()

        if (existing) {
          await imap.markSeen(seq)
          continue
        }

        // Fetch and parse
        const raw = await imap.fetchMessage(seq)
        const email = parseEmail(raw)

        console.log(`Processing email from ${email.from}: ${email.subject}`)

        // Skip system/noreply/automated emails
        const skipPatterns = ['noreply', 'no-reply', 'no_reply', 'donotreply', 'do-not-reply',
          'mailer-daemon', 'postmaster', 'bounce', 'automated', 'notification',
          'alerts@', 'alert@', 'news@', 'newsletter@', 'marketing@', 'welcome@',
          'updates@', 'info@mongodb', 'team@mongodb']
        const fromLower = email.from.toLowerCase()
        if (skipPatterns.some(p => fromLower.includes(p)) || email.from === smtpUsername) {
          await imap.markSeen(seq)
          await supabase.from('processed_gmail_ids').insert({ gmail_uid: uid })
          continue
        }

        // Determine thread: check In-Reply-To / References for existing ticket
        let ticketId: string | null = null
        let isReply = false

        // Check if this is a reply to an existing ticket thread
        if (email.inReplyTo || email.references) {
          const refIds = [email.inReplyTo, ...email.references.split(/\s+/)].filter(Boolean)
          
          for (const refId of refIds) {
            // Check if any existing ticket message has this message ID
            const { data: existingMsg } = await supabase
              .from('support_ticket_messages')
              .select('ticket_id')
              .eq('gmail_message_id', refId.replace(/[<>]/g, ''))
              .maybeSingle()

            if (existingMsg) {
              ticketId = existingMsg.ticket_id
              isReply = true
              break
            }

            // Also check ticket's own gmail_message_id
            const { data: existingTicket } = await supabase
              .from('help_support_tickets')
              .select('id')
              .eq('gmail_message_id', refId.replace(/[<>]/g, ''))
              .maybeSingle()

            if (existingTicket) {
              ticketId = existingTicket.id
              isReply = true
              break
            }
          }
        }

        // Also match by subject (Re: Subject -> original subject)
        if (!ticketId) {
          const cleanSubject = email.subject.replace(/^(Re|Fwd|Fw):\s*/gi, '').trim()
          const { data: subjectMatch } = await supabase
            .from('help_support_tickets')
            .select('id')
            .eq('subject', cleanSubject)
            .eq('email', email.from)
            .neq('status', 'closed')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (subjectMatch) {
            ticketId = subjectMatch.id
            isReply = true
          }
        }

        const cleanMessageId = email.messageId.replace(/[<>]/g, '')

        if (ticketId) {
          // Add message to existing ticket
          await supabase.from('support_ticket_messages').insert({
            ticket_id: ticketId,
            sender_type: 'customer',
            sender_email: email.from,
            sender_name: email.fromName,
            message: email.body,
            gmail_message_id: cleanMessageId,
          })

          // Reopen ticket if it was closed
          await supabase
            .from('help_support_tickets')
            .update({ status: 'open', gmail_message_id: cleanMessageId })
            .eq('id', ticketId)

        } else {
          // Create new ticket
          const cleanSubject = email.subject.replace(/^(Re|Fwd|Fw):\s*/gi, '').trim()
          
          const { data: newTicket, error: ticketError } = await supabase
            .from('help_support_tickets')
            .insert({
              name: email.fromName,
              email: email.from,
              subject: cleanSubject,
              message: email.body,
              status: 'open',
              gmail_thread_id: cleanMessageId,
              gmail_message_id: cleanMessageId,
              source: 'email',
              auto_reply_sent: false,
            })
            .select('id')
            .single()

          if (ticketError) {
            console.error('Error creating ticket:', ticketError)
            errors.push(`Ticket creation failed for ${email.from}: ${ticketError.message}`)
            continue
          }

          // Add first message
          await supabase.from('support_ticket_messages').insert({
            ticket_id: newTicket.id,
            sender_type: 'customer',
            sender_email: email.from,
            sender_name: email.fromName,
            message: email.body,
            gmail_message_id: cleanMessageId,
          })

          // Send auto-reply via SMTP
          try {
            const autoReplyHtml = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <img src="https://rpshiyvndmnogbhbgmfm.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="Funding Pulze" style="height: 40px;" />
                </div>
                <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; border: 1px solid #e9ecef;">
                  <h2 style="margin: 0 0 16px; color: #1a1a1a; font-size: 20px;">We've received your message</h2>
                  <p style="color: #495057; line-height: 1.6; margin: 0 0 12px;">Hi ${email.fromName},</p>
                  <p style="color: #495057; line-height: 1.6; margin: 0 0 12px;">
                    Thank you for reaching out to Funding Pulze support. We've received your message regarding "<strong>${cleanSubject}</strong>" and our team will get back to you within <strong>4 hours</strong>.
                  </p>
                  <p style="color: #495057; line-height: 1.6; margin: 0 0 12px;">
                    Please reply to this email if you have any additional information to share.
                  </p>
                  <div style="background: #ffffff; border-radius: 8px; padding: 16px; margin-top: 20px; border: 1px solid #e9ecef;">
                    <p style="color: #868e96; font-size: 13px; margin: 0;">
                      <strong>Ticket Reference:</strong> #${newTicket.id.slice(0, 8).toUpperCase()}<br/>
                      <strong>Subject:</strong> ${cleanSubject}
                    </p>
                  </div>
                </div>
                <p style="text-align: center; color: #adb5bd; font-size: 12px; margin-top: 30px;">
                  © ${new Date().getFullYear()} Funding Pulze. All rights reserved.
                </p>
              </div>
            `

            await smtpTransport.sendMail({
              from: FROM_ADDRESS,
              to: email.from,
              subject: `Re: ${cleanSubject}`,
              html: autoReplyHtml,
              text: `Hi ${email.fromName},\n\nThank you for reaching out. We've received your message regarding "${cleanSubject}" and our team will get back to you within 4 hours.\n\nTicket Reference: #${newTicket.id.slice(0, 8).toUpperCase()}\n\n© ${new Date().getFullYear()} Funding Pulze`,
              inReplyTo: email.messageId,
              references: email.messageId,
            })

            await supabase
              .from('help_support_tickets')
              .update({ auto_reply_sent: true })
              .eq('id', newTicket.id)

            await supabase.from('support_ticket_messages').insert({
              ticket_id: newTicket.id,
              sender_type: 'system',
              sender_email: gmailEmail,
              sender_name: 'Funding Pulze Support',
              message: `Auto-reply sent: "We've received your message and will reply within 4 hours."`,
            })

            console.log(`Auto-reply sent to ${email.from}`)
          } catch (emailErr) {
            console.error('Auto-reply failed:', emailErr)
            errors.push(`Auto-reply failed for ${email.from}: ${emailErr}`)
          }
        }

        // Mark as processed
        await supabase.from('processed_gmail_ids').insert({ gmail_uid: uid })
        await imap.markSeen(seq)
        processed++

      } catch (msgErr) {
        console.error(`Error processing message ${seq}:`, msgErr)
        errors.push(`Message ${seq}: ${msgErr}`)
      }
    }

    await imap.logout()

    return new Response(JSON.stringify({ 
      success: true, 
      processed, 
      total_unseen: unseenSeqs.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Poll Gmail error:', error)
    try { await imap.logout() } catch { /* ok */ }
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      processed,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
