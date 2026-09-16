import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailNotification, emailTemplate, ADMIN_EMAIL } from "@/lib/email";
import {
  isDbOutage,
  fallbackListClients,
  fallbackGetClient,
  fallbackUpsertClient,
} from "@/lib/db-fallback";

/* GET /api/clients — liste complète pour le tableau de bord admin.
   MySQL d'abord ; si la base est injoignable → store de secours. */
export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { joinedAt: "desc" },
      include: { _count: { select: { appointments: true } } },
    });
    const shaped = clients.map((c) => ({
      name: c.name,
      email: c.email,
      phone: c.phone ?? undefined,
      pet: c.pet ?? undefined,
      petSpecies: c.petSpecies ?? undefined,
      assignedVet: c.assignedVet ?? undefined,
      joinedAt: c.joinedAt.toISOString(),
      appointmentCount: c._count.appointments,
    }));
    return NextResponse.json(shaped);
  } catch (err) {
    if (!isDbOutage(err)) throw err;
    const shaped = fallbackListClients().map((c) => ({
      name: c.name,
      email: c.email,
      phone: c.phone ?? undefined,
      pet: c.pet ?? undefined,
      petSpecies: c.petSpecies ?? undefined,
      assignedVet: c.assignedVet ?? undefined,
      joinedAt: c.joinedAt,
      appointmentCount: 0,
    }));
    return NextResponse.json(shaped);
  }
}

/* POST /api/clients — inscription ou mise à jour d'un client existant.
   Équivalent de registerClientForAdmin() dans l'ancien admin.ts. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, pet, petSpecies, assignedVet } = body as {
    name: string;
    email: string;
    phone?: string;
    pet?: string;
    petSpecies?: string;
    assignedVet: string;
  };

  if (!name || !email) {
    return NextResponse.json({ error: "name et email requis" }, { status: 400 });
  }

  try {
    const existing = await prisma.client.findUnique({ where: { email } });

    if (existing) {
      const updated = await prisma.client.update({
        where: { email },
        data: {
          name,
          phone: phone || existing.phone,
          pet: pet || existing.pet,
          petSpecies: petSpecies || existing.petSpecies,
          assignedVet,
        },
      });
      return NextResponse.json({ client: updated, isNew: false });
    }

    const created = await prisma.client.create({
      data: { name, email, phone, pet, petSpecies, assignedVet },
    });

    await prisma.newClientNotification.create({ data: { name, email } });

    await sendEmailNotification(
      email,
      "Bienvenue chez VetCare 🐾",
      emailTemplate(
        "Bienvenue !",
        `Bonjour ${name},<br/>Votre compte client VetCare vient d'être créé. Vous pouvez dès maintenant prendre rendez-vous pour votre animal depuis votre espace.`
      )
    );
    await sendEmailNotification(
      ADMIN_EMAIL,
      "Nouvelle inscription client — VetCare",
      emailTemplate(
        "Nouvelle inscription",
        `<b>${name}</b> (${email}) vient de créer un compte client, référent : ${assignedVet}.`
      )
    );

    return NextResponse.json({ client: created, isNew: true }, { status: 201 });
  } catch (err) {
    if (!isDbOutage(err)) throw err;

    /* ── Base injoignable : store de secours (même contrat de réponse) ── */
    const existing = fallbackGetClient(email);
    const client = fallbackUpsertClient({
      email,
      name,
      phone: phone ?? undefined,
      pet: pet ?? undefined,
      petSpecies: petSpecies ?? undefined,
      assignedVet: assignedVet ?? undefined,
    });

    if (!existing) {
      sendEmailNotification(
        email,
        "Bienvenue chez VetCare 🐾",
        emailTemplate(
          "Bienvenue !",
          `Bonjour ${name},<br/>Votre compte client VetCare vient d'être créé. Vous pouvez dès maintenant prendre rendez-vous pour votre animal depuis votre espace.`
        )
      ).catch(() => {});
      sendEmailNotification(
        ADMIN_EMAIL,
        "Nouvelle inscription client — VetCare",
        emailTemplate(
          "Nouvelle inscription",
          `<b>${name}</b> (${email}) vient de créer un compte client, référent : ${assignedVet}.`
        )
      ).catch(() => {});
      return NextResponse.json({ client, isNew: true }, { status: 201 });
    }

    return NextResponse.json({ client, isNew: false });
  }
}
