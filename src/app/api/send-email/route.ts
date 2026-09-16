import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

/* ─── /api/send-email ───
   Route serveur qui envoie réellement les emails via Nodemailer, avec
   une config SMTP générique (pas figée sur Gmail) — pour pouvoir passer
   plus tard à un vrai service transactionnel (Brevo, Mailgun, SendGrid…)
   juste en changeant .env, sans toucher au code.

   Configuration Gmail (par défaut, gratuit) — voir README-EMAIL.md :
   1. Active la validation en 2 étapes sur le compte Gmail expéditeur.
   2. Crée un "mot de passe d'application" :
        https://myaccount.google.com/apppasswords
   3. Mets ces variables dans .env.local :
        SMTP_HOST=smtp.gmail.com
        SMTP_PORT=587
        SMTP_USER=machattelolo9@gmail.com
        SMTP_PASS=xxxxxxxxxxxxxxxx   (le mot de passe d'application, 16 caractères, sans espaces)
        SMTP_FROM=machattelolo9@gmail.com
   4. Redémarre `npm run dev`.

   Pour passer plus tard à un service pro avec domaine vérifié (recommandé
   pour ne JAMAIS finir en spam, même au premier envoi — voir README-EMAIL.md) :
   change juste SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM avec les
   identifiants fournis par ce service. Rien d'autre à modifier.

   Tant que les identifiants SMTP ne sont pas configurés, cette route se
   contente de logger ce qui *aurait* été envoyé et renvoie
   { skipped: true } — l'app continue de fonctionner normalement. */

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true pour le port 465, false pour les autres (STARTTLS, dont Gmail sur 587)
      auth: { user, pass },
    });
  }
  return cachedTransporter;
}

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Champs manquants : to, subject et html sont requis." },
        { status: 400 }
      );
    }

    const transporter = getTransporter();
    if (!transporter) {
      console.warn(
        `[send-email] SMTP_HOST / SMTP_USER / SMTP_PASS absentes — email NON envoyé (to: ${to}, subject: "${subject}"). Voir README-EMAIL.md.`
      );
      return NextResponse.json({ skipped: true, reason: "Identifiants SMTP manquants" });
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const info = await transporter.sendMail({
      from: `VetCare <${from}>`,
      to,
      subject,
      html,
      text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });

    return NextResponse.json({ success: true, id: info.messageId });
  } catch (err) {
    console.error("[send-email] erreur inattendue:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
