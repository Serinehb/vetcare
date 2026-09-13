"use client";

import { useState } from "react";
import {
  VET_TEAM,
  getReferent,
  setFavoriteVetTeamMember,
  type VetCareUser,
} from "../user";

export default function TeamPanel({
  user,
  onUpdate,
}: {
  user: VetCareUser;
  onUpdate: (u: VetCareUser) => void;
}) {
  const referent = getReferent(user);
  const [openCard, setOpenCard] = useState<string | null>(null);

  const handleFavorite = (name: string) => {
    onUpdate(setFavoriteVetTeamMember(user, name));
    setOpenCard(null);
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Referent — about section style */}
      <div className="bg-white p-8 md:p-10 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
        <h2 className="text-2xl md:text-3xl font-bold text-[#1f636d] mb-5">Votre vétérinaire référent</h2>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <img
            src={referent.img}
            alt={referent.name}
            className="w-36 h-36 rounded-full object-cover bg-[#ccc] border-4 border-white shadow-[0_5px_15px_rgba(0,0,0,0.15)] shrink-0"
          />
          <div>
            <h3 className="text-xl text-[#2c8c99] font-semibold mb-1">{referent.name}</h3>
            <span className="text-[#888] italic block mb-3 text-sm">{referent.role}</span>
            <p className="text-[#555] text-sm leading-relaxed">
              C&apos;est votre interlocuteur privilégié pour le suivi de{" "}
              {user.pet ? user.pet.split(",")[0] : "votre animal"} et vos prochains rendez-vous.
            </p>
          </div>
        </div>
      </div>

      {/* Full team — same card style as homepage #team section */}
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-[#333] mb-2 text-center">Toute l&apos;équipe VetCare</h2>
        <p className="text-sm text-[#888] text-center mb-8">
          Cliquez sur une fiche pour la marquer comme votre référent favori.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {VET_TEAM.map((member) => {
            const isFavorite = member.name === referent.name;
            const isOpen = openCard === member.name;
            return (
              <div
                key={member.name}
                onClick={() => setOpenCard(isOpen ? null : member.name)}
                className={`group relative bg-[#f4f7f6] rounded-[20px] overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.05)] transition-all duration-500 hover:[transform:translateY(-0.75rem)_scale(1.05)] border border-[#eee] pt-8 cursor-pointer ${
                  isFavorite ? "ring-2 ring-[#2c8c99]" : ""
                }`}
              >
                {member.name === "Dr. Sophie Martin" && (
                  <span className="director-badge">
                    <i className="fa-solid fa-crown" />
                    Directrice
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFavorite(member.name);
                  }}
                  aria-label={
                    isFavorite ? `${member.name} est votre référent favori` : `Marquer ${member.name} comme favori`
                  }
                  className={`absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.12)] ${
                    isFavorite
                      ? "bg-[#2c8c99] text-white scale-100 opacity-100"
                      : isOpen
                      ? "bg-white text-[#2c8c99] scale-100 opacity-100"
                      : "bg-white text-[#b0bcbe] scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100"
                  }`}
                >
                  <i className={isFavorite ? "fa-solid fa-star" : "fa-regular fa-star"} />
                </button>

                <img
                  src={member.img}
                  alt={member.name}
                  className="w-36 h-36 rounded-full object-cover mx-auto block bg-[#ccc] border-4 border-white shadow-[0_5px_15px_rgba(0,0,0,0.15)] transition-transform duration-500 group-hover:scale-110"
                />
                <div className="p-7 text-left">
                  <h3 className="text-[#2c8c99] text-xl font-semibold mb-1">{member.name}</h3>
                  <span className="text-[#888] italic block mb-3 text-sm">{member.role}</span>
                  {isFavorite && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2c8c99] bg-[rgba(44,140,153,0.1)] px-3 py-1 rounded-full">
                      <i className="fa-solid fa-star text-[10px]" />
                      Votre référent
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
