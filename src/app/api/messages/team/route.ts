import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* GET /api/messages/team?a=NomA&b=NomB — fil de discussion entre deux
   membres de l'équipe (peu importe l'ordre a/b). */
export async function GET(req: NextRequest) {
  const a = req.nextUrl.searchParams.get("a");
  const b = req.nextUrl.searchParams.get("b");
  if (!a || !b) return NextResponse.json({ error: "a et b requis" }, { status: 400 });

  const messages = await prisma.teamMessage.findMany({
    where: {
      OR: [
        { authorName: a, toName: b },
        { authorName: b, toName: a },
      ],
    },
    orderBy: { at: "asc" },
  });
  return NextResponse.json(messages);
}

/* POST /api/messages/team — { fromName, toName, text } */
export async function POST(req: NextRequest) {
  const { fromName, toName, text } = await req.json();
  const author = await prisma.admin.findFirst({ where: { name: fromName } });
  if (!author) return NextResponse.json({ error: "Admin introuvable" }, { status: 404 });

  const message = await prisma.teamMessage.create({
    data: { authorId: author.id, authorName: fromName, toName, text },
  });
  return NextResponse.json(message, { status: 201 });
}
