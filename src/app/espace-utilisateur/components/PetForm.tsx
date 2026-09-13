"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ANIMAL_TYPES,
  type VetCareUser,
  updatePetInfo,
} from "../user";

type PetFormProps = {
  user: VetCareUser;
  onUpdate: (u: VetCareUser) => void;
  /** If true, the form blocks the page (mandatory first-time setup) */
  blocked?: boolean;
  /** Called after successful save when blocked=true */
  onDone?: () => void;
};

export default function PetForm({
  user,
  onUpdate,
  blocked = false,
  onDone,
}: PetFormProps) {
  const [petType, setPetType] = useState<string | null>(null);
  const [petTypeOther, setPetTypeOther] = useState("");
  const [petBreed, setPetBreed] = useState<string | null>(null);
  const [petBreedOther, setPetBreedOther] = useState("");
  const [petGender, setPetGender] = useState<"Femelle" | "Mâle" | null>(null);
  const [petSterilized, setPetSterilized] = useState<boolean | null>(null);

  const selectedAnimalType = ANIMAL_TYPES.find((t) => t.id === petType);

  /* Pre-fill from existing user data */
  useEffect(() => {
    if (user.petSpecies) {
      const match = ANIMAL_TYPES.find(
        (t) => t.label.toLowerCase() === user.petSpecies!.toLowerCase()
      );
      if (match) {
        setPetType(match.id);
      } else {
        setPetType("autre");
        setPetTypeOther(user.petSpecies || "");
      }
      if (user.petBreed) {
        const breedMatch = match?.breeds?.find(
          (b) => b.toLowerCase() === user.petBreed!.toLowerCase()
        );
        if (breedMatch && breedMatch !== "Autre") {
          setPetBreed(breedMatch);
        } else if (match && breedMatch !== "Autre") {
          setPetBreed("Autre");
          setPetBreedOther(user.petBreed || "");
        } else {
          setPetBreedOther(user.petBreed || "");
        }
      }
    }
    if (user.petGender) setPetGender(user.petGender);
    if (user.petSterilized !== undefined) setPetSterilized(user.petSterilized);
  }, []);

  const canSubmit = useMemo(() => {
    if (!petType) return false;
    if (petType === "autre" && !petTypeOther.trim()) return false;
    if (!petGender) return false;
    if (petSterilized === null) return false;
    return true;
  }, [petType, petTypeOther, petGender, petSterilized]);

  const handleSubmit = () => {
    if (!canSubmit || !petGender || petSterilized === null) return;

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

    const updated = updatePetInfo(user, {
      petSpecies: typeLabel || "",
      petBreed: breedLabel,
      petGender,
      petSterilized,
    });
    onUpdate(updated);
    onDone?.();
  };

  return (
    <div className="relative bg-white p-8 md:p-10 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
      <div className="absolute top-0 left-0 right-0 h-1.5 overflow-hidden rounded-t-[24px]">
        <div className="w-full h-full bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
      </div>

      {blocked && (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-[#fbeae8] flex items-center justify-center text-[#c0392b]">
            <i className="fa-solid fa-exclamation-triangle text-xl" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#333]">
              Complétez le profil de votre animal
            </h2>
            <p className="text-sm text-[#888]">
              Ces informations sont obligatoires pour accéder à votre espace.
            </p>
          </div>
        </div>
      )}

      {!blocked && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#333] mb-1">
            Modifier les informations de mon animal
          </h2>
          <p className="text-sm text-[#888]">
            Mettez à jour les détails de votre compagnon.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Type d'animal */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-3">
            Type d&apos;animal <span className="text-[#c0392b]">*</span>
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
                    : "border-[#eee] text-[#666] hover:border-[#2c8c99]/50"
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
                      : "border-[#eee] text-[#666] hover:border-[#2c8c99]/50"
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
            Sexe <span className="text-[#c0392b]">*</span>
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
                    : "border-[#eee] text-[#666] hover:border-[#2c8c99]/50"
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
            Stérilisé(e) ? <span className="text-[#c0392b]">*</span>
          </p>
          <div className="flex gap-3">
            {(
              [
                { label: "Oui", value: true },
                { label: "Non", value: false },
              ] as const
            ).map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setPetSterilized(opt.value)}
                className={`flex-1 py-2.5 rounded-full text-sm font-semibold border-2 transition-all duration-300 ${
                  petSterilized === opt.value
                    ? "border-[#2c8c99] bg-[#2c8c99] text-white"
                    : "border-[#eee] text-[#666] hover:border-[#2c8c99]/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="group bg-[#2c8c99] text-white py-3.5 px-8 rounded-full text-base font-bold transition-all duration-300 hover:-translate-y-1 hover:bg-[#1f636d] hover:shadow-[0_15px_35px_rgba(44,140,153,0.4)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          <i className="fa-solid fa-check text-sm" />
          {blocked ? "Enregistrer et accéder à mon espace" : "Enregistrer les modifications"}
        </button>
      </div>
    </div>
  );
}
