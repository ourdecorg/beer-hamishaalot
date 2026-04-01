import { Resend } from 'resend'

export interface WishOwner {
  wishText:     string
  contactName:  string
  contactEmail: string
  contactPhone: string | null
  contactCity:  string | null
}

/**
 * Sends a joyful connection notification to both wish owners.
 * Each recipient sees their own wish + the other's wish and contact details.
 */
export async function sendConnectionEmail(
  ownerA: WishOwner,
  ownerB: WishOwner,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[sendConnectionEmail] RESEND_API_KEY is not set — skipping email')
    return
  }
  const resend = new Resend(apiKey)
  const addr   = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
  const FROM   = `Well of Wishes <${addr}>`

  const [resA, resB] = await Promise.all([
    resend.emails.send({
      from:    FROM,
      to:      ownerA.contactEmail,
      subject: '🎉 We found a match for your wish!',
      html:    buildHtml(ownerA, ownerB),
    }),
    resend.emails.send({
      from:    FROM,
      to:      ownerB.contactEmail,
      subject: '🎉 We found a match for your wish!',
      html:    buildHtml(ownerB, ownerA),
    }),
  ])

  if (resA.error) throw new Error(`Resend (A): ${resA.error.message}`)
  if (resB.error) throw new Error(`Resend (B): ${resB.error.message}`)
  console.log(`[email] Resend IDs: A=${resA.data?.id} B=${resB.data?.id}`)
}

function buildHtml(recipient: WishOwner, other: WishOwner): string {
  return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head><meta charset="UTF-8" /></head>
<body style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px; direction: ltr; text-align: left;">
  <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">

    <h1 style="color: #4f46e5; font-size: 24px; margin: 0 0 8px;">🎉 We found a resonance!</h1>
    <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hi ${esc(recipient.contactName)},<br>
    We found a match between your wish and someone else's. Here are the details:</p>

    <div style="background: #eef2ff; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <div style="font-size: 11px; text-transform: uppercase; color: #6366f1; letter-spacing: 0.05em; margin-bottom: 8px; font-weight: 600;">Your wish</div>
      <p style="color: #1e293b; font-size: 15px; margin: 0; line-height: 1.6;">${esc(recipient.wishText)}</p>
    </div>

    <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <div style="font-size: 11px; text-transform: uppercase; color: #16a34a; letter-spacing: 0.05em; margin-bottom: 8px; font-weight: 600;">Matching wish</div>
      <p style="color: #1e293b; font-size: 15px; margin: 0 0 16px; line-height: 1.6;">${esc(other.wishText)}</p>
      <div style="border-top: 1px solid #bbf7d0; padding-top: 12px; font-size: 14px; color: #374151; line-height: 1.8;">
        <strong>Name:</strong> ${esc(other.contactName)}<br>
        <strong>Email:</strong> <a href="mailto:${esc(other.contactEmail)}" style="color: #4f46e5;">${esc(other.contactEmail)}</a><br>
        ${other.contactPhone ? `<strong>Phone:</strong> ${esc(other.contactPhone)}<br>` : ''}
        ${other.contactCity  ? `<strong>City:</strong> ${esc(other.contactCity)}<br>`   : ''}
      </div>
    </div>

    <p style="color: #94a3b8; font-size: 13px; margin: 32px 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
      The Well of Wishes team 💙
    </p>
  </div>
</body>
</html>`
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
