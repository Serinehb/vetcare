"use client";

import { useEffect, useRef, useState } from "react";

export default function Dropdown({
  name,
  required,
  value,
  onChange,
  options,
  placeholder = "Sélectionner…",
}: {
  name: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
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

  const current = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="contact-input text-left flex items-center justify-between gap-2"
      >
        <span className={current ? "text-[#333]" : "text-[#9aa3a3]"}>
          {current ? current.label : placeholder}
        </span>
        <i className={`fa-solid fa-chevron-down text-xs text-[#9aa3a3] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <input type="hidden" name={name} value={value} required={required} />

      {open && (
        <div className="absolute z-30 top-[calc(100%+8px)] left-0 w-full min-w-[240px] bg-white rounded-[14px] border-[1.5px] border-[#e5e5e5] shadow-[0_15px_40px_rgba(0,0,0,0.12)] overflow-hidden py-1 max-h-[260px] overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={[
                "w-full text-left px-4 py-2.5 text-sm font-medium transition-colors",
                o.value === value ? "bg-[#2c8c99] text-white" : "text-[#333] hover:bg-[#eaf6f7] hover:text-[#2c8c99]",
              ].join(" ")}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
