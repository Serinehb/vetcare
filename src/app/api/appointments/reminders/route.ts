import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailNotification, emailTemplate, ADMIN_EMAIL } from "@/lib/email";

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000; // rappelle une fois dans les 24h avant le RDV

/* POST /api/appointments/reminders — équivalent de
   checkAndSendAppointmentReminders(). Appelé à l'ouverture de chaque
   espace (client / admin / stagiaire) ; envoie un email de rappel au
   client, à l'admin, et à tous les stagiaires pour chaque RDV qui
   tombe dans les 24h et n'a pas déjà été rappelé. */
export async function POST() {
  const now = Date.now();
  const upcoming = await prisma.appointment.findMany({
    where: { status: "à venir", reminderSent: false },
    include: { client: { select: { email: true } } },
  });

  const stagiaires = await prisma.stagiaire.findMany({ select: { email: true } });
  let sent = 0;

  for (const a of upcoming) {
    const when = new Date(`${a.date.toISOString().slice(0, 10)}T${a.time || "00:00"}`).getTime();
    if (isNaN(when) || when < now || when - now > REMINDER_WINDOW_MS) continue;

    await sendEmailNotification(
      a.client.email,
      "Rappel : votre rendez-vous approche — VetCare",
      emailTemplate(
        "Votre rendez-vous approche",
        `Bonjour ${a.clientName},<br/>Petit rappel : vous avez rendez-vous le <b>${a.date.toISOString().slice(0, 10)}</b> à <b>${a.time}</b> avec ${a.vet}${a.pet ? ` pour ${a.pet}` : ""}.`
      )
    );
    await sendEmailNotification(
      ADMIN_EMAIL,
      "Rappel : rendez-vous à venir — VetCare",
      emailTemplate(
        "Rendez-vous à venir",
        `Rappel : <b>${a.clientName}</b> a rendez-vous le ${a.date.toISOString().slice(0, 10)} à ${a.time} avec ${a.vet}.`
      )
    );
    for (const s of stagiaires) {
      await sendEmailNotification(
        s.email,
        "Rappel : rendez-vous à venir — VetCare",
        emailTemplate(
          "Rendez-vous à venir",
          `Pour information : ${a.clientName} a rendez-vous le ${a.date.toISOString().slice(0, 10)} à ${a.time} avec ${a.vet}.`
        )
      );
    }

    await prisma.appointment.update({ where: { id: a.id }, data: { reminderSent: true } });
    sent++;
  }

  return NextResponse.json({ remindersSent: sent });
}
