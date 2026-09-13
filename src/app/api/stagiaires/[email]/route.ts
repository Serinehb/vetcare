import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailNotification, emailTemplate } from "@/lib/email";

type Params = { params: Promise<{ email: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { email } = await params;
  const s = await prisma.stagiaire.findUnique({
    where: { email: decodeURIComponent(email) },
    include: { messages: { orderBy: { at: "asc" } } },
  });
  if (!s) return NextResponse.json({ error: "Stagiaire introuvable" }, { status: 404 });
  return NextResponse.json(s);
}

/* PATCH /api/stagiaires/[email] — progression, statut, ou réaffectation
   du tuteur (la directrice notifie automatiquement le stagiaire). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { email } = await params;
  const decoded = decodeURIComponent(email);
  const body = await req.json();

  const data: Record<string, unknown> = {};
  for (const key of ["name", "phone", "school", "status", "progress"] as const) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  if (body.mentor !== undefined) {
    data.mentor = body.mentor;
    data.mentorAssignedBy = body.assignedBy;
    data.mentorAssignedAt = new Date();
  }

  const updated = await prisma.stagiaire.update({ where: { email: decoded }, data });

  if (body.mentor !== undefined && body.assignedBy) {
    await prisma.internMessage.create({
      data: {
        stagiaireId: updated.id,
        from: "equipe",
        author: "VetCare",
        text: `Vous avez été affecté(e) à ${body.mentor} par ${body.assignedBy}. Votre tuteur de stage est désormais ${body.mentor}.`,
      },
    });
    await sendEmailNotification(
      decoded,
      "Nouveau tuteur de stage — VetCare",
      emailTemplate(
        "Nouveau tuteur",
        `Votre tuteur de stage est désormais <b>${body.mentor}</b> (affecté par ${body.assignedBy}).`
      )
    );
  }

  return NextResponse.json(updated);
}
