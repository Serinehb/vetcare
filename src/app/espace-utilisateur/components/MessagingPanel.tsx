"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { addMessage, VET_TEAM, type VetCareUser } from "../user";

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

export default function MessagingPanel({
  user,
  onUpdate,
  variant = "panel",
}: {
  user: VetCareUser;
  onUpdate: (u: VetCareUser) => void;
  variant?: "panel" | "sidebar";
}) {
  const [draft, setDraft] = useState("");
  const [activeVet, setActiveVet] = useState(VET_TEAM[0].name);
  const referent = VET_TEAM.find((v) => v.name === activeVet) || VET_TEAM[0];
  const allMessages = user.messages || [];
  const messages = useMemo(
    () => allMessages.filter((m) => m.with === activeVet),
    [allMessages, activeVet]
  );
  const endRef = useRef<HTMLDivElement>(null);
  const userInitial = initial(user.name);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeVet]);

  const handleSend = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const withUserMsg = addMessage(user, {
      from: "user",
      author: user.name,
      text,
      with: activeVet,
    });
    onUpdate(withUserMsg);
    setDraft("");
    /* Plus de fausse réponse automatique : elle apparaissait comme un
       vrai message de l'équipe, noyait la conversation et masquait le
       badge "non lu" côté admin (le dernier message n'était plus celui
       du client). La vraie réponse de l'équipe arrive via la synchro. */
  };

  const isSidebar = variant === "sidebar";

  return (
    <div
      className={
        isSidebar
          ? "relative bg-white flex flex-col h-full"
          : "relative bg-white p-8 md:p-10 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col h-[70vh] max-h-[720px]"
      }
    >
      {!isSidebar && (
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
      )}

      <div className={isSidebar ? "px-5 pt-4 shrink-0" : "shrink-0"}>
        {!isSidebar && <h2 className="text-2xl font-bold text-[#333] mb-1">Discussion avec l&apos;équipe</h2>}
        <p className={`text-sm text-[#888] ${isSidebar ? "mb-3" : "mb-4"}`}>
          Choisissez à qui écrire :
        </p>

        {/* ── Doctor picker ── */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {VET_TEAM.map((vet) => {
            const active = vet.name === activeVet;
            return (
              <button
                key={vet.name}
                type="button"
                onClick={() => setActiveVet(vet.name)}
                className={`flex items-center gap-2 shrink-0 pl-1.5 pr-3.5 py-1.5 rounded-full border transition-all duration-300 ${
                  active
                    ? "bg-[#2c8c99] border-[#2c8c99] text-white shadow-[0_5px_15px_rgba(44,140,153,0.3)]"
                    : "bg-white border-[#ddd] text-[#555] hover:border-[#2c8c99] hover:text-[#2c8c99]"
                }`}
              >
                <img
                  src={vet.img}
                  alt={vet.name}
                  className={`w-7 h-7 shrink-0 rounded-full object-cover ${
                    active ? "ring-2 ring-white" : "ring-2 ring-[rgba(44,140,153,0.15)]"
                  }`}
                />
                <span className="text-xs font-semibold whitespace-nowrap">
                  {vet.name.replace(/^Dr\.\s*/, "")}
                </span>
              </button>
            );
          })}
        </div>

        <p className={`text-sm text-[#888] ${isSidebar ? "pb-3 border-b border-[#eee]" : "mb-6"}`}>
          Vous échangez avec <span className="text-[#2c8c99] font-semibold">{referent.name}</span> ({referent.role})
        </p>
      </div>

      <div
        className={
          isSidebar
            ? "flex-1 overflow-y-auto flex flex-col gap-3 px-5 py-4"
            : "flex-1 overflow-y-auto flex flex-col gap-3 pr-1 -mr-1"
        }
      >
        {messages.length === 0 ? (
          <p className="text-sm text-[#888] m-auto text-center">
            Aucun message pour le moment. Écrivez à {referent.name.replace(/^Dr\.\s*/, "")} pour toute question.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-end gap-2 max-w-[85%] ${
                m.from === "user" ? "self-end flex-row-reverse" : "self-start"
              }`}
            >
              {m.from === "user" ? (
                <span className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold bg-[#2c8c99] text-white">
                  {userInitial}
                </span>
              ) : (
                <img
                  src={(VET_TEAM.find((v) => v.name === m.author) || referent).img}
                  alt={m.author}
                  className="w-7 h-7 shrink-0 rounded-full object-cover"
                />
              )}
              <div
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  m.from === "user"
                    ? "bg-[#2c8c99] text-white rounded-br-sm"
                    : "bg-[#f4f7f6] text-[#333] rounded-bl-sm"
                }`}
              >
                {m.from === "team" && (
                  <p className="text-[11px] font-semibold text-[#2c8c99] mb-1">{m.author}</p>
                )}
                <p>{m.text}</p>
                <p className={`text-[10px] mt-1 ${m.from === "user" ? "text-white/70" : "text-[#888]"}`}>
                  {new Date(m.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={handleSend}
        className={
          isSidebar
            ? "px-5 py-4 border-t border-[#eee] flex items-center gap-3 shrink-0"
            : "mt-4 pt-4 border-t border-[#eee] flex items-center gap-3 shrink-0"
        }
      >
        <span className="w-9 h-9 shrink-0 rounded-full bg-[#2c8c99] text-white flex items-center justify-center text-xs font-bold">
          {userInitial}
        </span>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Écrire à ${referent.name.replace(/^Dr\.\s*/, "")}…`}
          className="flex-1 min-w-0 px-4 py-3 rounded-full border border-[#ddd] text-sm bg-[#f4f7f6] focus:outline-none focus:border-[#2c8c99] focus:bg-white transition-colors duration-300"
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
  );
}
