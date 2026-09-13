"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import {
  loadStagiaire,
  clearStagiaire,
  saveStagiaire,
  toggleTask,
  addMessageIntern,
  unreadInternMessages,
  markInternMessagesSeen,
  internshipProgress,
  internshipDaysInfo,
  syncStagiaireFromShared,
  VET_TEAM_STAGIAIRE,
  type StagiaireUser,
  type ResourceItem,
  type TaskItem,
  type ScheduleSlot,
} from "./stagiaire";
import { checkAndSendAppointmentReminders } from "../espace-admin/admin";

type TabId = "vue" | "planning" | "taches" | "ressources" | "equipe" | "messagerie";

const navItems: { id: TabId; label: string; icon: string }[] = [
  { id: "vue", label: "Tableau de bord", icon: "fa-solid fa-gauge" },
  { id: "planning", label: "Mon planning", icon: "fa-solid fa-calendar-week" },
  { id: "taches", label: "Mes tâches", icon: "fa-solid fa-list-check" },
  { id: "ressources", label: "Ressources", icon: "fa-solid fa-book-medical" },
  { id: "equipe", label: "L'équipe", icon: "fa-solid fa-user-doctor" },
  { id: "messagerie", label: "Messagerie", icon: "fa-solid fa-comments" },
];

const tabTitles: Record<TabId, { title: string; subtitle: string }> = {
  vue: { title: "Tableau de bord", subtitle: "Votre espace stagiaire, en un coup d'œil" },
  planning: { title: "Mon planning", subtitle: "Votre emploi du temps de la semaine" },
  taches: { title: "Mes tâches", subtitle: "Objectifs et suivis de votre stage" },
  ressources: { title: "Ressources", subtitle: "Documents et guides utiles" },
  equipe: { title: "L'équipe", subtitle: "Votre tuteur et l'équipe VetCare" },
  messagerie: { title: "Messagerie", subtitle: "Échangez avec votre tuteur" },
};

const ACTIVITY_COLORS: Record<string, string> = {
  consultation: "bg-blue-100 text-blue-700",
  chirurgie: "bg-red-100 text-red-700",
  urgence: "bg-orange-100 text-orange-700",
  laboratoire: "bg-purple-100 text-purple-700",
  accueil: "bg-green-100 text-green-700",
  réunion: "bg-teal-100 text-teal-700",
};

const RESOURCE_CATEGORY_ICONS: Record<string, string> = {
  Consultations: "fa-solid fa-stethoscope",
  Chirurgie: "fa-solid fa-scissors",
  Laboratoire: "fa-solid fa-microscope",
  Urgences: "fa-solid fa-truck-medical",
};

const DAYS_ORDER = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];

const DAYS_LABELS: Record<string, string> = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
};

function initials(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function joinDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

function formatDateFr(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ─── Custom animated scrollbar (same as homepage) ─── */
function useCustomScrollbar() {
  const [thumb, setThumb] = useState({ height: 0, top: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      if (scrollable <= 0) {
        setThumb({ height: 0, top: 0 });
        return;
      }
      const ratio = doc.clientHeight / doc.scrollHeight;
      const trackHeight = doc.clientHeight - 16;
      const height = Math.max(ratio * trackHeight, 40);
      const top =
        (doc.scrollTop / scrollable) * (trackHeight - height) + 8;
      setThumb({ height, top });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return { thumb, visible, setVisible };
}

/* ─── Auto-reply messages from the team ─── */
const autoReplies = [
  "Merci pour votre message ! N'hésitez pas si vous avez d'autres questions.",
  "Bien reçu — on en discute à la prochaine séance.",
  "Super initiative ! On voit ça ensemble bientôt.",
  "Noté, je vous prépare quelques ressources sur le sujet.",
];

export default function EspaceStagiaire() {
  const router = useRouter();
  const [user, setUser] = useState<StagiaireUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<TabId>("vue");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [msgDraft, setMsgDraft] = useState("");
  const [selectedResource, setSelectedResource] = useState<ResourceItem | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const [nearFooter, setNearFooter] = useState(false);
  const { thumb, visible: scrollbarVisible, setVisible: setScrollbarVisible } =
    useCustomScrollbar();

  useEffect(() => {
    const timer = setTimeout(() => setScrollbarVisible(true), 800);
    return () => clearTimeout(timer);
  }, [setScrollbarVisible]);

  useEffect(() => {
    let stored = loadStagiaire();
    if (stored) {
      stored = syncStagiaireFromShared(stored);
    }
    setUser(stored);
    setChecked(true);
    if (!stored) {
      router.replace("/");
    }
    checkAndSendAppointmentReminders();
  }, [router]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    if (searchOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) setSearchQuery("");
  }, [searchOpen]);

  useEffect(() => {
    const shouldLock = sidebarOpen || messagingOpen || !!selectedResource;
    if (shouldLock) {
      const scrollY = window.scrollY;
      document.body.style.top = `-${scrollY}px`;
      document.body.dataset.scrollY = String(scrollY);
      document.body.classList.add("modal-open");
    } else if (document.body.classList.contains("modal-open")) {
      const scrollY = Number(document.body.dataset.scrollY || "0");
      document.body.classList.remove("modal-open");
      document.body.style.top = "";
      delete document.body.dataset.scrollY;
      window.scrollTo(0, scrollY);
    }
    return () => {
      if (document.body.classList.contains("modal-open")) {
        document.body.classList.remove("modal-open");
        document.body.style.top = "";
        delete document.body.dataset.scrollY;
      }
    };
  }, [sidebarOpen, messagingOpen, selectedResource]);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setNearFooter(entry.isIntersecting),
      { root: null, rootMargin: "0px 0px -40px 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [checked, user]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [user?.messages?.length]);

  const handleLogout = () => {
    clearStagiaire();
    setUser(null);
    router.push("/");
  };

  const goToTab = (id: TabId) => {
    if (id === "messagerie") {
      openMessaging();
      return;
    }
    setTab(id);
    setSidebarOpen(false);
    setNotifOpen(false);
    setUserMenuOpen(false);
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openMessaging = () => {
    setMessagingOpen(true);
    setSidebarOpen(false);
    setNotifOpen(false);
    setUserMenuOpen(false);
    setSearchOpen(false);
    if (user) setUser(markInternMessagesSeen(user));
  };

  const handleToggleTask = (taskId: string) => {
    if (!user) return;
    setUser(toggleTask(user, taskId));
  };

  const handleSendMessage = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const text = msgDraft.trim();
    if (!text) return;
    const withUserMsg = addMessageIntern(user, {
      from: "stagiaire",
      author: user.name,
      text,
    });
    setUser(withUserMsg);
    setMsgDraft("");
    window.setTimeout(() => {
      const reply = autoReplies[Math.floor(Math.random() * autoReplies.length)];
      const mentor = VET_TEAM_STAGIAIRE[0];
      const withReply = addMessageIntern(withUserMsg, {
        from: "equipe",
        author: mentor.name,
        text: reply,
      });
      setUser(withReply);
    }, 1400);
  };

  const unread = useMemo(() => (user ? unreadInternMessages(user) : 0), [user]);
  const taskProgress = useMemo(() => (user ? internshipProgress(user) : 0), [user]);
  const daysInfo = useMemo(() => (user ? internshipDaysInfo(user) : { totalDays: 0, elapsed: 0, remaining: 0, percent: 0 }), [user]);
  const totalTasks = user?.tasks?.length || 0;
  const doneTasks = user?.tasks?.filter((t) => t.done).length || 0;

  /* Group tasks by category */
  const tasksByCategory = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    (user?.tasks || []).forEach((task) => {
      const cat = task.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(task);
    });
    return map;
  }, [user]);

  /* Group resources by category */
  const resourcesByCategory = useMemo(() => {
    const map = new Map<string, ResourceItem[]>();
    (user?.resources || []).forEach((res) => {
      const cat = res.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(res);
    });
    return map;
  }, [user]);

  /* Schedule grouped by day */
  const scheduleByDay = useMemo(() => {
    const map = new Map<string, ScheduleSlot[]>();
    (user?.schedule || []).forEach((slot) => {
      const day = slot.day;
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(slot);
    });
    return map;
  }, [user]);

  const notifCount = unread;

  /* Search: pages filtered live */
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const pageResults = useMemo(
    () =>
      navItems.filter((item) =>
        item.label.toLowerCase().includes(normalizedQuery)
      ),
    [normalizedQuery]
  );

  const teamResults = useMemo(
    () =>
      VET_TEAM_STAGIAIRE.filter(
        (v) =>
          v.name.toLowerCase().includes(normalizedQuery) ||
          v.role.toLowerCase().includes(normalizedQuery)
      ),
    [normalizedQuery]
  );

  const hasSearchResults = pageResults.length > 0 || teamResults.length > 0;

  if (!checked || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f7f6]">
        <div className="flex flex-col items-center gap-4 text-[#2c8c99]">
          <i className="fa-solid fa-graduation-cap text-5xl animate-pulse" />
          <p className="text-sm font-medium text-[#888]">
            Vérification de votre session…
          </p>
        </div>
      </div>
    );
  }

  /* ─── User dropdown ─── */
  const UserDropdown = (
    <div ref={userMenuRef} className="relative">
      <button
        type="button"
        onClick={() => setUserMenuOpen((v) => !v)}
        className="group flex items-center gap-2.5 px-3 py-1.5 rounded-full shadow-[inset_0_0_0_2px_#2c8c99] text-[#2c8c99] font-medium transition-all duration-300 hover:bg-[#2c8c99] hover:text-white"
      >
        <span className="w-7 h-7 shrink-0 rounded-full bg-[#2c8c99] text-white flex items-center justify-center text-xs font-bold transition-colors duration-300 group-hover:bg-white group-hover:text-[#2c8c99]">
          {user.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="hidden sm:inline">{firstName(user.name)}</span>
        <i className="fa-solid fa-chevron-down text-[10px] ml-0.5" />
      </button>

      {userMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
          <div className="absolute right-0 mt-3 w-[280px] bg-white rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-[#eee] z-50 overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 shrink-0 rounded-full bg-[#2c8c99] text-white flex items-center justify-center text-sm font-bold">
                  {initials(user.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#333] truncate">{user.name}</p>
                  <p className="text-xs text-[#888] truncate">{user.email}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[rgba(44,140,153,0.1)] text-[#2c8c99]">
                <i className="fa-solid fa-graduation-cap text-[10px]" />
                Stagiaire depuis {joinDateLabel(user.joinedAt)}
              </span>
            </div>

            <div className="border-t border-[#eee] py-1">
              {navItems
                .filter((item) => item.id !== "messagerie")
                .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goToTab(item.id)}
                  className={`w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors duration-200 ${
                    tab === item.id
                      ? "text-[#2c8c99] bg-[rgba(44,140,153,0.05)]"
                      : "text-[#666] hover:bg-[#f4f7f6] hover:text-[#333]"
                  }`}
                >
                  <i className={`${item.icon} w-5 text-center text-[#2c8c99]`} />
                  {item.label}
                  {item.id === "messagerie" && unread > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#c0392b] text-white text-[10px] font-bold">
                      {unread}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-[#eee] py-1">
              <Link
                href="/"
                className="flex items-center gap-3 px-5 py-3 text-sm text-[#666] hover:bg-[#f4f7f6] hover:text-[#333] transition-colors duration-200"
                onClick={() => setUserMenuOpen(false)}
              >
                <i className="fa-solid fa-arrow-left w-5 text-center text-[#2c8c99]" />
                Retour au site
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-5 py-3 text-sm font-semibold text-[#c0392b] hover:bg-[#c0392b]/5 transition-colors duration-200"
              >
                <i className="fa-solid fa-right-from-bracket w-5 text-center" />
                Déconnexion
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  /* ─── Search results list ─── */
  const SearchResultsList = (
    <>
      {!hasSearchResults ? (
        <p className="text-sm text-[#888] text-center py-8 px-4">
          {normalizedQuery
            ? `Aucun résultat pour « ${searchQuery} ».`
            : "Tapez pour rechercher une page ou un membre de l'équipe."}
        </p>
      ) : (
        <div className="flex flex-col gap-6 py-2">
          {pageResults.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#888] px-4 mb-2">
                Pages
              </p>
              <div className="flex flex-col">
                {pageResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goToTab(item.id)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-[#333] transition-colors duration-200 hover:bg-[#f4f7f6] hover:text-[#2c8c99]"
                  >
                    <span className="w-9 h-9 shrink-0 rounded-full bg-[rgba(44,140,153,0.1)] text-[#2c8c99] flex items-center justify-center">
                      <i className={item.icon} />
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {teamResults.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#888] px-4 mb-2">
                Équipe
              </p>
              <div className="flex flex-col">
                {teamResults.map((member) => (
                  <button
                    key={member.name}
                    type="button"
                    onClick={() => goToTab("equipe")}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-200 hover:bg-[#f4f7f6]"
                  >
                    <img
                      src={member.img}
                      alt={member.name}
                      className="w-9 h-9 shrink-0 rounded-full object-cover"
                    />
                    <span className="text-left">
                      <span className="block font-medium text-[#333]">{member.name}</span>
                      <span className="block text-xs text-[#888]">{member.role}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[#f4f7f6] font-[family-name:var(--font-geist-sans)]">
      {/* ── HEADER ── */}
      <header className="bg-white shadow-[0_2px_15px_rgba(0,0,0,0.1)] px-[5%] py-5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
            className="lg:hidden w-10 h-10 flex items-center justify-center text-xl text-[#333]"
          >
            <i className="fa-solid fa-bars" />
          </button>

          <Link
            href="/"
            className="logo-link text-2xl font-bold flex items-center gap-2 text-[#333] cursor-pointer"
          >
            <i className="fa-solid fa-graduation-cap logo-paw" />
            VetCare
          </Link>
          <span className="hidden sm:block text-sm text-[#888]">
            {tabTitles[tab].subtitle}
          </span>
        </div>

        <nav className="hidden lg:flex items-center gap-4" />

        <div className="flex items-center gap-3 shrink-0">
          {/* Search */}
          <div ref={searchRef} className="relative">
            <div
              className={`hidden md:flex items-center gap-2.5 w-56 lg:w-64 px-4 py-2.5 rounded-full bg-[#f4f7f6] transition-all duration-300 ${
                searchOpen ? "bg-white ring-2 ring-[#2c8c99]/30" : ""
              }`}
            >
              <i className="fa-solid fa-magnifying-glass text-xs text-[#888] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Rechercher…"
                className="flex-1 min-w-0 bg-transparent text-sm text-[#333] placeholder:text-[#888] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchOpen((v) => !v);
                setTimeout(() => mobileSearchInputRef.current?.focus(), 50);
              }}
              aria-label="Rechercher"
              className="md:hidden w-10 h-10 rounded-full flex items-center justify-center text-[#333] hover:bg-[#f4f7f6] transition-colors duration-300"
            >
              <i className="fa-solid fa-magnifying-glass" />
            </button>

            {searchOpen && (
              <div className="hidden md:block absolute right-0 mt-3 w-[380px] max-h-[70vh] overflow-y-auto bg-white rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-[#eee] z-50">
                {SearchResultsList}
              </div>
            )}

            {searchOpen && (
              <div className="md:hidden fixed left-0 right-0 top-[73px] z-50 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] border-t border-[#eee] max-h-[75vh] overflow-y-auto">
                <div className="px-4 pt-3">
                  <div className="contact-field relative">
                    <i className="fa-solid fa-magnifying-glass contact-field-icon" />
                    <input
                      ref={mobileSearchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher…"
                      className="contact-input"
                    />
                  </div>
                </div>
                {SearchResultsList}
              </div>
            )}
          </div>

          {/* Notification bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Notifications"
              className="relative w-10 h-10 rounded-full flex items-center justify-center text-[#333] hover:bg-[#f4f7f6] transition-colors duration-300"
            >
              <i className="fa-solid fa-bell" />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#c0392b] text-white text-[10px] font-bold">
                  {notifCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 mt-3 w-[320px] bg-white rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-[#eee] z-40 overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#eee]">
                    <p className="text-sm font-bold text-[#333]">Notifications</p>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto">
                    {notifCount === 0 ? (
                      <p className="text-sm text-[#888] px-5 py-6 text-center">Rien de nouveau.</p>
                    ) : (
                      unread > 0 && (
                        <button
                          type="button"
                          onClick={() => goToTab("messagerie")}
                          className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-[#f4f7f6] transition-colors duration-200"
                        >
                          <span className="w-8 h-8 shrink-0 rounded-full bg-[rgba(44,140,153,0.1)] text-[#2c8c99] flex items-center justify-center text-xs">
                            <i className="fa-solid fa-comments" />
                          </span>
                          <span className="text-sm text-[#666]">
                            {unread} nouveau{unread > 1 ? "x" : ""} message{unread > 1 ? "s" : ""}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {UserDropdown}
        </div>
      </header>

      {/* ── FLOATING ACTION BUTTONS ── */}
      <div
        className={`fixed bottom-6 z-20 hidden lg:flex items-center gap-4 bg-white/80 backdrop-blur-sm px-5 py-3 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-all duration-500 ${
          nearFooter
            ? "right-6 left-auto translate-x-0"
            : "left-1/2 right-auto -translate-x-1/2"
        }`}
      >
        <button
          type="button"
          onClick={() => goToTab("messagerie")}
          aria-label="Messagerie"
          className="relative w-14 h-14 rounded-full bg-[#2c8c99] text-white flex items-center justify-center shadow-[0_5px_20px_rgba(44,140,153,0.35)] hover:bg-[#1f636d] transition-all duration-300 hover:-translate-y-1"
        >
          <i className="fa-solid fa-comments text-lg" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#c0392b]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => goToTab("planning")}
          aria-label="Planning"
          className="w-14 h-14 rounded-full bg-[#2c8c99] text-white flex items-center justify-center shadow-[0_5px_20px_rgba(44,140,153,0.35)] hover:bg-[#1f636d] transition-all duration-300 hover:-translate-y-1"
        >
          <i className="fa-solid fa-calendar-week text-lg" />
        </button>
        <button
          type="button"
          onClick={() => goToTab("taches")}
          aria-label="Tâches"
          className="w-14 h-14 rounded-full bg-[#2c8c99] text-white flex items-center justify-center shadow-[0_5px_20px_rgba(44,140,153,0.35)] hover:bg-[#1f636d] transition-all duration-300 hover:-translate-y-1"
        >
          <i className="fa-solid fa-list-check text-lg" />
        </button>
        <button
          type="button"
          onClick={() => goToTab("equipe")}
          aria-label="Équipe"
          className="w-14 h-14 rounded-full bg-[#2c8c99] text-white flex items-center justify-center shadow-[0_5px_20px_rgba(44,140,153,0.35)] hover:bg-[#1f636d] transition-all duration-300 hover:-translate-y-1"
        >
          <i className="fa-solid fa-user-doctor text-lg" />
        </button>
      </div>

      {/* ── MOBILE SIDEBAR DRAWER ── */}
      {sidebarOpen && (
        <div
          className="mobile-menu-backdrop fixed inset-0 z-[1000] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="mobile-menu-panel absolute top-0 left-0 h-full w-full max-h-[88vh] overflow-y-auto no-scrollbar bg-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex flex-col p-6 gap-2 rounded-b-[24px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-[#333] flex items-center gap-2">
                <i className="fa-solid fa-graduation-cap text-[#2c8c99] logo-paw" />
                VetCare
              </span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Fermer"
                className="w-9 h-9 rounded-full bg-[#f4f7f6] text-[#888] flex items-center justify-center transition-all duration-300 hover:bg-[#2c8c99] hover:text-white"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 mb-1 rounded-2xl bg-[#eaf6f7]">
              <span className="w-9 h-9 shrink-0 rounded-full bg-[#2c8c99] text-white flex items-center justify-center text-sm font-bold">
                {initials(user.name)}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-[#333]">{user.name}</span>
                <span className="text-xs text-[#2c8c99]">{user.email}</span>
              </span>
            </div>

            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goToTab(item.id)}
                className={`flex items-center gap-3 py-2.5 text-base font-medium border-b border-[#eee] transition-colors duration-300 ${
                  tab === item.id
                    ? "text-[#2c8c99]"
                    : "text-[#333] hover:text-[#2c8c99]"
                }`}
              >
                <i className={`${item.icon} w-5 text-[#2c8c99]`} />
                {item.label}
                {item.id === "messagerie" && unread > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#c0392b] text-white text-[10px] font-bold">
                    {unread}
                  </span>
                )}
              </button>
            ))}

            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 flex items-center gap-3 py-2.5 text-base font-medium text-[#c0392b] border-b border-[#eee] transition-colors duration-300"
            >
              <i className="fa-solid fa-right-from-bracket w-5" />
              Déconnexion
            </button>
            <Link
              href="/"
              className="flex items-center gap-3 py-2.5 text-base font-medium text-[#333] transition-colors duration-300 hover:text-[#2c8c99]"
              onClick={() => setSidebarOpen(false)}
            >
              <i className="fa-solid fa-arrow-left w-5 text-[#2c8c99]" />
              Retour au site
            </Link>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="px-5 sm:px-[5%] py-10 max-w-[1200px] mx-auto lg:pl-28 lg:pr-28">

        {/* ════════════════════════════════════════════════
            TAB: TABLEAU DE BORD ("vue")
            ════════════════════════════════════════════════ */}
        {tab === "vue" && (
          <div className="flex flex-col gap-10">
            {/* ── HERO CARD ── */}
            <div className="flex flex-col lg:flex-row gap-7 items-stretch">
              <div className="flex-1 bg-white p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  <div className="w-[90px] h-[90px] bg-[#2c8c99] rounded-full flex items-center justify-center text-white text-3xl font-bold shrink-0 shadow-[0_10px_25px_rgba(44,140,153,0.35)]">
                    {initials(user.name)}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2c8c99] mb-2">
                      Espace stagiaire
                    </p>
                    <h2 className="text-3xl md:text-4xl font-bold text-[#333] mb-2 leading-tight">
                      {greeting()}, {firstName(user.name)}.
                    </h2>
                    <p className="text-[#666] leading-relaxed max-w-lg">
                      {user.school
                        ? `Étudiant(e) à ${user.school},`
                        : "Bienvenue dans votre espace stagiaire !"}{" "}
                      Votre tuteur est <span className="font-semibold text-[#2c8c99]">{user.mentor}</span>.
                      {user.status === "en cours"
                        ? ` Votre stage se déroule du ${formatDateFr(user.startDate)} au ${formatDateFr(user.endDate)}.`
                        : ` Votre stage est ${user.status}.`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-[#eee]">
                  <div className="flex items-center gap-2 text-sm text-[#555]">
                    <i className="fa-solid fa-graduation-cap text-[#2c8c99]" />
                    Stagiaire depuis {joinDateLabel(user.joinedAt)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#555]">
                    <i className="fa-solid fa-user-doctor text-[#2c8c99]" />
                    Tuteur : {user.mentor}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#555]">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${
                      user.status === "en cours"
                        ? "bg-green-100 text-green-700"
                        : user.status === "terminé"
                        ? "bg-gray-100 text-gray-600"
                        : "bg-red-100 text-red-600"
                    }`}>
                      <i className={`fa-solid ${user.status === "en cours" ? "fa-circle-check" : user.status === "terminé" ? "fa-flag-checkered" : "fa-circle-xmark"} text-[10px]`} />
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Internship time progress card */}
              <div className="w-full lg:w-[260px] shrink-0 bg-white p-7 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col text-center gap-3">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
                <div className="w-16 h-16 rounded-full bg-[rgba(44,140,153,0.1)] flex items-center justify-center text-[#2c8c99] text-2xl mx-auto">
                  <i className="fa-solid fa-hourglass-half" />
                </div>
                <p className="text-lg font-bold text-[#333]">{daysInfo.remaining} jours</p>
                <p className="text-sm text-[#666]">restants</p>
                <div className="w-full bg-[#f4f7f6] rounded-full h-3 mt-1 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#2c8c99] to-[#4dd0e1] rounded-full transition-all duration-500"
                    style={{ width: `${daysInfo.percent}%` }}
                  />
                </div>
                <p className="text-xs text-[#888]">{daysInfo.percent}% du stage</p>
              </div>
            </div>

            {/* ── STAT CARDS ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-7">
              <div className="group bg-white p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] transition-all duration-500 hover:[transform:translateY(-0.5rem)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.1)]">
                <div className="w-[70px] h-[70px] bg-[rgba(44,140,153,0.1)] rounded-full flex items-center justify-center text-[#2c8c99] text-3xl mb-4 transition-all duration-500 group-hover:scale-110 group-hover:bg-[#2c8c99] group-hover:text-white">
                  <i className="fa-solid fa-hourglass-end" />
                </div>
                <p className="text-4xl font-bold text-[#333] mb-1">{daysInfo.remaining}</p>
                <p className="text-sm text-[#888] uppercase tracking-wide font-semibold">Jours restants</p>
              </div>

              <div className="group bg-white p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] transition-all duration-500 hover:[transform:translateY(-0.5rem)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.1)]">
                <div className="w-[70px] h-[70px] bg-[rgba(44,140,153,0.1)] rounded-full flex items-center justify-center text-[#2c8c99] text-3xl mb-4 transition-all duration-500 group-hover:scale-110 group-hover:bg-[#2c8c99] group-hover:text-white">
                  <i className="fa-solid fa-chart-pie" />
                </div>
                <p className="text-4xl font-bold text-[#333] mb-1">{taskProgress}%</p>
                <p className="text-sm text-[#888] uppercase tracking-wide font-semibold">Progression tâches</p>
              </div>

              <div className="group bg-white p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] transition-all duration-500 hover:[transform:translateY(-0.5rem)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.1)]">
                <div className="w-[70px] h-[70px] bg-[rgba(44,140,153,0.1)] rounded-full flex items-center justify-center text-[#2c8c99] text-3xl mb-4 transition-all duration-500 group-hover:scale-110 group-hover:bg-[#2c8c99] group-hover:text-white">
                  <i className="fa-solid fa-list-check" />
                </div>
                <p className="text-4xl font-bold text-[#333] mb-1">{doneTasks}/{totalTasks}</p>
                <p className="text-sm text-[#888] uppercase tracking-wide font-semibold">Tâches complétées</p>
              </div>
            </div>

            {/* ── PROGRESSION BAR ── */}
            <div className="bg-white p-8 md:p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
              <h2 className="text-xl font-bold text-[#333] mb-4">Progression du stage</h2>
              <div className="flex items-center gap-4 mb-3">
                <span className="text-sm font-semibold text-[#2c8c99]">{daysInfo.elapsed}j écoulés</span>
                <div className="flex-1 bg-[#f4f7f6] rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#2c8c99] to-[#4dd0e1] rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(daysInfo.percent, 8)}%` }}
                  >
                    {daysInfo.percent >= 15 && (
                      <span className="text-[10px] font-bold text-white">{daysInfo.percent}%</span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-semibold text-[#888]">{daysInfo.totalDays}j total</span>
              </div>
              <p className="text-sm text-[#888]">
                Début : {formatDateFr(user.startDate)} — Fin : {formatDateFr(user.endDate)}
              </p>
            </div>

            {/* ── ACTION CARDS ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
              <button
                type="button"
                onClick={() => goToTab("planning")}
                className="group bg-white p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] text-left transition-all duration-500 hover:[transform:translateY(-0.5rem)_scale(1.02)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.1)]"
              >
                <div className="w-[70px] h-[70px] bg-[rgba(59,130,246,0.1)] rounded-full flex items-center justify-center text-[#3B82F6] text-3xl mb-4 transition-all duration-500 group-hover:scale-110 group-hover:bg-[#3B82F6] group-hover:text-white">
                  <i className="fa-solid fa-calendar-week" />
                </div>
                <h3 className="text-xl font-semibold text-[#333] mb-1">Voir mon planning</h3>
                <p className="text-[#666] text-sm">Consultez votre emploi du temps hebdomadaire et vos créneaux.</p>
              </button>

              <button
                type="button"
                onClick={() => goToTab("taches")}
                className="group bg-white p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] text-left transition-all duration-500 hover:[transform:translateY(-0.5rem)_scale(1.02)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.1)]"
              >
                <div className="w-[70px] h-[70px] bg-[rgba(16,185,129,0.1)] rounded-full flex items-center justify-center text-[#10B981] text-3xl mb-4 transition-all duration-500 group-hover:scale-110 group-hover:bg-[#10B981] group-hover:text-white">
                  <i className="fa-solid fa-list-check" />
                </div>
                <h3 className="text-xl font-semibold text-[#333] mb-1">Mes tâches</h3>
                <p className="text-[#666] text-sm">Suivez vos objectifs d'apprentissage et cochez vos réalisations.</p>
              </button>
            </div>

            {/* ── PROFILE INFO + QUICK ACCESS ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
              <div className="xl:col-span-2 bg-white p-8 md:p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
                <h2 className="text-xl font-bold text-[#333] mb-6">Mes informations</h2>

                <dl className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Nom complet</dt>
                    <dd className="text-base text-[#333] font-medium">{user.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Adresse email</dt>
                    <dd className="text-base text-[#333] font-medium break-all">{user.email || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Téléphone</dt>
                    <dd className="text-base text-[#333] font-medium">{user.phone || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">École / Formation</dt>
                    <dd className="text-base text-[#333] font-medium">{user.school || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Période de stage</dt>
                    <dd className="text-base text-[#333] font-medium">{formatDateFr(user.startDate)} — {formatDateFr(user.endDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Tuteur</dt>
                    <dd className="text-base text-[#2c8c99] font-medium">{user.mentor}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Statut</dt>
                    <dd className="text-base text-[#333] font-medium">{user.status.charAt(0).toUpperCase() + user.status.slice(1)}</dd>
                  </div>
                </dl>

                <div className="mt-8 pt-6 border-t border-[#eee] flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => goToTab("planning")}
                    className="bg-[#2c8c99] text-white py-3.5 px-8 rounded-full text-base font-bold transition-all duration-300 hover:-translate-y-1 hover:bg-[#1f636d] hover:shadow-[0_15px_35px_rgba(44,140,153,0.4)] flex items-center gap-2"
                  >
                    <i className="fa-solid fa-calendar-week" />
                    Mon planning
                  </button>
                  <button
                    type="button"
                    onClick={() => goToTab("taches")}
                    className="shadow-[inset_0_0_0_2px_#2c8c99] text-[#2c8c99] py-3.5 px-8 rounded-full text-base font-bold transition-all duration-300 hover:bg-[#2c8c99] hover:text-white flex items-center gap-2"
                  >
                    <i className="fa-solid fa-list-check" />
                    Mes tâches
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-7">
                <div className="bg-white p-7 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
                  <h3 className="text-lg font-semibold text-[#333] mb-3">Résumé du stage</h3>
                  <p className="text-sm text-[#666] mb-4">
                    {doneTasks > 0
                      ? `Vous avez complété ${doneTasks} tâche${doneTasks > 1 ? "s" : ""} sur ${totalTasks}.`
                      : "Aucune tâche complétée pour le moment."}
                  </p>
                  <button
                    type="button"
                    onClick={() => goToTab("taches")}
                    className="text-sm font-semibold text-[#2c8c99] hover:text-[#1f636d] flex items-center gap-2"
                  >
                    Voir mes tâches <i className="fa-solid fa-arrow-right text-xs" />
                  </button>
                </div>

                <div className="bg-white p-7 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
                  <h3 className="text-lg font-semibold text-[#333] mb-3">Accès rapide</h3>
                  <div className="flex flex-col gap-1">
                    {[
                      { id: "planning" as TabId, icon: "fa-solid fa-calendar-week", label: "Mon planning" },
                      { id: "ressources" as TabId, icon: "fa-solid fa-book-medical", label: "Ressources" },
                      { id: "equipe" as TabId, icon: "fa-solid fa-user-doctor", label: "L'équipe" },
                      { id: "messagerie" as TabId, icon: "fa-solid fa-comments", label: "Messagerie" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => goToTab(item.id)}
                        className="flex items-center gap-3 py-2.5 text-base font-medium text-[#333] border-b border-[#eee] transition-colors duration-300 hover:text-[#2c8c99] last:border-b-0"
                      >
                        <i className={`${item.icon} w-5 text-[#2c8c99]`} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB: MON PLANNING ("planning")
            ════════════════════════════════════════════════ */}
        {tab === "planning" && (
          <div className="flex flex-col gap-10">
            <div className="bg-white p-8 md:p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
              <h2 className="text-2xl md:text-3xl font-bold text-[#333] mb-2">Mon planning hebdomadaire</h2>
              <p className="text-sm text-[#888] mb-8">Voici votre emploi du type de la semaine en clinique.</p>

              {DAYS_ORDER.map((day) => {
                const slots = scheduleByDay.get(day) || [];
                return (
                  <div key={day} className="mb-8 last:mb-0">
                    <h3 className="text-lg font-bold text-[#1f636d] mb-4 flex items-center gap-2">
                      <i className="fa-solid fa-calendar-day text-[#2c8c99]" />
                      {DAYS_LABELS[day]}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-[#f4f7f6]">
                            <th className="text-left px-4 py-3 rounded-tl-lg text-[#888] font-semibold uppercase tracking-wide text-xs">Créneau</th>
                            <th className="text-left px-4 py-3 text-[#888] font-semibold uppercase tracking-wide text-xs">Activité</th>
                            <th className="text-left px-4 py-3 rounded-tr-lg text-[#888] font-semibold uppercase tracking-wide text-xs">Lieu</th>
                          </tr>
                        </thead>
                        <tbody>
                          {slots.map((slot) => (
                            <tr key={slot.id} className="border-b border-[#eee] hover:bg-[#f9fffe] transition-colors duration-200">
                              <td className="px-4 py-3 text-[#555] font-medium whitespace-nowrap">
                                <i className="fa-regular fa-clock text-[#2c8c99] mr-2" />
                                {slot.time}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-2">
                                  <span className="font-medium text-[#333]">{slot.title}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ACTIVITY_COLORS[slot.type] || "bg-gray-100 text-gray-700"}`}>
                                    {slot.type}
                                  </span>
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[#666]">
                                <i className="fa-solid fa-location-dot text-[#2c8c99] mr-2" />
                                {slot.location}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="bg-white p-7 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
              <h3 className="text-lg font-semibold text-[#333] mb-4">Légende des activités</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(ACTIVITY_COLORS).map(([type, cls]) => (
                  <span key={type} className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${cls}`}>
                    <i className="fa-solid fa-circle text-[6px]" />
                    {type}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB: MES TÂCHES ("taches")
            ════════════════════════════════════════════════ */}
        {tab === "taches" && (
          <div className="flex flex-col gap-10">
            {/* Progress header */}
            <div className="bg-white p-8 md:p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-[#333] mb-1">Mes tâches</h2>
                  <p className="text-sm text-[#888]">Objectifs d&apos;apprentissage de votre stage</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-3xl font-bold text-[#2c8c99]">{taskProgress}%</p>
                    <p className="text-xs text-[#888]">{doneTasks}/{totalTasks} complétées</p>
                  </div>
                  <div className="w-16 h-16 rounded-full bg-[#f4f7f6] flex items-center justify-center">
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#eee" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15" fill="none" stroke="#2c8c99" strokeWidth="3"
                        strokeDasharray={`${(taskProgress / 100) * 94.25} 94.25`}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="w-full bg-[#f4f7f6] rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#2c8c99] to-[#4dd0e1] rounded-full transition-all duration-500"
                  style={{ width: `${taskProgress}%` }}
                />
              </div>
            </div>

            {/* Tasks grouped by category */}
            {Array.from(tasksByCategory.entries()).map(([category, tasks]) => {
              const catDone = tasks.filter((t) => t.done).length;
              const catTotal = tasks.length;
              return (
                <div key={category} className="bg-white p-8 md:p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-[#333] flex items-center gap-2">
                      <i className={`${RESOURCE_CATEGORY_ICONS[category] || "fa-solid fa-tag"} text-[#2c8c99]`} />
                      {category}
                    </h3>
                    <span className="text-xs font-bold text-[#2c8c99] bg-[rgba(44,140,153,0.1)] px-3 py-1 rounded-full">
                      {catDone}/{catTotal}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => handleToggleTask(task.id)}
                        className={`flex items-center gap-3 p-4 rounded-xl transition-all duration-300 text-left ${
                          task.done
                            ? "bg-[rgba(44,140,153,0.05)] border border-[rgba(44,140,153,0.15)]"
                            : "bg-[#f9fafb] border border-[#eee] hover:border-[#2c8c99]/30 hover:bg-[#f4f7f6]"
                        }`}
                      >
                        <span className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${
                          task.done
                            ? "bg-[#2c8c99] border-[#2c8c99] text-white"
                            : "border-[#ccc] bg-white"
                        }`}>
                          {task.done && <i className="fa-solid fa-check text-[10px]" />}
                        </span>
                        <span className={`text-sm font-medium transition-all duration-300 ${
                          task.done
                            ? "text-[#888] line-through"
                            : "text-[#333]"
                        }`}>
                          {task.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB: RESSOURCES ("ressources")
            ════════════════════════════════════════════════ */}
        {tab === "ressources" && (
          <div className="flex flex-col gap-10">
            <div className="bg-white p-8 md:p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
              <h2 className="text-2xl md:text-3xl font-bold text-[#333] mb-2">Ressources pédagogiques</h2>
              <p className="text-sm text-[#888] mb-8">Documents et guides fournis par l&apos;équipe VetCare pour accompagner votre stage.</p>

              {Array.from(resourcesByCategory.entries()).map(([category, resources]) => (
                <div key={category} className="mb-10 last:mb-0">
                  <h3 className="text-lg font-bold text-[#1f636d] mb-5 flex items-center gap-2">
                    <i className={`${RESOURCE_CATEGORY_ICONS[category] || "fa-solid fa-tag"} text-[#2c8c99]`} />
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {resources.map((res) => (
                      <div
                        key={res.id}
                        onClick={() => setSelectedResource(res)}
                        className="group bg-[#f4f7f6] p-6 rounded-[16px] border border-[#eee] transition-all duration-300 hover:[transform:translateY(-0.25rem)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:border-[#2c8c99]/30 cursor-pointer"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 shrink-0 rounded-xl bg-[rgba(44,140,153,0.1)] text-[#2c8c99] flex items-center justify-center text-xl transition-all duration-300 group-hover:bg-[#2c8c99] group-hover:text-white">
                            <i className={res.icon} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-base font-bold text-[#333] mb-1">{res.title}</h4>
                            <p className="text-sm text-[#666] leading-relaxed">{res.description}</p>
                            <span className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white text-[#2c8c99]">
                              <i className="fa-solid fa-tag text-[8px]" />
                              {res.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB: L'ÉQUIPE ("equipe")
            ════════════════════════════════════════════════ */}
        {tab === "equipe" && (
          <div className="flex flex-col gap-10">
            {/* Mentor card — highlighted */}
            <div className="bg-white p-8 md:p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
              <h2 className="text-2xl md:text-3xl font-bold text-[#1f636d] mb-5">Votre tuteur</h2>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  <img
                    src={VET_TEAM_STAGIAIRE[0].img}
                    alt={VET_TEAM_STAGIAIRE[0].name}
                    className="w-36 h-36 rounded-full object-cover bg-[#ccc] border-4 border-white shadow-[0_5px_15px_rgba(0,0,0,0.15)] shrink-0"
                  />
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full bg-[#2c8c99] text-white shadow-[0_4px_10px_rgba(44,140,153,0.3)]">
                    <i className="fa-solid fa-star text-[8px]" />
                    Votre tuteur
                  </span>
                </div>
                <div>
                  <h3 className="text-xl text-[#2c8c99] font-semibold mb-1">{VET_TEAM_STAGIAIRE[0].name}</h3>
                  <span className="text-[#888] italic block mb-3 text-sm">{VET_TEAM_STAGIAIRE[0].role}</span>
                  <p className="text-[#555] text-sm leading-relaxed">
                    C&apos;est votre interlocuteur privilégié pendant tout votre stage. N&apos;hésitez pas à lui poser
                    des questions, à lui demander des conseils ou à solliciter des retours sur votre travail.
                  </p>
                </div>
              </div>
            </div>

            {/* Full team */}
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-[#333] mb-2 text-center">Toute l&apos;équipe VetCare</h2>
              <p className="text-sm text-[#888] text-center mb-8">
                Découvrez les professionnels qui vous accompagnent pendant votre stage.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {VET_TEAM_STAGIAIRE.map((member, idx) => (
                  <div
                    key={member.name}
                    className="group relative bg-[#f4f7f6] rounded-[20px] overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.05)] transition-all duration-500 hover:[transform:translateY(-0.75rem)_scale(1.05)] border border-[#eee] pt-8"
                  >
                    {member.name === "Dr. Sophie Martin" && (
                      <span className="director-badge">
                        <i className="fa-solid fa-crown" />
                        Directrice
                      </span>
                    )}
                    {idx === 0 && (
                      <span className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full bg-[#2c8c99] text-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
                        <i className="fa-solid fa-star text-[8px]" />
                        Votre tuteur
                      </span>
                    )}
                    <img
                      src={member.img}
                      alt={member.name}
                      className="w-36 h-36 rounded-full object-cover mx-auto block bg-[#ccc] border-4 border-white shadow-[0_5px_15px_rgba(0,0,0,0.15)] transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="p-7 text-left">
                      <h3 className="text-[#2c8c99] text-xl font-semibold mb-1">{member.name}</h3>
                      <span className="text-[#888] italic block mb-3 text-sm">{member.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── MESSAGING SIDEBAR (slides in from the right) ── */}
      {messagingOpen && (
        <div
          className="fixed inset-0 z-[1100]"
          onClick={() => setMessagingOpen(false)}
        >
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] lg:w-[560px] z-[1200] bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.15)] transform transition-transform duration-300 ease-out flex flex-col ${
          messagingOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#eee] shrink-0">
          <h2 className="text-lg font-bold text-[#333] flex items-center gap-2">
            <i className="fa-solid fa-comments text-[#2c8c99]" />
            Messagerie
          </h2>
          <button
            type="button"
            onClick={() => setMessagingOpen(false)}
            aria-label="Fermer la messagerie"
            className="w-9 h-9 rounded-full bg-[#f4f7f6] text-[#888] flex items-center justify-center transition-all duration-300 hover:bg-[#2c8c99] hover:text-white"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Chat info */}
        <div className="px-5 pt-4 pb-3 border-b border-[#eee] shrink-0">
          <p className="text-sm text-[#888] mb-2">
            Vous échangez avec{" "}
            <span className="text-[#2c8c99] font-semibold">{VET_TEAM_STAGIAIRE[0].name}</span>
            <span className="text-[#888]"> ({VET_TEAM_STAGIAIRE[0].role})</span>
          </p>
          <div className="flex items-center gap-2">
            <img
              src={VET_TEAM_STAGIAIRE[0].img}
              alt={VET_TEAM_STAGIAIRE[0].name}
              className="w-7 h-7 shrink-0 rounded-full object-cover ring-2 ring-[rgba(44,140,153,0.15)]"
            />
            <span className="text-xs font-semibold whitespace-nowrap text-[#2c8c99]">
              {VET_TEAM_STAGIAIRE[0].name.replace(/^Dr\.\s*/, "")}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-5 py-4">
          {(user.messages || []).length === 0 ? (
            <p className="text-sm text-[#888] m-auto text-center">
              Aucun message pour le moment. Écrivez à {VET_TEAM_STAGIAIRE[0].name.replace(/^Dr\.\s*/, "")} pour toute question.
            </p>
          ) : (
            (user.messages || []).map((m) => (
              <div
                key={m.id}
                className={`flex items-end gap-2 max-w-[85%] ${
                  m.from === "stagiaire" ? "self-end flex-row-reverse" : "self-start"
                }`}
              >
                {m.from === "stagiaire" ? (
                  <span className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold bg-[#2c8c99] text-white">
                    {initials(user.name)}
                  </span>
                ) : (
                  <img
                    src={(VET_TEAM_STAGIAIRE.find((v) => v.name === m.author) || VET_TEAM_STAGIAIRE[0]).img}
                    alt={m.author}
                    className="w-7 h-7 shrink-0 rounded-full object-cover"
                  />
                )}
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    m.from === "stagiaire"
                      ? "bg-[#2c8c99] text-white rounded-br-sm"
                      : "bg-[#f4f7f6] text-[#333] rounded-bl-sm"
                  }`}
                >
                  {m.from === "equipe" && (
                    <p className="text-[11px] font-semibold text-[#2c8c99] mb-1">{m.author}</p>
                  )}
                  <p>{m.text}</p>
                  <p className={`text-[10px] mt-1 ${m.from === "stagiaire" ? "text-white/70" : "text-[#888]"}`}>
                    {new Date(m.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={msgEndRef} />
        </div>

        {/* Message input */}
        <form
          onSubmit={handleSendMessage}
          className="px-5 py-4 border-t border-[#eee] flex items-center gap-3 shrink-0"
        >
          <span className="w-9 h-9 shrink-0 rounded-full bg-[#2c8c99] text-white flex items-center justify-center text-xs font-bold">
            {initials(user.name)}
          </span>
          <input
            type="text"
            value={msgDraft}
            onChange={(e) => setMsgDraft(e.target.value)}
            placeholder={`Écrire à ${VET_TEAM_STAGIAIRE[0].name.replace(/^Dr\.\s*/, "")}…`}
            className="flex-1 px-4 py-3 rounded-full border border-[#ddd] text-sm bg-[#f4f7f6] focus:outline-none focus:border-[#2c8c99] focus:bg-white transition-colors duration-300"
          />
          <button
            type="submit"
            aria-label="Envoyer"
            className="w-11 h-11 shrink-0 rounded-full bg-[#2c8c99] text-white flex items-center justify-center transition-all duration-300 hover:bg-[#1f636d] hover:-translate-y-0.5"
          >
            <i className="fa-solid fa-paper-plane text-sm" />
          </button>
        </form>
      </div>

      {/* ── FOOTER ── */}
      <footer ref={footerRef} className="bg-[#1a1a1a] text-white text-center py-10 mt-10">
        <div className="flex justify-center gap-4 mb-6">
          {[
            { icon: "fa-brands fa-facebook-f", label: "Facebook" },
            { icon: "fa-brands fa-instagram", label: "Instagram" },
            { icon: "fa-brands fa-linkedin-in", label: "LinkedIn" },
          ].map((s) => (
            <span
              key={s.label}
              className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white text-lg"
            >
              <i className={s.icon} />
            </span>
          ))}
        </div>
        <p className="text-sm text-white/60">
          © 2023 Cabinet Vétérinaire VetCare. Tous droits réservés.
        </p>
      </footer>

      {/* ── CUSTOM SCROLLBAR ── */}
      <div
        className={`custom-scrollbar-track ${
          scrollbarVisible && !sidebarOpen && !messagingOpen && !userMenuOpen && !notifOpen && !searchOpen && !selectedResource
            ? "custom-scrollbar-visible"
            : ""
        }`}
      >
        <div
          className="custom-scrollbar-thumb"
          style={{ height: thumb.height, top: thumb.top }}
        />
      </div>

      {/* ── RESOURCE DETAIL POPUP ── */}
      {selectedResource && (
        <div
          className="modal-backdrop fixed inset-0 z-[1200] flex items-center justify-center p-4"
          onClick={() => setSelectedResource(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="modal-box relative w-full max-w-md rounded-[20px] shadow-[0_25px_60px_rgba(0,0,0,0.2)] overflow-hidden"
          >

            <div className="p-7">
              {/* Icon + title row */}
              <div className="flex items-start gap-4 mb-5">
                <div className="w-14 h-14 shrink-0 rounded-xl bg-[rgba(44,140,153,0.1)] text-[#2c8c99] flex items-center justify-center text-2xl">
                  <i className={selectedResource.icon} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-[#333] leading-tight mb-1">
                    {selectedResource.title}
                  </h3>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#e0f7fa] text-[#2c8c99]">
                    <i className={`${RESOURCE_CATEGORY_ICONS[selectedResource.category] || "fa-solid fa-tag"} text-[8px]`} />
                    {selectedResource.category}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="bg-[#f4f7f6] rounded-[14px] p-5 mb-6">
                <p className="text-sm text-[#555] leading-relaxed">
                  {selectedResource.description}
                </p>
              </div>

              {/* Content preview */}
              <div className="bg-[#f9fbfb] rounded-[14px] p-5 mb-6 border border-[#eee]">
                <h4 className="text-xs font-bold uppercase tracking-wide text-[#888] mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-file-lines text-[#2c8c99]" />
                  Aperçu du contenu
                </h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-check-circle text-[#2c8c99] text-xs mt-1" />
                    <p className="text-sm text-[#555]">Objectifs pédagogiques du document</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-check-circle text-[#2c8c99] text-xs mt-1" />
                    <p className="text-sm text-[#555]">Points clés à retenir</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-check-circle text-[#2c8c99] text-xs mt-1" />
                    <p className="text-sm text-[#555]">Conseils pratiques d'application</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedResource(null)}
                  className="flex-1 py-3 rounded-full text-sm font-semibold bg-[#2c8c99] text-white transition-all duration-300 hover:bg-[#1f636d] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(44,140,153,0.3)]"
                >
                  <i className="fa-solid fa-eye mr-2" />
                  Consulter
                </button>
                <button
                  onClick={() => setSelectedResource(null)}
                  className="flex-1 py-3 rounded-full text-sm font-semibold border-2 border-[#eee] text-[#666] transition-all duration-300 hover:border-[#2c8c99] hover:text-[#2c8c99]"
                >
                  Fermer
                </button>
              </div>
            </div>

            {/* Close X button */}
            <button
              onClick={() => setSelectedResource(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f4f7f6] flex items-center justify-center text-[#888] hover:bg-[#eee] hover:text-[#333] transition-colors"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
