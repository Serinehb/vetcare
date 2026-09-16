/* ─── Stagiaire (intern) model ───
   Separate from VetCareUser so interns get their own dedicated space
   without pet/appointment data but with internship-specific fields. */

import { assignVetTeamMember } from "../espace-utilisateur/user";
import {
  mirrorInternMessage,
  loadInternConversation,
  getMentorOverride,
  type SharedInternMessage,
} from "../../lib/vetcare-shared";

/* Ré-export pour la page : la boucle de synchro serveur vit dans
   vetcare-shared mais l'espace stagiaire l'importe depuis son module. */
export { startServerSync } from "../../lib/vetcare-shared";

export type InternshipStatus = "en cours" | "terminé" | "annulé";

export type TaskItem = {
  id: string;
  category: string;
  label: string;
  done: boolean;
  doneAt?: string;
};

export type ResourceItem = {
  id: string;
  title: string;
  category: string;
  description: string;
  icon: string;
};

export type ScheduleSlot = {
  id: string;
  day: string; // "lundi" | "mardi" | ...
  time: string; // "09:00 - 12:00"
  title: string;
  location: string;
  type: "consultation" | "chirurgie" | "urgence" | "laboratoire" | "accueil" | "réunion";
};

export type ChatMessageIntern = {
  id: string;
  from: "stagiaire" | "equipe";
  author: string;
  text: string;
  at: string;
};

export type StagiaireUser = {
  name: string;
  email: string;
  phone?: string;
  school?: string;
  motivation?: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  mentor: string; // assigned mentor name
  status: InternshipStatus;
  tasks?: TaskItem[];
  resources?: ResourceItem[];
  schedule?: ScheduleSlot[];
  messages?: ChatMessageIntern[];
  lastSeenMessagesAt?: string;
  joinedAt: string;
};

const STORAGE_KEY = "vetcare_stagiaire";

export function loadStagiaire(): StagiaireUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StagiaireUser;
  } catch {
    return null;
  }
}

export function saveStagiaire(user: StagiaireUser) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {}
}

export function clearStagiaire() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/* ─── Default schedule template ─── */
export const DEFAULT_SCHEDULE: ScheduleSlot[] = [
  { id: "s1", day: "lundi", time: "09:00 - 12:00", title: "Consultations générales", location: "Salle 1", type: "consultation" },
  { id: "s2", day: "lundi", time: "14:00 - 17:00", title: "Laboratoire / Analyses", location: "Labo", type: "laboratoire" },
  { id: "s3", day: "mardi", time: "09:00 - 12:00", title: "Chirurgie (observation)", location: "Bloc opératoire", type: "chirurgie" },
  { id: "s4", day: "mardi", time: "14:00 - 17:00", title: "Accueil & secrétariat", location: "Réception", type: "accueil" },
  { id: "s5", day: "mercredi", time: "09:00 - 12:00", title: "Urgences", location: "Urgences", type: "urgence" },
  { id: "s6", day: "mercredi", time: "14:00 - 17:00", title: "Consultations spécialisées", location: "Salle 2", type: "consultation" },
  { id: "s7", day: "jeudi", time: "09:00 - 12:00", title: "Chirurgie (assistance)", location: "Bloc opératoire", type: "chirurgie" },
  { id: "s8", day: "jeudi", time: "14:00 - 16:00", title: "Réunion de suivi", location: "Salle réunion", type: "réunion" },
  { id: "s9", day: "vendredi", time: "09:00 - 12:00", title: "Consultations générales", location: "Salle 1", type: "consultation" },
  { id: "s10", day: "vendredi", time: "14:00 - 17:00", title: "Bilan de la semaine", location: "Bureau", type: "réunion" },
];

/* ─── Default tasks / learning objectives ─── */
export const DEFAULT_TASKS: TaskItem[] = [
  { id: "t1", category: "Consultations", label: "Observer 10 consultations générales", done: false },
  { id: "t2", category: "Consultations", label: "Rédiger un compte-rendu de consultation", done: false },
  { id: "t3", category: "Consultations", label: "Pratiquer l'anamnèse sous supervision", done: false },
  { id: "t4", category: "Chirurgie", label: "Assister à au moins 3 interventions", done: false },
  { id: "t5", category: "Chirurgie", label: "Préparer le matériel chirurgical", done: false },
  { id: "t6", category: "Chirurgie", label: "Observer les protocoles d'anesthésie", done: false },
  { id: "t7", category: "Laboratoire", label: "Réaliser une prise de sang", done: false },
  { id: "t8", category: "Laboratoire", label: "Interpréter un bilan sanguin simple", done: false },
  { id: "t9", category: "Urgences", label: "Participer à une garde urgences", done: false },
  { id: "t10", category: "Urgences", label: "Identifier les signes d'urgence vitale", done: false },
  { id: "t11", category: "Accueil", label: "Gérer l'accueil téléphonique", done: false },
  { id: "t12", category: "Accueil", label: "Accueiller un client et son animal", done: false },
];

/* ─── Default resources ─── */
export const DEFAULT_RESOURCES: ResourceItem[] = [
  { id: "r1", title: "Protocole de consultation", category: "Consultations", description: "Étapes détaillées d'une consultation type", icon: "fa-solid fa-clipboard-list" },
  { id: "r2", title: "Guide de rédaction CRM", category: "Consultations", description: "Comment rédiger un compte-rendu médical", icon: "fa-solid fa-file-medical" },
  { id: "r3", title: "Préparation du bloc opératoire", category: "Chirurgie", description: "Checklist avant, pendant et après intervention", icon: "fa-solid fa-kit-medical" },
  { id: "r4", title: "Protocoles d'anesthésie", category: "Chirurgie", description: "Anesthésie générale et locale : posologies", icon: "fa-solid fa-syringe" },
  { id: "r5", title: "Interprétation NFS", category: "Laboratoire", description: "Guide d'interprétation de la numération formule sanguine", icon: "fa-solid fa-flask" },
  { id: "r6", title: "Prélèvements et analyses", category: "Laboratoire", description: "Techniques de prélèvement et envoi au laboratoire", icon: "fa-solid fa-vials" },
  { id: "r7", title: "Tri aux urgences", category: "Urgences", description: "Échelle de tri et prise en charge des urgences", icon: "fa-solid fa-truck-medical" },
  { id: "r8", title: "Gestes de premiers secours vétérinaires", category: "Urgences", description: "Réanimation et stabilisation d'urgence", icon: "fa-solid fa-heart-pulse" },
];

/* ─── Default welcome messages ─── */
export function getDefaultMessages(mentorName: string): ChatMessageIntern[] {
  return [
    {
      id: "msg_welcome",
      from: "equipe",
      author: mentorName,
      text: `Bienvenue chez VetCare ! Je suis ${mentorName}, votre tuteur pendant ce stage. N'hésitez pas à me poser des questions à tout moment. Je vous souhaite un excellent stage !`,
      at: new Date().toISOString(),
    },
    {
      id: "msg_info",
      from: "equipe",
      author: "VetCare",
      text: "Votre planning de la semaine est disponible dans l'onglet \"Mon planning\". Vérifiez-le régulièrement car des modifications peuvent survenir.",
      at: new Date().toISOString(),
    },
  ];
}

/* ─── Team ─── */
export const VET_TEAM_STAGIAIRE = [
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

/* ─── Helpers ───
   Same deterministic email-based assignment as clients, so a stagiaire
   and their admin-side "mentor" entry always point to the same vet. */
export function assignMentor(email: string): string {
  return assignVetTeamMember(email).name;
}

export function createStagiaire(data: {
  name: string;
  email: string;
  phone?: string;
  school?: string;
  motivation?: string;
  startDate: string;
  endDate: string;
}): StagiaireUser {
  const mentor = assignMentor(data.email);
  const user: StagiaireUser = {
    ...data,
    mentor,
    status: "en cours",
    tasks: DEFAULT_TASKS.map((t) => ({ ...t })),
    resources: DEFAULT_RESOURCES.map((r) => ({ ...r })),
    schedule: DEFAULT_SCHEDULE.map((s) => ({ ...s })),
    messages: getDefaultMessages(mentor),
    joinedAt: new Date().toISOString(),
  };
  saveStagiaire(user);
  return user;
}

export function toggleTask(user: StagiaireUser, taskId: string): StagiaireUser {
  const updated: StagiaireUser = {
    ...user,
    tasks: (user.tasks || []).map((t) =>
      t.id === taskId
        ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : undefined }
        : t
    ),
  };
  saveStagiaire(updated);
  return updated;
}

export function addMessageIntern(
  user: StagiaireUser,
  message: Omit<ChatMessageIntern, "id" | "at">
): StagiaireUser {
  const newMessage: ChatMessageIntern = {
    ...message,
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
  };
  const updated: StagiaireUser = {
    ...user,
    messages: [...(user.messages || []), newMessage],
  };
  saveStagiaire(updated);
  mirrorInternMessage(updated.email, newMessage as SharedInternMessage);
  return updated;
}

/** Pulls in messages sent by the admin/directrice (e.g. mentor reassignment note)
    and applies a mentor reassignment made from the admin dashboard. */
export function syncStagiaireFromShared(user: StagiaireUser): StagiaireUser {
  let updated = user;

  const override = getMentorOverride(user.email);
  if (override && override.mentor && override.mentor !== updated.mentor) {
    updated = { ...updated, mentor: override.mentor };
  }

  const shared = loadInternConversation(user.email);
  if (shared.length) {
    const existingIds = new Set((updated.messages || []).map((m) => m.id));
    const newOnes = shared.filter((m) => !existingIds.has(m.id)) as ChatMessageIntern[];
    if (newOnes.length) {
      updated = { ...updated, messages: [...(updated.messages || []), ...newOnes] };
    }
  }

  if (updated !== user) saveStagiaire(updated);
  return updated;
}

export function unreadInternMessages(user: StagiaireUser): number {
  const lastSeen = user.lastSeenMessagesAt
    ? new Date(user.lastSeenMessagesAt).getTime()
    : 0;
  return (user.messages || []).filter(
    (m) => m.from === "equipe" && new Date(m.at).getTime() > lastSeen
  ).length;
}

export function markInternMessagesSeen(user: StagiaireUser): StagiaireUser {
  const updated: StagiaireUser = {
    ...user,
    lastSeenMessagesAt: new Date().toISOString(),
  };
  saveStagiaire(updated);
  return updated;
}

export function internshipProgress(user: StagiaireUser): number {
  const tasks = user.tasks || [];
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
}

export function internshipDaysInfo(user: StagiaireUser) {
  const start = new Date(user.startDate).getTime();
  const end = new Date(user.endDate).getTime();
  const now = Date.now();
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  const elapsed = Math.max(0, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));
  const remaining = Math.max(0, totalDays - elapsed);
  const percent = Math.min(100, Math.round((elapsed / totalDays) * 100));
  return { totalDays, elapsed, remaining, percent };
}
