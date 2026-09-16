"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  VET_TEAM,
  addAppointment,
  cancelAppointment,
  isPastAppointment,
  type VetCareUser,
} from "../user";
import DatePicker from "./DatePicker";
import TimePicker from "./TimePicker";
import Dropdown from "./Dropdown";

const reasons = [
  "Consultation générale",
  "Vaccination / rappel",
  "Toilettage",
  "Chirurgie",
  "Urgence",
  "Suivi post-opératoire",
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    "à venir": "bg-[rgba(44,140,153,0.1)] text-[#2c8c99]",
    "terminé": "bg-[#f4f7f6] text-[#5a8a63]",
    "annulé": "bg-[#fbeae8] text-[#c0392b]",
  };
  return map[status] || "bg-[#f4f7f6] text-[#888]";
}

export default function AppointmentsPanel({
  user,
  onUpdate,
}: {
  user: VetCareUser;
  onUpdate: (u: VetCareUser) => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState(reasons[0]);
  const [vet, setVet] = useState(VET_TEAM[0].name);

  const appointments = user.appointments || [];
  const upcoming = appointments
    .filter((a) => a.status === "à venir" && !isPastAppointment(a))
    .sort((a, b) => a.date.localeCompare(b.date));
  const history = appointments
    .filter((a) => a.status !== "à venir" || isPastAppointment(a))
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleBook = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!date || !time) return; // hidden inputs aren't part of native constraint validation
    const updated = addAppointment(user, { date, time, reason, vet });
    onUpdate(updated);
    e.currentTarget.reset();
    setDate("");
    setTime("");
    setReason(reasons[0]);
    setVet(VET_TEAM[0].name);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3500);
  };

  const handleCancel = (id: string) => {
    onUpdate(cancelAppointment(user, id));
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Booking form — same style as homepage contact form */}
      <div className="relative bg-white p-8 md:p-10 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
        <div className="absolute top-0 left-0 right-0 h-1.5 overflow-hidden rounded-t-[24px]">
          <div className="w-full h-full bg-gradient-to-r from-[#2c8c99] via-[#4dd0e1] to-[#2c8c99]" />
        </div>
        <h2 className="text-2xl font-bold text-[#333] mb-1">Réserver un rendez-vous</h2>
        <p className="text-sm text-[#888] mb-6">Choisissez un créneau adapté à vos besoins.</p>

        <form onSubmit={handleBook} className="grid sm:grid-cols-2 gap-4">
          <DatePicker name="date" min={today} required value={date} onChange={setDate} />
          <TimePicker name="time" required value={time} onChange={setTime} />
          <div className="contact-field relative">
            <i className="fa-solid fa-notes-medical contact-field-icon" />
            <Dropdown
              name="reason"
              required
              value={reason}
              onChange={setReason}
              options={reasons.map((r) => ({ value: r, label: r }))}
            />
          </div>
          <div className="contact-field relative">
            <i className="fa-solid fa-user-doctor contact-field-icon" />
            <Dropdown
              name="vet"
              required
              value={vet}
              onChange={setVet}
              options={VET_TEAM.map((v) => ({ value: v.name, label: `${v.name} — ${v.role}` }))}
            />
          </div>

          <button
            type="submit"
            className="sm:col-span-2 group mt-1 bg-[#2c8c99] text-white py-4 px-8 rounded-full text-base font-bold transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(44,140,153,0.4)] hover:bg-[#1f636d] flex items-center justify-center gap-2"
          >
            Confirmer la réservation
            <i className="fa-solid fa-paper-plane text-sm transition-transform duration-300 group-hover:translate-x-1" />
          </button>

          {submitted && (
            <p className="sm:col-span-2 text-sm font-medium text-[#2c8c99] bg-[#eaf6f7] rounded-[10px] px-4 py-3 flex items-center gap-2">
              <i className="fa-solid fa-circle-check" />
              Rendez-vous confirmé !
            </p>
          )}
        </form>
      </div>

      {/* Upcoming — same card style as homepage services */}
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-[#333] mb-6">Rendez-vous à venir</h2>
        {upcoming.length === 0 ? (
          <div className="bg-white p-7 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] text-sm text-[#888]">
            Vous n&apos;avez aucun rendez-vous prévu pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            {upcoming.map((a) => (
              <div key={a.id} className="group bg-white p-7 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] transition-all duration-500 hover:[transform:translateY(-0.5rem)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.1)]">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusBadge(a.status)}`}>{a.status}</span>
                  <button type="button" onClick={() => handleCancel(a.id)} className="text-xs font-semibold text-[#c0392b] hover:underline">Annuler</button>
                </div>
                <p className="text-lg font-semibold text-[#333] mb-1">
                  {new Date(a.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="text-sm text-[#888]">{a.time} — {a.reason}</p>
                <p className="text-sm text-[#2c8c99] mt-2 font-medium">{a.vet}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History — testimonial-style cards */}
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-[#333] mb-6">Historique</h2>
        {history.length === 0 ? (
          <div className="bg-white p-7 rounded-[20px] shadow-[0_5px_20px_rgba(0,0,0,0.05)] text-sm text-[#888]">
            Aucun rendez-vous passé pour l&apos;instant.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            {history.map((a) => (
              <div key={a.id} className="bg-white p-7 rounded-[15px] text-left border-l-[5px] border-l-[#2c8c99] shadow-[0_5px_15px_rgba(0,0,0,0.03)]">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusBadge(a.status === "à venir" ? "terminé" : a.status)}`}>
                    {a.status === "à venir" ? "terminé" : a.status}
                  </span>
                </div>
                <p className="text-base font-semibold text-[#333]">
                  {new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} · {a.time}
                </p>
                <p className="text-sm text-[#666] mt-1">{a.reason} — {a.vet}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
