"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["lu", "ma", "me", "je", "ve", "sa", "di"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fromISO(v: string) {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDisplay(v: string) {
  const d = fromISO(v);
  if (!d) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function DatePicker({
  name,
  min,
  required,
  value,
  onChange,
}: {
  name: string;
  min?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const minDate = useMemo(() => (min ? fromISO(min) : null), [min]);
  const [viewDate, setViewDate] = useState(() => fromISO(value) || minDate || new Date());
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const cells = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    // Monday-first index (0 = lu)
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const out: { date: Date; inMonth: boolean }[] = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      out.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (out.length % 7 !== 0 || out.length < 42) {
      const last = out[out.length - 1].date;
      out.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
    }
    return out;
  }, [year, month]);

  const selected = fromISO(value);
  const todayISO = toISO(new Date());

  const isDisabled = (d: Date) => {
    if (!minDate) return false;
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const mm = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    return dd < mm;
  };

  return (
    <div className="contact-field relative" ref={wrapRef}>
      <i className="fa-solid fa-calendar-day contact-field-icon" />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="contact-input text-left flex items-center"
      >
        <span className={value ? "text-[#333]" : "text-[#9aa3a3]"}>
          {value ? formatDisplay(value) : "jj/mm/aaaa"}
        </span>
      </button>
      <input type="hidden" name={name} value={value} required={required} />

      {open && (
        <div className="absolute z-30 top-[calc(100%+8px)] left-0 w-[300px] bg-white rounded-[14px] border-[1.5px] border-[#e5e5e5] shadow-[0_15px_40px_rgba(0,0,0,0.12)] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[#333] capitalize">
              {MONTHS[month]} {year}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#666] hover:bg-[#f4f7f6] hover:text-[#2c8c99] transition-colors"
                aria-label="Mois précédent"
              >
                <i className="fa-solid fa-chevron-up text-xs" />
              </button>
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#666] hover:bg-[#f4f7f6] hover:text-[#2c8c99] transition-colors"
                aria-label="Mois suivant"
              >
                <i className="fa-solid fa-chevron-down text-xs" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-[11px] font-semibold text-[#9aa3a3] py-1">
                {w}
              </span>
            ))}
            {cells.map(({ date, inMonth }, i) => {
              const iso = toISO(date);
              const disabled = isDisabled(date);
              const isSelected = value && iso === value;
              const isToday = iso === todayISO;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={[
                    "w-9 h-9 mx-auto my-0.5 rounded-full text-sm flex items-center justify-center transition-colors",
                    !inMonth ? "text-[#c9cfcf]" : "text-[#333]",
                    disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-[#eaf6f7] hover:text-[#2c8c99]",
                    isSelected ? "bg-[#2c8c99] text-white hover:bg-[#2c8c99] hover:text-white" : "",
                    isToday && !isSelected ? "border border-[#2c8c99] text-[#2c8c99]" : "",
                  ].join(" ")}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#eee]">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="text-xs font-semibold text-[#888] hover:text-[#c0392b] transition-colors"
            >
              Effacer
            </button>
            <button
              type="button"
              onClick={() => {
                const t = new Date();
                if (!isDisabled(t)) {
                  onChange(toISO(t));
                  setViewDate(t);
                  setOpen(false);
                }
              }}
              className="text-xs font-semibold text-[#2c8c99] hover:underline"
            >
              Aujourd&apos;hui
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
