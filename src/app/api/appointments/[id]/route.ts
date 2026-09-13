import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/* PATCH /api/appointments/[id] — changement de statut (annulé côté
   client, ou terminé/annulé côté admin). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { status } = await req.json();
  const updated = await prisma.appointment.update({
    where: { id },
    data: { status },
  });
  return NextResponse.json(updated);
}
