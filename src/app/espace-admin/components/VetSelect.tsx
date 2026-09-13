"use client";

import { useEffect, useRef, useState } from "react";

/** Compact, pill-shaped dropdown used wherever the directrice reassigns a
    vet (client "Vétérinaire" column, stagiaire "Tuteur" field). Replaces
    the plain native <select> with something that matches the rest of the
    admin dashboard's styling, including a properly styled option list
    (native <select> options can't be restyled across browsers). */
export default function VetSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative inline-block" ref={wrapRef}>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs font-medium bg-white border border-[#ddd] rounded-full pl-3 pr-2.5 py-1.5 text-[#333] transition-all duration-300 hover:border-[#2c8c99] hover:bg-[#f4fbfb] focus:outline-none focus:border-[#2c8c99] focus:ring-2 focus:ring-[rgba(44,140,153,0.15)]"
      >
        {value}
        <i className={`fa-solid fa-chevron-down text-[9px] text-[#999] transition-transform duration-300 ${open ? "rotate-180 text-[#2c8c99]" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-30 top-[calc(100%+6px)] left-0 min-w-[180px] max-h-[240px] overflow-y-auto bg-white rounded-[14px] border border-[#eee] shadow-[0_15px_35px_rgba(0,0,0,0.12)] py-1">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={[
                "w-full text-left px-4 py-2.5 text-xs font-medium transition-colors duration-200 flex items-center justify-between gap-2",
                opt === value
                  ? "bg-[#2c8c99] text-white"
                  : "text-[#333] hover:bg-[#eaf6f7] hover:text-[#2c8c99]",
              ].join(" ")}
            >
              {opt}
              {opt === value && <i className="fa-solid fa-check text-[10px]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
