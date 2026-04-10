import { Resend } from 'resend'

export interface WishOwner {
  wishId:          string
  wishText:        string
  contactName:     string
  contactEmail:    string
  opportunityText?: string | null   // personalised opportunity from connection_enrichment
  sharedBasisText?: string | null   // shared_basis.he from connection_enrichment
}

export interface ConnectionMeta {
  overallScore?: number | null      // overall_connection_score (0–100)
}

/**
 * Sends a connection notification to both wish owners.
 * Each recipient sees their own wish + the matching wish, personalised opportunity
 * text, shared basis, and a CTA button to review and confirm the connection.
 * Personal details of the other side are NOT revealed — they are disclosed only
 * after mutual acceptance via the double opt-in flow.
 */
export async function sendConnectionEmail(
  ownerA: WishOwner,
  ownerB: WishOwner,
  meta: ConnectionMeta = {},
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[sendConnectionEmail] RESEND_API_KEY is not set — skipping email')
    return
  }
  const resend  = new Resend(apiKey)
  const addr    = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
  const FROM    = `באר המשאלות <${addr}>`
  const appUrl  = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  const [resA, resB] = await Promise.all([
    resend.emails.send({
      from:    FROM,
      to:      ownerA.contactEmail,
      subject: '🎉 מצאנו התאמה למשאלה שלך!',
      html:    buildHtml(ownerA, ownerB, meta, appUrl),
    }),
    resend.emails.send({
      from:    FROM,
      to:      ownerB.contactEmail,
      subject: '🎉 מצאנו התאמה למשאלה שלך!',
      html:    buildHtml(ownerB, ownerA, meta, appUrl),
    }),
  ])

  if (resA.error) throw new Error(`Resend (A): ${resA.error.message}`)
  if (resB.error) throw new Error(`Resend (B): ${resB.error.message}`)
  console.log(`[email] Resend IDs: A=${resA.data?.id} B=${resB.data?.id}`)
}

function buildHtml(
  recipient: WishOwner,
  other: WishOwner,
  meta: ConnectionMeta,
  appUrl: string,
): string {
  const wishUrl = `${appUrl}/wishes/${recipient.wishId}`

  const scoreLine = meta.overallScore != null
    ? `<p style="display:inline-block; background:#eef2ff; color:#4f46e5; font-weight:700; font-size:15px; padding:6px 14px; border-radius:20px; margin:0 0 20px;">
        ציון התאמה: ${meta.overallScore}/100
       </p>`
    : ''

  const opportunityBlock = recipient.opportunityText
    ? `<div style="background:#fefce8; border-left:4px solid #eab308; border-radius:6px; padding:16px 20px; margin:20px 0;">
        <div style="font-size:11px; text-transform:uppercase; color:#92400e; letter-spacing:0.05em; margin-bottom:8px; font-weight:700;">למה זה רלוונטי עבורך</div>
        <p style="color:#1e293b; font-size:14px; margin:0; line-height:1.7;">${esc(recipient.opportunityText)}</p>
       </div>`
    : ''

  const sharedBasisBlock = recipient.sharedBasisText
    ? `<div style="background:#f0f9ff; border-left:4px solid #38bdf8; border-radius:6px; padding:14px 20px; margin:16px 0;">
        <div style="font-size:11px; text-transform:uppercase; color:#0369a1; letter-spacing:0.05em; margin-bottom:6px; font-weight:700;">מה משותף לכם</div>
        <p style="color:#1e293b; font-size:14px; margin:0; line-height:1.7;">${esc(recipient.sharedBasisText)}</p>
       </div>`
    : ''

  const greeting = recipient.contactName
    ? `שלום ${esc(recipient.contactName)},`
    : 'שלום,'

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8" /></head>
<body style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px; direction: rtl; text-align: right;">
  <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">

    <h1 style="color: #4f46e5; font-size: 24px; margin: 0 0 8px;">🎉 מצאנו הדהוד למשאלה שלך!</h1>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">${greeting}<br>
    מצאנו התאמה משמעותית בין המשאלה שלך למשאלה של מישהו אחר.</p>

    ${scoreLine}

    <div style="background: #eef2ff; border-radius: 8px; padding: 20px; margin: 16px 0;">
      <div style="font-size: 11px; text-transform: uppercase; color: #6366f1; letter-spacing: 0.05em; margin-bottom: 8px; font-weight: 600;">המשאלה שלך</div>
      <p style="color: #1e293b; font-size: 15px; margin: 0; line-height: 1.6;">${esc(recipient.wishText)}</p>
    </div>

    <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <div style="font-size: 11px; text-transform: uppercase; color: #16a34a; letter-spacing: 0.05em; margin-bottom: 8px; font-weight: 600;">המשאלה המהדהדת</div>
      <p style="color: #1e293b; font-size: 15px; margin: 0; line-height: 1.6;">${esc(other.wishText)}</p>
    </div>

    ${opportunityBlock}
    ${sharedBasisBlock}

    <div style="text-align: center; margin: 32px 0 24px;">
      <a href="${wishUrl}"
         style="display: inline-block; background: #4f46e5; color: white; font-size: 16px; font-weight: 700;
                padding: 14px 36px; border-radius: 10px; text-decoration: none; letter-spacing: 0.02em;">
        לאישור החיבור ←
      </a>
      <p style="color: #94a3b8; font-size: 12px; margin: 12px 0 0;">
        פרטי הקשר של הצד השני יוצגו רק לאחר שני הצדדים יאשרו את החיבור.
      </p>
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
