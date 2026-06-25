"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { LOCATION_SUGGESTIONS } from "@/lib/locations";
import { cn } from "@/lib/utils";

/**
 * Autocomplete de cidade/bairro com dropdown PRÓPRIO (não usa <datalist>, que
 * é instável no Safari do iPhone — não mostrava sugestão nenhuma no mobile).
 * Sugere a partir das cidades e bairros atendidos; funciona em qualquer device.
 */
export function CityAutocomplete({
  value,
  onChange,
  placeholder = "Cidade ou bairro",
  pillClassName = "flex items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-3",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  pillClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const q = value.trim().toLowerCase();
  const matches = (q ? LOCATION_SUGGESTIONS.filter((s) => s.toLowerCase().includes(q)) : LOCATION_SUGGESTIONS).slice(0, 8);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className={pillClassName}>
        <MapPin className="h-4 w-4 shrink-0 text-blue-500" />
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="absolute left-0 top-full z-30 mt-1 max-h-64 w-full min-w-[12rem] overflow-auto rounded-xl border border-line bg-white py-1 shadow-xl">
          {matches.map((s) => (
            <li key={s}>
              <button
                type="button"
                // mousedown antes do click evita o blur fechar o dropdown cedo
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                )}
              >
                <MapPin className="h-4 w-4 shrink-0 text-blue-500" />
                <span className="text-ink">{s}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
