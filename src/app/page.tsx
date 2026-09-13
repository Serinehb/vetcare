"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, FormEvent } from "react";
import type { VetCareUser } from "./espace-utilisateur/user";
import { loadUser, saveUser } from "./espace-utilisateur/user";
import { createStagiaire, loadStagiaire } from "./espace-stagiaire/stagiaire";
import DatePicker from "./espace-utilisateur/components/DatePicker";
import {
  ADMIN_TEAM,
  saveAdmin,
  registerClientForAdmin,
  registerStagiaireForAdmin,
} from "./espace-admin/admin";
import { assignVetTeamMember } from "./espace-utilisateur/user";
import { sendEmailNotification, emailTemplate, emailInfoTable, ADMIN_EMAIL } from "../lib/email";

/* ─── Custom animated scrollbar (native scrollbars can't be animated) ─── */
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
      const trackHeight = doc.clientHeight - 16; // 8px top/bottom margin
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

/* ─── Intersection Observer Hook ─── */
function useScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.15 }
    );
    el.querySelectorAll(".animate-on-scroll").forEach((child) =>
      observer.observe(child)
    );
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ─── Data ─── */
const services = [
  {
    icon: "fa-solid fa-stethoscope",
    title: "Consultations",
    desc: "Bilans de santé complets, auscultation et diagnostics précis pour vos animaux.",
  },
  {
    icon: "fa-solid fa-syringe",
    title: "Vaccinations",
    desc: "Programmes de vaccination adaptés à l’âge et au mode de vie de votre compagnon.",
  },
  {
    icon: "fa-solid fa-heart-pulse",
    title: "Chirurgie",
    desc: "Interventions réalisées dans notre bloc opératoire équipé des dernières technologies.",
  },
  {
    icon: "fa-solid fa-truck-medical",
    title: "Urgences 24/7",
    desc: "Service d’urgence disponible jour et nuit pour les situations critiques.",
  },
];

const team = [
  {
    img: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    name: "Dr. Sophie Martin",
    role: "Directrice & Chirurgienne",
    bio: "Diplômée de l’École Vétérinaire de Maisons-Alfort, spécialisée en chirurgie des tissus mous. Reconnue pour sa grande précision et son calme.",
  },
  {
    img: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    name: "Dr. Lucas Bernard",
    role: "Vétérinaire Comportementaliste",
    bio: "Passionné par l’éthologie, il aide les propriétaires à résoudre les problèmes d’anxiété de séparation ou d’agressivité avec des méthodes bienveillantes.",
  },
  {
    img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    name: "Camille Petit",
    role: "Assistante Vétérinaire",
    bio: "Le sourire du cabinet, elle s’assure du confort de vos animaux dès leur arrivée. Très douée pour les prises de sang et les soins infirmiers, elle est le pilier de l’équipe.",
  },
];

const testimonials = [
  {
    text: "« Une équipe incroyablement douce avec mon chat. Je recommande à 100 % ! »",
    author: "Sophie M.",
  },
  {
    text: "« Merci au Dr. Bernard pour sa réactivité lors de l’urgence de mon chien la nuit dernière. »",
    author: "Marc L.",
  },
  {
    text: "« Le suivi après l’opération de mon lapin a été parfait. Ils ont même appelé le lendemain. »",
    author: "Camille D.",
  },
];

/* Animal types shown as selectable icons in the post-inscription "fiche
   animal" step, each with its own breed list (always ending in "Autre"
   so nothing is ever a dead end). */
const ANIMAL_TYPES = [
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

const faqs = [
  {
    q: "Faut-il prendre rendez-vous pour une vaccination ?",
    a: "Oui, nous préférons que vous preniez rendez-vous afin de garantir un temps d’attente minimal. Cependant, nous accueillons aussi les urgences sans rendez-vous.",
  },
  {
    q: "Quelles assurances animaux acceptez-vous ?",
    a: "Nous travaillons avec la majorité des assurances animaux (SantéVet, Agria, Barko, etc.). Apportez votre carte de mutuelle lors de la visite.",
  },
  {
    q: "Comment préparer mon animal pour une consultation ?",
    a: "Assurez-vous que votre animal soit en laisse ou dans une cage de transport. Apportez son carnet de santé et un échantillon d’urine ou de selles si nécessaire.",
  },
];

/* ─── Main Page ─── */
export default function Home() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [preloaderExit, setPreloaderExit] = useState(false);
  const [activeModal, setActiveModal] = useState<
    "inscription" | "stage" | "animal" | null
  >(null);
  const [authTab, setAuthTab] = useState<"inscription" | "connexion">(
    "inscription"
  );
  const [stageAuthTab, setStageAuthTab] = useState<"inscription" | "connexion">(
    "inscription"
  );
  const [stageLoginError, setStageLoginError] = useState("");
  const [clientLoginError, setClientLoginError] = useState("");
  const [user, setUser] = useState<VetCareUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* ── "Fiche animal" step, shown right after account creation ── */
  const [pendingUser, setPendingUser] = useState<VetCareUser | null>(null);
  const [petType, setPetType] = useState<string | null>(null);
  const [petTypeOther, setPetTypeOther] = useState("");
  const [petBreed, setPetBreed] = useState<string | null>(null);
  const [petBreedOther, setPetBreedOther] = useState("");
  const [petGender, setPetGender] = useState<"Femelle" | "Mâle" | null>(
    null
  );
  const [petSterilized, setPetSterilized] = useState<boolean | null>(null);

  /* ── Stage (internship) date pickers ── */
  const todayISO = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const [stageStartDate, setStageStartDate] = useState("");
  const [stageEndDate, setStageEndDate] = useState("");

  const resetPetForm = () => {
    setPetType(null);
    setPetTypeOther("");
    setPetBreed(null);
    setPetBreedOther("");
    setPetGender(null);
    setPetSterilized(null);
  };

  const selectedAnimalType = ANIMAL_TYPES.find((t) => t.id === petType);

  /* Saves the account (plus whatever pet info was filled in, if any) and
     sends the new member to their space. */
  const finishSignup = (withPetInfo: boolean) => {
    if (!pendingUser) return;
    let finalUser: VetCareUser = { ...pendingUser };

    if (withPetInfo && petType) {
      const typeLabel =
        petType === "autre"
          ? petTypeOther.trim() || "Autre"
          : selectedAnimalType?.label;
      const breedLabel =
        petType === "autre"
          ? petBreedOther.trim() || undefined
          : petBreed === "Autre"
          ? petBreedOther.trim() || "Autre"
          : petBreed || undefined;

      finalUser = {
        ...finalUser,
        petSpecies: typeLabel || undefined,
        petBreed: breedLabel,
        petGender: petGender || undefined,
        petSterilized: petSterilized === null ? undefined : petSterilized,
        pet:
          finalUser.pet ||
          [typeLabel, breedLabel].filter(Boolean).join(" - ") ||
          undefined,
      };
    }

    setUser(finalUser);
    saveUser(finalUser);
    registerClientForAdmin(
      finalUser.name,
      finalUser.email,
      finalUser.phone,
      finalUser.pet,
      finalUser.petSpecies,
      assignVetTeamMember(finalUser.email).name
    );
    sendEmailNotification(
      finalUser.email,
      "Bienvenue chez VetCare",
      emailTemplate(
        "Bienvenue !",
        `Bonjour ${finalUser.name}, votre compte VetCare a bien été créé. Vous pouvez dès à présent prendre rendez-vous et suivre le suivi de santé de votre animal depuis votre espace.`
      )
    );
    sendEmailNotification(
      ADMIN_EMAIL,
      "Nouveau client inscrit — VetCare",
      emailTemplate(
        "Nouvelle inscription client",
        `<b>${finalUser.name}</b> vient de créer un compte.` +
          emailInfoTable([
            ["Nom", finalUser.name],
            ["Email", finalUser.email],
            ["Téléphone", finalUser.phone || "non renseigné"],
            ["Animal", finalUser.pet || "non renseigné"],
          ])
      )
    );
    setPendingUser(null);
    resetPetForm();
    setActiveModal(null);
    router.push("/espace-utilisateur");
  };

  /* Restore the session (if any) once we're on the client, so a user who
     signed in earlier stays recognized when they come back to the site. */
  useEffect(() => {
    const stored = loadUser();
    if (stored) setUser(stored);
  }, []);

  /* "Ajouter un compte" from the member-space menu links here with
     ?compte=1 so the same login/création modal pops up automatically. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("compte") === "1") {
      setActiveModal("inscription");
      setAuthTab("connexion");
      window.history.replaceState({}, "", "/");
    }
  }, []);
  const { thumb, visible: scrollbarVisible, setVisible: setScrollbarVisible } =
    useCustomScrollbar();

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("preloader-lock");
    document.body.classList.add("preloader-lock");
    const exitTimer = setTimeout(() => setPreloaderExit(true), 1300);
    const removeTimer = setTimeout(() => {
      setLoading(false);
      html.classList.remove("preloader-lock");
      document.body.classList.remove("preloader-lock");
    }, 1900);
    const scrollbarTimer = setTimeout(() => setScrollbarVisible(true), 2000);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
      clearTimeout(scrollbarTimer);
      html.classList.remove("preloader-lock");
      document.body.classList.remove("preloader-lock");
    };
  }, [setScrollbarVisible]);
  const servicesRef = useScrollAnimation();
  const aboutRef = useScrollAnimation();
  const teamRef = useScrollAnimation();
  const testimonialsRef = useScrollAnimation();
  const faqRef = useScrollAnimation();
  const contactRef = useScrollAnimation();
  const footerRef = useScrollAnimation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    alert(`Merci ${fd.get("name")} ! Votre demande a bien été envoyée.`);
    e.currentTarget.reset();
  };

  /* If the email/password typed into a "Connexion" form (client or
     stagiaire) actually belongs to one of the 3 vet team accounts,
     send that person straight into the admin space instead of
     creating a fake client/stagiaire session. */
  // Is this email one of the 3 vet team accounts? (regardless of password)
  const isAdminEmail = (email: string) =>
    ADMIN_TEAM.some((v) => v.email.toLowerCase() === email.trim().toLowerCase());

  const tryAdminLogin = (email: string, password: string) => {
    const match = ADMIN_TEAM.find(
      (v) =>
        v.email.toLowerCase() === email.trim().toLowerCase() &&
        v.password === password.trim()
    );
    if (!match) return false;
    saveAdmin({
      name: match.name,
      role: match.adminRole,
      img: match.img,
      loggedAt: new Date().toISOString(),
    });
    setActiveModal(null);
    router.push("/espace-admin");
    return true;
  };

  const handleModalSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // The "stage" (internship) form creates an intern session and
    // redirects to the dedicated intern space.
    if (activeModal === "stage") {
      // Connexion: retrieve the intern's existing local session instead
      // of creating a brand-new one (keeps their tasks/progress/messages).
      if (stageAuthTab === "connexion") {
        setStageLoginError("");
        const fd = new FormData(e.currentTarget);
        const email = (fd.get("email") as string)?.trim().toLowerCase() || "";
        const password = (fd.get("password") as string) || "";

        // Is this actually one of the vets logging in through the
        // stagiaire form? Send them to the admin space instead.
        if (isAdminEmail(email)) {
          if (tryAdminLogin(email, password)) {
            e.currentTarget.reset();
            return;
          }
          // Right admin email, wrong password: say so instead of
          // silently creating/loading a fake stagiaire session.
          setStageLoginError("Mot de passe administrateur incorrect.");
          return;
        }

        const existing = loadStagiaire();
        if (existing && existing.email.trim().toLowerCase() === email) {
          e.currentTarget.reset();
          setActiveModal(null);
          router.push("/espace-stagiaire");
        } else {
          setStageLoginError(
            "Aucun compte stagiaire trouvé avec cet email sur cet appareil. Inscrivez-vous d'abord."
          );
        }
        return;
      }

      if (!stageStartDate || !stageEndDate) return;
      const fd = new FormData(e.currentTarget);
      const name = (fd.get("name") as string)?.trim() || "";
      const email = (fd.get("email") as string)?.trim() || "";
      const phone = (fd.get("phone") as string)?.trim() || undefined;
      const school = (fd.get("school") as string)?.trim() || undefined;
      const motivation = (fd.get("message") as string)?.trim() || undefined;

      const startDate = new Date(stageStartDate + "T00:00:00").toISOString();
      const endDate = new Date(stageEndDate + "T00:00:00").toISOString();

      createStagiaire({ name, email, phone, school, motivation, startDate, endDate });
      registerStagiaireForAdmin(
        name,
        email,
        phone,
        school,
        assignVetTeamMember(email).name,
        startDate,
        endDate
      );
      sendEmailNotification(
        email,
        "Candidature de stage reçue — VetCare",
        emailTemplate(
          "Candidature reçue",
          `Bonjour ${name}, votre demande de stage chez VetCare a bien été enregistrée. Notre équipe reviendra vers vous rapidement.`
        )
      );
      sendEmailNotification(
        ADMIN_EMAIL,
        "Nouvelle candidature de stage — VetCare",
        emailTemplate(
          "Nouvelle candidature de stage",
          `<b>${name}</b> a postulé pour un stage.` +
            emailInfoTable([
              ["Nom", name],
              ["Email", email],
              ["Téléphone", phone || "non renseigné"],
              ["École", school || "non renseigné"],
            ])
        )
      );
      e.currentTarget.reset();
      setStageStartDate("");
      setStageEndDate("");
      setActiveModal(null);
      router.push("/espace-stagiaire");
      return;
    }

    const fd = new FormData(e.currentTarget);
    const rawName = fd.get("name") as string | null;
    const email = (fd.get("email") as string | null) ?? "";
    const phone = (fd.get("phone") as string | null) ?? undefined;
    const pet = (fd.get("pet") as string | null) ?? undefined;
    const password = (fd.get("password") as string | null) ?? "";
    const displayName =
      rawName?.trim() || email.split("@")[0] || "Client";

    // Admin email typed into the client form? Handle it here instead of
    // falling through to "create a client account" below.
    if (isAdminEmail(email)) {
      if (tryAdminLogin(email, password)) {
        e.currentTarget.reset();
        return;
      }
      setClientLoginError("Mot de passe administrateur incorrect.");
      return;
    }

    const newUser: VetCareUser = {
      name: displayName,
      email,
      phone: phone || undefined,
      pet: pet || undefined,
      joinedAt: new Date().toISOString(),
    };

    e.currentTarget.reset();

    if (authTab === "inscription") {
      // Brand-new account: collect the animal's profile (type, race,
      // sexe, stérilisation) in a dedicated step before entering the
      // member space, instead of jumping straight there.
      resetPetForm();
      setPendingUser(newUser);
      setActiveModal("animal");
      return;
    }

    // Connexion: the login form only asks for email + password, so if this
    // browser already has that client's full record saved (from a previous
    // inscription), reuse it instead of a blank newUser — otherwise we'd
    // wipe out their phone/pet info with the login flow's undefined values.
    const storedClient = loadUser();
    const finalUser: VetCareUser =
      storedClient && storedClient.email.toLowerCase() === email.toLowerCase()
        ? storedClient
        : newUser;

    setUser(finalUser);
    saveUser(finalUser);
    registerClientForAdmin(
      finalUser.name,
      finalUser.email,
      finalUser.phone,
      finalUser.pet,
      finalUser.petSpecies,
      assignVetTeamMember(finalUser.email).name
    );
    setActiveModal(null);
    router.push("/espace-utilisateur");
  };

  useEffect(() => {
    const isOpen = Boolean(activeModal) || mobileMenuOpen;

    if (isOpen) {
      // Freeze the body exactly at the current scroll position instead of
      // just hiding overflow. Just toggling `overflow:hidden` lets the
      // page silently snap to a different spot (and jump back on close)
      // whenever the content height changes behind the modal. Locking via
      // position:fixed + a negative top offset guarantees zero movement.
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
        const scrollY = Number(document.body.dataset.scrollY || "0");
        document.body.classList.remove("modal-open");
        document.body.style.top = "";
        delete document.body.dataset.scrollY;
        window.scrollTo(0, scrollY);
      }
    };
  }, [activeModal, mobileMenuOpen]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── PRELOADER ── */}
      {loading && (
        <div
          className={`preloader fixed inset-0 z-[999] flex items-center justify-center bg-[#eaf6f7] ${
            preloaderExit ? "preloader-exit" : ""
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="preloader-paw text-[#2c8c99] text-6xl">
              <i className="fa-solid fa-paw" />
            </div>
            <div className="preloader-text text-[#1f636d] text-2xl font-bold tracking-wide">
              VetCare
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header
        className={`header-animated fixed top-0 left-0 w-full z-50 flex justify-between items-center px-[5%] py-5 transition-colors duration-300 ${
          scrolled
            ? "bg-white/98 shadow-[0_2px_15px_rgba(0,0,0,0.1)]"
            : "bg-black/20"
        }`}
      >
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`logo-link text-3xl font-bold flex items-center gap-2.5 transition-colors duration-300 cursor-pointer ${
            scrolled ? "text-[#333]" : "text-white"
          }`}
        >
          <i className="fa-solid fa-paw logo-paw" />
          VetCare
        </a>
        <nav className="flex items-center gap-6">
          <a
            href="#services"
            className={`hidden md:inline transition-colors duration-300 hover:text-[#4dd0e1] ${
              scrolled ? "text-[#333]" : "text-white"
            }`}
          >
            Services
          </a>
          <a
            href="#about"
            className={`hidden md:inline transition-colors duration-300 hover:text-[#4dd0e1] ${
              scrolled ? "text-[#333]" : "text-white"
            }`}
          >
            À propos
          </a>
          <a
            href="#team"
            className={`hidden md:inline transition-colors duration-300 hover:text-[#4dd0e1] ${
              scrolled ? "text-[#333]" : "text-white"
            }`}
          >
            Équipe
          </a>
          {user ? (
            <Link
              href="/espace-utilisateur"
              title="Accéder à mon espace utilisateur"
              className={`hidden md:inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all duration-300 hover:!-translate-y-1 ${
                scrolled
                  ? "shadow-[inset_0_0_0_2px_#2c8c99] text-[#2c8c99] hover:!bg-[#2c8c99] hover:!text-white"
                  : "shadow-[inset_0_0_0_2px_#ffffff] text-white hover:!bg-white hover:!text-[#1f636d]"
              }`}
            >
              <i className="fa-solid fa-circle-user text-sm" />
              {user.name}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthTab("inscription");
                setActiveModal("inscription");
              }}
              className={`hidden md:inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all duration-300 hover:!-translate-y-1 ${
                scrolled
                  ? "shadow-[inset_0_0_0_2px_#2c8c99] text-[#2c8c99] hover:!bg-[#2c8c99] hover:!text-white"
                  : "shadow-[inset_0_0_0_2px_#ffffff] text-white hover:!bg-white hover:!text-[#1f636d]"
              }`}
            >
              <i className="fa-solid fa-user-plus text-sm" />
              Inscription
            </button>
          )}
          {!user && (
            <button
              type="button"
              onClick={() => {
                setStageAuthTab("inscription");
                setStageLoginError("");
                setActiveModal("stage");
              }}
              className={`hidden md:inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full font-medium transition-all duration-300 hover:!-translate-y-1 ${
                scrolled
                  ? "shadow-[inset_0_0_0_2px_#2c8c99] text-[#2c8c99] hover:!bg-[#2c8c99] hover:!text-white"
                  : "shadow-[inset_0_0_0_2px_#ffffff] text-white hover:!bg-white hover:!text-[#1f636d]"
              }`}
            >
              Inscription stage
            </button>
          )}
          <a
            href="#contact"
            className="bg-[#2c8c99] text-white px-5 py-2.5 rounded-full font-medium transition-all duration-300 hover:!-translate-y-1 hover:!bg-[#1f636d] hover:!shadow-[0_15px_35px_rgba(44,140,153,0.4)]"
          >
            Prendre RDV
          </a>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Ouvrir le menu"
            className={`md:hidden w-10 h-10 flex items-center justify-center text-xl transition-colors duration-300 ${
              scrolled ? "text-[#333]" : "text-white"
            }`}
          >
            <i className="fa-solid fa-bars" />
          </button>
        </nav>
      </header>

      {/* ── MOBILE SIDEBAR ── */}
      {mobileMenuOpen && (
        <div
          className="mobile-menu-backdrop fixed inset-0 z-[1100] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="mobile-menu-panel absolute top-0 left-0 w-full max-h-[88vh] overflow-y-auto no-scrollbar bg-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex flex-col p-6 gap-2 rounded-b-[24px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-[#333] flex items-center gap-2">
                <i className="fa-solid fa-paw text-[#2c8c99]" />
                VetCare
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fermer le menu"
                className="w-9 h-9 rounded-full bg-[#f4f7f6] text-[#888] text-base flex items-center justify-center transition-all duration-300 hover:!bg-[#2c8c99] hover:!text-white"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {user && (
              <Link
                href="/espace-utilisateur"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 p-3 mb-1 rounded-2xl bg-[#eaf6f7] transition-colors duration-300 hover:!bg-[#dcf0f2]"
              >
                <span className="w-9 h-9 shrink-0 rounded-full bg-[#2c8c99] text-white flex items-center justify-center text-sm">
                  <i className="fa-solid fa-circle-user" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-[#333]">
                    {user.name}
                  </span>
                  <span className="text-xs text-[#2c8c99]">
                    Voir mon espace utilisateur
                  </span>
                </span>
                <i className="fa-solid fa-chevron-right ml-auto text-xs text-[#2c8c99]" />
              </Link>
            )}

            <a
              href="#services"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 py-2.5 text-base font-medium text-[#333] border-b border-[#eee] transition-colors duration-300 hover:!text-[#2c8c99]"
            >
              <i className="fa-solid fa-stethoscope w-5 text-[#2c8c99]" />
              Services
            </a>
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 py-2.5 text-base font-medium text-[#333] border-b border-[#eee] transition-colors duration-300 hover:!text-[#2c8c99]"
            >
              <i className="fa-solid fa-circle-info w-5 text-[#2c8c99]" />
              À propos
            </a>
            <a
              href="#team"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 py-2.5 text-base font-medium text-[#333] border-b border-[#eee] transition-colors duration-300 hover:!text-[#2c8c99]"
            >
              <i className="fa-solid fa-user-doctor w-5 text-[#2c8c99]" />
              Équipe
            </a>

            {!user && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAuthTab("inscription");
                  setActiveModal("inscription");
                }}
                className="mt-2 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold shadow-[inset_0_0_0_2px_#2c8c99] text-[#2c8c99] transition-all duration-300 hover:!bg-[#2c8c99] hover:!text-white"
              >
                <i className="fa-solid fa-user-plus" />
                Inscription
              </button>
            )}
            {!user && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setStageAuthTab("inscription");
                  setStageLoginError("");
                  setActiveModal("stage");
                }}
                className="flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold shadow-[inset_0_0_0_2px_#2c8c99] text-[#2c8c99] transition-all duration-300 hover:!bg-[#2c8c99] hover:!text-white"
              >
                <i className="fa-solid fa-graduation-cap" />
                Inscription stage
              </button>
            )}
            <a
              href="#contact"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold bg-[#2c8c99] text-white transition-all duration-300 hover:!bg-[#1f636d]"
            >
              <i className="fa-solid fa-calendar-check" />
              Prendre RDV
            </a>
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section
        id="top"
        className="relative min-h-screen h-screen w-full flex items-center justify-start pl-[8%] text-white overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%), url('https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=2070&auto=format&fit=crop')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-[650px] z-10 mt-10">
          <h1 className="hero-title text-4xl md:text-6xl font-extrabold mb-6 leading-[1.1] tracking-tight">
            La santé de votre animal,{" "}
            <span className="text-[#4dd0e1]">notre priorité</span>.
          </h1>
          <p className="hero-text text-base md:text-lg leading-relaxed font-light opacity-0 mb-10">
            Nous combinons expertise médicale de pointe et passion pour offrir
            à vos compagnons les meilleurs soins possibles, dans un cadre
            apaisant et moderne.
          </p>
          <a
            href="#contact"
            className="hero-btn inline-block bg-[#2c8c99] text-white px-10 py-[18px] rounded-full text-lg font-bold transition-all duration-300 hover:!-translate-y-1 hover:!bg-[#1f636d] hover:!shadow-[0_15px_35px_rgba(44,140,153,0.4)] opacity-0"
          >
            Prendre Rendez-vous
          </a>
        </div>
        <div className="scroll-indicator absolute bottom-10 left-1/2 text-white text-2xl">
          <i className="fa-solid fa-chevron-down" />
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section
        id="services"
        ref={servicesRef}
        className="bg-[#f4f7f6] text-center pb-28"
        style={{ paddingTop: "120px", marginTop: "-80px" }}
      >
        <h2 className="animate-on-scroll animate-fade-up text-3xl md:text-4xl font-bold text-[#333] mb-16">
          Nos Services
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7 max-w-[1200px] mx-auto px-5">
          {services.map((s, i) => (
            <div
              key={s.title}
              className={`animate-on-scroll animate-fade-up stagger-${i + 1}`}
            >
              <div className="group bg-white p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] transition-all duration-500 ease-out hover:[transform:translateY(-1rem)_scale(1.05)] hover:!shadow-[0_15px_40px_rgba(0,0,0,0.1)] cursor-default">
                <div className="w-[90px] h-[90px] bg-[rgba(44,140,153,0.1)] rounded-full flex items-center justify-center mx-auto mb-6 text-[#2c8c99] text-4xl transition-all duration-500 group-hover:!scale-110 group-hover:!bg-[#2c8c99] group-hover:!text-white">
                  <i className={s.icon} />
                </div>
                <h3 className="text-xl font-semibold text-[#333] mb-4">
                  {s.title}
                </h3>
                <p className="text-[#666] leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section
        id="about"
        ref={aboutRef}
        className="about-gradient-bg pb-28 relative overflow-hidden"
        style={{ paddingTop: "120px", marginTop: "-80px" }}
      >
        <div className="flex flex-col md:flex-row items-center gap-15 max-w-[1200px] mx-auto px-[5%] relative z-10">
          <div className="animate-on-scroll animate-fade-right flex-1 rounded-[20px] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.15)]">
            <img
              src="https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?ixlib=rb-4.0.3&auto=format&fit=crop&w=764&q=80"
              alt="Vétérinaire"
              className="w-full h-[450px] object-cover block"
            />
          </div>
          <div className="animate-on-scroll animate-fade-left stagger-2 flex-1">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1f636d] mb-5">
              Qui sommes-nous ?
            </h2>
            <p className="text-[#444] leading-[1.8] mb-5 text-base bg-white/60 p-4 rounded-[10px]">
              Depuis plus de 15 ans, le cabinet VetCare accompagne les animaux
              et leurs maîtres. Nous croyons que chaque animal mérite des
              soins d’excellence, prodigués avec bienveillance.
            </p>
            <p className="text-[#444] leading-[1.8] text-base bg-white/60 p-4 rounded-[10px]">
              Notre clinique est équipée d’un matériel de pointe
              (radiographie numérique, échographie) pour vous garantir des
              diagnostics rapides et fiables, sans avoir à multiplier les
              déplacements.
            </p>
          </div>
        </div>
      </section>

      {/* ── TEAM ── */}
      <section
        id="team"
        ref={teamRef}
        className="bg-white text-center pb-28"
        style={{ paddingTop: "120px", marginTop: "-80px" }}
      >
        <h2 className="animate-on-scroll animate-fade-up text-3xl md:text-4xl font-bold text-[#333] mb-16">
          Notre Équipe
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-[1200px] mx-auto px-5">
          {team.map((t, i) => (
            <div
              key={t.name}
              className={`animate-on-scroll animate-fade-up stagger-${i + 1}`}
            >
              <div
                className="group bg-[#f4f7f6] rounded-[20px] overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.05)] transition-all duration-500 ease-out hover:[transform:translateY(-0.75rem)_scale(1.05)] pt-8"
                style={{ border: "1px solid #eee" }}
              >
                {t.name === "Dr. Sophie Martin" && (
                  <span className="director-badge">
                    <i className="fa-solid fa-crown" />
                    Directrice
                  </span>
                )}
                <img
                  src={t.img}
                  alt={t.name}
                  className="w-36 h-36 rounded-full object-cover mx-auto block bg-[#ccc] shadow-[0_5px_15px_rgba(0,0,0,0.15)] transition-transform duration-500 group-hover:!scale-110"
                  style={{ border: "4px solid #fff" }}
                />
                <div className="p-7 text-left">
                  <h3 className="text-[#2c8c99] text-xl font-semibold mb-1">
                    {t.name}
                  </h3>
                  <span className="text-[#888] italic block mb-4 text-sm">
                    {t.role}
                  </span>
                  <p className="text-[#555] text-sm leading-relaxed">{t.bio}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section
        ref={testimonialsRef}
        className="bg-[#f4f7f6] text-center pb-28"
        style={{ paddingTop: "120px", marginTop: "-80px" }}
      >
        <h2 className="animate-on-scroll animate-fade-up text-3xl md:text-4xl font-bold text-[#333] mb-16">
          Ce que disent nos clients
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7 max-w-[1200px] mx-auto px-5">
          {testimonials.map((t, i) => (
            <div
              key={t.author}
              className={`animate-on-scroll animate-fade-up stagger-${i + 1} bg-white p-7 rounded-[15px] text-left border-l-[5px] border-l-[#2c8c99] shadow-[0_5px_15px_rgba(0,0,0,0.03)]`}
            >
              <p className="italic text-[#555] mb-5 leading-relaxed">
                {t.text}
              </p>
              <div className="font-bold text-[#2c8c99]">{t.author}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section
        id="faq"
        ref={faqRef}
        className="bg-white pb-28"
        style={{ paddingTop: "120px", marginTop: "-80px" }}
      >
        <h2 className="text-3xl md:text-4xl font-bold text-[#333] mb-16 text-center">
          Questions Fréquentes
        </h2>
        <div className="max-w-[800px] mx-auto px-5">
          {faqs.map((f, i) => (
            <div
              key={i}
              className={`faq-item bg-[#f4f7f6] mb-4 rounded-[10px] overflow-hidden border border-[#ddd] ${
                activeFaq === i ? "active" : ""
              }`}
            >
              <button
                className="w-full bg-transparent border-none px-5 py-5 text-left text-lg font-semibold text-[#333] flex justify-between items-center cursor-pointer"
                onClick={() =>
                  setActiveFaq(activeFaq === i ? null : i)
                }
              >
                {f.q}
                <i className="fa-solid fa-chevron-down faq-chevron text-[#2c8c99]" />
              </button>
              <div className="faq-answer text-[#555] leading-relaxed">
                {f.a}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section
        id="contact"
        ref={contactRef}
        className="bg-[#f4f7f6] pb-28"
        style={{ paddingTop: "120px", marginTop: "-80px" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-[1200px] mx-auto px-[5%]">
          <div className="animate-on-scroll animate-fade-right">
            <h2 className="text-3xl md:text-4xl font-bold text-[#2c8c99] text-left mb-5">
              Contactez-nous
            </h2>
            <p className="text-[#555] mb-8 text-base">
              Vous avez une question ou souhaitez prendre rendez-vous ? N’hésitez pas à nous écrire.
            </p>
            <div className="space-y-2 text-[#555] text-base leading-[2.2]">
              <p>
                <i className="fa-solid fa-location-dot text-[#2c8c99] w-6" />{" "}
                123 Rue des Animaux, 75001 Paris
              </p>
              <p>
                <i className="fa-solid fa-phone text-[#2c8c99] w-6" /> 01 23 45 67
                89
              </p>
              <p>
                <i className="fa-solid fa-envelope text-[#2c8c99] w-6" />{" "}
                contact@vetcare.fr
              </p>
              <p>
                <i className="fa-solid fa-clock text-[#2c8c99] w-6" /> Lun-Sam
                : 9h00 - 19h00
              </p>
            </div>
          </div>
          <form
            onSubmit={handleSubmit}
            className="animate-on-scroll animate-fade-left stagger-2 relative flex flex-col gap-5 bg-white p-8 md:p-10 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.08)] overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />

            <div>
              <h3 className="text-xl font-bold text-[#333] mb-1">
                Envoyez-nous un message
              </h3>
              <p className="text-sm text-[#888]">
                Réponse sous 24h ouvrées.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="contact-field relative">
                <i className="fa-solid fa-user contact-field-icon" />
                <input
                  type="text"
                  name="name"
                  placeholder="Votre nom"
                  required
                  className="contact-input"
                />
              </div>
              <div className="contact-field relative">
                <i className="fa-solid fa-paw contact-field-icon" />
                <input
                  type="text"
                  name="pet"
                  placeholder="Nom de votre animal"
                  className="contact-input"
                />
              </div>
            </div>

            <div className="contact-field relative">
              <i className="fa-solid fa-envelope contact-field-icon" />
              <input
                type="email"
                name="email"
                placeholder="Votre email"
                required
                className="contact-input"
              />
            </div>

            <div className="contact-field relative">
              <i className="fa-solid fa-comment-dots contact-field-icon contact-field-icon-top" />
              <textarea
                name="message"
                placeholder="Décrivez votre besoin..."
                rows={4}
                required
                className="contact-input resize-none"
              />
            </div>

            <button
              type="submit"
              className="group mt-1 bg-[#2c8c99] text-white py-4 px-8 rounded-full text-base font-bold transition-all duration-300 hover:!-translate-y-1 hover:!shadow-[0_15px_35px_rgba(44,140,153,0.4)] hover:!bg-[#1f636d] flex items-center justify-center gap-2"
            >
              Envoyer le message
              <i className="fa-solid fa-paper-plane text-sm transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </form>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        ref={footerRef}
        className="bg-[#1a1a1a] text-white text-center py-10 mt-auto"
      >
        <div className="animate-on-scroll flex justify-center gap-4 mb-6">
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="social-btn w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white text-lg transition-all duration-500 hover:!bg-[#2c8c99] hover:!-translate-y-1"
          >
            <i className="fa-brands fa-facebook-f" />
          </a>
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="social-btn w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white text-lg transition-all duration-500 hover:!bg-[#2c8c99] hover:!-translate-y-1"
          >
            <i className="fa-brands fa-instagram" />
          </a>
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="social-btn w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white text-lg transition-all duration-500 hover:!bg-[#2c8c99] hover:!-translate-y-1"
          >
            <i className="fa-brands fa-linkedin-in" />
          </a>
        </div>
        <p className="animate-on-scroll animate-fade-up">
          © 2023 Cabinet Vétérinaire VetCare. Tous droits
          réservés.
        </p>
        <Link
          href="/espace-admin"
          className="text-[10px] text-white/30 hover:text-white/60 transition-colors mt-2 inline-block"
        >
          Administration
        </Link>
      </footer>

      {/* ── CUSTOM SCROLLBAR ── */}
      <div
        className={`custom-scrollbar-track ${
          scrollbarVisible && !activeModal && !mobileMenuOpen
            ? "custom-scrollbar-visible"
            : ""
        }`}
      >
        <div
          className="custom-scrollbar-thumb"
          style={{ height: thumb.height, top: thumb.top }}
        />
      </div>

      {/* ── MODALS ── */}
      {activeModal && (
        <div
          className="modal-backdrop fixed inset-0 z-[1000] flex items-center justify-center p-4"
          onClick={() =>
            activeModal === "animal" ? finishSignup(false) : setActiveModal(null)
          }
        >
          <div
            className={`modal-box relative w-full ${
              activeModal === "animal" ? "max-w-[560px]" : "max-w-[480px]"
            } max-h-[90vh] bg-white rounded-[24px] shadow-[0_25px_60px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99] z-10" />

            <button
              type="button"
              onClick={() =>
                activeModal === "animal"
                  ? finishSignup(false)
                  : setActiveModal(null)
              }
              aria-label="Fermer"
              className="absolute top-5 right-5 z-10 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm text-[#888] flex items-center justify-center transition-all duration-300 hover:!bg-[#2c8c99] hover:!text-white"
            >
              <i className="fa-solid fa-xmark" />
            </button>

            <div className="modal-scroll-content overflow-y-auto p-8 md:p-10 min-h-0">
              {activeModal === "inscription" ? (
                <>
                  <div className="mb-6">
                    <div className="w-14 h-14 rounded-full bg-[#e0f7fa] flex items-center justify-center text-[#2c8c99] text-2xl mb-4">
                      <i
                        className={`fa-solid ${
                          authTab === "inscription"
                            ? "fa-user-plus"
                            : "fa-right-to-bracket"
                        }`}
                      />
                    </div>
                    <h3 className="text-2xl font-bold text-[#333] mb-1">
                      {authTab === "inscription"
                        ? "Inscription client"
                        : "Connexion"}
                    </h3>
                    <p className="text-sm text-[#888]">
                      {authTab === "inscription"
                        ? "Créez votre dossier pour suivre la santé de votre compagnon avec nous."
                        : "Accédez à votre espace client VetCare."}
                    </p>
                  </div>

                  <div className="auth-tabs flex bg-[#f4f7f6] rounded-full p-1 mb-6">
                    <button
                      type="button"
                      onClick={() => { setAuthTab("inscription"); setClientLoginError(""); }}
                      className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                        authTab === "inscription"
                          ? "bg-[#2c8c99] text-white shadow-[0_4px_12px_rgba(44,140,153,0.35)]"
                          : "text-[#888] hover:!text-[#2c8c99]"
                      }`}
                    >
                      Inscription
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthTab("connexion"); setClientLoginError(""); }}
                      className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                        authTab === "connexion"
                          ? "bg-[#2c8c99] text-white shadow-[0_4px_12px_rgba(44,140,153,0.35)]"
                          : "text-[#888] hover:!text-[#2c8c99]"
                      }`}
                    >
                      Connexion
                    </button>
                  </div>

                  {authTab === "inscription" ? (
                    <form
                      onSubmit={handleModalSubmit}
                      className="flex flex-col gap-4"
                    >
                      <div className="contact-field relative">
                        <i className="fa-solid fa-user contact-field-icon" />
                        <input
                          type="text"
                          name="name"
                          placeholder="Votre nom complet"
                          required
                          className="contact-input"
                        />
                      </div>
                      <div className="contact-field relative">
                        <i className="fa-solid fa-envelope contact-field-icon" />
                        <input
                          type="email"
                          name="email"
                          placeholder="Votre email"
                          required
                          className="contact-input"
                        />
                      </div>
                      <div className="contact-field relative">
                        <i className="fa-solid fa-phone contact-field-icon" />
                        <input
                          type="tel"
                          name="phone"
                          placeholder="Votre téléphone"
                          required
                          className="contact-input"
                        />
                      </div>
                      <div className="contact-field relative">
                        <i className="fa-solid fa-paw contact-field-icon" />
                        <input
                          type="text"
                          name="pet"
                          placeholder="Nom et espèce de votre animal"
                          className="contact-input"
                        />
                      </div>
                      <div className="contact-field relative">
                        <i className="fa-solid fa-lock contact-field-icon" />
                        <input
                          type="password"
                          name="password"
                          placeholder="Votre mot de passe"
                          className="contact-input"
                        />
                      </div>
                      <button
                        type="submit"
                        className="group mt-1 bg-[#2c8c99] text-white py-3.5 px-8 rounded-full text-base font-bold transition-all duration-300 hover:!-translate-y-1 hover:!shadow-[0_15px_35px_rgba(44,140,153,0.4)] hover:!bg-[#1f636d] flex items-center justify-center gap-2"
                      >
                        S'inscrire
                        <i className="fa-solid fa-paper-plane text-sm transition-transform duration-300 group-hover:translate-x-1" />
                      </button>
                    </form>
                  ) : (
                    <form
                      onSubmit={handleModalSubmit}
                      className="flex flex-col gap-4"
                    >
                      <div className="contact-field relative">
                        <i className="fa-solid fa-envelope contact-field-icon" />
                        <input
                          type="email"
                          name="email"
                          placeholder="Votre email"
                          required
                          className="contact-input"
                        />
                      </div>
                      <div className="contact-field relative">
                        <i className="fa-solid fa-lock contact-field-icon" />
                        <input
                          type="password"
                          name="password"
                          placeholder="Votre mot de passe"
                          required
                          onChange={() => setClientLoginError("")}
                          className="contact-input"
                        />
                      </div>
                      {clientLoginError && (
                        <p className="flex items-center gap-2 bg-red-50 text-red-500 text-sm px-4 py-3 rounded-[12px] -mt-1">
                          <i className="fa-solid fa-circle-exclamation" />
                          {clientLoginError}
                        </p>
                      )}
                      <a
                        href="#"
                        onClick={(e) => e.preventDefault()}
                        className="text-sm text-[#2c8c99] font-medium hover:!text-[#1f636d] self-end -mt-2"
                      >
                        Mot de passe oublié ?
                      </a>
                      <button
                        type="submit"
                        className="group mt-1 bg-[#2c8c99] text-white py-3.5 px-8 rounded-full text-base font-bold transition-all duration-300 hover:!-translate-y-1 hover:!shadow-[0_15px_35px_rgba(44,140,153,0.4)] hover:!bg-[#1f636d] flex items-center justify-center gap-2"
                      >
                        Se connecter
                        <i className="fa-solid fa-right-to-bracket text-sm transition-transform duration-300 group-hover:translate-x-1" />
                      </button>
                    </form>
                  )}
                </>
              ) : activeModal === "animal" ? (
                <>
                  <div className="mb-6">
                    <div className="w-14 h-14 rounded-full bg-[#e0f7fa] flex items-center justify-center text-[#2c8c99] text-2xl mb-4">
                      <i className="fa-solid fa-paw" />
                    </div>
                    <h3 className="text-2xl font-bold text-[#333] mb-1">
                      Parlez-nous de votre compagnon
                    </h3>
                    <p className="text-sm text-[#888]">
                      Ces informations sont obligatoires pour
                      personnaliser le suivi santé de votre animal.
                    </p>
                  </div>

                  <div className="flex flex-col gap-6">
                    {/* Type d'animal */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-3">
                        Type d'animal
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {ANIMAL_TYPES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setPetType(t.id);
                              setPetBreed(null);
                              setPetBreedOther("");
                            }}
                            className={`flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl border-2 text-center transition-all duration-300 ${
                              petType === t.id
                                ? "border-[#2c8c99] bg-[#e0f7fa] text-[#1f636d]"
                                : "border-[#eee] text-[#666] hover:!border-[#2c8c99]/50"
                            }`}
                          >
                            <span
                              className={`w-11 h-11 rounded-full flex items-center justify-center text-lg ${
                                petType === t.id
                                  ? "bg-[#2c8c99] text-white"
                                  : "bg-[#f4f7f6] text-[#2c8c99]"
                              }`}
                            >
                              <i className={t.icon} />
                            </span>
                            <span className="text-xs font-semibold leading-tight">
                              {t.label}
                            </span>
                          </button>
                        ))}
                      </div>
                      {petType === "autre" && (
                        <div className="contact-field relative mt-3">
                          <i className="fa-solid fa-paw contact-field-icon" />
                          <input
                            type="text"
                            value={petTypeOther}
                            onChange={(e) => setPetTypeOther(e.target.value)}
                            placeholder="Précisez le type d'animal"
                            className="contact-input"
                          />
                        </div>
                      )}
                    </div>

                    {/* Race */}
                    {petType && petType !== "autre" && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-3">
                          Race
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedAnimalType?.breeds.map((breed) => (
                            <button
                              key={breed}
                              type="button"
                              onClick={() => {
                                setPetBreed(breed);
                                if (breed !== "Autre") setPetBreedOther("");
                              }}
                              className={`py-2 px-4 rounded-full text-sm font-medium border-2 transition-all duration-300 ${
                                petBreed === breed
                                  ? "border-[#2c8c99] bg-[#2c8c99] text-white"
                                  : "border-[#eee] text-[#666] hover:!border-[#2c8c99]/50"
                              }`}
                            >
                              {breed}
                            </button>
                          ))}
                        </div>
                        {petBreed === "Autre" && (
                          <div className="contact-field relative mt-3">
                            <i className="fa-solid fa-dna contact-field-icon" />
                            <input
                              type="text"
                              value={petBreedOther}
                              onChange={(e) => setPetBreedOther(e.target.value)}
                              placeholder="Précisez la race"
                              className="contact-input"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {petType === "autre" && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-3">
                          Race (optionnel)
                        </p>
                        <div className="contact-field relative">
                          <i className="fa-solid fa-dna contact-field-icon" />
                          <input
                            type="text"
                            value={petBreedOther}
                            onChange={(e) => setPetBreedOther(e.target.value)}
                            placeholder="Précisez la race, si connue"
                            className="contact-input"
                          />
                        </div>
                      </div>
                    )}

                    {/* Sexe */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-3">
                        Sexe
                      </p>
                      <div className="flex gap-3">
                        {(["Femelle", "Mâle"] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setPetGender(g)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold border-2 transition-all duration-300 ${
                              petGender === g
                                ? "border-[#2c8c99] bg-[#2c8c99] text-white"
                                : "border-[#eee] text-[#666] hover:!border-[#2c8c99]/50"
                            }`}
                          >
                            <i
                              className={`fa-solid ${
                                g === "Femelle" ? "fa-venus" : "fa-mars"
                              }`}
                            />
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Stérilisation */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-3">
                        Stérilisé(e) ?
                      </p>
                      <div className="flex gap-3">
                        {([
                          { label: "Oui", value: true },
                          { label: "Non", value: false },
                        ] as const).map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => setPetSterilized(opt.value)}
                            className={`flex-1 py-2.5 rounded-full text-sm font-semibold border-2 transition-all duration-300 ${
                              petSterilized === opt.value
                                ? "border-[#2c8c99] bg-[#2c8c99] text-white"
                                : "border-[#eee] text-[#666] hover:!border-[#2c8c99]/50"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-1">
                      <button
                        type="button"
                        onClick={() => finishSignup(true)}
                        disabled={
                          !petType ||
                          (petType === "autre" && !petTypeOther.trim()) ||
                          !petGender ||
                          petSterilized === null
                        }
                        className="group bg-[#2c8c99] text-white py-3.5 px-8 rounded-full text-base font-bold transition-all duration-300 hover:!-translate-y-1 hover:!shadow-[0_15px_35px_rgba(44,140,153,0.4)] hover:!bg-[#1f636d] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:!translate-y-0 disabled:hover:!shadow-none"
                      >
                        Terminer mon inscription
                        <i className="fa-solid fa-check text-sm transition-transform duration-300 group-hover:translate-x-1" />
                      </button>

                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="w-14 h-14 rounded-full bg-[#e0f7fa] flex items-center justify-center text-[#2c8c99] text-2xl mb-4">
                      <i
                        className={`fa-solid ${
                          stageAuthTab === "inscription"
                            ? "fa-graduation-cap"
                            : "fa-right-to-bracket"
                        }`}
                      />
                    </div>
                    <h3 className="text-2xl font-bold text-[#333] mb-1">
                      {stageAuthTab === "inscription"
                        ? "Inscription pour un stage"
                        : "Connexion stagiaire"}
                    </h3>
                    <p className="text-sm text-[#888]">
                      {stageAuthTab === "inscription"
                        ? "Rejoignez notre équipe le temps d'un stage et apprenez à nos côtés."
                        : "Accédez à votre espace stagiaire VetCare."}
                    </p>
                  </div>

                  <div className="auth-tabs flex bg-[#f4f7f6] rounded-full p-1 mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        setStageAuthTab("inscription");
                        setStageLoginError("");
                      }}
                      className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                        stageAuthTab === "inscription"
                          ? "bg-[#2c8c99] text-white shadow-[0_4px_12px_rgba(44,140,153,0.35)]"
                          : "text-[#888] hover:!text-[#2c8c99]"
                      }`}
                    >
                      Inscription
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStageAuthTab("connexion");
                        setStageLoginError("");
                      }}
                      className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                        stageAuthTab === "connexion"
                          ? "bg-[#2c8c99] text-white shadow-[0_4px_12px_rgba(44,140,153,0.35)]"
                          : "text-[#888] hover:!text-[#2c8c99]"
                      }`}
                    >
                      Connexion
                    </button>
                  </div>

                  {stageAuthTab === "inscription" ? (
                    <form
                      onSubmit={handleModalSubmit}
                      className="flex flex-col gap-4"
                    >
                      <div className="contact-field relative">
                        <i className="fa-solid fa-user contact-field-icon" />
                        <input
                          type="text"
                          name="name"
                          placeholder="Votre nom complet"
                          required
                          className="contact-input"
                        />
                      </div>
                      <div className="contact-field relative">
                        <i className="fa-solid fa-envelope contact-field-icon" />
                        <input
                          type="email"
                          name="email"
                          placeholder="Votre email"
                          required
                          className="contact-input"
                        />
                      </div>
                      <div className="contact-field relative">
                        <i className="fa-solid fa-phone contact-field-icon" />
                        <input
                          type="tel"
                          name="phone"
                          placeholder="Votre téléphone"
                          required
                          className="contact-input"
                        />
                      </div>
                      <div className="contact-field relative">
                        <i className="fa-solid fa-school contact-field-icon" />
                        <input
                          type="text"
                          name="school"
                          placeholder="École / formation actuelle"
                          required
                          className="contact-input"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <DatePicker
                          name="startDate"
                          min={todayISO}
                          required
                          value={stageStartDate}
                          onChange={setStageStartDate}
                        />
                        <DatePicker
                          name="endDate"
                          min={stageStartDate || todayISO}
                          required
                          value={stageEndDate}
                          onChange={setStageEndDate}
                        />
                      </div>
                      <div className="contact-field relative">
                        <i className="fa-solid fa-comment-dots contact-field-icon contact-field-icon-top" />
                        <textarea
                          name="message"
                          placeholder="Période souhaitée, motivation..."
                          rows={3}
                          className="contact-input resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="group mt-1 bg-[#2c8c99] text-white py-3.5 px-8 rounded-full text-base font-bold transition-all duration-300 hover:!-translate-y-1 hover:!shadow-[0_15px_35px_rgba(44,140,153,0.4)] hover:!bg-[#1f636d] flex items-center justify-center gap-2"
                      >
                        Envoyer ma candidature
                        <i className="fa-solid fa-paper-plane text-sm transition-transform duration-300 group-hover:translate-x-1" />
                      </button>
                    </form>
                  ) : (
                    <form
                      onSubmit={handleModalSubmit}
                      className="flex flex-col gap-4"
                    >
                      <div className="contact-field relative">
                        <i className="fa-solid fa-envelope contact-field-icon" />
                        <input
                          type="email"
                          name="email"
                          placeholder="Votre email"
                          required
                          className="contact-input"
                          onChange={() => setStageLoginError("")}
                        />
                      </div>
                      <div className="contact-field relative">
                        <i className="fa-solid fa-lock contact-field-icon" />
                        <input
                          type="password"
                          name="password"
                          placeholder="Votre mot de passe"
                          required
                          className="contact-input"
                        />
                      </div>
                      {stageLoginError && (
                        <p className="text-sm text-red-500 flex items-center gap-2 -mt-1">
                          <i className="fa-solid fa-circle-exclamation" />
                          {stageLoginError}
                        </p>
                      )}
                      <button
                        type="submit"
                        className="group mt-1 bg-[#2c8c99] text-white py-3.5 px-8 rounded-full text-base font-bold transition-all duration-300 hover:!-translate-y-1 hover:!shadow-[0_15px_35px_rgba(44,140,153,0.4)] hover:!bg-[#1f636d] flex items-center justify-center gap-2"
                      >
                        Se connecter
                        <i className="fa-solid fa-right-to-bracket text-sm transition-transform duration-300 group-hover:translate-x-1" />
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
