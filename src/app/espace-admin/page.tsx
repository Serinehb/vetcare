"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import VetSelect from "./components/VetSelect";
import {
  ADMIN_TEAM,
  loadAdmin,
  saveAdmin,
  clearAdmin,
  isDirectrice,
  loadAllClients,
  loadAllStagiaires,
  filterClientsForAdmin,
  filterStagiairesForAdmin,
  reassignStagiaireMentor,
  reassignClientVet,
  removeClientForAdmin,
  checkAndSendAppointmentReminders,
  mergeDbClientsIntoAdminList,
  mergeDbStagiairesIntoAdminList,
  type AdminUser,
} from "./admin";
import {
  loadAllAppointments,
  setSharedAppointmentStatus,
  loadClientConversation,
  sendAdminMessageToClient,
  hasUnseenClientMessage,
  markClientThreadSeenByAdmin,
  loadInternConversation,
  sendAdminMessageToStagiaire,
  hasUnseenInternMessage,
  markInternThreadSeenByAdmin,
  loadTeamConversation,
  sendTeamMessage,
  hasUnseenTeamMessage,
  markTeamThreadSeen,
  getUnseenNewClientNotifications,
  getUnseenNewAppointmentNotifications,
  isNotificationDismissed,
  dismissNotification,
  newClientNotifId,
  newAppointmentNotifId,
  appointmentNotifId,
  startServerSync,
  type SharedAppointment,
} from "../../lib/vetcare-shared";

type TabId = "vue" | "clients" | "stagiaires" | "equipe" | "rdv" | "messagerie";
const ADMIN_ACTIVE_TAB_KEY = "vetcare_admin_active_tab";
const ADMIN_TAB_IDS: TabId[] = ["vue", "clients", "stagiaires", "equipe", "rdv", "messagerie"];

const navItems: { id: TabId; label: string; icon: string }[] = [
  { id: "vue", label: "Tableau de bord", icon: "fa-solid fa-gauge" },
  { id: "clients", label: "Clients", icon: "fa-solid fa-users" },
  { id: "rdv", label: "Rendez-vous", icon: "fa-solid fa-calendar-check" },
  { id: "stagiaires", label: "Stagiaires", icon: "fa-solid fa-graduation-cap" },
  { id: "equipe", label: "L'équipe", icon: "fa-solid fa-user-doctor" },
  { id: "messagerie", label: "Messagerie", icon: "fa-solid fa-comments" },
];

const tabTitles: Record<TabId, { title: string; subtitle: string }> = {
  vue: { title: "Tableau de bord", subtitle: "Vue d'ensemble de votre activité" },
  clients: { title: "Clients", subtitle: "Gestion de vos clients et leurs animaux" },
  rdv: { title: "Rendez-vous", subtitle: "Suivi des rendez-vous à venir et passés" },
  stagiaires: { title: "Stagiaires", subtitle: "Suivi de vos stagiaires" },
  equipe: { title: "L'équipe", subtitle: "Les membres de l'équipe VetCare" },
  messagerie: { title: "Messagerie", subtitle: "Discutez avec vos clients, stagiaires et l'équipe" },
};

const REMINDER_PRESET =
  "🔔 Rappel : pensez à planifier le rappel de vaccination de votre animal. Contactez-nous pour prendre rendez-vous à votre convenance.";

function initials(name: string) {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : "?";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/* ─── Custom animated scrollbar ─── */
function useCustomScrollbar() {
  const [thumb, setThumb] = useState({ height: 0, top: 0 });
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      if (scrollable <= 0) { setThumb({ height: 0, top: 0 }); return; }
      const ratio = doc.clientHeight / doc.scrollHeight;
      const trackHeight = doc.clientHeight - 16;
      const height = Math.max(ratio * trackHeight, 40);
      const top = (doc.scrollTop / scrollable) * (trackHeight - height) + 8;
      setThumb({ height, top });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  return { thumb, visible, setVisible };
}

/* ─── LOGIN SCREEN ─── */
function AdminLogin({ onLogin }: { onLogin: (a: AdminUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setError("");
    if (!email.trim()) { setError("Veuillez entrer votre email"); return; }
    if (!password.trim()) { setError("Veuillez entrer votre mot de passe"); return; }

    setLoading(true);
    setTimeout(() => {
      const vet = ADMIN_TEAM.find(
        (v) => v.email.toLowerCase() === email.trim().toLowerCase() && v.password === password
      );
      if (!vet) {
        setError("Email ou mot de passe incorrect");
        setLoading(false);
        return;
      }
      onLogin({ name: vet.name, role: vet.adminRole, img: vet.img, loggedAt: new Date().toISOString() });
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#f4f7f6] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-[#2c8c99] text-white flex items-center justify-center text-3xl mx-auto mb-4 shadow-[0_8px_25px_rgba(44,140,153,0.3)]">
            <i className="fa-solid fa-shield-halved" />
          </div>
          <h1 className="text-3xl font-bold text-[#333] mb-2">Espace Admin</h1>
          <p className="text-sm text-[#888]">Connectez-vous pour accéder au tableau de bord VetCare</p>
        </div>

        <div className="bg-white rounded-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.08)] p-8">
          <div className="space-y-5 mb-6">
            {/* Email field */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#888] mb-2">
                <i className="fa-solid fa-envelope mr-1.5 text-[#2c8c99]" />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="nom@vetcare.com"
                className="w-full px-4 py-3.5 rounded-[14px] border-2 border-[#eee] bg-[#f9fbfb] text-sm text-[#333] placeholder:text-[#bbb] outline-none transition-all duration-300 focus:border-[#2c8c99] focus:bg-white focus:shadow-[0_0_0_4px_rgba(44,140,153,0.1)]"
              />
            </div>

            {/* Password field */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#888] mb-2">
                <i className="fa-solid fa-lock mr-1.5 text-[#2c8c99]" />
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Votre mot de passe"
                  className="w-full px-4 py-3.5 pr-12 rounded-[14px] border-2 border-[#eee] bg-[#f9fbfb] text-sm text-[#333] placeholder:text-[#bbb] outline-none transition-all duration-300 focus:border-[#2c8c99] focus:bg-white focus:shadow-[0_0_0_4px_rgba(44,140,153,0.1)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#bbb] hover:text-[#2c8c99] transition-colors"
                >
                  <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-500 text-sm px-4 py-3 rounded-[12px] mb-4">
              <i className="fa-solid fa-circle-exclamation" />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3.5 rounded-full text-base font-bold bg-[#2c8c99] text-white transition-all duration-300 hover:bg-[#1f636d] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(44,140,153,0.3)] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" />
                Connexion...
              </>
            ) : (
              "Se connecter"
            )}
          </button>
        </div>
        <p className="text-center mt-6">
          <Link href="/" className="text-sm text-[#2c8c99] font-medium hover:underline">
            <i className="fa-solid fa-arrow-left mr-1" />
            Retour au site
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ─── MAIN ADMIN DASHBOARD ─── */
export default function AdminPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);
  /* Onglet actif : persisté dans localStorage pour qu'un rafraîchissement
     de la page (F5) reste sur le même onglet au lieu de revenir à "vue". */
  const [tab, setTabState] = useState<TabId>("vue");
  const setTab = (next: TabId) => {
    setTabState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ADMIN_ACTIVE_TAB_KEY, next);
    }
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeThreadEmail, setActiveThreadEmail] = useState<string | null>(null);
  const [threadDraft, setThreadDraft] = useState("");
  const [msgCategory, setMsgCategory] = useState<"clients" | "stagiaires" | "equipe">("clients");
  const [activeStagiaireEmail, setActiveStagiaireEmail] = useState<string | null>(null);
  const [activeTeamMemberName, setActiveTeamMemberName] = useState<string | null>(null);
  const [teamThreadDraft, setTeamThreadDraft] = useState("");
  const [stagThreadDraft, setStagThreadDraft] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  // footerRef removed (no footer in admin)
  const { thumb, visible: scrollbarVisible, setVisible: setScrollbarVisible } = useCustomScrollbar();

  const fullAccess = admin ? isDirectrice(admin) : false;

  useEffect(() => {
    const stored = loadAdmin();
    setAdmin(stored);
    setChecked(true);
    const storedTab = window.localStorage.getItem(ADMIN_ACTIVE_TAB_KEY) as TabId | null;
    if (storedTab && ADMIN_TAB_IDS.includes(storedTab)) {
      setTabState(storedTab);
    }
    checkAndSendAppointmentReminders();
  }, []);

  /* ─── Synchronisation multi-appareils (base de données du site) ───
     Toutes les 4 s (et à chaque retour sur l'onglet) : récupération de
     l'état partagé (messages, notifications, RDV, marqueurs "vu") et
     rafraîchissement de l'affichage si le serveur a apporté du nouveau.
     C'est ce qui rend la cloche, le badge Messagerie et les RDV
     réactifs même quand un client écrit depuis un autre appareil. */
  useEffect(() => {
    return startServerSync(() => setRefreshTick((t) => t + 1));
  }, []);

  /* Fusion des clients/stagiaires enregistrés en base dans les listes du
     tableau de bord : un inscrit depuis un autre appareil apparaît ici
     (et les fiches complétées — race, sexe… — restent à jour). */
  useEffect(() => {
    let alive = true;
    const pullLists = async () => {
      try {
        const res = await fetch("/api/clients", { cache: "no-store" });
        if (res.ok) mergeDbClientsIntoAdminList(await res.json());
      } catch {
        /* base injoignable : listes locales conservées */
      }
      try {
        const res = await fetch("/api/stagiaires", { cache: "no-store" });
        if (res.ok) mergeDbStagiairesIntoAdminList(await res.json());
      } catch {
        /* idem */
      }
      if (alive) setRefreshTick((t) => t + 1);
    };
    void pullLists();
    const timer = window.setInterval(pullLists, 12000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setScrollbarVisible(true), 800);
    return () => clearTimeout(timer);
  }, [setScrollbarVisible]);

  /* Scroll lock — un seul mécanisme pour tous les panneaux (drawer, menu
     utilisateur, recherche, messagerie) : body figé + scroll restauré
     à la fermeture (instantané, même position exacte). */
  const scrollLockRef = useRef<number | null>(null);
  const unlockBodyScroll = () => {
    if (scrollLockRef.current !== null) {
      const y = scrollLockRef.current;
      scrollLockRef.current = null;
      document.body.classList.remove("modal-open");
      document.body.style.top = "";
      delete document.body.dataset.scrollY;
      window.scrollTo({ top: y, left: 0, behavior: "instant" });
    }
  };
  useEffect(() => {
    const shouldLock = sidebarOpen || userMenuOpen || searchOpen || messagingOpen;
    if (shouldLock) {
      /* Déjà verrouillé (autre panneau ouvert) : on garde la position
         d'origine au lieu de capturer scrollY (= 0 quand le body est fixé). */
      if (scrollLockRef.current === null) scrollLockRef.current = window.scrollY;
      const y = scrollLockRef.current;
      document.body.style.top = `-${y}px`;
      document.body.dataset.scrollY = String(y);
      document.body.classList.add("modal-open");
    } else {
      unlockBodyScroll();
    }
    return () => {
      /* Déverrouillage aussi au démontage (changement de page). */
      unlockBodyScroll();
    };
  }, [sidebarOpen, userMenuOpen, searchOpen, messagingOpen]);

  /* Click outside user menu / notifications / more options / search */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* (Le scroll lock de la messagerie est géré par l'effet unique ci-dessus,
     avec drawer/menu/recherche — un seul verrou pour tous les panneaux.) */

  /* Data */
  const allClients = useMemo(() => loadAllClients(), [tab, refreshTick]);
  const allStagiaires = useMemo(() => loadAllStagiaires(), [tab, refreshTick]);
  const clients = admin ? filterClientsForAdmin(admin, allClients) : [];
  const stagiaires = admin ? filterStagiairesForAdmin(admin, allStagiaires) : [];
  const allAppointments = useMemo(() => loadAllAppointments(), [tab, refreshTick]);
  const clientEmails = useMemo(() => new Set(clients.map((c) => c.email.toLowerCase())), [clients]);
  const scopedAppointments = useMemo(
    () => allAppointments.filter((a) => clientEmails.has(a.clientEmail.toLowerCase())),
    [allAppointments, clientEmails]
  );
  const upcomingAppointments = useMemo(
    () =>
      scopedAppointments
        .filter((a) => a.status === "à venir")
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
    [scopedAppointments]
  );
  const pastAppointments = useMemo(
    () => scopedAppointments.filter((a) => a.status !== "à venir"),
    [scopedAppointments]
  );
  const soonAppointments = useMemo(() => {
    const in3Days = Date.now() + 3 * 24 * 60 * 60 * 1000;
    return upcomingAppointments
      .filter((a) => new Date(`${a.date}T${a.time || "00:00"}`).getTime() <= in3Days)
      .filter((a) => !admin || !isNotificationDismissed(admin.name, appointmentNotifId(a.id)));
  }, [upcomingAppointments, admin, refreshTick]);
  const unseenClients = useMemo(
    () => (admin ? clients.filter((c) => hasUnseenClientMessage(admin.name, c.email)) : []),
    [admin, clients, refreshTick]
  );
  const unseenStagiaires = useMemo(
    () => (admin ? stagiaires.filter((s) => hasUnseenInternMessage(admin.name, s.email)) : []),
    [admin, stagiaires, refreshTick]
  );
  const unseenTeam = useMemo(
    () =>
      admin
        ? ADMIN_TEAM.filter(
            (v) => v.name !== admin.name && hasUnseenTeamMessage(admin.name, v.name)
          )
        : [],
    [admin, refreshTick]
  );
  /* Total des messages non lus pour le badge "Messagerie" de la sidebar
     et de la cloche : clients + stagiaires + collègues de l'équipe. */
  const messagerieUnread = unseenClients.length + unseenStagiaires.length + unseenTeam.length;
  const newClientNotifs = useMemo(
    () => (admin ? getUnseenNewClientNotifications(admin.name) : []),
    [admin, refreshTick]
  );
  const newApptNotifs = useMemo(
    () => (admin ? getUnseenNewAppointmentNotifications(admin.name) : []),
    [admin, refreshTick]
  );

  /* Dismiss exactly ONE notification (used when the person clicks it),
     so the bell badge count drops by one instead of only being able to
     clear everything at once. */
  const dismissOneNotif = (id: string) => {
    if (!admin) return;
    dismissNotification(admin.name, id);
    setRefreshTick((t) => t + 1);
  };
  const notifCount =
    soonAppointments.length +
    newApptNotifs.length +
    newClientNotifs.length +
    messagerieUnread;

  const activeThreadClient = clients.find((c) => c.email === activeThreadEmail) || null;
  const activeThreadMessages = activeThreadEmail ? loadClientConversation(activeThreadEmail) : [];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchClientResults = useMemo(
    () =>
      normalizedQuery
        ? clients.filter(
            (c) =>
              c.name.toLowerCase().includes(normalizedQuery) ||
              c.email.toLowerCase().includes(normalizedQuery) ||
              (c.pet || "").toLowerCase().includes(normalizedQuery)
          )
        : [],
    [clients, normalizedQuery]
  );
  const searchStagiaireResults = useMemo(
    () =>
      normalizedQuery
        ? stagiaires.filter((s) => s.name.toLowerCase().includes(normalizedQuery))
        : [],
    [stagiaires, normalizedQuery]
  );
  const searchTeamResults = useMemo(
    () =>
      normalizedQuery
        ? ADMIN_TEAM.filter(
            (m) =>
              m.name.toLowerCase().includes(normalizedQuery) ||
              m.role.toLowerCase().includes(normalizedQuery)
          )
        : [],
    [normalizedQuery]
  );
  const hasSearchResults =
    searchClientResults.length > 0 || searchStagiaireResults.length > 0 || searchTeamResults.length > 0;

  const handleLogout = () => {
    clearAdmin();
    router.replace("/");
  };

  const goToTab = (t: TabId) => {
    setTab(t);
    setSidebarOpen(false);
    setNotifOpen(false);
    setMoreOpen(false);
    setSearchOpen(false);
  };

  /* Notifications are now dismissed one at a time (see dismissOneNotif),
     right when each one is clicked — the badge count drops by exactly
     one instead of the whole panel needing to close first. */

  const openMessagingWith = (email: string) => {
    setActiveThreadEmail(email);
    setMessagingOpen(true);
    setNotifOpen(false);
    setUserMenuOpen(false);
    setSearchOpen(false);
    if (admin) markClientThreadSeenByAdmin(admin.name, email);
    setRefreshTick((t) => t + 1);
  };

  /* Comme openMessagingWith, mais destiné à la liste de l'onglet
     "Messagerie" intégré : sur desktop (lg+) la conversation s'ouvre
     dans le panneau droit de l'onglet ; sur mobile on ouvre le panneau
     latéral plein écran, plus lisible que la vue empilée. */
  const openThreadInTab = (email: string) => {
    setActiveThreadEmail(email);
    if (admin) markClientThreadSeenByAdmin(admin.name, email);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMessagingOpen(true);
    }
    setRefreshTick((t) => t + 1);
  };

  const openStagThreadInTab = (email: string) => {
    setActiveStagiaireEmail(email);
    setMsgCategory("stagiaires");
    if (admin) markInternThreadSeenByAdmin(admin.name, email);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMessagingOpen(true);
    }
    setRefreshTick((t) => t + 1);
  };

  const openMessagingWithStagiaire = (email: string) => {
    setActiveStagiaireEmail(email);
    setMessagingOpen(true);
    setMsgCategory("stagiaires");
    setNotifOpen(false);
    setUserMenuOpen(false);
    setSearchOpen(false);
    if (admin) markInternThreadSeenByAdmin(admin.name, email);
    setRefreshTick((t) => t + 1);
  };

  const activeStagiaireThread = stagiaires.find((s) => s.email === activeStagiaireEmail) || null;
  const activeStagiaireMessages = activeStagiaireEmail ? loadInternConversation(activeStagiaireEmail) : [];

  const sendStagThreadMessage = (text: string) => {
    if (!admin || !activeStagiaireThread || !text.trim()) return;
    sendAdminMessageToStagiaire(activeStagiaireThread.email, admin.name, text.trim());
    setStagThreadDraft("");
    setRefreshTick((t) => t + 1);
  };

  const openMessagingWithTeamMember = (name: string) => {
    if (admin && name === admin.name) return; // can't message yourself
    setActiveTeamMemberName(name);
    setMessagingOpen(true);
    setMsgCategory("equipe");
    setNotifOpen(false);
    setUserMenuOpen(false);
    setSearchOpen(false);
    if (admin) markTeamThreadSeen(admin.name, name);
    setRefreshTick((t) => t + 1);
  };

  const activeTeamMemberThread = ADMIN_TEAM.find((v) => v.name === activeTeamMemberName) || null;
  const activeTeamMessages = admin && activeTeamMemberName ? loadTeamConversation(admin.name, activeTeamMemberName) : [];

  const sendTeamThreadMessage = (text: string) => {
    if (!admin || !activeTeamMemberThread || !text.trim()) return;
    sendTeamMessage(admin.name, activeTeamMemberThread.name, text.trim());
    setTeamThreadDraft("");
    setRefreshTick((t) => t + 1);
  };

  const getAdminImg = (authorName: string) => {
    const member = ADMIN_TEAM.find((m) => m.name === authorName);
    return member ? member.img : null;
  };

  const markAppointmentFinished = (id: string) => {
    setSharedAppointmentStatus(id, "terminé");
    setRefreshTick((t) => t + 1);
  };

  const handleRemoveClient = (email: string) => {
    if (typeof window !== "undefined" && !window.confirm("Supprimer ce client de la liste ?")) return;
    removeClientForAdmin(email);
    setRefreshTick((t) => t + 1);
  };

  const handleReassignMentor = (email: string, mentor: string) => {
    if (!admin) return;
    reassignStagiaireMentor(email, mentor, admin.name);
    setRefreshTick((t) => t + 1);
  };

  const handleReassignClientVet = (email: string, vet: string) => {
    if (!admin) return;
    reassignClientVet(email, vet, admin.name);
    setRefreshTick((t) => t + 1);
  };

  const sendThreadMessage = (text: string) => {
    if (!admin || !activeThreadClient || !text.trim()) return;
    sendAdminMessageToClient(activeThreadClient.email, activeThreadClient.assignedVet, admin.name, text.trim());
    setThreadDraft("");
    setRefreshTick((t) => t + 1);
  };

  /* Résultats de recherche partagés entre le dropdown desktop et le
     panneau mobile (même rendu aux deux endroits, sans duplication). */
  const searchResultsList = (
    <div className="py-2">
      {searchClientResults.length > 0 && (
        <div className="mb-2">
          <p className="px-5 pt-2 pb-1 text-[10px] font-bold uppercase text-[#888]">Clients</p>
          {searchClientResults.map((c) => (
            <button key={c.email} onClick={() => goToTab("clients")} className="w-full text-left px-5 py-2.5 hover:bg-[#f4f7f6] transition-colors">
              <p className="text-sm font-semibold text-[#333]">{c.name}</p>
              <p className="text-xs text-[#888]">{c.email}{c.pet ? ` • ${c.pet}` : ""}</p>
            </button>
          ))}
        </div>
      )}
      {searchStagiaireResults.length > 0 && (
        <div className="mb-2">
          <p className="px-5 pt-2 pb-1 text-[10px] font-bold uppercase text-[#888]">Stagiaires</p>
          {searchStagiaireResults.map((s) => (
            <button key={s.email} onClick={() => goToTab("stagiaires")} className="w-full text-left px-5 py-2.5 hover:bg-[#f4f7f6] transition-colors">
              <p className="text-sm font-semibold text-[#333]">{s.name}</p>
              <p className="text-xs text-[#888]">Tuteur : {s.mentor}</p>
            </button>
          ))}
        </div>
      )}
      {searchTeamResults.length > 0 && (
        <div>
          <p className="px-5 pt-2 pb-1 text-[10px] font-bold uppercase text-[#888]">Équipe</p>
          {searchTeamResults.map((m) => (
            <button key={m.name} onClick={() => goToTab("equipe")} className="w-full text-left px-5 py-2.5 flex items-center gap-3 hover:bg-[#f4f7f6] transition-colors">
              <img src={m.img} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
              <div>
                <p className="text-sm font-semibold text-[#333]">{m.name}</p>
                <p className="text-xs text-[#888]">{m.role}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const searchEmptyState = (
    <p className="text-sm text-[#888] px-5 py-6 text-center">
      {normalizedQuery ? `Aucun résultat pour « ${searchQuery} ».` : "Commencez à taper pour rechercher."}
    </p>
  );

  /* ── Not checked yet ── */
  if (!checked) return null;

  /* ── Not logged in → show login ── */
  if (!admin) return <AdminLogin onLogin={(a) => { saveAdmin(a); setAdmin(a); }} />;

  /* ── Dashboard ── */
  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7f6]">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 bg-white/98 shadow-[0_2px_15px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-[5%] py-3 sm:py-4">
          <div className="flex items-center gap-1.5 sm:gap-4 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
              className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center text-lg sm:text-xl text-[#333]"
            >
              <i className="fa-solid fa-bars" />
            </button>
            <Link href="/" className="logo-link text-lg sm:text-2xl font-bold flex items-center gap-1.5 sm:gap-2 text-[#333] cursor-pointer min-w-0">
              <i className="fa-solid fa-shield-halved logo-paw shrink-0" />
              <span className="whitespace-nowrap truncate max-[359px]:hidden">VetCare <span className="text-xs sm:text-sm font-normal text-[#888] hidden sm:inline">Admin</span></span>
            </Link>
            {/* navbar subtitle removed */}
          </div>

          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            {fullAccess && (
              <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-sm">
                <i className="fa-solid fa-crown text-[8px]" />
                Accès complet
              </span>
            )}

            {/* ── Search ── */}
            <div ref={searchRef} className="relative">
              <div
                className={`hidden md:flex items-center gap-2.5 w-48 lg:w-64 px-4 py-2.5 rounded-full bg-[#f4f7f6] transition-all duration-300 ${
                  searchOpen ? "bg-white ring-2 ring-[#2c8c99]/30" : ""
                }`}
              >
                <i className="fa-solid fa-magnifying-glass text-xs text-[#888] shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Rechercher un client, stagiaire..."
                  className="flex-1 min-w-0 bg-transparent text-sm text-[#333] placeholder:text-[#888] focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Rechercher"
                className="md:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[#333] hover:bg-[#f4f7f6] transition-colors"
              >
                <i className="fa-solid fa-magnifying-glass" />
              </button>
              {searchOpen && (
                <div className="hidden md:block absolute right-0 mt-3 w-[90vw] max-w-[380px] max-h-[70vh] overflow-y-auto bg-white rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-[#eee] z-50">
                  {!hasSearchResults ? searchEmptyState : searchResultsList}
                </div>
              )}
            </div>

            {/* ── Messagerie ── */}
            <button
              type="button"
              onClick={() => { setMessagingOpen(true); setActiveThreadEmail(null); setActiveStagiaireEmail(null); setActiveTeamMemberName(null); setNotifOpen(false); setSearchOpen(false); }}
              aria-label="Messagerie"
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[#333] hover:bg-[#f4f7f6] transition-colors"
            >
              <i className="fa-solid fa-comments" />
              {messagerieUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#c0392b] text-white text-[10px] font-bold">
                  {messagerieUnread}
                </span>
              )}
            </button>

            {/* ── Notifications ── */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifications"
                className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[#333] hover:bg-[#f4f7f6] transition-colors"
              >
                <i className="fa-solid fa-bell" />
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#c0392b] text-white text-[10px] font-bold">
                    {notifCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-3 w-[calc(100vw-2rem)] max-w-[320px] max-sm:fixed max-sm:left-2 max-sm:right-2 max-sm:top-[64px] max-sm:mt-0 max-sm:w-auto max-sm:max-w-none bg-white rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-[#eee] z-50 overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#eee]">
                    <p className="text-sm font-bold text-[#333]">Notifications</p>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto">
                    {notifCount === 0 ? (
                      <p className="text-sm text-[#888] px-5 py-6 text-center">Rien de nouveau.</p>
                    ) : (
                      <>
                        {newApptNotifs.map((n) => (
                          <button
                            key={newAppointmentNotifId(n)}
                            type="button"
                            onClick={() => {
                              dismissOneNotif(newAppointmentNotifId(n));
                              goToTab("rdv");
                            }}
                            className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-[#f4f7f6] transition-colors border-b border-[#eee]"
                          >
                            <span className="w-8 h-8 shrink-0 rounded-full bg-[rgba(44,140,153,0.1)] text-[#2c8c99] flex items-center justify-center text-xs">
                              <i className="fa-solid fa-calendar-plus" />
                            </span>
                            <span className="text-sm text-[#666]">
                              Nouveau rendez-vous : <span className="font-semibold text-[#333]">{n.clientName}</span>
                              <br />
                              {new Date(n.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à {n.time} avec {n.vet}
                            </span>
                          </button>
                        ))}
                        {soonAppointments.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              dismissOneNotif(appointmentNotifId(a.id));
                              goToTab("rdv");
                            }}
                            className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-[#f4f7f6] transition-colors border-b border-[#eee]"
                          >
                            <span className="w-8 h-8 shrink-0 rounded-full bg-[rgba(44,140,153,0.1)] text-[#2c8c99] flex items-center justify-center text-xs">
                              <i className="fa-solid fa-calendar-days" />
                            </span>
                            <span className="text-sm text-[#666]">
                              RDV le {new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à {a.time} — {a.clientName}
                            </span>
                          </button>
                        ))}
                        {newClientNotifs.map((n) => (
                          <button
                            key={newClientNotifId(n)}
                            type="button"
                            onClick={() => {
                              dismissOneNotif(newClientNotifId(n));
                              goToTab("clients");
                            }}
                            className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-[#f4f7f6] transition-colors border-b border-[#eee]"
                          >
                            <span className="w-8 h-8 shrink-0 rounded-full bg-[rgba(44,140,153,0.1)] text-[#2c8c99] flex items-center justify-center text-xs">
                              <i className="fa-solid fa-user-plus" />
                            </span>
                            <span className="text-sm text-[#666]">Nouvelle inscription{n.kind === "stagiaire" ? " stagiaire" : ""} : <span className="font-semibold text-[#333]">{n.name}</span></span>
                          </button>
                        ))}
                        {unseenClients.map((c) => (
                          <button key={c.email} type="button" onClick={() => openMessagingWith(c.email)} className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-[#f4f7f6] transition-colors border-b border-[#eee]">
                            <span className="w-8 h-8 shrink-0 rounded-full bg-[rgba(44,140,153,0.1)] text-[#2c8c99] flex items-center justify-center text-xs">
                              <i className="fa-solid fa-comment-dots" />
                            </span>
                            <span className="text-sm text-[#666]">Nouveau message de <span className="font-semibold text-[#333]">{c.name}</span></span>
                          </button>
                        ))}
                        {unseenStagiaires.map((s) => (
                          <button key={s.email} type="button" onClick={() => openMessagingWithStagiaire(s.email)} className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-[#f4f7f6] transition-colors border-b border-[#eee]">
                            <span className="w-8 h-8 shrink-0 rounded-full bg-[rgba(142,68,173,0.1)] text-[#8e44ad] flex items-center justify-center text-xs">
                              <i className="fa-solid fa-comment-dots" />
                            </span>
                            <span className="text-sm text-[#666]">Nouveau message de <span className="font-semibold text-[#333]">{s.name}</span> <span className="text-[10px] font-bold uppercase text-[#8e44ad]">Stagiaire</span></span>
                          </button>
                        ))}
                        {unseenTeam.map((v) => (
                          <button key={v.name} type="button" onClick={() => openMessagingWithTeamMember(v.name)} className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-[#f4f7f6] transition-colors border-b border-[#eee] last:border-b-0">
                            <span className="w-8 h-8 shrink-0 rounded-full bg-[rgba(44,140,153,0.1)] text-[#2c8c99] flex items-center justify-center text-xs">
                              <i className="fa-solid fa-comment-dots" />
                            </span>
                            <span className="text-sm text-[#666]">Nouveau message de <span className="font-semibold text-[#333]">{v.name}</span> <span className="text-[10px] font-bold uppercase text-[#2c8c99]">Équipe</span></span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Plus d'options ── */}
            <div ref={moreRef} className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-label="Plus d'options"
                className="w-10 h-10 rounded-full flex items-center justify-center text-[#333] hover:bg-[#f4f7f6] transition-colors"
              >
                <i className="fa-solid fa-gear" />
              </button>
              {moreOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-[16px] shadow-[0_15px_40px_rgba(0,0,0,0.12)] border border-[#eee] overflow-hidden z-50">
                  <p className="px-4 pt-3 pb-2 text-[10px] font-bold uppercase text-[#888]">Gérer le système</p>
                  <button onClick={() => goToTab("rdv")} className="w-full text-left px-4 py-2.5 text-sm text-[#333] hover:bg-[#f4f7f6] flex items-center gap-2.5">
                    <i className="fa-solid fa-calendar-check text-[#2c8c99] w-4" />Rendez-vous
                  </button>
                  <button onClick={() => { setMessagingOpen(true); setActiveThreadEmail(null); setMoreOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-[#333] hover:bg-[#f4f7f6] flex items-center gap-2.5">
                    <i className="fa-solid fa-paper-plane text-[#2c8c99] w-4" />Envoyer un rappel client
                  </button>
                  {fullAccess && (
                    <button onClick={() => goToTab("stagiaires")} className="w-full text-left px-4 py-2.5 text-sm text-[#333] hover:bg-[#f4f7f6] flex items-center gap-2.5">
                      <i className="fa-solid fa-people-arrows text-[#2c8c99] w-4" />Affecter les stagiaires
                    </button>
                  )}
                  <button onClick={() => goToTab("equipe")} className="w-full text-left px-4 py-2.5 text-sm text-[#333] hover:bg-[#f4f7f6] flex items-center gap-2.5">
                    <i className="fa-solid fa-user-doctor text-[#2c8c99] w-4" />Gérer l&apos;équipe
                  </button>
                </div>
              )}
            </div>

            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1 sm:gap-2 pl-0.5 pr-0.5 sm:pr-3 py-1 rounded-full hover:bg-[#f4f7f6] transition-colors"
              >
                <img src={admin.img} alt={admin.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                <span className="hidden sm:block text-sm font-medium text-[#333] truncate max-w-[100px]">{admin.name.split(" ").pop()}</span>
                <i className="fa-solid fa-chevron-down text-[10px] text-[#888] hidden sm:inline" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-[16px] shadow-[0_15px_40px_rgba(0,0,0,0.12)] border border-[#eee] overflow-hidden z-50">
                  <div className="p-4 border-b border-[#eee] flex items-center gap-3">
                    <img src={admin.img} alt={admin.name} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <p className="text-sm font-bold text-[#333]">{admin.name}</p>
                      <p className="text-xs text-[#888]">{ADMIN_TEAM.find((v) => v.name === admin.name)?.role}</p>
                      {fullAccess && <p className="text-[10px] font-bold text-amber-600 mt-1"><i className="fa-solid fa-crown mr-1" />Directrice</p>}
                    </div>
                  </div>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors">
                    <i className="fa-solid fa-right-from-bracket mr-2" />
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile search panel */}
        {searchOpen && (
          <div className="md:hidden px-3 sm:px-[5%] pb-4">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#f4f7f6]">
              <i className="fa-solid fa-magnifying-glass text-xs text-[#888]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="flex-1 bg-transparent text-sm text-[#333] placeholder:text-[#888] focus:outline-none min-w-0"
                autoFocus
              />
            </div>
            <div className="mt-2 max-h-[60vh] overflow-y-auto bg-white rounded-[16px] shadow-[0_15px_40px_rgba(0,0,0,0.10)] border border-[#eee]">
              {!hasSearchResults ? searchEmptyState : searchResultsList}
            </div>
          </div>
        )}
      </header>

      {/* ── BODY: sidebar + main side by side ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── DESKTOP SIDEBAR ── */}
        <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-[#eee] sticky top-[60px] self-start">
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-[12px] text-sm font-medium transition-all duration-200 ${
                tab === item.id
                  ? "bg-[#2c8c99] text-white shadow-[0_4px_12px_rgba(44,140,153,0.3)]"
                  : "text-[#666] hover:bg-[#f4f7f6] hover:text-[#2c8c99]"
              }`}
            >
              <i className={item.icon} />
              {item.label}
              {item.id === "clients" && clients.length > 0 && (
                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${tab === item.id ? "bg-white/20" : "bg-[#f4f7f6] text-[#888]"}`}>
                  {clients.length}
                </span>
              )}
              {item.id === "stagiaires" && stagiaires.length > 0 && (
                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${tab === item.id ? "bg-white/20" : "bg-[#f4f7f6] text-[#888]"}`}>
                  {stagiaires.length}
                </span>
              )}
              {item.id === "messagerie" && messagerieUnread > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#c0392b] text-white text-[10px] font-bold">
                  {messagerieUnread}
                </span>
              )}
            </button>
          ))}
        </nav>
        {/* Retour au site : navigation simple vers la page d'accueil,
            SANS déconnexion — la session admin reste active. */}
        <div className="px-4 pb-4">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-[12px] text-sm font-medium text-[#666] hover:bg-[#f4f7f6] hover:text-[#2c8c99] transition-all duration-200"
          >
            <i className="fa-solid fa-arrow-left" />
            Retour au site
          </Link>
        </div>
      </aside>

      {/* ── MOBILE SIDEBAR ── */}
      {sidebarOpen && (
        <div className="mobile-menu-backdrop fixed inset-0 z-[1000] lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      {sidebarOpen && (
        <div
          className="mobile-menu-panel fixed top-0 left-0 h-full w-full max-h-[90vh] overflow-y-auto no-scrollbar bg-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex flex-col p-4 sm:p-6 gap-2 rounded-b-[24px] z-[1010]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xl sm:text-2xl font-bold text-[#333] flex items-center gap-2">
              <i className="fa-solid fa-shield-halved text-[#2c8c99] logo-paw" />
              VetCare <span className="text-xs sm:text-sm font-normal text-[#888]">Admin</span>
            </span>
            <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Fermer" className="w-9 h-9 shrink-0 rounded-full bg-[#f4f7f6] text-[#888] flex items-center justify-center hover:bg-[#2c8c99] hover:text-white transition-all">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => goToTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-[12px] text-sm font-medium transition-all ${
                tab === item.id ? "bg-[#2c8c99] text-white" : "text-[#666] hover:bg-[#f4f7f6]"
              }`}
            >
              <i className={item.icon} />{item.label}
              {item.id === "messagerie" && messagerieUnread > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#c0392b] text-white text-[10px] font-bold">
                  {messagerieUnread}
                </span>
              )}
            </button>
          ))}
          <div className="mt-auto pt-4 border-t border-[#eee] flex flex-col gap-1">
            {/* Retour au site sans déconnexion : la session admin persiste. */}
            <Link
              href="/"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-[12px] text-sm font-medium text-[#666] hover:bg-[#f4f7f6] hover:text-[#2c8c99] transition-all w-full"
            >
              <i className="fa-solid fa-arrow-left" />Retour au site
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-[12px] text-sm font-medium text-red-500 hover:bg-red-50 transition-all w-full">
              <i className="fa-solid fa-right-from-bracket" />Déconnexion
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 p-4 sm:p-6 lg:p-10 max-w-[1200px] mx-auto w-full">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#333]">{tabTitles[tab].title}</h1>
          <p className="text-xs sm:text-sm text-[#888] mt-1">{tabTitles[tab].subtitle}</p>
        </div>

        {/* ═══ TABLEAU DE BORD ═══ */}
        {tab === "vue" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard icon="fa-solid fa-users" label="Clients" value={clients.length} color="bg-blue-50 text-blue-600" />
            <StatCard icon="fa-solid fa-graduation-cap" label="Stagiaires" value={stagiaires.length} color="bg-purple-50 text-purple-600" />
            <StatCard icon="fa-solid fa-paw" label="Animaux" value={clients.filter((c) => c.pet).length} color="bg-green-50 text-green-600" />
            <StatCard icon={fullAccess ? "fa-solid fa-crown" : "fa-solid fa-user-doctor"} label={fullAccess ? "Accès" : "Mon rôle"} value={fullAccess ? "Complet" : admin.role === "vétérinaire" ? "Vétérinaire" : "Assistante"} color="bg-amber-50 text-amber-600" isText />
          </div>
        )}

        {/* ═══ CLIENTS ═══ */}
        {tab === "clients" && (
          <div className="bg-white rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
            <div className="h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99] rounded-t-[20px]" />
            <div className="p-6 md:p-8">
              {!fullAccess && (
                <p className="text-xs text-[#888] mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-info-circle text-[#2c8c99]" />
                  Vous ne voyez que les clients qui vous sont assignés. La directrice a accès à tous les clients.
                </p>
              )}
              {clients.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-[#f4f7f6] flex items-center justify-center text-2xl text-[#ccc] mx-auto mb-4">
                    <i className="fa-solid fa-users" />
                  </div>
                  <p className="text-[#888] text-sm">Aucun client enregistré pour le moment.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-base">
                    <thead>
                      <tr className="border-b border-[#eee]">
                        <th className="text-left py-4 px-4 text-sm font-bold uppercase text-[#888]">Client</th>
                        <th className="text-left py-4 px-4 text-sm font-bold uppercase text-[#888] hidden md:table-cell">Animal</th>
                        <th className="text-left py-4 px-4 text-sm font-bold uppercase text-[#888] hidden lg:table-cell">Tél</th>
                        {fullAccess && <th className="text-left py-4 px-4 text-sm font-bold uppercase text-[#888]">Vétérinaire</th>}
                        <th className="text-left py-4 px-4 text-sm font-bold uppercase text-[#888]">Inscription</th>
                        <th className="text-right py-4 px-4 text-sm font-bold uppercase text-[#888]">Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((c) => (
                        <tr key={c.email} className="border-b border-[#f4f7f6] hover:bg-[#f9fbfb] transition-colors">
                          <td className="py-4 px-4">
                            <p className="font-semibold text-[#333] text-base">{c.name}</p>
                            <p className="text-sm text-[#888]">{c.email}</p>
                          </td>
                          <td className="py-4 px-4 hidden md:table-cell">
                            {c.pet ? (
                              <span className="inline-flex items-center gap-1.5 text-sm bg-[#e0f7fa] text-[#2c8c99] px-3 py-1.5 rounded-full font-medium">
                                <i className="fa-solid fa-paw text-[9px]" />
                                {c.pet}
                              </span>
                            ) : <span className="text-sm text-[#ccc]">—</span>}
                          </td>
                          <td className="py-4 px-4 text-[#666] hidden lg:table-cell">{c.phone || "—"}</td>
                          {fullAccess && (
                            <td className="py-4 px-4 text-sm">
                              <VetSelect
                                label={`Vétérinaire référent de ${c.name}`}
                                value={c.assignedVet}
                                onChange={(v) => handleReassignClientVet(c.email, v)}
                                options={ADMIN_TEAM.map((m) => m.name)}
                              />
                            </td>
                          )}
                          <td className="py-4 px-4 text-[#888] text-sm">{formatDate(c.joinedAt)}</td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openMessagingWith(c.email)}
                                className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#f4f7f6] text-[#2c8c99] hover:bg-[#2c8c99] hover:text-white transition-colors duration-500"
                                aria-label={`Contacter ${c.name}`}
                              >
                                <i className="fa-solid fa-comment-dots text-sm" />
                                {admin && hasUnseenClientMessage(admin.name, c.email) && (
                                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#c0392b] ring-2 ring-white" />
                                )}
                              </button>
                              <button
                                onClick={() => handleRemoveClient(c.email)}
                                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#f4f7f6] text-[#c0392b] hover:bg-[#c0392b] hover:text-white transition-colors duration-500"
                                aria-label={`Supprimer ${c.name}`}
                              >
                                <i className="fa-solid fa-trash-can text-sm" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ RENDEZ-VOUS ═══ */}
        {tab === "rdv" && (
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
              <div className="p-6 md:p-8">
                <h3 className="text-lg font-bold text-[#333] mb-1">À venir</h3>
                <p className="text-xs text-[#888] mb-5">Marquez un rendez-vous comme terminé une fois la consultation réalisée.</p>
                {upcomingAppointments.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 rounded-full bg-[#f4f7f6] flex items-center justify-center text-xl text-[#ccc] mx-auto mb-3">
                      <i className="fa-solid fa-calendar-check" />
                    </div>
                    <p className="text-[#888] text-sm">Aucun rendez-vous à venir.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {upcomingAppointments.map((a) => (
                      <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#f4f7f6] rounded-[14px] p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-10 h-10 shrink-0 rounded-full bg-[rgba(44,140,153,0.1)] text-[#2c8c99] flex items-center justify-center">
                            <i className="fa-solid fa-calendar-days" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#333] truncate">{a.clientName}{a.pet ? ` — ${a.pet}` : ""}</p>
                            <p className="text-xs text-[#666]">
                              {new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} à {a.time} • {a.reason} • avec {a.vet}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => markAppointmentFinished(a.id)}
                          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-[#2c8c99] text-white hover:bg-[#1f636d] transition-colors"
                        >
                          <i className="fa-solid fa-check" />Marquer comme terminé
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="p-6 md:p-8">
                <h3 className="text-lg font-bold text-[#333] mb-4">Historique</h3>
                {pastAppointments.length === 0 ? (
                  <p className="text-[#888] text-sm">Aucun rendez-vous passé pour le moment.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {pastAppointments
                      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
                      .map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-[#f4f7f6] last:border-b-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#333] truncate">{a.clientName} — {a.reason}</p>
                            <p className="text-xs text-[#888]">{new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} à {a.time}</p>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${a.status === "terminé" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {a.status}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ STAGIAIRES ═══ */}
        {tab === "stagiaires" && (
          <div className="bg-white rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
            <div className="h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99] rounded-t-[20px]" />
            <div className="p-6 md:p-8">
              {!fullAccess ? (
                <p className="text-xs text-[#888] mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-info-circle text-[#2c8c99]" />
                  Vous ne voyez que les stagiaires qui vous sont assignés. La directrice a accès à tous les stagiaires.
                </p>
              ) : (
                <p className="text-xs text-[#888] mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-info-circle text-[#2c8c99]" />
                  En tant que directrice, choisissez avec quel vétérinaire chaque stagiaire travaille : le stagiaire et le vétérinaire concerné en sont informés immédiatement.
                </p>
              )}
              {stagiaires.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-[#f4f7f6] flex items-center justify-center text-2xl text-[#ccc] mx-auto mb-4">
                    <i className="fa-solid fa-graduation-cap" />
                  </div>
                  <p className="text-[#888] text-sm">Aucun stagiaire enregistré pour le moment.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {stagiaires.map((s) => (
                    <div key={s.email} className="bg-[#f4f7f6] rounded-[16px] p-5 border border-[#eee] hover:border-[#2c8c99]/30 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-[#333]">{s.name}</h3>
                          <p className="text-xs text-[#888]">{s.email}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${s.status === "en cours" ? "bg-green-100 text-green-700" : s.status === "terminé" ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-700"}`}>
                          {s.status}
                        </span>
                      </div>
                      <div className="space-y-2 text-xs text-[#666]">
                        {s.school && <p><i className="fa-solid fa-school text-[#2c8c99] mr-2 w-4 text-center" />{s.school}</p>}
                        <p><i className="fa-solid fa-calendar text-[#2c8c99] mr-2 w-4 text-center" />{formatDate(s.startDate)} → {formatDate(s.endDate)}</p>
                        {fullAccess ? (
                          <div className="flex items-center gap-2">
                            <i className="fa-solid fa-user-doctor text-[#2c8c99] w-4 text-center" />
                            <VetSelect
                              label={`Tuteur de ${s.name}`}
                              value={s.mentor}
                              onChange={(v) => handleReassignMentor(s.email, v)}
                              options={ADMIN_TEAM.map((m) => m.name)}
                            />
                          </div>
                        ) : (
                          <p><i className="fa-solid fa-user-doctor text-[#2c8c99] mr-2 w-4 text-center" />Tuteur : {s.mentor}</p>
                        )}
                      </div>
                      <div className="mt-4">
                        <div className="flex justify-between text-[10px] font-semibold text-[#888] mb-1">
                          <span>Progression</span>
                          <span>{s.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-[#e5e5e5] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#2c8c99] to-[#4dd0e1] rounded-full transition-all duration-500" style={{ width: `${s.progress}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ ÉQUIPE ═══ */}
        {tab === "equipe" && (
          <div className="flex flex-col gap-8">
            {ADMIN_TEAM.map((member) => {
              const isMe = member.name === admin.name;
              return (
                <div key={member.name} className={`bg-white rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(0,0,0,0.1)] ${isMe ? "ring-2 ring-[#2c8c99]" : ""}`}>
                  <div className="flex flex-col sm:flex-row items-center gap-5 p-6 md:p-8">
                    <div className="relative">
                      <img src={member.img} alt={member.name} className="w-24 h-24 rounded-full object-cover bg-[#ccc] border-4 border-white shadow-[0_5px_15px_rgba(0,0,0,0.12)]" />
                      {isMe && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#2c8c99] text-white whitespace-nowrap">C'est vous</span>
                      )}
                    </div>
                    <div className="text-center sm:text-left">
                      <h3 className="text-lg font-bold text-[#333] flex items-center gap-2 justify-center sm:justify-start">
                        {member.name}
                        {member.adminRole === "directrice" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-white">
                            <i className="fa-solid fa-crown mr-1" />Directrice
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-[#888] italic">{member.role}</p>
                      <p className="text-xs text-[#666] mt-2">
                        {member.adminRole === "directrice"
                          ? "Accès complet : tous les clients, tous les stagiaires et l'équipe."
                          : `Accès limité à ses propres clients et stagiaires.`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      </div>

      {/* ── MESSAGERIE (slide-over panel) ── */}
      {messagingOpen && (
        <div
          className="fixed inset-0 z-[1100] bg-black/30"
          onClick={() => { setMessagingOpen(false); setActiveThreadEmail(null); }}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.15)] z-[1101] flex flex-col transform transition-transform duration-300 ease-out ${
          messagingOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {!activeThreadClient && !activeStagiaireThread && !activeTeamMemberThread ? (
          <>
            <div className="px-5 py-4 border-b border-[#eee] flex items-center justify-between shrink-0">
              <div>
                <p className="text-sm font-bold text-[#333]">Messagerie</p>
                <p className="text-xs text-[#888]">Sélectionnez une personne pour discuter.</p>
              </div>
              <button
                type="button"
                onClick={() => setMessagingOpen(false)}
                aria-label="Fermer"
                className="w-9 h-9 rounded-full bg-[#f4f7f6] text-[#888] flex items-center justify-center hover:bg-[#2c8c99] hover:text-white transition-all shrink-0"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="px-5 pt-3 shrink-0">
              <div className="flex gap-1 bg-[#f4f7f6] rounded-full p-1">
                {([
                  { id: "clients" as const, label: "Clients", icon: "fa-solid fa-users" },
                  { id: "stagiaires" as const, label: "Stagiaires", icon: "fa-solid fa-graduation-cap" },
                  { id: "equipe" as const, label: "Équipe", icon: "fa-solid fa-user-doctor" },
                ]).map((cat) => {
                  const isActive = msgCategory === cat.id;
                  const count = cat.id === "clients" ? clients.length : cat.id === "stagiaires" ? stagiaires.length : ADMIN_TEAM.length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setMsgCategory(cat.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
                        isActive ? "bg-[#2c8c99] text-white shadow-[0_3px_10px_rgba(44,140,153,0.3)]" : "text-[#666] hover:text-[#2c8c99]"
                      }`}
                    >
                      <i className={`${cat.icon} text-[10px]`} />
                      <span>{cat.label}</span>
                      {count > 0 && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-[#e5e5e5] text-[#888]"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto mt-2">
              {msgCategory === "clients" && (
                clients.length === 0 ? (
                  <p className="text-sm text-[#888] px-5 py-8 text-center">Aucun client pour le moment.</p>
                ) : (
                  clients.map((c) => {
                    const thread = loadClientConversation(c.email);
                    const last = thread[thread.length - 1];
                    const unseen = admin ? hasUnseenClientMessage(admin.name, c.email) : false;
                    return (
                      <button
                        key={c.email}
                        onClick={() => openMessagingWith(c.email)}
                        className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-[#f4f7f6] transition-colors border-b border-[#f4f7f6]"
                      >
                        <span className="relative w-10 h-10 shrink-0 rounded-full bg-[#2c8c99] text-white flex items-center justify-center text-sm font-bold">
                          {initials(c.name)}
                          {unseen && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#c0392b] ring-2 ring-white" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#333] truncate">{c.name}</p>
                          {c.phone && (
                            <p className="text-[11px] text-[#2c8c99] truncate">
                              <i className="fa-solid fa-phone text-[9px] mr-1" />{c.phone}
                            </p>
                          )}
                          <p className="text-xs text-[#888] truncate">
                            {last ? (last.from === "team" ? "Vous : " : "") + last.text : "Aucun message — cliquez pour écrire"}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )
              )}
              {msgCategory === "stagiaires" && (
                stagiaires.length === 0 ? (
                  <p className="text-sm text-[#888] px-5 py-8 text-center">Aucun stagiaire pour le moment.</p>
                ) : (
                  stagiaires.map((s) => {
                    const thread = loadInternConversation(s.email);
                    const last = thread[thread.length - 1];
                    const unseen = admin ? hasUnseenInternMessage(admin.name, s.email) : false;
                    return (
                      <button
                        key={s.email}
                        onClick={() => openMessagingWithStagiaire(s.email)}
                        className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-[#f4f7f6] transition-colors border-b border-[#f4f7f6]"
                      >
                        <span className="relative w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#8e44ad] to-[#bb6bd9] text-white flex items-center justify-center text-sm font-bold">
                          {initials(s.name)}
                          {unseen && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#c0392b] ring-2 ring-white" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#333] truncate">{s.name}</p>
                          {s.phone && (
                            <p className="text-[11px] text-[#8e44ad] truncate">
                              <i className="fa-solid fa-phone text-[9px] mr-1" />{s.phone}
                            </p>
                          )}
                          <p className="text-xs text-[#888] truncate">
                            {last ? (last.from === "equipe" ? "Vous : " : "") + last.text : "Aucun message — cliquez pour écrire"}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )
              )}
              {msgCategory === "equipe" && (
                ADMIN_TEAM.length === 0 ? (
                  <p className="text-sm text-[#888] px-5 py-8 text-center">Aucun membre pour le moment.</p>
                ) : (
                  ADMIN_TEAM.map((vet) => {
                    const isMe = vet.name === admin?.name;
                    const thread = admin && !isMe ? loadTeamConversation(admin.name, vet.name) : [];
                    const last = thread[thread.length - 1];
                    const unseen = admin && !isMe ? hasUnseenTeamMessage(admin.name, vet.name) : false;
                    return (
                      <button
                        key={vet.name}
                        type="button"
                        disabled={isMe}
                        onClick={() => openMessagingWithTeamMember(vet.name)}
                        className={`w-full text-left px-5 py-3.5 flex items-center gap-3 border-b border-[#f4f7f6] transition-colors ${isMe ? "cursor-default" : "hover:bg-[#f4f7f6]"}`}
                      >
                        <div className="relative shrink-0">
                          <img src={vet.img} alt={vet.name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                          {isMe && (
                            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#2c8c99] text-white flex items-center justify-center text-[8px]">
                              <i className="fa-solid fa-star" />
                            </span>
                          )}
                          {unseen && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#c0392b] ring-2 ring-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm truncate text-[#333] ${unseen ? "font-bold" : "font-semibold"}`}>{vet.name}</p>
                          <p className="text-xs text-[#888] truncate">
                            {isMe ? vet.role : last ? (last.author === admin?.name ? "Vous : " : "") + last.text : vet.role}
                          </p>
                        </div>
                        {isMe && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2c8c99]/10 text-[#2c8c99] shrink-0">Vous</span>}
                      </button>
                    );
                  })
                )
              )}
            </div>
          </>
        ) : activeThreadClient ? (
          <>
            {/* ── Client thread header ── */}
            <div className="px-5 py-4 border-b border-[#eee] flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveThreadEmail(null)}
                aria-label="Retour"
                className="w-9 h-9 rounded-full bg-[#f4f7f6] text-[#888] flex items-center justify-center hover:bg-[#2c8c99] hover:text-white transition-all shrink-0"
              >
                <i className="fa-solid fa-arrow-left" />
              </button>
              <span className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#2c8c99] to-[#4dd0e1] text-white flex items-center justify-center text-sm font-bold shadow-sm">
                {initials(activeThreadClient.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#333] truncate">{activeThreadClient.name}</p>
                <p className="text-xs text-[#888] truncate">{activeThreadClient.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setMessagingOpen(false)}
                aria-label="Fermer"
                className="w-9 h-9 rounded-full bg-[#f4f7f6] text-[#888] flex items-center justify-center hover:bg-[#2c8c99] hover:text-white transition-all shrink-0"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-5 py-4">
              {activeThreadMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-14 h-14 rounded-full bg-[#f4f7f6] flex items-center justify-center text-xl text-[#ccc] mb-3">
                    <i className="fa-solid fa-comment-dots" />
                  </div>
                  <p className="text-sm text-[#888]">Aucun message pour le moment.</p>
                </div>
              ) : (
                activeThreadMessages.map((m) => {
                  const vetImg = m.from === "team" ? getAdminImg(m.author) : null;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-end gap-2 max-w-[85%] ${m.from === "team" ? "self-end flex-row-reverse" : "self-start"}`}
                    >
                      {m.from === "team" && vetImg ? (
                        <img src={vetImg} alt={m.author} className="w-8 h-8 shrink-0 rounded-full object-cover shadow-sm" />
                      ) : (
                        <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold bg-[#f4f7f6] text-[#2c8c99]">
                          {initials(m.author)}
                        </span>
                      )}
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          m.from === "team" ? "bg-[#2c8c99] text-white rounded-br-sm shadow-sm" : "bg-[#f4f7f6] text-[#333] rounded-bl-sm"
                        }`}
                      >
                        {m.from === "team" && <p className="text-[11px] font-semibold text-white/80 mb-1">{m.author}</p>}
                        <p>{m.text}</p>
                        <p className={`text-[10px] mt-1 ${m.from === "team" ? "text-white/70" : "text-[#888]"}`}>
                          {new Date(m.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-5 pt-3 pb-4 border-t border-[#eee] shrink-0">
              <button
                type="button"
                onClick={() => sendThreadMessage(REMINDER_PRESET)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors mb-3"
              >
                <i className="fa-solid fa-bell" />Envoyer un rappel de vaccination
              </button>
              <form
                onSubmit={(e) => { e.preventDefault(); sendThreadMessage(threadDraft); }}
                className="flex items-center gap-3"
              >
                {admin && (
                  <img src={admin.img} alt={admin.name} className="w-9 h-9 shrink-0 rounded-full object-cover" />
                )}
                <input
                  type="text"
                  value={threadDraft}
                  onChange={(e) => setThreadDraft(e.target.value)}
                  placeholder={`Écrire à ${activeThreadClient.name}…`}
                  className="flex-1 min-w-0 px-4 py-3 rounded-full border border-[#ddd] text-sm bg-[#f4f7f6] focus:outline-none focus:border-[#2c8c99] focus:bg-white transition-colors"
                />
                <button
                  type="submit"
                  aria-label="Envoyer"
                  className="w-11 h-11 shrink-0 rounded-full bg-[#2c8c99] text-white flex items-center justify-center transition-all hover:bg-[#1f636d] hover:-translate-y-0.5"
                >
                  <i className="fa-solid fa-paper-plane text-sm" />
                </button>
              </form>
            </div>
          </>
        ) : activeStagiaireThread ? (
          <>
            {/* ── Stagiaire thread header ── */}
            <div className="px-5 py-4 border-b border-[#eee] flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveStagiaireEmail(null)}
                aria-label="Retour"
                className="w-9 h-9 rounded-full bg-[#f4f7f6] text-[#888] flex items-center justify-center hover:bg-[#2c8c99] hover:text-white transition-all shrink-0"
              >
                <i className="fa-solid fa-arrow-left" />
              </button>
              <span className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#8e44ad] to-[#bb6bd9] text-white flex items-center justify-center text-sm font-bold shadow-sm">
                {initials(activeStagiaireThread.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#333] truncate">{activeStagiaireThread.name}</p>
                <p className="text-xs text-[#888] truncate">Stagiaire • {activeStagiaireThread.mentor}</p>
              </div>
              <button
                type="button"
                onClick={() => setMessagingOpen(false)}
                aria-label="Fermer"
                className="w-9 h-9 rounded-full bg-[#f4f7f6] text-[#888] flex items-center justify-center hover:bg-[#2c8c99] hover:text-white transition-all shrink-0"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-5 py-4">
              {activeStagiaireMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-14 h-14 rounded-full bg-[#f4f7f6] flex items-center justify-center text-xl text-[#ccc] mb-3">
                    <i className="fa-solid fa-comment-dots" />
                  </div>
                  <p className="text-sm text-[#888]">Aucun message pour le moment.</p>
                </div>
              ) : (
                activeStagiaireMessages.map((m) => {
                  const vetImg = m.from === "equipe" ? getAdminImg(m.author) : null;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-end gap-2 max-w-[85%] ${m.from === "equipe" ? "self-end flex-row-reverse" : "self-start"}`}
                    >
                      {m.from === "equipe" && vetImg ? (
                        <img src={vetImg} alt={m.author} className="w-8 h-8 shrink-0 rounded-full object-cover shadow-sm" />
                      ) : (
                        <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold bg-[#f0e6f6] text-[#8e44ad]">
                          {initials(m.author)}
                        </span>
                      )}
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          m.from === "equipe" ? "bg-[#2c8c99] text-white rounded-br-sm shadow-sm" : "bg-[#f0e6f6] text-[#333] rounded-bl-sm"
                        }`}
                      >
                        {m.from === "equipe" && <p className="text-[11px] font-semibold text-white/80 mb-1">{m.author}</p>}
                        <p>{m.text}</p>
                        <p className={`text-[10px] mt-1 ${m.from === "equipe" ? "text-white/70" : "text-[#888]"}`}>
                          {new Date(m.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-5 pt-3 pb-4 border-t border-[#eee] shrink-0">
              <form
                onSubmit={(e) => { e.preventDefault(); sendStagThreadMessage(stagThreadDraft); }}
                className="flex items-center gap-3"
              >
                {admin && (
                  <img src={admin.img} alt={admin.name} className="w-9 h-9 shrink-0 rounded-full object-cover" />
                )}
                <input
                  type="text"
                  value={stagThreadDraft}
                  onChange={(e) => setStagThreadDraft(e.target.value)}
                  placeholder={`Écrire à ${activeStagiaireThread.name}…`}
                  className="flex-1 min-w-0 px-4 py-3 rounded-full border border-[#ddd] text-sm bg-[#f4f7f6] focus:outline-none focus:border-[#2c8c99] focus:bg-white transition-colors"
                />
                <button
                  type="submit"
                  aria-label="Envoyer"
                  className="w-11 h-11 shrink-0 rounded-full bg-[#2c8c99] text-white flex items-center justify-center transition-all hover:bg-[#1f636d] hover:-translate-y-0.5"
                >
                  <i className="fa-solid fa-paper-plane text-sm" />
                </button>
              </form>
            </div>
          </>
        ) : activeTeamMemberThread ? (
          <>
            {/* ── Team member thread header ── */}
            <div className="px-5 py-4 border-b border-[#eee] flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTeamMemberName(null)}
                aria-label="Retour"
                className="w-9 h-9 rounded-full bg-[#f4f7f6] text-[#888] flex items-center justify-center hover:bg-[#2c8c99] hover:text-white transition-all shrink-0"
              >
                <i className="fa-solid fa-arrow-left" />
              </button>
              <img src={activeTeamMemberThread.img} alt={activeTeamMemberThread.name} className="w-10 h-10 shrink-0 rounded-full object-cover shadow-sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#333] truncate">{activeTeamMemberThread.name}</p>
                <p className="text-xs text-[#888] truncate">{activeTeamMemberThread.role}</p>
              </div>
              <button
                type="button"
                onClick={() => setMessagingOpen(false)}
                aria-label="Fermer"
                className="w-9 h-9 rounded-full bg-[#f4f7f6] text-[#888] flex items-center justify-center hover:bg-[#2c8c99] hover:text-white transition-all shrink-0"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-5 py-4">
              {activeTeamMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-14 h-14 rounded-full bg-[#f4f7f6] flex items-center justify-center text-xl text-[#ccc] mb-3">
                    <i className="fa-solid fa-comment-dots" />
                  </div>
                  <p className="text-sm text-[#888]">Aucun message pour le moment.</p>
                </div>
              ) : (
                activeTeamMessages.map((m) => {
                  const isMe = admin ? m.author === admin.name : false;
                  const authorImg = getAdminImg(m.author);
                  return (
                    <div
                      key={m.id}
                      className={`flex items-end gap-2 max-w-[85%] ${isMe ? "self-end flex-row-reverse" : "self-start"}`}
                    >
                      {authorImg ? (
                        <img src={authorImg} alt={m.author} className="w-8 h-8 shrink-0 rounded-full object-cover shadow-sm" />
                      ) : (
                        <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold bg-[#f4f7f6] text-[#2c8c99]">
                          {initials(m.author)}
                        </span>
                      )}
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          isMe ? "bg-[#2c8c99] text-white rounded-br-sm shadow-sm" : "bg-[#f4f7f6] text-[#333] rounded-bl-sm"
                        }`}
                      >
                        {!isMe && <p className="text-[11px] font-semibold text-[#2c8c99] mb-1">{m.author}</p>}
                        <p>{m.text}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? "text-white/70" : "text-[#888]"}`}>
                          {new Date(m.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-5 pt-3 pb-4 border-t border-[#eee] shrink-0">
              <form
                onSubmit={(e) => { e.preventDefault(); sendTeamThreadMessage(teamThreadDraft); }}
                className="flex items-center gap-3"
              >
                {admin && (
                  <img src={admin.img} alt={admin.name} className="w-9 h-9 shrink-0 rounded-full object-cover" />
                )}
                <input
                  type="text"
                  value={teamThreadDraft}
                  onChange={(e) => setTeamThreadDraft(e.target.value)}
                  placeholder={`Écrire à ${activeTeamMemberThread.name}…`}
                  className="flex-1 min-w-0 px-4 py-3 rounded-full border border-[#ddd] text-sm bg-[#f4f7f6] focus:outline-none focus:border-[#2c8c99] focus:bg-white transition-colors"
                />
                <button
                  type="submit"
                  aria-label="Envoyer"
                  className="w-11 h-11 shrink-0 rounded-full bg-[#2c8c99] text-white flex items-center justify-center transition-all hover:bg-[#1f636d] hover:-translate-y-0.5"
                >
                  <i className="fa-solid fa-paper-plane text-sm" />
                </button>
              </form>
            </div>
          </>
        ) : null}
      </div>

        {/* ═══ MESSAGERIE (integrated tab) ═══ */}
        {tab === "messagerie" && (
          <div className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10">
            <div className="bg-white rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
            <div className="p-6 md:p-8">
              <div className="flex flex-col lg:flex-row gap-6 h-[65vh]">
                {/* ── Left: contact list ── */}
                <div className="w-full lg:w-80 shrink-0 border-r border-[#eee] flex flex-col">
                  <div className="mb-4">
                    <div className="flex gap-1 bg-[#f4f7f6] rounded-full p-1">
                      {([
                        { id: "clients" as const, label: "Clients", icon: "fa-solid fa-users" },
                        { id: "stagiaires" as const, label: "Stagiaires", icon: "fa-solid fa-graduation-cap" },
                        { id: "equipe" as const, label: "Vétos", icon: "fa-solid fa-user-doctor" },
                      ]).map((cat) => {
                        const isActive = msgCategory === cat.id;
                        const count = cat.id === "clients" ? clients.length : cat.id === "stagiaires" ? stagiaires.length : ADMIN_TEAM.length;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setMsgCategory(cat.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
                              isActive
                                ? "bg-[#2c8c99] text-white shadow-[0_3px_10px_rgba(44,140,153,0.3)]"
                                : "text-[#666] hover:text-[#2c8c99]"
                            }`}
                          >
                            <i className={`${cat.icon} text-[10px]`} />
                            <span>{cat.label}</span>
                            {count > 0 && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-[#e5e5e5] text-[#888]"}`}>
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto -mx-2">
                    {/* Clients */}
                    {msgCategory === "clients" && clients.map((c) => {
                      const thread = loadClientConversation(c.email);
                      const last = thread[thread.length - 1];
                      const unseen = admin ? hasUnseenClientMessage(admin.name, c.email) : false;
                      const isActive = activeThreadEmail === c.email;
                      return (
                        <button
                          key={c.email}
                          onClick={() => openThreadInTab(c.email)}
                          className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-[#f4f7f6] ${isActive ? "bg-[#e0f7fa]" : "hover:bg-[#f4f7f6]"}`}
                        >
                          <span className="relative w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#2c8c99] to-[#4dd0e1] text-white flex items-center justify-center text-sm font-bold shadow-sm">
                            {initials(c.name)}
                            {unseen && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#c0392b] ring-2 ring-white" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className={`text-sm truncate ${unseen ? "font-bold" : "font-semibold"} text-[#333]`}>{c.name}</p>
                              {last && <span className="text-[10px] text-[#aaa] shrink-0 ml-2">{new Date(last.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
                            </div>
                            <p className="text-xs text-[#888] truncate mt-0.5">
                              {last ? (last.from === "team" ? "Vous : " : "") + last.text : "Aucun message"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                    {/* Stagiaires */}
                    {msgCategory === "stagiaires" && stagiaires.map((s) => {
                      const thread = loadInternConversation(s.email);
                      const last = thread[thread.length - 1];
                      const unseen = admin ? hasUnseenInternMessage(admin.name, s.email) : false;
                      const isActive = activeStagiaireEmail === s.email;
                      return (
                        <button
                          key={s.email}
                          onClick={() => openStagThreadInTab(s.email)}
                          className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-[#f4f7f6] ${isActive ? "bg-[#f3e8ff]" : "hover:bg-[#f4f7f6]"}`}
                        >
                          <span className="relative w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#8e44ad] to-[#bb6bd9] text-white flex items-center justify-center text-sm font-bold shadow-sm">
                            {initials(s.name)}
                            {unseen && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#c0392b] ring-2 ring-white" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className={`text-sm truncate ${unseen ? "font-bold" : "font-semibold"} text-[#333]`}>{s.name}</p>
                              {last && <span className="text-[10px] text-[#aaa] shrink-0 ml-2">{new Date(last.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
                            </div>
                            <p className="text-xs text-[#888] truncate mt-0.5">
                              {last ? (last.from === "equipe" ? "Vous : " : "") + last.text : "Aucun message"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                    {/* Vétos / Équipe */}
                    {msgCategory === "equipe" && ADMIN_TEAM.map((vet) => {
                      const isMe = vet.name === admin?.name;
                      return (
                        <div key={vet.name} className="px-4 py-3 flex items-center gap-3 border-b border-[#f4f7f6]">
                          <div className="relative">
                            <img src={vet.img} alt={vet.name} className="w-10 h-10 shrink-0 rounded-full object-cover shadow-sm" />
                            {isMe && (
                              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#2c8c99] text-white flex items-center justify-center text-[8px]">
                                <i className="fa-solid fa-star" />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[#333] truncate">{vet.name}</p>
                            <p className="text-xs text-[#888] truncate">{vet.role}</p>
                          </div>
                          {isMe && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2c8c99]/10 text-[#2c8c99]">Vous</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* ── Right: conversation view ── */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#fafcfb] rounded-[16px] overflow-hidden">
                  {activeThreadClient ? (
                    <>
                      <div className="px-5 py-3 border-b border-[#eee] flex items-center gap-3 shrink-0 bg-white">
                        <span className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-[#2c8c99] to-[#4dd0e1] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                          {initials(activeThreadClient.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[#333] truncate">{activeThreadClient.name}</p>
                          <p className="text-[10px] text-[#888]">Client</p>
                        </div>
                        <button type="button" onClick={() => setActiveThreadEmail(null)} className="w-8 h-8 rounded-full hover:bg-[#f4f7f6] flex items-center justify-center text-[#888] transition-colors">
                          <i className="fa-solid fa-xmark text-xs" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-5 py-4">
                        {activeThreadMessages.length === 0 ? (
                          <p className="text-sm text-[#888] m-auto text-center">Aucun message pour le moment.</p>
                        ) : (
                          activeThreadMessages.map((m) => {
                            const vetImg = m.from === "team" ? getAdminImg(m.author) : null;
                            return (
                              <div key={m.id} className={`flex items-end gap-2 max-w-[85%] ${m.from === "team" ? "self-end flex-row-reverse" : "self-start"}`}>
                                {m.from === "team" && vetImg ? (
                                  <img src={vetImg} alt={m.author} className="w-7 h-7 shrink-0 rounded-full object-cover shadow-sm" />
                                ) : (
                                  <span className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold bg-[#f4f7f6] text-[#2c8c99]">
                                    {initials(m.author)}
                                  </span>
                                )}
                                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.from === "team" ? "bg-[#2c8c99] text-white rounded-br-sm" : "bg-white text-[#333] rounded-bl-sm shadow-sm"}`}>
                                  {m.from === "team" && <p className="text-[10px] font-semibold text-white/80 mb-0.5">{m.author}</p>}
                                  <p>{m.text}</p>
                                  <p className={`text-[9px] mt-1 ${m.from === "team" ? "text-white/60" : "text-[#aaa]"}`}>
                                    {new Date(m.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="px-5 py-3 border-t border-[#eee] shrink-0 bg-white">
                        <div className="flex items-center gap-3">
                          {admin && <img src={admin.img} alt={admin.name} className="w-8 h-8 shrink-0 rounded-full object-cover" />}
                          <input type="text" value={threadDraft} onChange={(e) => setThreadDraft(e.target.value)} placeholder={`Écrire à ${activeThreadClient.name}…`} className="flex-1 min-w-0 px-4 py-2.5 rounded-full border border-[#ddd] text-sm bg-[#f4f7f6] focus:outline-none focus:border-[#2c8c99] focus:bg-white transition-colors" />
                          <button type="button" onClick={() => sendThreadMessage(threadDraft)} aria-label="Envoyer" className="w-10 h-10 shrink-0 rounded-full bg-[#2c8c99] text-white flex items-center justify-center transition-all hover:bg-[#1f636d] hover:-translate-y-0.5">
                            <i className="fa-solid fa-paper-plane text-sm" />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : activeStagiaireThread ? (
                    <>
                      <div className="px-5 py-3 border-b border-[#eee] flex items-center gap-3 shrink-0 bg-white">
                        <span className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-[#8e44ad] to-[#bb6bd9] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                          {initials(activeStagiaireThread.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[#333] truncate">{activeStagiaireThread.name}</p>
                          <p className="text-[10px] text-[#888]">Stagiaire • {activeStagiaireThread.mentor}</p>
                        </div>
                        <button type="button" onClick={() => setActiveStagiaireEmail(null)} className="w-8 h-8 rounded-full hover:bg-[#f4f7f6] flex items-center justify-center text-[#888] transition-colors">
                          <i className="fa-solid fa-xmark text-xs" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-5 py-4">
                        {activeStagiaireMessages.length === 0 ? (
                          <p className="text-sm text-[#888] m-auto text-center">Aucun message pour le moment.</p>
                        ) : (
                          activeStagiaireMessages.map((m) => {
                            const vetImg = m.from === "equipe" ? getAdminImg(m.author) : null;
                            return (
                              <div key={m.id} className={`flex items-end gap-2 max-w-[85%] ${m.from === "equipe" ? "self-end flex-row-reverse" : "self-start"}`}>
                                {m.from === "equipe" && vetImg ? (
                                  <img src={vetImg} alt={m.author} className="w-7 h-7 shrink-0 rounded-full object-cover shadow-sm" />
                                ) : (
                                  <span className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold bg-[#f0e6f6] text-[#8e44ad]">
                                    {initials(m.author)}
                                  </span>
                                )}
                                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.from === "equipe" ? "bg-[#2c8c99] text-white rounded-br-sm" : "bg-white text-[#333] rounded-bl-sm shadow-sm"}`}>
                                  {m.from === "equipe" && <p className="text-[10px] font-semibold text-white/80 mb-0.5">{m.author}</p>}
                                  <p>{m.text}</p>
                                  <p className={`text-[9px] mt-1 ${m.from === "equipe" ? "text-white/60" : "text-[#aaa]"}`}>
                                    {new Date(m.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="px-5 py-3 border-t border-[#eee] shrink-0 bg-white">
                        <div className="flex items-center gap-3">
                          {admin && <img src={admin.img} alt={admin.name} className="w-8 h-8 shrink-0 rounded-full object-cover" />}
                          <input type="text" value={stagThreadDraft} onChange={(e) => setStagThreadDraft(e.target.value)} placeholder={`Écrire à ${activeStagiaireThread.name}…`} className="flex-1 min-w-0 px-4 py-2.5 rounded-full border border-[#ddd] text-sm bg-[#f4f7f6] focus:outline-none focus:border-[#2c8c99] focus:bg-white transition-colors" />
                          <button type="button" onClick={() => sendStagThreadMessage(stagThreadDraft)} aria-label="Envoyer" className="w-10 h-10 shrink-0 rounded-full bg-[#2c8c99] text-white flex items-center justify-center transition-all hover:bg-[#1f636d] hover:-translate-y-0.5">
                            <i className="fa-solid fa-paper-plane text-sm" />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-[#f4f7f6] flex items-center justify-center text-2xl text-[#ccc] mb-4">
                        <i className="fa-solid fa-comments" />
                      </div>
                      <p className="text-sm font-semibold text-[#333]">Sélectionnez une conversation</p>
                      <p className="text-xs text-[#888] mt-1">Choisissez un contact dans la liste pour commencer</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

      {/* ── CUSTOM SCROLLBAR ── */}
      <div className={`custom-scrollbar-track ${scrollbarVisible && !sidebarOpen && !userMenuOpen && !messagingOpen ? "custom-scrollbar-visible" : ""}`}>
        <div className="custom-scrollbar-thumb" style={{ height: thumb.height, top: thumb.top }} />
      </div>
    </div>
  );
}

/* ─── Stat card component ─── */
function StatCard({ icon, label, value, color, isText }: { icon: string; label: string; value: number | string; color: string; isText?: boolean }) {
  return (
    <div className="bg-white rounded-[16px] p-5 shadow-[0_5px_20px_rgba(0,0,0,0.05)] transition-all duration-300 cursor-default hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(0,0,0,0.1)]">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-lg mb-3 transition-transform duration-300`}>
        <i className={icon} />
      </div>
      <p className={`text-2xl font-bold text-[#333] ${isText ? "text-xl" : ""}`}>{value}</p>
      <p className="text-xs text-[#888] mt-1">{label}</p>
    </div>
  );
}
