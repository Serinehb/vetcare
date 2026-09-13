"use client";

import { useEffect, useRef, useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export default function TimePicker({
  name,
  required,
  value,
  onChange,
}: {
  name: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [h, m] = value ? value.split(":") : ["", ""];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const setHour = (hh: string) => onChange(`${hh}:${m || "00"}`);
  const setMinute = (mm: string) => onChange(`${h || "00"}:${mm}`);

  return (
    <div className="contact-field relative" ref={wrapRef}>
      <i className="fa-regular fa-clock contact-field-icon" />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="contact-input text-left flex items-center"
      >
        <span className={value ? "text-[#333]" : "text-[#9aa3a3]"}>{value || "--:--"}</span>
      </button>
      <input type="hidden" name={name} value={value} required={required} />

      {open && (
        <div className="absolute z-30 top-[calc(100%+8px)] left-0 w-[180px] bg-white rounded-[14px] border-[1.5px] border-[#e5e5e5] shadow-[0_15px_40px_rgba(0,0,0,0.12)] overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-[#eee]">
            <div className="max-h-[220px] overflow-y-auto py-1">
              {HOURS.map((hh) => (
                <button
                  key={hh}
                  type="button"
                  onClick={() => setHour(hh)}
                  className={[
                    "w-full text-center py-2 text-sm font-medium transition-colors",
                    hh === h ? "bg-[#2c8c99] text-white" : "text-[#333] hover:bg-[#eaf6f7] hover:text-[#2c8c99]",
                  ].join(" ")}
                >
                  {hh}
                </button>
              ))}
            </div>
            <div className="max-h-[220px] overflow-y-auto py-1">
              {MINUTES.map((mm) => (
                <button
                  key={mm}
                  type="button"
                  onClick={() => setMinute(mm)}
                  className={[
                    "w-full text-center py-2 text-sm font-medium transition-colors",
                    mm === m ? "bg-[#2c8c99] text-white" : "text-[#333] hover:bg-[#eaf6f7] hover:text-[#2c8c99]",
                  ].join(" ")}
                >
                  {mm}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-t border-[#eee]">
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
              onClick={() => setOpen(false)}
              disabled={!value}
              className="text-xs font-semibold text-[#2c8c99] hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
