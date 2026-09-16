/* ─── File-based fallback store ───
   La base MySQL hébergée (Aiven) peut être momentanément injoignable
   (service en pause, DNS, quota…). Pour que les données clients —
   notamment le profil animal — soient TOUJOURS conservées côté serveur
   ("enregistrées dans la base de données du site"), les routes API
   essaient d'abord Prisma/MySQL puis, en cas d'échec, retombent sur ce
   store JSON persistant sur le disque du serveur.

   Quand MySQL redevient joignable, Prisma reprend la main automatiquement :
   ce fichier n'est lu que si la vraie base répond une erreur. */

import fs from "fs";
import os from "os";
import path from "path";

type FallbackClient = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  pet: string | null;
  petSpecies: string | null;
  petBreed: string | null;
  petGender: string | null;
  petSterilized: boolean | null;
  assignedVet: string | null;
  assignedVetBy?: string | null;
  assignedVetAt?: string | null;
  joinedAt: string;
  lastSeenMessagesAt: string | null;
};

type FallbackStagiaire = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  school: string | null;
  motivation: string | null;
  mentor: string | null;
  startDate: string;
  endDate: string;
  status: string;
  progress: number;
  joinedAt: string;
};

/* Messages / notifications / rendez-vous : structures légères et
   tolérantes (les formes exactes vivent côté client dans
   vetcare-shared.ts ; le serveur ne fait que fusionner par id). */
type AnyMessage = {
  id: string;
  at: string;
  [key: string]: unknown;
};

type NewClientNotif = {
  name: string;
  email: string;
  kind: string; // "client" | "stagiaire"
  at: string;
};

type SharedAppointmentRecord = {
  id: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type FallbackDb = {
  clients: FallbackClient[];
  stagiaires: FallbackStagiaire[];
  /* Conversations par clé (email client, email stagiaire, paire équipe) */
  convClient: Record<string, AnyMessage[]>;
  convIntern: Record<string, AnyMessage[]>;
  convTeam: Record<string, AnyMessage[]>;
  /* Marqueurs "vu" : clé complète (même format que localStorage) → ISO */
  seen: Record<string, string>;
  newClientNotifs: NewClientNotif[];
  newApptNotifs: Record<string, unknown>[];
  /* Notifications individuellement fermées, par admin */
  dismissed: Record<string, string[]>;
  appointments: SharedAppointmentRecord[];
  /* RDV déjà rappelés automatiquement (fenêtre 24 h) côté serveur */
  remindedAppointments: string[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "vetcare-db-fallback.json");

/* Sur Vercel (serverless), le disque du projet est en LECTURE SEULE :
   seule la zone /tmp est inscriptible — et son contenu survit tant que
   l'instance reste chaude. On détecte au premier accès quel emplacement
   est utilisable pour ne jamais perdre une écriture en silence.
   Pour une persistance définitive multi-appareils, la vraie base MySQL
   (DATABASE_URL) reste indispensable — voir README-DEPLOYER.md. */
const TMP_DIR = path.join(os.tmpdir(), "vetcare-data");
const TMP_FILE = path.join(TMP_DIR, "vetcare-db-fallback.json");
let activeDbFile: string | null = null;

function dirIsWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, ".write-probe");
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function resolveDbFile(): string {
  if (activeDbFile) return activeDbFile;
  try {
    if (fs.existsSync(DB_FILE)) {
      activeDbFile = DB_FILE;
      return DB_FILE;
    }
  } catch {
    /* ignore */
  }
  if (fs.existsSync(TMP_FILE)) {
    activeDbFile = TMP_FILE;
    return TMP_FILE;
  }
  /* Aucun fichier existant : on choisit le premier dossier inscriptible. */
  activeDbFile = dirIsWritable(DATA_DIR) ? DB_FILE : TMP_FILE;
  return activeDbFile;
}

/* Prisma lève des erreurs très verbeuses ; on teste simplement si la
   requête a échoué à cause de la connexion/du moteur (et pas d'une
   erreur de données). En cas de doute → fallback (aucune perte). */
export function isDbOutage(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; message?: string };
  if (typeof e.code === "string" && /^P1\d{3}$/.test(e.code)) return true; // P1001…: connexion
  const msg = (e.message || "").toLowerCase();
  return (
    msg.includes("can't reach") ||
    msg.includes("timed out") ||
    msg.includes("connection") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("etimedout") ||
    msg.includes("dns") ||
    msg.includes("protocol") ||
    msg.includes("ssl") ||
    msg.includes("terminated")
  );
}

function emptyDb(): FallbackDb {
  return {
    clients: [],
    stagiaires: [],
    convClient: {},
    convIntern: {},
    convTeam: {},
    seen: {},
    newClientNotifs: [],
    newApptNotifs: [],
    dismissed: {},
    appointments: [],
    remindedAppointments: [],
  };
}

/* Compatibilité avec les anciens fichiers JSON qui ne contenaient que
   `clients` : chaque section manquante est recréée vide. */
function ensureSections(db: Partial<FallbackDb>): FallbackDb {
  return {
    clients: Array.isArray(db.clients) ? db.clients : [],
    stagiaires: Array.isArray(db.stagiaires) ? db.stagiaires : [],
    convClient: db.convClient && typeof db.convClient === "object" ? db.convClient : {},
    convIntern: db.convIntern && typeof db.convIntern === "object" ? db.convIntern : {},
    convTeam: db.convTeam && typeof db.convTeam === "object" ? db.convTeam : {},
    seen: db.seen && typeof db.seen === "object" ? db.seen : {},
    newClientNotifs: Array.isArray(db.newClientNotifs) ? db.newClientNotifs : [],
    newApptNotifs: Array.isArray(db.newApptNotifs) ? db.newApptNotifs : [],
    dismissed: db.dismissed && typeof db.dismissed === "object" ? db.dismissed : {},
    appointments: Array.isArray(db.appointments) ? db.appointments : [],
    remindedAppointments: Array.isArray(db.remindedAppointments) ? db.remindedAppointments : [],
  };
}

export function readFallbackDb(): FallbackDb {
  /* On lit l'emplacement actif puis, par sécurité, l'autre (une écriture
     peut avoir eu lieu sur /tmp pendant qu'un fichier data/ était déployé). */
  for (const file of [resolveDbFile(), TMP_FILE, DB_FILE]) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<FallbackDb>;
      if (parsed && typeof parsed === "object") return ensureSections(parsed);
    } catch {
      /* fichier absent/corrompu : on tente le suivant */
    }
  }
  return emptyDb();
}

function writeFallbackDb(db: FallbackDb) {
  try {
    const target = resolveDbFile();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // écriture atomique : fichier temporaire puis rename
    const tmp = target + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, target);
  } catch {
    /* disque plein / lecture seule : on n'interrompt pas la requête */
  }
}

function newId() {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/* ─── Clients ─── */

export function fallbackListClients(): FallbackClient[] {
  return readFallbackDb().clients.sort(
    (a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
  );
}

export function fallbackGetClient(email: string): FallbackClient | null {
  const db = readFallbackDb();
  return (
    db.clients.find(
      (c) => c.email.toLowerCase() === email.toLowerCase()
    ) ?? null
  );
}

function normalizeClient(data: Partial<FallbackClient> & { email: string; name?: string }): FallbackClient {
  const now = new Date().toISOString();
  return {
    id: data.id || newId(),
    name: data.name ?? data.email.split("@")[0],
    email: data.email,
    phone: data.phone ?? null,
    pet: data.pet ?? null,
    petSpecies: data.petSpecies ?? null,
    petBreed: data.petBreed ?? null,
    petGender: data.petGender ?? null,
    petSterilized: data.petSterilized ?? null,
    assignedVet: data.assignedVet ?? null,
    assignedVetBy: data.assignedVetBy ?? null,
    assignedVetAt: data.assignedVetAt ?? null,
    joinedAt: data.joinedAt || now,
    lastSeenMessagesAt: data.lastSeenMessagesAt ?? null,
  };
}

/** Crée ou met à jour (upsert) un client dans le store de secours.
    Ne réécrit un champ que si une vraie valeur est fournie — pour ne
    jamais effacer une info existante avec un `undefined`. */
export function fallbackUpsertClient(
  data: Partial<FallbackClient> & { email: string }
): FallbackClient {
  const db = readFallbackDb();
  const idx = db.clients.findIndex(
    (c) => c.email.toLowerCase() === data.email.toLowerCase()
  );
  if (idx >= 0) {
    const prev = db.clients[idx];
    const merged = normalizeClient({
      ...prev,
      ...Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== "")
      ),
      id: prev.id, // l'id ne change jamais
      joinedAt: prev.joinedAt,
    } as Partial<FallbackClient> & { email: string });
    // les champs explicitement fournis à null (ex: lastSeenMessagesAt) restent appliqués
    for (const [k, v] of Object.entries(data)) {
      if (v === null) (merged as Record<string, unknown>)[k] = null;
    }
    db.clients[idx] = merged;
    writeFallbackDb(db);
    return merged;
  }
  const created = normalizeClient(
    data as Partial<FallbackClient> & { email: string; name?: string }
  );
  db.clients.push(created);
  writeFallbackDb(db);
  return created;
}

/** Mise à jour partielle stricte (équivalent PATCH) — upsert si absent. */
export function fallbackUpdateClient(
  email: string,
  data: Record<string, unknown>
): FallbackClient {
  const existing = fallbackGetClient(email);
  const payload = { ...data, email } as Partial<FallbackClient> & { email: string };
  if (!existing) return fallbackUpsertClient(payload);
  return fallbackUpsertClient({ ...payload, name: (data.name as string) ?? undefined });
}

export function fallbackDeleteClient(email: string) {
  const db = readFallbackDb();
  db.clients = db.clients.filter(
    (c) => c.email.toLowerCase() !== email.toLowerCase()
  );
  writeFallbackDb(db);
}

/* ─── Stagiaires (même logique de secours que les clients) ─── */

function normalizeStagiaire(
  data: Partial<FallbackStagiaire> & { email: string; name?: string }
): FallbackStagiaire {
  const now = new Date().toISOString();
  return {
    id: data.id || `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: data.name ?? data.email.split("@")[0],
    email: data.email,
    phone: data.phone ?? null,
    school: data.school ?? null,
    motivation: data.motivation ?? null,
    mentor: data.mentor ?? null,
    startDate: data.startDate || now,
    endDate: data.endDate || now,
    status: data.status || "en cours",
    progress: typeof data.progress === "number" ? data.progress : 0,
    joinedAt: data.joinedAt || now,
  };
}

export function fallbackListStagiaires(): FallbackStagiaire[] {
  return readFallbackDb().stagiaires.sort(
    (a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
  );
}

export function fallbackUpsertStagiaire(
  data: Partial<FallbackStagiaire> & { email: string }
): FallbackStagiaire {
  const db = readFallbackDb();
  const idx = db.stagiaires.findIndex(
    (s) => s.email.toLowerCase() === data.email.toLowerCase()
  );
  if (idx >= 0) {
    const prev = db.stagiaires[idx];
    const merged = normalizeStagiaire({
      ...prev,
      ...Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== "")
      ),
      id: prev.id,
      joinedAt: prev.joinedAt,
      startDate: prev.startDate,
      endDate: prev.endDate,
    });
    db.stagiaires[idx] = merged;
    writeFallbackDb(db);
    return merged;
  }
  const created = normalizeStagiaire(data);
  db.stagiaires.push(created);
  writeFallbackDb(db);
  return created;
}

/* ─── Sync multi-appareils : état partagé + mutations ───
   Le client (vetcare-shared.ts) pousse chaque écriture via POST /api/sync
   et fusionne l'état renvoyé par GET /api/sync dans son localStorage.
   Le serveur est ainsi la source de vérité commune à tous les appareils
   ("enregistré dans la base de données du site"), même quand MySQL est
   injoignable (fallback JSON) ; dès que Prisma reprend la main, les
   routes existantes basculeront dessus sans changement côté client. */

export type SyncMutation =
  | { type: "client_message"; email: string; message: AnyMessage }
  | { type: "intern_message"; email: string; message: AnyMessage }
  | { type: "team_message"; pair: [string, string]; message: AnyMessage }
  | { type: "seen"; key: string; at: string }
  | { type: "new_client_notif"; notif: { name: string; email: string; kind?: string; at: string } }
  | { type: "new_appt_notif"; notif: Record<string, unknown> }
  | { type: "dismiss"; admin: string; id: string }
  | { type: "appointment"; appointment: SharedAppointmentRecord }
  | { type: "stagiaire"; stagiaire: Partial<FallbackStagiaire> & { email: string } };

const MAX_MESSAGES_PER_CONV = 500;

function teamPairKey(a: string, b: string): string {
  const p = [a, b].map((n) => n.trim().toLowerCase()).sort();
  return `${p[0]}||${p[1]}`;
}

function appendMessage(
  bucket: Record<string, AnyMessage[]>,
  key: string,
  message: AnyMessage
): boolean {
  if (!bucket[key]) bucket[key] = [];
  const list = bucket[key];
  if (list.some((m) => m.id === message.id)) return false;
  list.push(message);
  list.sort((x, y) => new Date(x.at).getTime() - new Date(y.at).getTime());
  if (list.length > MAX_MESSAGES_PER_CONV) list.splice(0, list.length - MAX_MESSAGES_PER_CONV);
  return true;
}

/** Applique une mutation idempotente (fusion par id / par date). */
export function applySyncMutation(m: SyncMutation): void {
  const db = readFallbackDb();
  let changed = false;

  switch (m.type) {
    case "client_message": {
      const key = m.email.trim().toLowerCase();
      changed = appendMessage(db.convClient, key, m.message);
      break;
    }
    case "intern_message": {
      const key = m.email.trim().toLowerCase();
      changed = appendMessage(db.convIntern, key, m.message);
      break;
    }
    case "team_message": {
      const key = teamPairKey(m.pair[0], m.pair[1]);
      changed = appendMessage(db.convTeam, key, m.message);
      break;
    }
    case "seen": {
      if (!m.key) break;
      const prev = db.seen[m.key];
      if (!prev || new Date(m.at).getTime() > new Date(prev).getTime()) {
        db.seen[m.key] = m.at;
        changed = true;
      }
      break;
    }
    case "new_client_notif": {
      const entry: NewClientNotif = {
        name: m.notif.name,
        email: m.notif.email,
        kind: m.notif.kind || "client",
        at: m.notif.at,
      };
      if (
        !db.newClientNotifs.some(
          (n) => n.email.toLowerCase() === entry.email.toLowerCase() && n.at === entry.at
        )
      ) {
        db.newClientNotifs.push(entry);
        changed = true;
      }
      break;
    }
    case "new_appt_notif": {
      const apptId = String(m.notif.appointmentId || "");
      if (apptId && !db.newApptNotifs.some((n) => String(n.appointmentId) === apptId)) {
        db.newApptNotifs.push(m.notif);
        changed = true;
      }
      break;
    }
    case "dismiss": {
      const admin = m.admin.trim().toLowerCase();
      if (!db.dismissed[admin]) db.dismissed[admin] = [];
      if (!db.dismissed[admin].includes(m.id)) {
        db.dismissed[admin].push(m.id);
        changed = true;
      }
      break;
    }
    case "appointment": {
      const idx = db.appointments.findIndex((a) => a.id === m.appointment.id);
      if (idx < 0) {
        db.appointments.push(m.appointment);
        changed = true;
      } else {
        const prev = db.appointments[idx];
        const prevAt = prev.updatedAt || "";
        const nextAt = m.appointment.updatedAt || "";
        if (nextAt >= prevAt) {
          db.appointments[idx] = m.appointment;
          changed = true;
        }
      }
      break;
    }
    case "stagiaire": {
      fallbackUpsertStagiaire(m.stagiaire); // écrit lui-même le fichier
      return;
    }
  }

  if (changed) writeFallbackDb(db);
}

/** Renvoie tout l'état partagé, après avoir exécuté les rappels auto 24 h.
    C'est le cœur du "message automatique au client quand le RDV approche" :
    il part du SERVEUR, donc même si aucun admin n'ouvre son tableau de
    bord, le client reçoit son rappel dans sa messagerie (une seule fois
    par RDV, garde rappelledAppointments). */
export function readSyncState(): FallbackDb {
  const db = readFallbackDb();
  const now = Date.now();
  const WINDOW = 24 * 60 * 60 * 1000;
  let changed = false;

  for (const a of db.appointments) {
    if (a.status !== "à venir") continue;
    if (db.remindedAppointments.includes(a.id)) continue;
    const date = String(a.date || "");
    const time = String(a.time || "00:00");
    const when = new Date(`${date}T${time}`).getTime();
    if (isNaN(when) || when < now || when - now > WINDOW) continue;

    const email = String(a.clientEmail || "").trim().toLowerCase();
    const clientName = String(a.clientName || "");
    const vet = String(a.vet || "");
    const pet = a.pet ? String(a.pet) : "";
    const whenFr = isNaN(new Date(`${date}T00:00:00`).getTime())
      ? date
      : new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
    const reminder: AnyMessage = {
      id: `remind_${a.id}`,
      from: "team",
      author: "VetCare — Rappel automatique",
      text: `Bonjour ${clientName}, petit rappel : vous avez rendez-vous ${whenFr} à ${time} avec ${vet}${pet ? ` pour ${pet}` : ""}. En cas d'empêchement, contactez-nous ou annulez depuis votre espace. À bientôt !`,
      at: new Date().toISOString(),
      with: vet,
    };
    appendMessage(db.convClient, email, reminder);
    db.remindedAppointments.push(a.id);
    changed = true;
  }

  if (changed) writeFallbackDb(db);
  return db;
}
