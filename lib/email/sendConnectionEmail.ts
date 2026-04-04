import { Resend } from 'resend'

export interface WishOwner {
  wishText:        string
  contactName:     string
  contactEmail:    string
  contactPhone:    string | null
  contactCity:     string | null
  opportunityText?: string | null   // personalised opportunity from connection_enrichment
  sharedBasisText?: string | null   // shared_basis.en from connection_enrichment
  theirNeeds?:     string[]         // other side's needs from wish_enrichment
  theirSkills?:    string[]         // other side's skills_offered from wish_enrichment
}

export interface ConnectionMeta {
  overallScore?: number | null      // overall_connection_score (0–100)
}

/**
 * Sends a joyful connection notification to both wish owners.
 * Each recipient sees their own wish + the other's wish, personalised opportunity
 * text, shared basis, and the other person's contact details.
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
  const resend = new Resend(apiKey)
  const addr   = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
  const FROM   = `Well of Wishes <${addr}>`

  const [resA, resB] = await Promise.all([
    resend.emails.send({
      from:    FROM,
      to:      ownerA.contactEmail,
      subject: '🎉 We found a match for your wish!',
      html:    buildHtml(ownerA, ownerB, meta),
    }),
    resend.emails.send({
      from:    FROM,
      to:      ownerB.contactEmail,
      subject: '🎉 We found a match for your wish!',
      html:    buildHtml(ownerB, ownerA, meta),
    }),
  ])

  if (resA.error) throw new Error(`Resend (A): ${resA.error.message}`)
  if (resB.error) throw new Error(`Resend (B): ${resB.error.message}`)
  console.log(`[email] Resend IDs: A=${resA.data?.id} B=${resB.data?.id}`)
}

function buildHtml(recipient: WishOwner, other: WishOwner, meta: ConnectionMeta): string {
  const scoreLine = meta.overallScore != null
    ? `<p style="display:inline-block; background:#eef2ff; color:#4f46e5; font-weight:700; font-size:15px; padding:6px 14px; border-radius:20px; margin:0 0 20px;">
        Connection score: ${meta.overallScore}/100
       </p>`
    : ''

  const opportunityBlock = recipient.opportunityText
    ? `<div style="background:#fefce8; border-left:4px solid #eab308; border-radius:6px; padding:16px 20px; margin:20px 0;">
        <div style="font-size:11px; text-transform:uppercase; color:#92400e; letter-spacing:0.05em; margin-bottom:8px; font-weight:700;">Why this could matter for you</div>
        <p style="color:#1e293b; font-size:14px; margin:0; line-height:1.7;">${esc(recipient.opportunityText)}</p>
       </div>`
    : ''

  const sharedBasisBlock = recipient.sharedBasisText
    ? `<div style="background:#f0f9ff; border-left:4px solid #38bdf8; border-radius:6px; padding:14px 20px; margin:16px 0;">
        <div style="font-size:11px; text-transform:uppercase; color:#0369a1; letter-spacing:0.05em; margin-bottom:6px; font-weight:700;">What you share</div>
        <p style="color:#1e293b; font-size:14px; margin:0; line-height:1.7;">${esc(recipient.sharedBasisText)}</p>
       </div>`
    : ''

  const theirNeedsSkills = buildNeedsSkillsTags(other.theirNeeds, other.theirSkills)

  return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head><meta charset="UTF-8" /></head>
<body style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px; direction: ltr; text-align: left;">
  <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">

    <h1 style="color: #4f46e5; font-size: 24px; margin: 0 0 8px;">🎉 We found a resonance!</h1>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">Hi ${esc(recipient.contactName)},<br>
    We found a meaningful match between your wish and someone else's.</p>

    ${scoreLine}

    <div style="background: #eef2ff; border-radius: 8px; padding: 20px; margin: 16px 0;">
      <div style="font-size: 11px; text-transform: uppercase; color: #6366f1; letter-spacing: 0.05em; margin-bottom: 8px; font-weight: 600;">Your wish</div>
      <p style="color: #1e293b; font-size: 15px; margin: 0; line-height: 1.6;">${esc(recipient.wishText)}</p>
    </div>

    ${opportunityBlock}
    ${sharedBasisBlock}

    <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <div style="font-size: 11px; text-transform: uppercase; color: #16a34a; letter-spacing: 0.05em; margin-bottom: 8px; font-weight: 600;">Matching wish</div>
      <p style="color: #1e293b; font-size: 15px; margin: 0 0 16px; line-height: 1.6;">${esc(other.wishText)}</p>
      ${theirNeedsSkills}
      <div style="border-top: 1px solid #bbf7d0; padding-top: 14px; font-size: 14px; color: #374151; line-height: 1.8;">
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

function buildNeedsSkillsTags(needs: string[] | undefined, skills: string[] | undefined): string {
  const parts: string[] = []
  if (needs && needs.length > 0) {
    parts.push(
      `<div style="margin-bottom:10px;">
        <span style="font-size:11px; text-transform:uppercase; color:#374151; font-weight:700; letter-spacing:0.04em;">Needs: </span>
        ${needs.map(t => `<span style="display:inline-block; background:#f1f5f9; color:#475569; font-size:12px; padding:2px 9px; border-radius:12px; margin:2px 2px 2px 0;">${esc(t)}</span>`).join('')}
       </div>`
    )
  }
  if (skills && skills.length > 0) {
    parts.push(
      `<div style="margin-bottom:12px;">
        <span style="font-size:11px; text-transform:uppercase; color:#374151; font-weight:700; letter-spacing:0.04em;">Offers: </span>
        ${skills.map(t => `<span style="display:inline-block; background:#f0fdf4; color:#15803d; font-size:12px; padding:2px 9px; border-radius:12px; margin:2px 2px 2px 0;">${esc(t)}</span>`).join('')}
       </div>`
    )
  }
  return parts.join('')
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
