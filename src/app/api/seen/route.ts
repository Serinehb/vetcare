import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* GET /api/seen?admin=Nom&scope=client_thread:email@x.com
   Renvoie la date à laquelle cet admin a ouvert ce fil pour la dernière
   fois (ou null s'il ne l'a jamais ouvert). */
export async function GET(req: NextRequest) {
  const adminName = req.nextUrl.searchParams.get("admin");
  const scope = req.nextUrl.searchParams.get("scope");
  if (!adminName || !scope) {
    return NextResponse.json({ error: "admin et scope requis" }, { status: 400 });
  }

  const admin = await prisma.admin.findFirst({ where: { name: adminName } });
  if (!admin) return NextResponse.json({ seenAt: null });

  const marker = await prisma.seenMarker.findUnique({
    where: { adminId_scope: { adminId: admin.id, scope } },
  });
  return NextResponse.json({ seenAt: marker?.seenAt ?? null });
}

/* POST /api/seen — { adminName, scope } marque le fil comme lu maintenant. */
export async function POST(req: NextRequest) {
  const { adminName, scope } = await req.json();
  if (!adminName || !scope) {
    return NextResponse.json({ error: "adminName et scope requis" }, { status: 400 });
  }

  const admin = await prisma.admin.findFirst({ where: { name: adminName } });
  if (!admin) return NextResponse.json({ error: "Admin introuvable" }, { status: 404 });

  const marker = await prisma.seenMarker.upsert({
    where: { adminId_scope: { adminId: admin.id, scope } },
    update: { seenAt: new Date() },
    create: { adminId: admin.id, scope },
  });

  return NextResponse.json(marker);
}
