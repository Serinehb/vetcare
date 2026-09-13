import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailNotification, emailTemplate, ADMIN_EMAIL } from "@/lib/email";

/* GET /api/appointments?clientEmail=... — tous les RDV, ou ceux d'un
   client précis si clientEmail est fourni. */
export async function GET(req: NextRequest) {
  const clientEmail = req.nextUrl.searchParams.get("clientEmail");
  const appointments = await prisma.appointment.findMany({
    where: clientEmail ? { client: { email: clientEmail } } : undefined,
    orderBy: { date: "asc" },
    include: { client: { select: { email: true } } },
  });
  return NextResponse.json(appointments);
}

/* POST /api/appointments — réservation d'un nouveau créneau (espace client).
   Envoie l'email de confirmation au client + notification à l'admin. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientEmail, clientName, pet, date, time, reason, vet } = body as {
    clientEmail: string;
    clientName: string;
    pet?: string;
    date: string;
    time: string;
    reason: string;
    vet: string;
  };

  const client = await prisma.client.findUnique({ where: { email: clientEmail } });
  if (!client) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  const appointment = await prisma.appointment.create({
    data: {
      clientId: client.id,
      clientName,
      pet,
      date: new Date(date),
      time,
      reason,
      vet,
      status: "à venir",
    },
  });

  await sendEmailNotification(
    clientEmail,
    "Rendez-vous confirmé — VetCare",
    emailTemplate(
      "Rendez-vous confirmé",
      `Bonjour ${clientName},<br/>Votre rendez-vous du <b>${date}</b> à <b>${time}</b> avec ${vet} (${reason}) est confirmé.`
    )
  );
  await sendEmailNotification(
    ADMIN_EMAIL,
    "Nouveau rendez-vous réservé — VetCare",
    emailTemplate(
      "Nouveau rendez-vous",
      `<b>${clientName}</b> a réservé un rendez-vous le ${date} à ${time} avec ${vet}.`
    )
  );

  return NextResponse.json(appointment, { status: 201 });
}
