import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

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
  await Promise.all([
    resend.emails.send({
      from:    FROM,
      to:      ownerA.contactEmail,
      subject: '🎉 מצאנו הדהוד למשאלה שלך!',
      html:    buildHtml(ownerA, ownerB),
    }),
    resend.emails.send({
      from:    FROM,
      to:      ownerB.contactEmail,
      subject: '🎉 מצאנו הדהוד למשאלה שלך!',
      html:    buildHtml(ownerB, ownerA),
    }),
  ])
}

function buildHtml(recipient: WishOwner, other: WishOwner): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8" /></head>
<body style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px; direction: rtl; text-align: right;">
  <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">

    <h1 style="color: #4f46e5; font-size: 24px; margin: 0 0 8px;">🎉 מצאנו הדהוד!</h1>
    <p style="color: #475569; font-size: 16px; line-height: 1.6;">שלום ${esc(recipient.contactName)},<br>
    מצאנו התאמה בין המשאלה שלך לבין משאלה של אדם אחר. הנה הפרטים:</p>

    <div style="background: #eef2ff; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <div style="font-size: 11px; text-transform: uppercase; color: #6366f1; letter-spacing: 0.05em; margin-bottom: 8px; font-weight: 600;">המשאלה שלך</div>
      <p style="color: #1e293b; font-size: 15px; margin: 0; line-height: 1.6;">${esc(recipient.wishText)}</p>
    </div>

    <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <div style="font-size: 11px; text-transform: uppercase; color: #16a34a; letter-spacing: 0.05em; margin-bottom: 8px; font-weight: 600;">המשאלה התואמת</div>
      <p style="color: #1e293b; font-size: 15px; margin: 0 0 16px; line-height: 1.6;">${esc(other.wishText)}</p>
      <div style="border-top: 1px solid #bbf7d0; padding-top: 12px; font-size: 14px; color: #374151; line-height: 1.8;">
        <strong>שם:</strong> ${esc(other.contactName)}<br>
        <strong>אימייל:</strong> <a href="mailto:${esc(other.contactEmail)}" style="color: #4f46e5;">${esc(other.contactEmail)}</a><br>
        ${other.contactPhone ? `<strong>טלפון:</strong> ${esc(other.contactPhone)}<br>` : ''}
        ${other.contactCity  ? `<strong>עיר:</strong> ${esc(other.contactCity)}<br>`   : ''}
      </div>
    </div>

    <p style="color: #94a3b8; font-size: 13px; margin: 32px 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
      צוות באר המשאלות 💙
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
