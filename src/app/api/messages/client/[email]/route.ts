import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ email: string }> };

/* GET /api/messages/client/[email] — tout le fil de discussion d'un client */
export async function GET(_req: NextRequest, { params }: Params) {
  const { email } = await params;
  const client = await prisma.client.findUnique({
    where: { email: decodeURIComponent(email) },
    include: { messages: { orderBy: { at: "asc" } } },
  });
  if (!client) return NextResponse.json([]);
  return NextResponse.json(client.messages);
}

/* POST /api/messages/client/[email] — envoi d'un message, côté client
   (from: "user") ou côté équipe (from: "team", avec withVet précisé). */
export async function POST(req: NextRequest, { params }: Params) {
  const { email } = await params;
  const body = await req.json();
  const { from, author, text, withVet } = body as {
    from: "user" | "team";
    author: string;
    text: string;
    withVet: string;
  };

  const client = await prisma.client.findUnique({ where: { email: decodeURIComponent(email) } });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  const message = await prisma.clientMessage.create({
    data: { clientId: client.id, from, author, text, withVet },
  });

  return NextResponse.json(message, { status: 201 });
}
