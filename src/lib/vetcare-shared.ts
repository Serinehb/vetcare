/* ─── Cross-space shared store ───
   Chaque espace (client, stagiaire, admin) garde son enregistrement
   localStorage. Ces helpers ajoutent un jeu de clés *partagées* pour que
   les actions d'un côté soient visibles de l'autre. Depuis la synchro
   serveur, chaque écriture locale est AUSSI poussée vers la base du site
   (/api/sync → store serveur persistant), et chaque espace récupère
   régulièrement l'état du serveur (startServerSync) : les messages,
   notifications, RDV et marqueurs "vu" fonctionnent donc entre
   appareils/navigateurs différents, pas seulement sur un même poste. */

/* ─── Server sync : envoi des écritures vers la base du site ───
   Fire-and-forget : jamais bloquant, jamais d'erreur remontée à l'UI.
   Si le serveur est injoignable, le localStorage reste la source
   affichée et le prochain push repartira à la prochaine écriture. */
function pushSync(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

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
  pushSync({ type: "client_message", email, message: msg });
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
  pushSync({ type: "client_message", email, message: msg });
  return msg;
}

function adminSeenKey(adminName: string, email: string) {
  return `vetcare_admin_seen_${adminName}__${email.trim().toLowerCase()}`;
}

export function markClientThreadSeenByAdmin(adminName: string, email: string) {
  if (typeof window === "undefined") return;
  const key = adminSeenKey(adminName, email);
  const at = new Date().toISOString();
  window.localStorage.setItem(key, at);
  pushSync({ type: "seen", key, at });
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
  kind?: "client" | "stagiaire";
  at: string;
};

const NEW_CLIENT_NOTIFS_KEY = "vetcare_new_client_notifications";

export function addNewClientNotification(
  name: string,
  email: string,
  kind: "client" | "stagiaire" = "client"
) {
  if (typeof window === "undefined") return;
  try {
    const list = loadNewClientNotifications();
    const entry = { name, email, kind, at: new Date().toISOString() };
    list.push(entry);
    window.localStorage.setItem(NEW_CLIENT_NOTIFS_KEY, JSON.stringify(list));
    pushSync({ type: "new_client_notif", notif: entry });
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
  pushSync({ type: "dismiss", admin: adminName, id });
}

/* ─── New appointment notifications ───
   Fired once per brand-new booking (not on cancellations or status
   changes) so the admin dashboard can surface it in the notification
   bell the moment a client reserves a rendez-vous. Same per-admin
   "seen/dismiss" mechanics as the new-signup notifications above. */
export type NewAppointmentNotification = {
  appointmentId: string;
  clientName: string;
  clientEmail: string;
  date: string;
  time: string;
  vet: string;
  at: string;
};

const NEW_APPOINTMENT_NOTIFS_KEY = "vetcare_new_appointment_notifications";

export function addAppointmentNotification(a: {
  appointmentId: string;
  clientName: string;
  clientEmail: string;
  date: string;
  time: string;
  vet: string;
}) {
  if (typeof window === "undefined") return;
  try {
    const list = loadNewAppointmentNotifications();
    // One notification per booking: a re-upsert (cancel/reschedule of the
    // same appointment id) never duplicates the bell entry.
    if (list.some((n) => n.appointmentId === a.appointmentId)) return;
    const entry = { ...a, at: new Date().toISOString() };
    list.push(entry);
    window.localStorage.setItem(NEW_APPOINTMENT_NOTIFS_KEY, JSON.stringify(list));
    pushSync({ type: "new_appt_notif", notif: entry });
  } catch {
    /* ignore */
  }
}

export function loadNewAppointmentNotifications(): NewAppointmentNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NEW_APPOINTMENT_NOTIFS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Stable id for a "new appointment" notification, used for individual
    dismissal. Distinct from appointmentNotifId (the upcoming-RDV
    reminder) so both can coexist in the bell without colliding. */
export function newAppointmentNotifId(n: { appointmentId: string; at: string }): string {
  return `newappt_${n.appointmentId}_${n.at}`;
}

/** New-booking notifications this admin hasn't dismissed yet, newest first. */
export function getUnseenNewAppointmentNotifications(adminName: string): NewAppointmentNotification[] {
  if (typeof window === "undefined") return [];
  return loadNewAppointmentNotifications()
    .filter((n) => !isNotificationDismissed(adminName, newAppointmentNotifId(n)))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
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
  pushSync({ type: "intern_message", email, message: msg });
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
  pushSync({ type: "intern_message", email, message: msg });
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
  const key = adminSeenKey(adminName, `stagiaire_${email}`);
  const at = new Date().toISOString();
  window.localStorage.setItem(key, at);
  pushSync({ type: "seen", key, at });
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
  pushSync({ type: "team_message", pair: [fromName, toName], message: msg });
  return msg;
}

function teamSeenKey(viewer: string, other: string) {
  return `vetcare_team_seen_${viewer.trim().toLowerCase()}__${other.trim().toLowerCase()}`;
}

export function markTeamThreadSeen(viewerName: string, otherName: string) {
  if (typeof window === "undefined") return;
  const key = teamSeenKey(viewerName, otherName);
  const at = new Date().toISOString();
  window.localStorage.setItem(key, at);
  pushSync({ type: "seen", key, at });
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
  /* Date de dernière écriture : sert à la fusion multi-appareils
     (la version la plus récente gagne, côté serveur ET local). */
  updatedAt?: string;
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
  const stamped: SharedAppointment = { ...a, updatedAt: new Date().toISOString() };
  const list = loadAllAppointments();
  const idx = list.findIndex((x) => x.id === a.id);
  if (idx >= 0) list[idx] = stamped;
  else list.push(stamped);
  saveAllAppointments(list);
  pushSync({ type: "appointment", appointment: stamped });
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
  const now = new Date().toISOString();
  const updated = list.map((a) => {
    if (a.clientEmail.toLowerCase() === clientEmail.toLowerCase() && !a.pet) {
      changed = true;
      const stamped = { ...a, pet, updatedAt: now };
      pushSync({ type: "appointment", appointment: stamped });
      return stamped;
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
  const stamped: SharedAppointment = {
    ...list[idx],
    status,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = stamped;
  saveAllAppointments(list);
  pushSync({ type: "appointment", appointment: stamped });
  return stamped;
}

/* ─── Synchronisation multi-appareils (récupération serveur) ───
   Récupère l'état partagé depuis la base du site (GET /api/sync) et le
   fusionne dans le localStorage local : messages inconnus ajoutés,
   marqueurs "vu" à la date la plus récente, notifications en union,
   RDV à la version la plus récente. Renvoie true si quelque chose a
   changé (pour déclencher un rafraîchissement de l'affichage). */
export async function pullServerSync(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  let state: {
    convClient?: Record<string, unknown[]>;
    convIntern?: Record<string, unknown[]>;
    convTeam?: Record<string, unknown[]>;
    seen?: Record<string, string>;
    newClientNotifs?: { name: string; email: string; kind?: string; at: string }[];
    newApptNotifs?: Record<string, unknown>[];
    dismissed?: Record<string, string[]>;
    appointments?: SharedAppointment[];
    stagiaires?: Record<string, unknown>[];
  } | null = null;
  try {
    const res = await fetch("/api/sync", { cache: "no-store" });
    if (!res.ok) return false;
    state = await res.json();
  } catch {
    return false; // serveur injoignable : on garde l'état local tel quel
  }
  if (!state) return false;

  let changed = false;

  /* Conversations client : union par id de message, tri par date. */
  Object.entries(state.convClient || {}).forEach(([key, msgs]) => {
    if (!Array.isArray(msgs) || !msgs.length) return;
    const local = loadClientConversation(key);
    const ids = new Set(local.map((m) => m.id));
    const add = (msgs as SharedClientMessage[]).filter((m) => m && m.id && !ids.has(m.id));
    if (add.length) {
      saveClientConversation(key, [...local, ...add].sort((a, b) => a.at.localeCompare(b.at)));
      changed = true;
    }
  });

  /* Conversations stagiaire. */
  Object.entries(state.convIntern || {}).forEach(([key, msgs]) => {
    if (!Array.isArray(msgs) || !msgs.length) return;
    const local = loadInternConversation(key);
    const ids = new Set(local.map((m) => m.id));
    const add = (msgs as SharedInternMessage[]).filter((m) => m && m.id && !ids.has(m.id));
    if (add.length) {
      saveInternConversation(key, [...local, ...add].sort((a, b) => a.at.localeCompare(b.at)));
      changed = true;
    }
  });

  /* Conversations équipe — la clé serveur "a||b" doit être traduite en
     clé locale (même tri que teamConvKey). */
  Object.entries(state.convTeam || {}).forEach(([key, msgs]) => {
    if (!Array.isArray(msgs) || !msgs.length) return;
    const pair = key.split("||");
    if (pair.length !== 2) return;
    const local = loadTeamConversation(pair[0], pair[1]);
    const ids = new Set(local.map((m) => m.id));
    const add = (msgs as SharedTeamMessage[]).filter((m) => m && m.id && !ids.has(m.id));
    if (add.length) {
      saveTeamConversation(pair[0], pair[1], [...local, ...add].sort((a, b) => a.at.localeCompare(b.at)));
      changed = true;
    }
  });

  /* Marqueurs "vu" : la date la plus récente gagne. */
  Object.entries(state.seen || {}).forEach(([key, at]) => {
    if (!key || typeof at !== "string") return;
    const local = window.localStorage.getItem(key);
    if (!local || new Date(at).getTime() > new Date(local).getTime()) {
      window.localStorage.setItem(key, at);
      changed = true;
    }
  });

  /* Notifications "nouvelle inscription" : union par email+date. */
  if (Array.isArray(state.newClientNotifs) && state.newClientNotifs.length) {
    const local = loadNewClientNotifications();
    const seenIds = new Set(local.map((n) => `${n.email.toLowerCase()}|${n.at}`));
    const add = state.newClientNotifs.filter(
      (n) => n && n.email && !seenIds.has(`${n.email.toLowerCase()}|${n.at}`)
    );
    if (add.length) {
      const merged = [...local, ...add.map((n) => ({ name: n.name, email: n.email, kind: (n.kind as "client" | "stagiaire" | undefined) ?? "client", at: n.at }))];
      window.localStorage.setItem(NEW_CLIENT_NOTIFS_KEY, JSON.stringify(merged));
      changed = true;
    }
  }

  /* Notifications "nouveau rendez-vous" : union par appointmentId. */
  if (Array.isArray(state.newApptNotifs) && state.newApptNotifs.length) {
    const local = loadNewAppointmentNotifications();
    const ids = new Set(local.map((n) => n.appointmentId));
    const add = state.newApptNotifs.filter(
      (n) => n && n.appointmentId && !ids.has(String(n.appointmentId))
    ) as NewAppointmentNotification[];
    if (add.length) {
      window.localStorage.setItem(NEW_APPOINTMENT_NOTIFS_KEY, JSON.stringify([...local, ...add]));
      changed = true;
    }
  }

  /* Notifications fermées par admin : union. */
  Object.entries(state.dismissed || {}).forEach(([admin, ids]) => {
    if (!Array.isArray(ids) || !ids.length) return;
    const local = loadDismissedNotifIds(admin);
    const add = ids.filter((id) => !local.has(id));
    if (add.length) {
      const merged = new Set([...local, ...add]);
      window.localStorage.setItem(dismissedNotifsKey(admin), JSON.stringify([...merged]));
      changed = true;
    }
  });

  /* RDV : la version avec updatedAt le plus récent gagne ; les RDV
     inconnus sont ajoutés (restauration multi-appareils incluse). */
  if (Array.isArray(state.appointments) && state.appointments.length) {
    const local = loadAllAppointments();
    const byId = new Map(local.map((a) => [a.id, a]));
    let apptsChanged = false;
    state.appointments.forEach((server) => {
      if (!server || !server.id) return;
      const localA = byId.get(server.id);
      if (!localA) {
        byId.set(server.id, server);
        apptsChanged = true;
      } else {
        const localAt = localA.updatedAt || "";
        const serverAt = server.updatedAt || "";
        if (serverAt > localAt) {
          byId.set(server.id, server);
          apptsChanged = true;
        }
      }
    });
    if (apptsChanged) {
      saveAllAppointments([...byId.values()]);
      changed = true;
    }
  }

  return changed;
}

/* ─── Boucle de synchronisation live ───
   Démarre un cycle : pull immédiat, puis toutes les 4 s et à chaque
   retour sur l'onglet. Appelle onChange() quand le serveur a apporté
   quelque chose de nouveau, pour que la page relise le localStorage. */
export function startServerSync(onChange?: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  let stopped = false;
  let busy = false;

  const tick = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      const changed = await pullServerSync();
      if (changed && onChange && !stopped) onChange();
    } catch {
      /* jamais propagé */
    } finally {
      busy = false;
    }
  };

  void tick();
  const timer = window.setInterval(tick, 4000);
  const onFocus = () => void tick();
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onFocus);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onFocus);
  };
}
