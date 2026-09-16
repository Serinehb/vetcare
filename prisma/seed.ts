/* ─── Seed initial ───
   Remplit la base avec l'équipe admin (3 comptes) + quelques clients de
   démo, l'équivalent de ADMIN_TEAM / DEMO_CLIENTS qui étaient codés en
   dur dans admin.ts. À lancer une fois avec : npx prisma db seed */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── Équipe (vétérinaires / staff) ──
  // Les mots de passe sont hashés avec bcryptjs avant d'être stockés —
  // plus aucun mot de passe en clair en base, contrairement à l'ancien
  // tableau ADMIN_TEAM codé en dur dans admin.ts.
  const rawPassword = "VetCare@2024";
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const team = [
    {
      name: "Dr. Sophie Martin",
      role: "Directrice & Chirurgienne",
      adminRole: "directrice",
      img: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      email: "sophie.martin@vetcare.com",
      password: hashedPassword,
    },
    {
      name: "Dr. Lucas Bernard",
      role: "Vétérinaire Comportementaliste",
      adminRole: "vétérinaire",
      img: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      email: "lucas.bernard@vetcare.com",
      password: hashedPassword,
    },
    {
      name: "Camille Petit",
      role: "Assistante Vétérinaire",
      adminRole: "assistante",
      img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      email: "camille.petit@vetcare.com",
      password: hashedPassword,
    },
  ];

  for (const member of team) {
    await prisma.admin.upsert({
      where: { email: member.email },
      update: {},
      create: member,
    });
  }

  // ── Clients de démo (mêmes que DEMO_CLIENTS) ──
  const demoClients = [
    {
      name: "Thomas Lefebvre",
      email: "thomas.lefebvre@example.com",
      phone: "0661 23 45 67",
      pet: "Chien - Labrador",
      petSpecies: "Chien",
      assignedVet: "Dr. Sophie Martin",
      joinedAt: new Date("2026-06-14T09:00:00.000Z"),
    },
    {
      name: "Camille Rousseau",
      email: "camille.rousseau@example.com",
      phone: "0770 88 12 34",
      pet: "Chat - Siamois",
      petSpecies: "Chat",
      assignedVet: "Dr. Lucas Bernard",
      joinedAt: new Date("2026-07-02T09:00:00.000Z"),
    },
    {
      name: "Julien Moreau",
      email: "julien.moreau@example.com",
      phone: "0555 44 21 09",
      pet: "Lapin - Nain",
      petSpecies: "Lapin",
      assignedVet: "Camille Petit",
      joinedAt: new Date("2026-07-20T09:00:00.000Z"),
    },
    {
      name: "Élodie Girard",
      email: "elodie.girard@example.com",
      phone: "0698 77 65 43",
      pet: "Chien - Berger Allemand",
      petSpecies: "Chien",
      assignedVet: "Dr. Sophie Martin",
      joinedAt: new Date("2026-08-05T09:00:00.000Z"),
    },
    {
      name: "Marion Lambert",
      email: "marion.lambert@example.com",
      phone: "0562 33 19 88",
      pet: "Chat - Européen",
      petSpecies: "Chat",
      assignedVet: "Dr. Lucas Bernard",
      joinedAt: new Date("2026-08-22T09:00:00.000Z"),
    },
  ];

  for (const client of demoClients) {
    await prisma.client.upsert({
      where: { email: client.email },
      update: {},
      create: client,
    });
  }

  console.log(`Seed terminé : ${team.length} admins, ${demoClients.length} clients démo.`);
  console.log(`Mot de passe admin (en clair, pour te connecter) : ${rawPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
