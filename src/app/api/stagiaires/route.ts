import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailNotification, emailTemplate, ADMIN_EMAIL } from "@/lib/email";
import {
  isDbOutage,
  fallbackListStagiaires,
  fallbackUpsertStagiaire,
} from "@/lib/db-fallback";

/* GET /api/stagiaires — liste pour le tableau de bord admin.
   MySQL d'abord ; si la base est injoignable → store de secours JSON. */
export async function GET() {
  try {
    const stagiaires = await prisma.stagiaire.findMany({ orderBy: { joinedAt: "desc" } });
    return NextResponse.json(stagiaires);
  } catch (err) {
    if (!isDbOutage(err)) throw err;
    return NextResponse.json(fallbackListStagiaires());
  }
}

/* POST /api/stagiaires — inscription ou mise à jour d'un stagiaire.
   Équivalent de registerStagiaireForAdmin(). */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, school, motivation, mentor, startDate, endDate } = body as {
    name: string;
    email: string;
    phone?: string;
    school?: string;
    motivation?: string;
    mentor: string;
    startDate: string;
    endDate: string;
  };

  if (!name || !email || !startDate || !endDate) {
    return NextResponse.json(
      { error: "name, email, startDate, endDate requis" },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.stagiaire.findUnique({ where: { email } });
    const data = {
      name,
      phone,
      school,
      motivation,
      mentor,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };

    if (existing) {
      const updated = await prisma.stagiaire.update({ where: { email }, data });
      return NextResponse.json({ stagiaire: updated, isNew: false });
    }

    const created = await prisma.stagiaire.create({ data: { ...data, email } });

    await sendEmailNotification(
      email,
      "Bienvenue chez VetCare 🐾",
      emailTemplate(
        "Bienvenue !",
        `Bonjour ${name},<br/>Votre compte stagiaire VetCare vient d'être créé. Votre tuteur est <b>${mentor}</b>, stage du ${startDate} au ${endDate}.`
      )
    );
    await sendEmailNotification(
      ADMIN_EMAIL,
      "Nouvelle inscription stagiaire — VetCare",
      emailTemplate(
        "Nouveau stagiaire",
        `<b>${name}</b> (${email}) vient de s'inscrire comme stagiaire, tuteur : ${mentor}.`
      )
    );

    return NextResponse.json({ stagiaire: created, isNew: true }, { status: 201 });
  } catch (err) {
    if (!isDbOutage(err)) throw err;
    /* Base injoignable : store de secours JSON (persistant sur le
       serveur). Les e-mails de bienvenue sont envoyés en best-effort. */
    const created = fallbackUpsertStagiaire({
      name,
      email,
      phone: phone ?? null,
      school: school ?? null,
      motivation: motivation ?? null,
      mentor,
      startDate,
      endDate,
    });
    void sendEmailNotification(
      email,
      "Bienvenue chez VetCare 🐾",
      emailTemplate(
        "Bienvenue !",
        `Bonjour ${name},<br/>Votre compte stagiaire VetCare vient d'être créé. Votre tuteur est <b>${mentor}</b>, stage du ${startDate} au ${endDate}.`
      )
    ).catch(() => {});
    void sendEmailNotification(
      ADMIN_EMAIL,
      "Nouvelle inscription stagiaire — VetCare",
      emailTemplate(
        "Nouveau stagiaire",
        `<b>${name}</b> (${email}) vient de s'inscrire comme stagiaire, tuteur : ${mentor}.`
      )
    ).catch(() => {});
    return NextResponse.json(
      { stagiaire: created, isNew: true },
      { status: 201 }
    );
  }
}
