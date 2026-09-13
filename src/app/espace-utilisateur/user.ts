/* ─── Shared "connected user" model ───
   Small helper used by both the homepage (login/inscription modal) and
   the "Espace utilisateur" member page, so the session survives
   navigation between routes without needing a real backend. Everything
   (appointments, messages…) is persisted in localStorage under the same
   user record. */

import {
  mirrorClientMessage,
  loadClientConversation,
  upsertSharedAppointment,
  loadAllAppointments,
  updatePetOnClientAppointments,
  getClientVetOverride,
  type SharedClientMessage,
} from "../../lib/vetcare-shared";
import {
  updateClientContactForAdmin,
  updateClientPetForAdmin,
  checkAndSendAppointmentReminders,
} from "../espace-admin/admin";
import { sendEmailNotification, emailTemplate, emailInfoTable, ADMIN_EMAIL } from "../../lib/email";

export type AppointmentStatus = "à venir" | "terminé" | "annulé";

export type Appointment = {
  id: string;
  date: string; // ISO date, e.g. "2026-08-20"
  time: string; // "14:30"
  reason: string;
  vet: string; // name of the vet handling this appointment
  status: AppointmentStatus;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  from: "user" | "team";
  author: string;
  text: string;
  at: string; // ISO datetime
  with: string; // name of the vet team member this message belongs to (conversation thread)
};

export type VetCareUser = {
  name: string;
  email: string;
  phone?: string;
  pet?: string;
  petSpecies?: string; // "Chien" | "Chat" | ...
  petBreed?: string; // race de l'animal
  petGender?: "Femelle" | "Mâle"; // sexe de l'animal
  petSterilized?: boolean; // stérilisé(e) ou non
  joinedAt: string; // ISO date string
  appointments?: Appointment[];
  messages?: ChatMessage[];
  vetTeamName?: string; // assigned referent vet/staff member
  lastSeenMessagesAt?: string; // ISO datetime, used to compute unread count
};

const STORAGE_KEY = "vetcare_user";

export function loadUser(): VetCareUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VetCareUser;
  } catch {
    return null;
  }
}

export function saveUser(user: VetCareUser) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    /* ignore write errors (e.g. private browsing) */
  }
}

export function clearUser() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* ─── Vet team (kept in sync with the "Notre Équipe" section on the
   homepage) so the member space can assign a real referent. ─── */
export const VET_TEAM = [
  {
    name: "Dr. Sophie Martin",
    role: "Directrice & Chirurgienne",
    img: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Dr. Lucas Bernard",
    role: "Vétérinaire Comportementaliste",
    img: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Camille Petit",
    role: "Assistante Vétérinaire",
    img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
  },
];

/* Deterministic pick so the same client always sees the same referent,
   without needing a real backend to store the assignment. */
export function assignVetTeamMember(email: string) {
  const seed = email
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return VET_TEAM[seed % VET_TEAM.length];
}

/* Referent shown at the top of "Équipe": the member the user picked as
   favorite (vetTeamName) if any, otherwise the deterministic default. */
export function getReferent(user: VetCareUser) {
  const chosen = VET_TEAM.find((v) => v.name === user.vetTeamName);
  return chosen || assignVetTeamMember(user.email || user.name);
}

export function setFavoriteVetTeamMember(
  user: VetCareUser,
  name: string
): VetCareUser {
  const updated: VetCareUser = { ...user, vetTeamName: name };
  saveUser(updated);
  return updated;
}

/* ─── Appointments ─── */
export function addAppointment(
  user: VetCareUser,
  appointment: Omit<Appointment, "id" | "status" | "createdAt">
): VetCareUser {
  const newAppointment: Appointment = {
    ...appointment,
    id: `apt_${Date.now()}`,
    status: "à venir",
    createdAt: new Date().toISOString(),
  };
  const updated: VetCareUser = {
    ...user,
    appointments: [...(user.appointments || []), newAppointment],
  };
  saveUser(updated);
  upsertSharedAppointment({
    id: newAppointment.id,
    clientEmail: updated.email,
    clientName: updated.name,
    pet: updated.pet,
    date: newAppointment.date,
    time: newAppointment.time,
    reason: newAppointment.reason,
    vet: newAppointment.vet,
    status: newAppointment.status,
  });
  sendEmailNotification(
    updated.email,
    "Rendez-vous confirmé — VetCare",
    emailTemplate(
      "Rendez-vous confirmé",
      `Bonjour ${updated.name}, votre rendez-vous est confirmé :` +
        emailInfoTable([
          ["Date", newAppointment.date],
          ["Heure", newAppointment.time],
          ["Vétérinaire", newAppointment.vet],
          ["Motif", newAppointment.reason],
          ["Animal", updated.pet || "non renseigné"],
        ])
    )
  );
  sendEmailNotification(
    ADMIN_EMAIL,
    "Nouveau rendez-vous réservé — VetCare",
    emailTemplate(
      "Nouveau rendez-vous",
      `<b>${updated.name}</b> a réservé un rendez-vous.` +
        emailInfoTable([
          ["Client", updated.name],
          ["Email", updated.email],
          ["Téléphone", updated.phone || "non renseigné"],
          ["Animal", updated.pet || "non renseigné"],
          ["Date", newAppointment.date],
          ["Heure", newAppointment.time],
          ["Vétérinaire", newAppointment.vet],
          ["Motif", newAppointment.reason],
        ])
    )
  );
  return updated;
}

export function cancelAppointment(
  user: VetCareUser,
  id: string
): VetCareUser {
  const updated: VetCareUser = {
    ...user,
    appointments: (user.appointments || []).map((a) =>
      a.id === id ? { ...a, status: "annulé" as AppointmentStatus } : a
    ),
  };
  saveUser(updated);
  const cancelled = updated.appointments?.find((a) => a.id === id);
  if (cancelled) {
    upsertSharedAppointment({
      id: cancelled.id,
      clientEmail: updated.email,
      clientName: updated.name,
      pet: updated.pet,
      date: cancelled.date,
      time: cancelled.time,
      reason: cancelled.reason,
      vet: cancelled.vet,
      status: cancelled.status,
    });
  }
  return updated;
}

/** Pulls in any status change the admin made (e.g. marking a RDV as "terminé"). */
export function syncAppointmentsFromShared(user: VetCareUser): VetCareUser {
  const shared = loadAllAppointments().filter(
    (a) => a.clientEmail.toLowerCase() === user.email.toLowerCase()
  );
  if (!shared.length) return user;
  const byId = new Map(shared.map((a) => [a.id, a]));
  let changed = false;
  const appointments = (user.appointments || []).map((a) => {
    const s = byId.get(a.id);
    if (s && s.status !== a.status) {
      changed = true;
      return { ...a, status: s.status };
    }
    return a;
  });
  if (!changed) return user;
  const updated: VetCareUser = { ...user, appointments };
  saveUser(updated);
  return updated;
}

/** Pulls in a vet reassignment the directrice made from the admin
    dashboard, so the client's own "référent" updates without them having
    to pick it again themselves. */
export function syncReferentFromShared(user: VetCareUser): VetCareUser {
  const override = getClientVetOverride(user.email);
  if (!override || !override.vet || override.vet === user.vetTeamName) {
    return user;
  }
  const updated: VetCareUser = { ...user, vetTeamName: override.vet };
  saveUser(updated);
  return updated;
}

/* An appointment is considered past once its date has gone by, so the
   history tab stays accurate without any manual bookkeeping. */
export function isPastAppointment(a: Appointment) {
  return new Date(`${a.date}T${a.time || "00:00"}`).getTime() < Date.now();
}

/* ─── Messagerie ─── */
export function addMessage(
  user: VetCareUser,
  message: Omit<ChatMessage, "id" | "at">
): VetCareUser {
  const newMessage: ChatMessage = {
    ...message,
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
  };
  const updated: VetCareUser = {
    ...user,
    messages: [...(user.messages || []), newMessage],
  };
  saveUser(updated);
  mirrorClientMessage(updated.email, newMessage as SharedClientMessage);
  return updated;
}

/** Pulls in any message the admin sent while this client wasn't logged in. */
export function syncMessagesFromShared(user: VetCareUser): VetCareUser {
  const shared = loadClientConversation(user.email);
  if (!shared.length) return user;
  const existingIds = new Set((user.messages || []).map((m) => m.id));
  const newOnes = shared.filter((m) => !existingIds.has(m.id)) as ChatMessage[];
  if (!newOnes.length) return user;
  const updated: VetCareUser = {
    ...user,
    messages: [...(user.messages || []), ...newOnes],
  };
  saveUser(updated);
  return updated;
}

export function unreadMessageCount(user: VetCareUser) {
  const lastSeen = user.lastSeenMessagesAt
    ? new Date(user.lastSeenMessagesAt).getTime()
    : 0;
  return (user.messages || []).filter(
    (m) => m.from === "team" && new Date(m.at).getTime() > lastSeen
  ).length;
}

export function markMessagesSeen(user: VetCareUser): VetCareUser {
  const updated: VetCareUser = {
    ...user,
    lastSeenMessagesAt: new Date().toISOString(),
  };
  saveUser(updated);
  return updated;
}

/** Update the client's own contact details (name, email, phone) from
    their space. Saves the session locally AND keeps the admin's client
    list in sync, so a phone number filled in (or corrected) here shows up
    right away in the admin dashboard's "Téléphone" column. */
export function updateContactInfo(
  user: VetCareUser,
  info: { name: string; email: string; phone?: string }
): VetCareUser {
  const previousEmail = user.email;
  const updated: VetCareUser = {
    ...user,
    name: info.name.trim() || user.name,
    email: info.email.trim() || user.email,
    phone: info.phone?.trim() || undefined,
  };
  saveUser(updated);
  updateClientContactForAdmin(
    previousEmail,
    updated.name,
    updated.email,
    updated.phone
  );
  return updated;
}

/* ─── Animal types & breeds (shared with homepage inscription) ─── */
export const ANIMAL_TYPES = [
  {
    id: "chien",
    label: "Chien",
    icon: "fa-solid fa-dog",
    breeds: [
      "Labrador",
      "Berger Allemand",
      "Golden Retriever",
      "Bouledogue Français",
      "Caniche",
      "Jack Russell",
      "Husky Sibérien",
      "Autre",
    ],
  },
  {
    id: "chat",
    label: "Chat",
    icon: "fa-solid fa-cat",
    breeds: [
      "Européen",
      "Siamois",
      "Persan",
      "Maine Coon",
      "Bengal",
      "British Shorthair",
      "Autre",
    ],
  },
  {
    id: "lapin",
    label: "Lapin",
    icon: "fa-solid fa-paw",
    breeds: ["Nain", "Bélier", "Angora", "Rex", "Autre"],
  },
  {
    id: "oiseau",
    label: "Oiseau",
    icon: "fa-solid fa-dove",
    breeds: ["Perruche", "Canari", "Perroquet", "Cacatoès", "Autre"],
  },
  {
    id: "autre",
    label: "Autre",
    icon: "fa-solid fa-paw",
    breeds: [] as string[],
  },
];

/* Check whether a user has complete pet details */
export function hasPetDetails(user: VetCareUser): boolean {
  return !!(
    user.petSpecies &&
    user.petGender &&
    user.petSterilized !== undefined
  );
}

/* Update pet info on an existing user */
export function updatePetInfo(
  user: VetCareUser,
  info: {
    petSpecies: string;
    petBreed?: string;
    petGender: "Femelle" | "Mâle";
    petSterilized: boolean;
  }
): VetCareUser {
  const updated: VetCareUser = {
    ...user,
    petSpecies: info.petSpecies,
    petBreed: info.petBreed,
    petGender: info.petGender,
    petSterilized: info.petSterilized,
    pet: [info.petSpecies, info.petBreed].filter(Boolean).join(" - "),
  };
  saveUser(updated);
  updateClientPetForAdmin(updated.email, updated.pet, updated.petSpecies);
  updatePetOnClientAppointments(updated.email, updated.pet);
  return updated;
}

/* ─── Seasonal health / vaccine reminders ───
   Simple rule-based tips: the risk that matters most changes with the
   season, so the "fiche animal" surfaces something relevant instead of
   a generic vaccine checklist. */
export function getSeasonalHealthTip(species?: string) {
  const month = new Date().getMonth(); // 0 = janvier
  const isCat = (species || "").toLowerCase().includes("chat");

  // 0-1: hiver, 2-4: printemps, 5-7: été, 8-10: automne, 11: hiver
  let season: "hiver" | "printemps" | "été" | "automne";
  if (month <= 1 || month === 11) season = "hiver";
  else if (month <= 4) season = "printemps";
  else if (month <= 7) season = "été";
  else season = "automne";

  const tips: Record<
    typeof season,
    { risk: string; advice: string; level: "faible" | "modéré" | "élevé" }
  > = {
    hiver: {
      risk: "Toux du chenil & baisse d'immunité au froid",
      advice:
        "Vérifiez le rappel vaccinal annuel et limitez les sorties prolongées par grand froid.",
      level: "modéré",
    },
    printemps: {
      risk: "Pic de tiques et de puces",
      advice:
        "C'est la période la plus à risque pour les parasites externes : pensez au traitement antiparasitaire et à un rappel de vaccin contre la piroplasmose si besoin.",
      level: "élevé",
    },
    été: {
      risk: isCat
        ? "Coup de chaleur & déshydratation"
        : "Chenilles processionnaires & coup de chaleur",
      advice:
        "Évitez les sorties aux heures chaudes, assurez un accès permanent à l'eau fraîche, et restez vigilant en forêt/parc.",
      level: "élevé",
    },
    automne: {
      risk: "Retour des puces d'intérieur & chute d'immunité",
      advice:
        "Profitez de la baisse d'activité extérieure pour planifier le bilan de santé annuel avant l'hiver.",
      level: "faible",
    },
  };

  return { season, ...tips[season] };
}
