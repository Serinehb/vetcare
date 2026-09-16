import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ email: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { email } = await params;
  const s = await prisma.stagiaire.findUnique({
    where: { email: decodeURIComponent(email) },
    include: { messages: { orderBy: { at: "asc" } } },
  });
  if (!s) return NextResponse.json([]);
  return NextResponse.json(s.messages);
}

/* POST — from: "stagiaire" (côté stagiaire) ou "equipe" (côté admin) */
export async function POST(req: NextRequest, { params }: Params) {
  const { email } = await params;
  const body = await req.json();
  const { from, author, text } = body as { from: "stagiaire" | "equipe"; author: string; text: string };

  const s = await prisma.stagiaire.findUnique({ where: { email: decodeURIComponent(email) } });
  if (!s) return NextResponse.json({ error: "Stagiaire introuvable" }, { status: 404 });

  const message = await prisma.internMessage.create({
    data: { stagiaireId: s.id, from, author, text },
  });

  return NextResponse.json(message, { status: 201 });
}
