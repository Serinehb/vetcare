"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearUser,
  hasPetDetails,
  loadUser,
  markMessagesSeen,
  unreadMessageCount,
  syncMessagesFromShared,
  syncAppointmentsFromShared,
  syncReferentFromShared,
  updateContactInfo,
  VET_TEAM,
  type VetCareUser,
} from "./user";
import { checkAndSendAppointmentReminders } from "../espace-admin/admin";
import AppointmentsPanel from "./components/AppointmentsPanel";
import PetPanel from "./components/PetPanel";
import PetForm from "./components/PetForm";
import TeamPanel from "./components/TeamPanel";
import MessagingPanel from "./components/MessagingPanel";

type TabId = "vue" | "rdv" | "animal" | "equipe" | "messagerie";

const navItems: { id: TabId; label: string; icon: string }[] = [
  { id: "vue", label: "Tableau de bord", icon: "fa-solid fa-gauge" },
  { id: "rdv", label: "Rendez-vous", icon: "fa-solid fa-calendar-days" },
  { id: "animal", label: "Ma fiche animal", icon: "fa-solid fa-paw" },
  { id: "equipe", label: "Équipe", icon: "fa-solid fa-user-doctor" },
  { id: "messagerie", label: "Messagerie", icon: "fa-solid fa-comments" },
];

const tabTitles: Record<TabId, { title: string; subtitle: string }> = {
  vue: { title: "Tableau de bord", subtitle: "Votre espace, en un coup d'œil" },
  rdv: { title: "Rendez-vous", subtitle: "Réservez et suivez vos visites" },
  animal: { title: "Ma fiche animal", subtitle: "Santé et informations" },
  equipe: { title: "Équipe", subtitle: "Votre référent VetCare" },
  messagerie: { title: "Messagerie", subtitle: "Échangez avec l'équipe" },
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

/* Maps the animal type chosen in the "fiche animal" step (right after
   inscription) back to its icon, so the same icon shows up here. */
function petTypeIcon(species?: string) {
  const s = (species || "").toLowerCase();
  if (s.includes("chien")) return "fa-solid fa-dog";
  if (s.includes("chat")) return "fa-solid fa-cat";
  if (s.includes("oiseau")) return "fa-solid fa-dove";
  if (s.includes("lapin")) return "fa-solid fa-paw";
  return "fa-solid fa-paw";
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

export default function EspaceUtilisateur() {
  const router = useRouter();
  const [user, setUser] = useState<VetCareUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<TabId>("vue");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editPetMode, setEditPetMode] = useState(false);
  const [editContactMode, setEditContactMode] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const [nearFooter, setNearFooter] = useState(false);
  const { thumb, visible: scrollbarVisible, setVisible: setScrollbarVisible } =
    useCustomScrollbar();

  useEffect(() => {
    const timer = setTimeout(() => setScrollbarVisible(true), 800);
    return () => clearTimeout(timer);
  }, [setScrollbarVisible]);

  useEffect(() => {
    let stored = loadUser();
    if (stored) {
      stored = syncMessagesFromShared(stored);
      stored = syncAppointmentsFromShared(stored);
      stored = syncReferentFromShared(stored);
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
    const shouldLock = sidebarOpen || messagingOpen;
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
  }, [sidebarOpen, messagingOpen]);

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

  const handleLogout = () => {
    clearUser();
    setUser(null);
    router.push("/");
  };

  const openContactEdit = () => {
    if (!user) return;
    setContactName(user.name);
    setContactEmail(user.email);
    setContactPhone(user.phone || "");
    setEditContactMode(true);
  };

  const handleSaveContact = () => {
    if (!user) return;
    const updated = updateContactInfo(user, {
      name: contactName,
      email: contactEmail,
      phone: contactPhone,
    });
    setUser(updated);
    setEditContactMode(false);
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
  };

  const openMessaging = () => {
    setMessagingOpen(true);
    setSidebarOpen(false);
    setNotifOpen(false);
    setUserMenuOpen(false);
    setSearchOpen(false);
    if (user) setUser(markMessagesSeen(user));
  };

  const unread = useMemo(() => (user ? unreadMessageCount(user) : 0), [user]);

  const upcoming = useMemo(
    () =>
      (user?.appointments || [])
        .filter((a) => a.status === "à venir")
        .sort((a, b) => a.date.localeCompare(b.date)),
    [user]
  );

  const nextAppointment = upcoming[0];

  const soonAppointments = useMemo(() => {
    const in3Days = Date.now() + 3 * 24 * 60 * 60 * 1000;
    return upcoming.filter(
      (a) => new Date(`${a.date}T${a.time || "00:00"}`).getTime() <= in3Days
    );
  }, [upcoming]);

  const notifCount = unread + soonAppointments.length;
  const totalAppointments = (user?.appointments || []).length;

  /* ─── Search: pages, vets and appointments filtered live as the user types ─── */
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const pageResults = useMemo(
    () =>
      navItems.filter((item) =>
        item.label.toLowerCase().includes(normalizedQuery)
      ),
    [normalizedQuery]
  );

  const vetResults = useMemo(
    () =>
      VET_TEAM.filter(
        (v) =>
          v.name.toLowerCase().includes(normalizedQuery) ||
          v.role.toLowerCase().includes(normalizedQuery)
      ),
    [normalizedQuery]
  );

  const appointmentResults = useMemo(
    () =>
      (user?.appointments || []).filter(
        (a) =>
          a.reason.toLowerCase().includes(normalizedQuery) ||
          a.vet.toLowerCase().includes(normalizedQuery)
      ),
    [user, normalizedQuery]
  );

  const hasSearchResults =
    pageResults.length > 0 || vetResults.length > 0 || appointmentResults.length > 0;

  if (!checked || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f7f6]">
        <div className="flex flex-col items-center gap-4 text-[#2c8c99]">
          <i className="fa-solid fa-paw text-5xl animate-pulse" />
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
        <span className="hidden sm:inline">{user.name}</span>
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
                <i className="fa-solid fa-paw text-[10px]" />
                Membre depuis {joinDateLabel(user.joinedAt)}
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
                  {item.id === "rdv" && upcoming.length > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-[#2c8c99] text-white">
                      {upcoming.length}
                    </span>
                  )}
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
              <Link
                href="/?compte=1"
                className="flex items-center gap-3 px-5 py-3 text-sm text-[#666] hover:bg-[#f4f7f6] hover:text-[#333] transition-colors duration-200"
                onClick={() => setUserMenuOpen(false)}
              >
                <i className="fa-solid fa-user-plus w-5 text-center text-[#2c8c99]" />
                Ajouter un compte
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

  /* ─── Search: shared result list markup used by both the desktop dropdown and the mobile panel ─── */
  const SearchResultsList = (
    <>
      {!hasSearchResults ? (
        <p className="text-sm text-[#888] text-center py-8 px-4">
          {normalizedQuery
            ? `Aucun résultat pour « ${searchQuery} ».`
            : "Tapez pour rechercher une page, un vétérinaire ou un rendez-vous."}
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

          {vetResults.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#888] px-4 mb-2">
                Équipe
              </p>
              <div className="flex flex-col">
                {vetResults.map((vet) => (
                  <button
                    key={vet.name}
                    type="button"
                    onClick={() => goToTab("equipe")}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-200 hover:bg-[#f4f7f6]"
                  >
                    <img
                      src={vet.img}
                      alt={vet.name}
                      className="w-9 h-9 shrink-0 rounded-full object-cover"
                    />
                    <span className="text-left">
                      <span className="block font-medium text-[#333]">{vet.name}</span>
                      <span className="block text-xs text-[#888]">{vet.role}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {appointmentResults.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#888] px-4 mb-2">
                Rendez-vous
              </p>
              <div className="flex flex-col">
                {appointmentResults.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => goToTab("rdv")}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-200 hover:bg-[#f4f7f6]"
                  >
                    <span className="w-9 h-9 shrink-0 rounded-full bg-[rgba(44,140,153,0.1)] text-[#2c8c99] flex items-center justify-center">
                      <i className="fa-solid fa-calendar-days" />
                    </span>
                    <span className="text-left">
                      <span className="block font-medium text-[#333]">
                        {a.reason} — {a.vet}
                      </span>
                      <span className="block text-xs text-[#888]">
                        {new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à {a.time}
                      </span>
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
      {/* ── HEADER (same style as homepage) ── */}
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
            <i className="fa-solid fa-paw logo-paw" />
            VetCare
          </Link>
          <span className="hidden sm:block text-sm text-[#888]">
            {tabTitles[tab].subtitle}
          </span>
        </div>

        {/* Desktop nav — intentionally empty now (dashboard button removed) */}
        <nav className="hidden lg:flex items-center gap-4" />

        <div className="flex items-center gap-3 shrink-0">
          {/* Search (desktop: inline input with dropdown / mobile: icon toggling a full-width panel) */}
          <div ref={searchRef} className="relative">
            {/* Desktop input */}
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

            {/* Mobile icon */}
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

            {/* Desktop dropdown */}
            {searchOpen && (
              <div className="hidden md:block absolute right-0 mt-3 w-[420px] max-h-[70vh] overflow-y-auto bg-white rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-[#eee] z-50">
                {SearchResultsList}
              </div>
            )}

            {/* Mobile full-width panel, anchored under the header */}
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
                      <>
                        {soonAppointments.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => goToTab("rdv")}
                            className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-[#f4f7f6] transition-colors duration-200 border-b border-[#eee]"
                          >
                            <span className="w-8 h-8 shrink-0 rounded-full bg-[rgba(44,140,153,0.1)] text-[#2c8c99] flex items-center justify-center text-xs">
                              <i className="fa-solid fa-calendar-days" />
                            </span>
                            <span className="text-sm text-[#666]">
                              RDV le{" "}
                              {new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}{" "}
                              à {a.time} avec {a.vet}
                            </span>
                          </button>
                        ))}
                        {unread > 0 && (
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
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {UserDropdown}
        </div>
      </header>

      {/* ── FLOATING ACTION BUTTONS (bottom bar — teal, like homepage CTA) ── */}      {hasPetDetails(user) && !editPetMode && (
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
          onClick={() => goToTab("animal")}
          aria-label="Fiche animal"
          className="w-14 h-14 rounded-full bg-[#2c8c99] text-white flex items-center justify-center shadow-[0_5px_20px_rgba(44,140,153,0.35)] hover:bg-[#1f636d] transition-all duration-300 hover:-translate-y-1"
        >
          <i className="fa-solid fa-paw text-lg" />
        </button>
        <button
          type="button"
          onClick={() => goToTab("equipe")}
          aria-label="Équipe"
          className="w-14 h-14 rounded-full bg-[#2c8c99] text-white flex items-center justify-center shadow-[0_5px_20px_rgba(44,140,153,0.35)] hover:bg-[#1f636d] transition-all duration-300 hover:-translate-y-1"
        >
          <i className="fa-solid fa-user-doctor text-lg" />
        </button>
        <button
          type="button"
          onClick={() => goToTab("rdv")}
          aria-label="Prendre RDV"
          className="w-14 h-14 rounded-full bg-[#2c8c99] text-white flex items-center justify-center shadow-[0_5px_20px_rgba(44,140,153,0.35)] hover:bg-[#1f636d] transition-all duration-300 hover:-translate-y-1"
        >
          <i className="fa-solid fa-calendar-plus text-lg" />
        </button>
      </div>
      )}

      {/* ── MOBILE SIDEBAR DRAWER (same style as homepage mobile menu) ── */}
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
                <i className="fa-solid fa-paw text-[#2c8c99] logo-paw" />
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
                {item.id === "rdv" && upcoming.length > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-[#2c8c99] text-white">
                    {upcoming.length}
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
        {/* Block access if no pet details */}
        {!hasPetDetails(user) ? (
          <div className="max-w-[600px] mx-auto">
            <PetForm
              user={user}
              onUpdate={setUser}
              blocked
            />
          </div>
        ) : editPetMode ? (
          <div className="max-w-[600px] mx-auto">
            <PetForm
              user={user}
              onUpdate={(u) => { setUser(u); setEditPetMode(false); }}
            />
            <button
              type="button"
              onClick={() => setEditPetMode(false)}
              className="mt-4 text-sm font-semibold text-[#888] hover:text-[#2c8c99] flex items-center gap-2 mx-auto"
            >
              <i className="fa-solid fa-arrow-left text-xs" />
              Annuler
            </button>
          </div>
        ) : tab === "vue" ? (
          <div className="flex flex-col gap-10">
            {/* ── HERO CARD (same card style as homepage services) + animal card ── */}
            <div className="flex flex-col lg:flex-row gap-7 items-stretch">
              <div className="flex-1 bg-white p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  <div className="w-[90px] h-[90px] bg-[#2c8c99] rounded-full flex items-center justify-center text-white text-3xl font-bold shrink-0 shadow-[0_10px_25px_rgba(44,140,153,0.35)]">
                    {initials(user.name)}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2c8c99] mb-2">
                      Espace membre
                    </p>
                    <h2 className="text-3xl md:text-4xl font-bold text-[#333] mb-2 leading-tight">
                      {greeting()}, {firstName(user.name)}.
                    </h2>
                    <p className="text-[#666] leading-relaxed max-w-lg">
                      {nextAppointment
                        ? `Votre prochain rendez-vous est le ${new Date(nextAppointment.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à ${nextAppointment.time}, avec ${nextAppointment.vet}.`
                        : "Vous n'avez aucun rendez-vous prévu — réservez un créneau quand vous le souhaitez."}
                      {user.pet ? ` On s'occupe de ${user.pet.split(",")[0]} avec vous.` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-[#eee]">
                  <div className="flex items-center gap-2 text-sm text-[#555]">
                    <i className="fa-solid fa-paw text-[#2c8c99]" />
                    Membre depuis {joinDateLabel(user.joinedAt)}
                  </div>
                  {user.pet && (
                    <div className="flex items-center gap-2 text-sm text-[#555]">
                      <i className="fa-solid fa-paw text-[#2c8c99]" />
                      {user.pet}
                    </div>
                  )}
                </div>
              </div>

              {/* Animal card — icon selected in the "fiche animal" step
                  shown right next to the hero, to the right of the
                  main card. */}
              <div className="w-full lg:w-[260px] shrink-0 bg-white p-7 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col items-center text-center justify-center gap-3">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
                {user.petSpecies ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-[rgba(44,140,153,0.1)] flex items-center justify-center text-[#2c8c99] text-2xl">
                      <i className={petTypeIcon(user.petSpecies)} />
                    </div>
                    <div>
                      <p className="text-base font-bold text-[#333] leading-tight">
                        {user.petSpecies}
                      </p>
                      {user.petBreed && (
                        <p className="text-sm text-[#666]">{user.petBreed}</p>
                      )}
                    </div>
                    {(user.petGender || user.petSterilized !== undefined) && (
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                        {user.petGender && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#f4f7f6] text-[#555]">
                            <i
                              className={`fa-solid ${
                                user.petGender === "Femelle" ? "fa-venus" : "fa-mars"
                              }`}
                            />
                            {user.petGender}
                          </span>
                        )}
                        {user.petSterilized !== undefined && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#f4f7f6] text-[#555]">
                            <i className="fa-solid fa-shield-heart" />
                            {user.petSterilized ? "Stérilisé(e)" : "Non stérilisé(e)"}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-[rgba(44,140,153,0.1)] flex items-center justify-center text-[#2c8c99] text-2xl">
                      <i className="fa-solid fa-paw" />
                    </div>
                    <p className="text-sm text-[#666]">
                      Aucune fiche animal renseignée pour le moment.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* ── STAT CARDS (same card style as homepage services) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-7">
              <div className="group bg-white p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] transition-all duration-500 hover:[transform:translateY(-0.5rem)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.1)]">
                <div className="w-[70px] h-[70px] bg-[rgba(44,140,153,0.1)] rounded-full flex items-center justify-center text-[#2c8c99] text-3xl mb-4 transition-all duration-500 group-hover:scale-110 group-hover:bg-[#2c8c99] group-hover:text-white">
                  <i className="fa-solid fa-calendar-check" />
                </div>
                <p className="text-4xl font-bold text-[#333] mb-1">{totalAppointments}</p>
                <p className="text-sm text-[#888] uppercase tracking-wide font-semibold">Rendez-vous</p>
              </div>

              <div className="group bg-white p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] transition-all duration-500 hover:[transform:translateY(-0.5rem)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.1)]">
                <div className="w-[70px] h-[70px] bg-[rgba(44,140,153,0.1)] rounded-full flex items-center justify-center text-[#2c8c99] text-3xl mb-4 transition-all duration-500 group-hover:scale-110 group-hover:bg-[#2c8c99] group-hover:text-white">
                  <i className="fa-solid fa-clock" />
                </div>
                <p className="text-4xl font-bold text-[#333] mb-1">
                  {nextAppointment
                    ? new Date(nextAppointment.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                    : "0"}
                </p>
                <p className="text-sm text-[#888] uppercase tracking-wide font-semibold">Prochain RDV</p>
              </div>

              <div className="group bg-white p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] transition-all duration-500 hover:[transform:translateY(-0.5rem)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.1)]">
                <div className="w-[70px] h-[70px] bg-[rgba(44,140,153,0.1)] rounded-full flex items-center justify-center text-[#2c8c99] text-3xl mb-4 transition-all duration-500 group-hover:scale-110 group-hover:bg-[#2c8c99] group-hover:text-white">
                  <i className="fa-solid fa-star" />
                </div>
                <p className="text-[22px] font-bold text-[#333] mb-1 leading-tight">
                  {new Date(user.joinedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                <p className="text-sm text-[#888] uppercase tracking-wide font-semibold">Inscription</p>
              </div>
            </div>

            {/* ── ACTION CARDS (same hover style as service cards) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
              <button
                type="button"
                onClick={() => goToTab("rdv")}
                className="group bg-white p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] text-left transition-all duration-500 hover:[transform:translateY(-0.5rem)_scale(1.02)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.1)]"
              >
                <div className="w-[70px] h-[70px] bg-[rgba(59,130,246,0.1)] rounded-full flex items-center justify-center text-[#3B82F6] text-3xl mb-4 transition-all duration-500 group-hover:scale-110 group-hover:bg-[#3B82F6] group-hover:text-white">
                  <i className="fa-solid fa-chart-line" />
                </div>
                <h3 className="text-xl font-semibold text-[#333] mb-1">Votre progression</h3>
                <p className="text-[#666] text-sm">Suivez l'évolution de vos rendez-vous et la santé de votre animal.</p>
              </button>

              <button
                type="button"
                onClick={() => goToTab("rdv")}
                className="group bg-white p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] text-left transition-all duration-500 hover:[transform:translateY(-0.5rem)_scale(1.02)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.1)]"
              >
                <div className="w-[70px] h-[70px] bg-[rgba(16,185,129,0.1)] rounded-full flex items-center justify-center text-[#10B981] text-3xl mb-4 transition-all duration-500 group-hover:scale-110 group-hover:bg-[#10B981] group-hover:text-white">
                  <i className="fa-solid fa-calendar-plus" />
                </div>
                <h3 className="text-xl font-semibold text-[#333] mb-1">Prochain rendez-vous</h3>
                <p className="text-[#666] text-sm">Réservez un créneau ou consultez vos visites à venir.</p>
              </button>
            </div>

            {/* ── PROFILE + QUICK ACCESS (two-column like homepage about/contact) ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
              <div className="xl:col-span-2 bg-white p-8 md:p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-[#333]">Mes informations</h2>
                  {!editContactMode && (
                    <button
                      type="button"
                      onClick={openContactEdit}
                      className="text-sm font-semibold text-[#2c8c99] hover:!text-[#1f636d] flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-pen text-xs" />
                      Modifier mes coordonnées
                    </button>
                  )}
                </div>

                {editContactMode ? (
                  <div className="flex flex-col gap-4 max-w-md">
                    <div className="contact-field relative">
                      <i className="fa-solid fa-user contact-field-icon" />
                      <input
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Votre nom complet"
                        className="contact-input"
                      />
                    </div>
                    <div className="contact-field relative">
                      <i className="fa-solid fa-envelope contact-field-icon" />
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="Votre email"
                        className="contact-input"
                      />
                    </div>
                    <div className="contact-field relative">
                      <i className="fa-solid fa-phone contact-field-icon" />
                      <input
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="Votre téléphone"
                        className="contact-input"
                      />
                    </div>
                    <div className="flex gap-3 mt-1">
                      <button
                        type="button"
                        onClick={handleSaveContact}
                        disabled={!contactName.trim() || !contactEmail.trim()}
                        className="bg-[#2c8c99] text-white py-3 px-6 rounded-full text-sm font-bold transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1f636d] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <i className="fa-solid fa-check text-xs" />
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditContactMode(false)}
                        className="shadow-[inset_0_0_0_2px_#eee] text-[#888] py-3 px-6 rounded-full text-sm font-bold transition-all duration-300 hover:shadow-[inset_0_0_0_2px_#ccc]"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
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
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Animal renseigné</dt>
                    <dd className="text-base text-[#333] font-medium">{user.pet || "Aucun"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Type d'animal</dt>
                    <dd className="text-base text-[#333] font-medium">{user.petSpecies || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Race</dt>
                    <dd className="text-base text-[#333] font-medium">{user.petBreed || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Sexe</dt>
                    <dd className="text-base text-[#333] font-medium">{user.petGender || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Stérilisé(e)</dt>
                    <dd className="text-base text-[#333] font-medium">
                      {user.petSterilized === undefined
                        ? "—"
                        : user.petSterilized
                        ? "Oui"
                        : "Non"}
                    </dd>
                  </div>
                </dl>
                )}

                {!editContactMode && (
                <div className="mt-8 pt-6 border-t border-[#eee] flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => goToTab("rdv")}
                    className="bg-[#2c8c99] text-white py-3.5 px-8 rounded-full text-base font-bold transition-all duration-300 hover:-translate-y-1 hover:bg-[#1f636d] hover:shadow-[0_15px_35px_rgba(44,140,153,0.4)] flex items-center gap-2"
                  >
                    <i className="fa-solid fa-calendar-plus" />
                    Prendre RDV
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPetMode(true)}
                    className="shadow-[inset_0_0_0_2px_#2c8c99] text-[#2c8c99] py-3.5 px-8 rounded-full text-base font-bold transition-all duration-300 hover:bg-[#2c8c99] hover:text-white flex items-center gap-2"
                  >
                    <i className="fa-solid fa-paw" />
                    Modifier mon animal
                  </button>
                </div>
                )}
              </div>

              <div className="flex flex-col gap-7">
                <div className="bg-white p-7 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
                  <h3 className="text-lg font-semibold text-[#333] mb-3">Mes rendez-vous</h3>
                  <p className="text-sm text-[#666] mb-4">
                    {upcoming.length > 0
                      ? `Vous avez ${upcoming.length} RDV à venir.`
                      : "Aucun rendez-vous prévu."}
                  </p>
                  <button
                    type="button"
                    onClick={() => goToTab("rdv")}
                    className="text-sm font-semibold text-[#2c8c99] hover:text-[#1f636d] flex items-center gap-2"
                  >
                    Réserver <i className="fa-solid fa-arrow-right text-xs" />
                  </button>
                </div>

                <div className="bg-white p-7 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
                  <h3 className="text-lg font-semibold text-[#333] mb-3">Accès rapide</h3>
                  <div className="flex flex-col gap-1">
                    {[
                      { id: "animal" as TabId, icon: "fa-solid fa-paw", label: "Ma fiche animal" },
                      { id: "equipe" as TabId, icon: "fa-solid fa-user-doctor", label: "Notre équipe" },
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
        ) : null}

        {!editPetMode && hasPetDetails(user) && tab === "rdv" && <AppointmentsPanel user={user} onUpdate={setUser} />}
        {!editPetMode && hasPetDetails(user) && tab === "animal" && <PetPanel user={user} />}
        {!editPetMode && hasPetDetails(user) && tab === "equipe" && <TeamPanel user={user} onUpdate={setUser} />}
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
        <div className="flex-1 min-h-0">
          <MessagingPanel user={user} onUpdate={setUser} variant="sidebar" />
        </div>
      </div>

      {/* ── FOOTER (same as homepage) ── */}
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

      {/* ── CUSTOM SCROLLBAR (same as homepage) ── */}
      <div
        className={`custom-scrollbar-track ${
          scrollbarVisible && !sidebarOpen && !messagingOpen && !userMenuOpen && !notifOpen && !searchOpen
            ? "custom-scrollbar-visible"
            : ""
        }`}
      >
        <div
          className="custom-scrollbar-thumb"
          style={{ height: thumb.height, top: thumb.top }}
        />
      </div>
    </div>
  );
}
