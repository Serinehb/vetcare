"use client";

import { getSeasonalHealthTip, type VetCareUser } from "../user";

const levelStyle: Record<string, string> = {
  faible: "bg-[#f4f7f6] text-[#5a8a63]",
  modéré: "bg-[#fff8e1] text-[#a97a1c]",
  élevé: "bg-[#fbeae8] text-[#c0392b]",
};

export default function PetPanel({ user }: { user: VetCareUser }) {
  const tip = getSeasonalHealthTip(user.petSpecies);

  return (
    <div className="flex flex-col gap-10">
      {/* Pet info card */}
      <div className="group bg-white p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] transition-all duration-500 hover:[transform:translateY(-0.5rem)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.1)]">
        <div className="w-[90px] h-[90px] bg-[rgba(44,140,153,0.1)] rounded-full flex items-center justify-center text-[#2c8c99] text-4xl mb-6 transition-all duration-500 group-hover:scale-110 group-hover:bg-[#2c8c99] group-hover:text-white">
          <i className="fa-solid fa-paw" />
        </div>
        <h2 className="text-xl font-semibold text-[#333] mb-6">Ma fiche animal</h2>

        <dl className="grid sm:grid-cols-2 gap-5">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Type d&apos;animal</dt>
            <dd className="text-base text-[#333] font-medium">{user.petSpecies || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Race</dt>
            <dd className="text-base text-[#333] font-medium">{user.petBreed || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Sexe</dt>
            <dd className="text-base text-[#333] font-medium flex items-center gap-2">
              <i className={`fa-solid ${user.petGender === "Femelle" ? "fa-venus" : "fa-mars"} text-[#2c8c99]`} />
              {user.petGender || "—"}
            </dd>
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
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-1">Membre depuis</dt>
            <dd className="text-base text-[#333] font-medium">
              {new Date(user.joinedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </dd>
          </div>
        </dl>
      </div>

      {/* Seasonal health */}
      <div className="relative bg-white p-8 md:p-10 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
        <div className="absolute top-0 left-0 right-0 h-1.5 overflow-hidden rounded-t-[24px]">
          <div className="w-full h-full bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
        </div>
        <h2 className="text-2xl font-bold text-[#2c8c99] mb-6">Rappel santé de saison</h2>

        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#888]">Saison</span>
          <span className="text-sm font-bold text-[#2c8c99] capitalize">{tip.season}</span>
        </div>

        <div className="bg-[#f4f7f6] rounded-[10px] p-5 border border-[#ddd]">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="font-bold text-[#333]">{tip.risk}</p>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${levelStyle[tip.level]}`}>
              Risque {tip.level}
            </span>
          </div>
          <p className="text-sm text-[#555] leading-relaxed">{tip.advice}</p>
        </div>

        <p className="text-xs text-[#888] mt-4">
          Ce rappel est une recommandation générale basée sur la saison — votre vétérinaire référent adaptera le suivi à votre animal lors de votre prochain rendez-vous.
        </p>
      </div>
    </div>
  );
}
