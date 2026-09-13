/* ─── Email notifications ───
   Fire-and-forget helper: every space (client, admin, stagiaire) calls
   sendEmailNotification() whenever something worth emailing happens
   (new signup, new booking, upcoming reminder). It just posts to our
   own /api/send-email route, which does the real work server-side via
   Nodemailer + un compte Gmail (SMTP). */

export const ADMIN_EMAIL = "machattelolo9@gmail.com";

export async function sendEmailNotification(to: string | undefined, subject: string, html: string) {
  if (typeof window === "undefined" || !to) return;
  try {
    await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html }),
    });
  } catch (err) {
    // Never let an email failure break the actual user-facing action
    // (signup, booking…) that triggered it.
    console.error("[sendEmailNotification] échec de l'envoi:", err);
  }
}

/** Small shared wrapper so every email has the same VetCare branding. */
export function emailTemplate(title: string, bodyHtml: string) {
  return `
  <!DOCTYPE html>
  <html>
  <body style="margin:0; padding:0; background-color:#f2f6f5; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f6f5; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow: 0 4px 24px rgba(44,140,153,0.12);">
            <tr>
              <td style="background: linear-gradient(135deg, #2c8c99, #4dd0e1); padding: 28px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:22px;">🐾</td>
                    <td align="right" style="color:#ffffff; font-size:13px; letter-spacing:1px; text-transform:uppercase; font-weight:600;">VetCare</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <h1 style="margin:0 0 16px; font-size:21px; color:#1f636d; font-weight:700;">${title}</h1>
                <div style="font-size:15px; line-height:1.7; color:#3a4a4a;">${bodyHtml}</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px 28px;">
                <div style="height:1px; background:#eef2f2; margin-bottom:20px;"></div>
                <p style="margin:0; font-size:12px; color:#9aa8a8;">Cabinet Vétérinaire VetCare — cet email est automatique, merci de ne pas y répondre directement.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

/** Small helper to render a "fiche" (key/value table) inside an email —
    used for signup and booking notifications so the admin sees every
    detail at a glance instead of a single run-on sentence. */
export function emailInfoTable(rows: Array<[string, string]>) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px; border-collapse:collapse;">
      ${rows
        .map(
          ([label, value], i) => `
        <tr>
          <td style="padding:10px 12px; font-size:13px; color:#6b7a7a; background:${i % 2 === 0 ? "#f7fafa" : "#ffffff"}; border-bottom:1px solid #eef2f2; width:38%;">${label}</td>
          <td style="padding:10px 12px; font-size:14px; color:#233; background:${i % 2 === 0 ? "#f7fafa" : "#ffffff"}; border-bottom:1px solid #eef2f2; font-weight:600;">${value}</td>
        </tr>`
        )
        .join("")}
    </table>
  `;
}
