import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDbOutage, fallbackGetClient, fallbackUpdateClient, fallbackDeleteClient } from "@/lib/db-fallback";

type Params = { params: Promise<{ email: string }> };

/* GET /api/clients/[email] — fiche complète d'un client (espace client).
   MySQL d'abord ; si la base est injoignable → store de secours. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { email } = await params;
  const decoded = decodeURIComponent(email);
  try {
    const client = await prisma.client.findUnique({
      where: { email: decoded },
      include: { appointments: true, messages: { orderBy: { at: "asc" } } },
    });
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    return NextResponse.json(client);
  } catch (err) {
    if (!isDbOutage(err)) throw err;
    const client = fallbackGetClient(decoded);
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    return NextResponse.json({ ...client, appointments: [], messages: [] });
  }
}

/* PATCH /api/clients/[email] — mise à jour partielle (coordonnées, fiche
   animal, réassignation de vétérinaire, dernière vue des messages…).
   Upsert : si le client n'existe pas encore en base (ex: compte créé
   avant le branchement DB), il est créé avec les champs fournis au lieu
   de crasher — c'est ce qui permet à la fiche animal de toujours
   s'enregistrer. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { email } = await params;
  const decoded = decodeURIComponent(email);
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

  try {
    const updated = await prisma.client.upsert({
      where: { email: decoded },
      update: data,
      create: {
        email: decoded,
        name: (data.name as string) || decoded.split("@")[0],
        ...data,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (!isDbOutage(err)) throw err;
    const serialized: Record<string, unknown> = { ...data };
    if (serialized.assignedVetAt instanceof Date) {
      serialized.assignedVetAt = serialized.assignedVetAt.toISOString();
    }
    if (serialized.lastSeenMessagesAt instanceof Date) {
      serialized.lastSeenMessagesAt = serialized.lastSeenMessagesAt.toISOString();
    }
    const client = fallbackUpdateClient(decoded, serialized);
    return NextResponse.json(client);
  }
}

/* DELETE /api/clients/[email] — supprime le client (ligne "Clients" admin) */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { email } = await params;
  const decoded = decodeURIComponent(email);
  try {
    await prisma.client.delete({ where: { email: decoded } });
  } catch (err) {
    if (isDbOutage(err)) {
      fallbackDeleteClient(decoded);
      return NextResponse.json({ success: true });
    }
    throw err;
  }
  return NextResponse.json({ success: true });
}
