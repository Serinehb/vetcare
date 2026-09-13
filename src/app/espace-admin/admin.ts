/* ─── Admin (veterinarian staff) model ───
   Three vets: Dr. Sophie Martin (directrice = full access),
   Dr. Lucas Bernard and Camille Petit (limited to their own clients/interns). */

import { assignStagiaireMentor, assignClientVet, addNewClientNotification, loadAllAppointments } from "../../lib/vetcare-shared";
import {
  sendEmailNotification,
  emailTemplate,
  emailInfoTable,
  ADMIN_EMAIL,
} from "../../lib/email";

export type AdminRole = "directrice" | "vétérinaire" | "assistante";

export type AdminUser = {
  name: string;
  role: AdminRole;
  img: string;
 loggedAt: string;
};

/* Light client/intern summary stored in the admin's shared lists.
   We don't duplicate everything — just enough for the dashboard. */
export type AdminClientSummary = {
  name: string;
  email: string;
  phone?: string;
  pet?: string;
  petSpecies?: string;
  assignedVet: string; // which vet this client is assigned to
  joinedAt: string;
  appointmentCount: number;
};

export type AdminStagiaireSummary = {
  name: string;
  email: string;
  phone?: string;
  school?: string;
  mentor: string; // which vet this intern is assigned to
  startDate: string;
  endDate: string;
  status: string;
  progress: number; // task completion %
  joinedAt: string;
};

/* ─── Vet team (same faces as everywhere else) ─── */
export const ADMIN_TEAM = [
  {
    name: "Dr. Sophie Martin",
    role: "Directrice & Chirurgienne" as const,
    adminRole: "directrice" as AdminRole,
    img: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    email: "sophie.martin@vetcare.com",
    password: "VetCare@2024",
  },
  {
    name: "Dr. Lucas Bernard",
    role: "Vétérinaire Comportementaliste" as const,
    adminRole: "vétérinaire" as AdminRole,
    img: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    email: "lucas.bernard@vetcare.com",
    password: "VetCare@2024",
  },
  {
    name: "Camille Petit",
    role: "Assistante Vétérinaire" as const,
    adminRole: "assistante" as AdminRole,
    img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    email: "camille.petit@vetcare.com",
    password: "VetCare@2024",
  },
];

const ADMIN_STORAGE_KEY = "vetcare_admin";
const CLIENTS_LIST_KEY = "vetcare_admin_clients";
const STAGIAIRES_LIST_KEY = "vetcare_admin_stagiaires";

/* ─── Admin session CRUD ─── */
export function loadAdmin(): AdminUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function saveAdmin(admin: AdminUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(admin));
}

export function clearAdmin() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_STORAGE_KEY);
}

export function isDirectrice(admin: AdminUser): boolean {
  return admin.role === "directrice";
}

/* ─── Demo clients ───
   Sample data so the "Clients" dashboard isn't empty on a fresh install
   (or right after clearing test/ghost data from localStorage). Spread
   across the 3 vets, with realistic phone numbers and animal types so
   every column in the table has something to show. */
const DEMO_CLIENTS: AdminClientSummary[] = [
  {
    name: "Thomas Lefebvre",
    email: "thomas.lefebvre@example.com",
    phone: "0661 23 45 67",
    pet: "Chien - Labrador",
    petSpecies: "Chien",
    assignedVet: "Dr. Sophie Martin",
    joinedAt: "2026-06-14T09:00:00.000Z",
    appointmentCount: 3,
  },
  {
    name: "Camille Rousseau",
    email: "camille.rousseau@example.com",
    phone: "0770 88 12 34",
    pet: "Chat - Siamois",
    petSpecies: "Chat",
    assignedVet: "Dr. Lucas Bernard",
    joinedAt: "2026-07-02T09:00:00.000Z",
    appointmentCount: 1,
  },
  {
    name: "Julien Moreau",
    email: "julien.moreau@example.com",
    phone: "0555 44 21 09",
    pet: "Lapin - Nain",
    petSpecies: "Lapin",
    assignedVet: "Camille Petit",
    joinedAt: "2026-07-20T09:00:00.000Z",
    appointmentCount: 2,
  },
  {
    name: "Élodie Girard",
    email: "elodie.girard@example.com",
    phone: "0698 77 65 43",
    pet: "Chien - Berger Allemand",
    petSpecies: "Chien",
    assignedVet: "Dr. Sophie Martin",
    joinedAt: "2026-08-05T09:00:00.000Z",
    appointmentCount: 0,
  },
  {
    name: "Marion Lambert",
    email: "marion.lambert@example.com",
    phone: "0562 33 19 88",
    pet: "Chat - Européen",
    petSpecies: "Chat",
    assignedVet: "Dr. Lucas Bernard",
    joinedAt: "2026-08-22T09:00:00.000Z",
    appointmentCount: 1,
  },
];

/* ─── Shared client list (for admin dashboard) ─── */
/** Filters out any leftover "ghost" rows whose email matches one of the
    3 vet team accounts. Older builds could (before the admin-login
    guard) mistakenly save an admin's own email as a client when the
    password typed was wrong; this keeps that stale localStorage data
    from ever showing up in the dashboard again. */
function stripAdminGhosts(list: AdminClientSummary[]): AdminClientSummary[] {
  const adminEmails = new Set(
    ADMIN_TEAM.map((v) => v.email.toLowerCase())
  );
  return list.filter((c) => !adminEmails.has(c.email.toLowerCase()));
}

export function loadAllClients(): AdminClientSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLIENTS_LIST_KEY);
    const list: AdminClientSummary[] = raw ? JSON.parse(raw) : [];
    const cleaned = stripAdminGhosts(list);
    if (cleaned.length !== list.length) saveAllClients(cleaned);
    // Nothing real to show yet (fresh install, or all test/ghost data was
    // just cleared out): seed a few demo clients so the dashboard's
    // "Animal" and "Tél" columns aren't just an empty table.
    if (cleaned.length === 0) {
      saveAllClients(DEMO_CLIENTS);
      return DEMO_CLIENTS;
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveAllClients(list: AdminClientSummary[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLIENTS_LIST_KEY, JSON.stringify(list));
}

/** Called when a new client registers or logs in.
    Note: a login round-trip doesn't always carry every field (e.g. the
    "connexion" form has no phone input), so when updating an existing
    entry we only overwrite a field if a real value was supplied —
    otherwise we keep whatever the client already had on file instead of
    blanking it out. */
export function registerClientForAdmin(
  name: string,
  email: string,
  phone: string | undefined,
  pet: string | undefined,
  petSpecies: string | undefined,
  assignedVet: string
) {
  const list = loadAllClients();
  const existing = list.findIndex((c) => c.email === email);
  if (existing >= 0) {
    const prev = list[existing];
    list[existing] = {
      ...prev,
      name,
      email,
      phone: phone !== undefined && phone !== "" ? phone : prev.phone,
      pet: pet !== undefined && pet !== "" ? pet : prev.pet,
      petSpecies:
        petSpecies !== undefined && petSpecies !== ""
          ? petSpecies
          : prev.petSpecies,
      assignedVet,
    };
  } else {
    list.push({
      name,
      email,
      phone,
      pet,
      petSpecies,
      assignedVet,
      joinedAt: new Date().toISOString(),
      appointmentCount: 0,
    });
    addNewClientNotification(name, email);
    sendEmailNotification(
      email,
      "Bienvenue chez VetCare 🐾",
      emailTemplate(
        "Bienvenue !",
        `Bonjour ${name},<br/>Votre compte client VetCare vient d'être créé. Vous pouvez dès maintenant prendre rendez-vous pour votre animal depuis votre espace.`
      )
    );
    sendEmailNotification(
      ADMIN_EMAIL,
      "Nouvelle inscription client — VetCare",
      emailTemplate(
        "Nouvelle inscription client",
        `<b>${name}</b> vient de créer un compte client.` +
          emailInfoTable([
            ["Nom", name],
            ["Email", email],
            ["Téléphone", phone || "non renseigné"],
            ["Animal", pet || "non renseigné"],
            ["Espèce", petSpecies || "non renseigné"],
            ["Vétérinaire référent", assignedVet],
          ])
      )
    );
  }
  saveAllClients(list);
}

/** Called from the admin dashboard to remove a client row (e.g. a
    mistaken/test entry). Only removes the shared dashboard record —
    doesn't touch that client's own local session if they still have one. */
export function removeClientForAdmin(email: string) {
  const list = loadAllClients();
  const filtered = list.filter(
    (c) => c.email.toLowerCase() !== email.toLowerCase()
  );
  saveAllClients(filtered);
}

/** Called when a client edits their own contact details (name, email,
    phone) from their space. Matches on the client's *previous* email so a
    changed address still updates the right row instead of creating a
    duplicate entry. */
export function updateClientContactForAdmin(
  previousEmail: string,
  name: string,
  email: string,
  phone: string | undefined
) {
  const list = loadAllClients();
  const idx = list.findIndex(
    (c) => c.email.toLowerCase() === previousEmail.toLowerCase()
  );
  if (idx >= 0) {
    list[idx] = { ...list[idx], name, email, phone };
    saveAllClients(list);
  }
}

/** Called when a client fills in or updates their pet's details from
    their own space (fiche animal, possibly completed after the account
    was already created). Keeps the admin dashboard's "Animal" column in
    sync without waiting for another login/registration round-trip. */
export function updateClientPetForAdmin(
  email: string,
  pet: string | undefined,
  petSpecies: string | undefined
) {
  const list = loadAllClients();
  const idx = list.findIndex(
    (c) => c.email.toLowerCase() === email.toLowerCase()
  );
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      pet: pet !== undefined && pet !== "" ? pet : list[idx].pet,
      petSpecies:
        petSpecies !== undefined && petSpecies !== ""
          ? petSpecies
          : list[idx].petSpecies,
    };
    saveAllClients(list);
  }
}

/* ─── Shared stagiaire list (for admin dashboard) ─── */
export function loadAllStagiaires(): AdminStagiaireSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STAGIAIRES_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAllStagiaires(list: AdminStagiaireSummary[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STAGIAIRES_LIST_KEY, JSON.stringify(list));
}

/** Called when a new intern registers */
export function registerStagiaireForAdmin(
  name: string,
  email: string,
  phone: string | undefined,
  school: string | undefined,
  mentor: string,
  startDate: string,
  endDate: string
) {
  const list = loadAllStagiaires();
  const existing = list.findIndex((s) => s.email === email);
  const entry: AdminStagiaireSummary = {
    name,
    email,
    phone,
    school,
    mentor,
    startDate,
    endDate,
    status: "en cours",
    progress: 0,
    joinedAt: new Date().toISOString(),
  };
  if (existing >= 0) {
    list[existing] = { ...list[existing], ...entry, joinedAt: list[existing].joinedAt };
  } else {
    list.push(entry);
    sendEmailNotification(
      email,
      "Bienvenue chez VetCare 🐾",
      emailTemplate(
        "Bienvenue !",
        `Bonjour ${name},<br/>Votre compte stagiaire VetCare vient d'être créé. Votre tuteur est <b>${mentor}</b>, stage du ${startDate} au ${endDate}.`
      )
    );
    sendEmailNotification(
      ADMIN_EMAIL,
      "Nouvelle inscription stagiaire — VetCare",
      emailTemplate(
        "Nouveau stagiaire",
        `<b>${name}</b> vient de s'inscrire comme stagiaire.` +
          emailInfoTable([
            ["Nom", name],
            ["Email", email],
            ["Téléphone", phone || "non renseigné"],
            ["École", school || "non renseigné"],
            ["Tuteur", mentor],
            ["Début de stage", startDate],
            ["Fin de stage", endDate],
          ])
      )
    );
  }
  saveAllStagiaires(list);
}

/** Update a stagiaire's progress (called from stagiaire space) */
export function updateStagiaireProgressInAdmin(email: string, progress: number) {
  const list = loadAllStagiaires();
  const idx = list.findIndex((s) => s.email === email);
  if (idx >= 0) {
    list[idx].progress = progress;
    saveAllStagiaires(list);
  }
}

/** Directrice only: decide which vet a stagiaire is assigned to. Updates the
    shared list (so every admin view refreshes instantly) and notifies the
    intern directly in their own space. */
export function reassignStagiaireMentor(
  email: string,
  mentor: string,
  assignedBy: string
) {
  const list = loadAllStagiaires();
  const idx = list.findIndex((s) => s.email === email);
  if (idx >= 0) {
    list[idx] = { ...list[idx], mentor };
    saveAllStagiaires(list);
  }
  assignStagiaireMentor(email, mentor, assignedBy);
}

/** Directrice only: decide which vet follows up with a client's pet.
    Client assignment is automatic by default (deterministic, from the
    email, at registration) — this lets the directrice override it
    afterwards. Updates the shared list and notifies the client directly
    in their own space. */
export function reassignClientVet(
  email: string,
  vet: string,
  assignedBy: string
) {
  const list = loadAllClients();
  const idx = list.findIndex(
    (c) => c.email.toLowerCase() === email.toLowerCase()
  );
  if (idx >= 0) {
    list[idx] = { ...list[idx], assignedVet: vet };
    saveAllClients(list);
  }
  assignClientVet(email, vet, assignedBy);
}

/* ─── Role-based filtering ─── */
export function filterClientsForAdmin(
  admin: AdminUser,
  clients: AdminClientSummary[]
): AdminClientSummary[] {
  if (isDirectrice(admin)) return clients;
  return clients.filter((c) => c.assignedVet === admin.name);
}

export function filterStagiairesForAdmin(
  admin: AdminUser,
  stagiaires: AdminStagiaireSummary[]
): AdminStagiaireSummary[] {
  if (isDirectrice(admin)) return stagiaires;
  return stagiaires.filter((s) => s.mentor === admin.name);
}

/* ─── Appointment reminder emails ───
   There's no real backend/cron here, so "when the appointment is close"
   is checked opportunistically every time a dashboard (client, admin or
   stagiaire) mounts. Each appointment only ever triggers one reminder
   thanks to the localStorage guard, so it's safe to call this from every
   space without spamming duplicate emails. */
const REMINDED_APPOINTMENTS_KEY = "vetcare_reminded_appointments";
const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000; // remind once inside the last 24h before the RDV

function loadRemindedAppointmentIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REMINDED_APPOINTMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRemindedAppointmentIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMINDED_APPOINTMENTS_KEY, JSON.stringify(ids));
}

export function checkAndSendAppointmentReminders() {
  if (typeof window === "undefined") return;
  const upcoming = loadAllAppointments().filter((a) => a.status === "à venir");
  if (upcoming.length === 0) return;

  const reminded = new Set(loadRemindedAppointmentIds());
  const now = Date.now();
  let changed = false;

  upcoming.forEach((a) => {
    if (reminded.has(a.id)) return;
    const when = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
    if (isNaN(when) || when < now || when - now > REMINDER_WINDOW_MS) return;

    sendEmailNotification(
      a.clientEmail,
      "Rappel : votre rendez-vous approche — VetCare",
      emailTemplate(
        "Votre rendez-vous approche",
        `Bonjour ${a.clientName},<br/>Petit rappel : vous avez rendez-vous le <b>${a.date}</b> à <b>${a.time}</b> avec ${a.vet}${a.pet ? ` pour ${a.pet}` : ""}.`
      )
    );
    sendEmailNotification(
      ADMIN_EMAIL,
      "Rappel : rendez-vous à venir — VetCare",
      emailTemplate(
        "Rendez-vous à venir",
        `Rappel : <b>${a.clientName}</b> a rendez-vous le ${a.date} à ${a.time} avec ${a.vet}.`
      )
    );
    // Best-effort: also let the interns know, since they may be assisting that day.
    loadAllStagiaires().forEach((s) => {
      sendEmailNotification(
        s.email,
        "Rappel : rendez-vous à venir — VetCare",
        emailTemplate(
          "Rendez-vous à venir",
          `Pour information : ${a.clientName} a rendez-vous le ${a.date} à ${a.time} avec ${a.vet}.`
        )
      );
    });

    reminded.add(a.id);
    changed = true;
  });

  if (changed) saveRemindedAppointmentIds(Array.from(reminded));
}
