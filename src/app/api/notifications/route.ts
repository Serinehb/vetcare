import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* GET /api/notifications?admin=NomAdmin — nouvelles inscriptions client
   pas encore "dismiss" par cet admin (voir POST /api/notifications/dismiss). */
export async function GET(req: NextRequest) {
  const adminName = req.nextUrl.searchParams.get("admin");
  if (!adminName) return NextResponse.json({ error: "admin requis" }, { status: 400 });

  const admin = await prisma.admin.findFirst({ where: { name: adminName } });
  const dismissed = admin
    ? new Set((await prisma.dismissedNotification.findMany({ where: { adminId: admin.id } })).map((d) => d.notifId))
    : new Set<string>();

  const notifs = await prisma.newClientNotification.findMany({ orderBy: { at: "desc" }, take: 50 });
  const unseen = notifs.filter((n) => !dismissed.has(`newclient_${n.email.toLowerCase()}_${n.at.toISOString()}`));

  return NextResponse.json(unseen);
}

/* POST /api/notifications/dismiss — { adminName, notifId }
   Marque UNE notification comme lue pour cet admin (clic individuel). */
export async function POST(req: NextRequest) {
  const { adminName, notifId } = await req.json();
  if (!adminName || !notifId) {
    return NextResponse.json({ error: "adminName et notifId requis" }, { status: 400 });
  }

  const admin = await prisma.admin.findFirst({ where: { name: adminName } });
  if (!admin) return NextResponse.json({ error: "Admin introuvable" }, { status: 404 });

  await prisma.dismissedNotification.upsert({
    where: { adminId_notifId: { adminId: admin.id, notifId } },
    update: {},
    create: { adminId: admin.id, notifId },
  });

  return NextResponse.json({ success: true });
}
