import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ email: string }> };

/* GET /api/clients/[email] — fiche complète d'un client (espace client) */
export async function GET(_req: NextRequest, { params }: Params) {
  const { email } = await params;
  const client = await prisma.client.findUnique({
    where: { email: decodeURIComponent(email) },
    include: { appointments: true, messages: { orderBy: { at: "asc" } } },
  });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  return NextResponse.json(client);
}

/* PATCH /api/clients/[email] — mise à jour partielle (coordonnées, fiche
   animal, réassignation de vétérinaire, dernière vue des messages…) */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { email } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  for (const key of [
    "name",
    "email",
    "phone",
    "pet",
    "petSpecies",
    "petBreed",
    "petGender",
    "petSterilized",
    "assignedVet",
    "assignedVetBy",
  ] as const) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.assignedVet !== undefined) data.assignedVetAt = new Date();
  if (body.lastSeenMessagesAt !== undefined) {
    data.lastSeenMessagesAt = new Date(body.lastSeenMessagesAt);
  }

  const updated = await prisma.client.update({
    where: { email: decodeURIComponent(email) },
    data,
  });
  return NextResponse.json(updated);
}

/* DELETE /api/clients/[email] — supprime le client (ligne "Clients" admin) */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { email } = await params;
  await prisma.client.delete({ where: { email: decodeURIComponent(email) } });
  return NextResponse.json({ success: true });
}
