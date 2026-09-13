/* ─── Cross-space shared store ───
   VetCare has no real backend: each space (client, stagiaire, admin)
   keeps its own localStorage record. These helpers add a small set of
   *shared* keys so that when the admin acts on a client/stagiaire
   (replies to a message, sends a reminder, marks a RDV as done,
   reassigns a mentor…) the change is visible on the other side too,
   as soon as that space reloads its data. */

/* ─── Client conversation (mirrors ChatMessage in espace-utilisateur/user.ts) ─── */
export type SharedClientMessage = {
  id: string;
  from: "user" | "team";
  author: string;
  text: string;
  at: string;
  with: string; // vet name this message belongs to
};

function clientConvKey(email: string) {
  return `vetcare_conv_client_${email.trim().toLowerCase()}`;
}

export function loadClientConversation(email: string): SharedClientMessage[] {
  if (typeof window === "undefined" || !email) return [];
  try {
    const raw = window.localStorage.getItem(clientConvKey(email));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveClientConversation(email: string, msgs: SharedClientMessage[]) {
  if (typeof window === "undefined" || !email) return;
  window.localStorage.setItem(clientConvKey(email), JSON.stringify(msgs));
}

/** Called from the client's own MessagingPanel so the admin side can see it too. */
export function mirrorClientMessage(email: string, msg: SharedClientMessage) {
  const list = loadClientConversation(email);
  if (list.some((m) => m.id === msg.id)) return;
  list.push(msg);
  saveClientConversation(email, list);
}

/** Called from the admin dashboard: a staff member writes to a client (reply or reminder). */
export function sendAdminMessageToClient(
  email: string,
  vetName: string,
  authorName: string,
  text: string
): SharedClientMessage {
  const msg: SharedClientMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    from: "team",
    author: authorName,
    text,
    at: new Date().toISOString(),
    with: vetName,
  };
  const list = loadClientConversation(email);
  list.push(msg);
  saveClientConversation(email, list);
  return msg;
}

function adminSeenKey(adminName: string, email: string) {
  return `vetcare_admin_seen_${adminName}__${email.trim().toLowerCase()}`;
}

export function markClientThreadSeenByAdmin(adminName: string, email: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(adminSeenKey(adminName, email), new Date().toISOString());
}

/** True when the client's latest message hasn't been opened yet by this admin. */
export function hasUnseenClientMessage(adminName: string, email: string): boolean {
  if (typeof window === "undefined") return false;
  const list = loadClientConversation(email);
  const last = list[list.length - 1];
  if (!last || last.from !== "user") return false;
  const seen = window.localStorage.getItem(adminSeenKey(adminName, email));
  if (!seen) return true;
  return new Date(last.at).getTime() > new Date(seen).getTime();
}

/* ─── New client registration notifications ───
   Fired once per brand-new signup (not on ordinary logins) so the admin
   dashboard can surface it in the notification bell. Each admin tracks
   their own "last read" timestamp, so opening the panel on one admin
   account doesn't silently mark it read for another. */
export type NewClientNotification = {
  name: string;
  email: string;
  at: string;
};

const NEW_CLIENT_NOTIFS_KEY = "vetcare_new_client_notifications";

export function addNewClientNotification(name: string, email: string) {
  if (typeof window === "undefined") return;
  try {
    const list = loadNewClientNotifications();
    list.push({ name, email, at: new Date().toISOString() });
    window.localStorage.setItem(NEW_CLIENT_NOTIFS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function loadNewClientNotifications(): NewClientNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NEW_CLIENT_NOTIFS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function newClientNotifSeenKey(adminName: string) {
  return `vetcare_admin_newclient_seen_${adminName}`;
}

export function markNewClientNotificationsSeen(adminName: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(newClientNotifSeenKey(adminName), new Date().toISOString());
}

/** New-registration notifications this admin hasn't opened the bell for yet. */
export function getUnseenNewClientNotifications(adminName: string): NewClientNotification[] {
  if (typeof window === "undefined") return [];
  const seenRaw = window.localStorage.getItem(newClientNotifSeenKey(adminName));
  const seen = seenRaw ? new Date(seenRaw).getTime() : 0;
  return loadNewClientNotifications()
    .filter((n) => new Date(n.at).getTime() > seen)
    .filter((n) => !isNotificationDismissed(adminName, newClientNotifId(n)))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/* ─── Per-notification dismiss ───
   Lets the bell panel remove ONE notification at a time when it's
   clicked, instead of only being able to clear everything at once
   when the panel closes. Each notification (new signup, upcoming-RDV
   reminder…) gets a stable id; clicking it adds that id to this admin's
   dismissed set, so the badge count drops by exactly one right away. */
const DISMISSED_NOTIFS_KEY_PREFIX = "vetcare_admin_dismissed_notifs_";

function dismissedNotifsKey(adminName: string) {
  return `${DISMISSED_NOTIFS_KEY_PREFIX}${adminName}`;
}

function loadDismissedNotifIds(adminName: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(dismissedNotifsKey(adminName));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Stable id for a "new client" notification, used for individual dismissal. */
export function newClientNotifId(n: { email: string; at: string }): string {
  return `newclient_${n.email.trim().toLowerCase()}_${n.at}`;
}

/** Stable id for an "upcoming RDV" notification, used for individual dismissal. */
export function appointmentNotifId(appointmentId: string): string {
  return `appt_${appointmentId}`;
}

export function isNotificationDismissed(adminName: string, id: string): boolean {
  return loadDismissedNotifIds(adminName).has(id);
}

/** Dismiss exactly one notification for this admin (used when they click it). */
export function dismissNotification(adminName: string, id: string) {
  if (typeof window === "undefined") return;
  const set = loadDismissedNotifIds(adminName);
  set.add(id);
  window.localStorage.setItem(dismissedNotifsKey(adminName), JSON.stringify([...set]));
}

/* ─── Stagiaire conversation (mirrors ChatMessageIntern in espace-stagiaire/stagiaire.ts) ─── */
export type SharedInternMessage = {
  id: string;
  from: "stagiaire" | "equipe";
  author: string;
  text: string;
  at: string;
};

function internConvKey(email: string) {
  return `vetcare_conv_stagiaire_${email.trim().toLowerCase()}`;
}

export function loadInternConversation(email: string): SharedInternMessage[] {
  if (typeof window === "undefined" || !email) return [];
  try {
    const raw = window.localStorage.getItem(internConvKey(email));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveInternConversation(email: string, msgs: SharedInternMessage[]) {
  if (typeof window === "undefined" || !email) return;
  window.localStorage.setItem(internConvKey(email), JSON.stringify(msgs));
}

export function mirrorInternMessage(email: string, msg: SharedInternMessage) {
  const list = loadInternConversation(email);
  if (list.some((m) => m.id === msg.id)) return;
  list.push(msg);
  saveInternConversation(email, list);
}

export function sendAdminMessageToStagiaire(
  email: string,
  authorName: string,
  text: string
): SharedInternMessage {
  const msg: SharedInternMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    from: "equipe",
    author: authorName,
    text,
    at: new Date().toISOString(),
  };
  const list = loadInternConversation(email);
  list.push(msg);
  saveInternConversation(email, list);
  return msg;
}

export function hasUnseenInternMessage(adminName: string, email: string): boolean {
  if (typeof window === "undefined") return false;
  const list = loadInternConversation(email);
  const last = list[list.length - 1];
  if (!last || last.from !== "stagiaire") return false;
  const seen = window.localStorage.getItem(adminSeenKey(adminName, `stagiaire_${email}`));
  if (!seen) return true;
  return new Date(last.at).getTime() > new Date(seen).getTime();
}

export function markInternThreadSeenByAdmin(adminName: string, email: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(adminSeenKey(adminName, `stagiaire_${email}`), new Date().toISOString());
}

/* ─── Team (admin-to-admin) conversation: one shared thread per pair ─── */
export type SharedTeamMessage = {
  id: string;
  author: string; // sender name
  text: string;
  at: string;
};

function teamConvKey(a: string, b: string) {
  const pair = [a, b].map((n) => n.trim().toLowerCase()).sort();
  return `vetcare_conv_team_${pair[0]}__${pair[1]}`;
}

export function loadTeamConversation(a: string, b: string): SharedTeamMessage[] {
  if (typeof window === "undefined" || !a || !b) return [];
  try {
    const raw = window.localStorage.getItem(teamConvKey(a, b));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTeamConversation(a: string, b: string, msgs: SharedTeamMessage[]) {
  if (typeof window === "undefined" || !a || !b) return;
  window.localStorage.setItem(teamConvKey(a, b), JSON.stringify(msgs));
}

export function sendTeamMessage(fromName: string, toName: string, text: string): SharedTeamMessage {
  const msg: SharedTeamMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    author: fromName,
    text,
    at: new Date().toISOString(),
  };
  const list = loadTeamConversation(fromName, toName);
  list.push(msg);
  saveTeamConversation(fromName, toName, list);
  return msg;
}

function teamSeenKey(viewer: string, other: string) {
  return `vetcare_team_seen_${viewer.trim().toLowerCase()}__${other.trim().toLowerCase()}`;
}

export function markTeamThreadSeen(viewerName: string, otherName: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(teamSeenKey(viewerName, otherName), new Date().toISOString());
}

/** True when the other member's latest message hasn't been opened yet by the viewer. */
export function hasUnseenTeamMessage(viewerName: string, otherName: string): boolean {
  if (typeof window === "undefined") return false;
  const list = loadTeamConversation(viewerName, otherName);
  const last = list[list.length - 1];
  if (!last || last.author === viewerName) return false;
  const seen = window.localStorage.getItem(teamSeenKey(viewerName, otherName));
  if (!seen) return true;
  return new Date(last.at).getTime() > new Date(seen).getTime();
}

/* ─── Mentor (re)assignment: directrice decides which vet a stagiaire works with ─── */
export type MentorAssignment = {
  email: string;
  mentor: string;
  assignedAt: string;
  assignedBy: string;
};

const MENTOR_OVERRIDES_KEY = "vetcare_stagiaire_mentor_overrides";

function loadMentorOverrides(): Record<string, MentorAssignment> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MENTOR_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMentorOverrides(map: Record<string, MentorAssignment>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MENTOR_OVERRIDES_KEY, JSON.stringify(map));
}

export function getMentorOverride(email: string): MentorAssignment | null {
  const map = loadMentorOverrides();
  return map[email.trim().toLowerCase()] || null;
}

/** Directrice assigns a stagiaire to a vet: updates the override and notifies the intern. */
export function assignStagiaireMentor(email: string, mentor: string, assignedBy: string) {
  const map = loadMentorOverrides();
  map[email.trim().toLowerCase()] = {
    email,
    mentor,
    assignedAt: new Date().toISOString(),
    assignedBy,
  };
  saveMentorOverrides(map);
  sendAdminMessageToStagiaire(
    email,
    "VetCare",
    `Vous avez été affecté(e) à ${mentor} par ${assignedBy}. Votre tuteur de stage est désormais ${mentor}.`
  );
}

/* ─── Vet (re)assignment: directrice decides which vet a client's pet is followed by ─── */
export type VetAssignment = {
  email: string;
  vet: string;
  assignedAt: string;
  assignedBy: string;
};

const CLIENT_VET_OVERRIDES_KEY = "vetcare_client_vet_overrides";

function loadClientVetOverrides(): Record<string, VetAssignment> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CLIENT_VET_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveClientVetOverrides(map: Record<string, VetAssignment>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLIENT_VET_OVERRIDES_KEY, JSON.stringify(map));
}

export function getClientVetOverride(email: string): VetAssignment | null {
  const map = loadClientVetOverrides();
  return map[email.trim().toLowerCase()] || null;
}

/** Directrice (full access only) reassigns which vet follows a client's pet:
    updates the override and notifies the client directly in their space. */
export function assignClientVet(email: string, vet: string, assignedBy: string) {
  const map = loadClientVetOverrides();
  map[email.trim().toLowerCase()] = {
    email,
    vet,
    assignedAt: new Date().toISOString(),
    assignedBy,
  };
  saveClientVetOverrides(map);
  sendAdminMessageToClient(
    email,
    vet,
    "VetCare",
    `Votre suivi a été confié à ${vet} par ${assignedBy}. Votre référent est désormais ${vet}.`
  );
}

/* ─── Appointments shared across the admin dashboard ─── */
export type SharedAppointmentStatus = "à venir" | "terminé" | "annulé";

export type SharedAppointment = {
  id: string;
  clientEmail: string;
  clientName: string;
  pet?: string;
  date: string;
  time: string;
  reason: string;
  vet: string;
  status: SharedAppointmentStatus;
};

const APPOINTMENTS_KEY = "vetcare_all_appointments";

export function loadAllAppointments(): SharedAppointment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(APPOINTMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAllAppointments(list: SharedAppointment[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(list));
}

/** Called from the client space whenever an appointment is booked/cancelled. */
export function upsertSharedAppointment(a: SharedAppointment) {
  const list = loadAllAppointments();
  const idx = list.findIndex((x) => x.id === a.id);
  if (idx >= 0) list[idx] = a;
  else list.push(a);
  saveAllAppointments(list);
}

/** Called when a client fills in/updates their pet's info after already
    having booked appointments: backfills the "Animal" field on their
    existing appointments so the admin's RDV table doesn't stay stuck
    showing nothing, the way it used to before the pet form was completed. */
export function updatePetOnClientAppointments(
  clientEmail: string,
  pet: string | undefined
) {
  if (!pet) return;
  const list = loadAllAppointments();
  let changed = false;
  const updated = list.map((a) => {
    if (a.clientEmail.toLowerCase() === clientEmail.toLowerCase() && !a.pet) {
      changed = true;
      return { ...a, pet };
    }
    return a;
  });
  if (changed) saveAllAppointments(updated);
}

/** Called from the admin dashboard: mark a RDV as done/cancelled. */
export function setSharedAppointmentStatus(
  id: string,
  status: SharedAppointmentStatus
): SharedAppointment | null {
  const list = loadAllAppointments();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], status };
  saveAllAppointments(list);
  return list[idx];
}
