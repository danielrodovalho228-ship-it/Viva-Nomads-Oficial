"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  geocodingEnabled,
  geocodeAddress,
  type GeoSuggestion,
} from "@/lib/integrations/geocoding";
import { LocationDatalist } from "@/lib/locations";

interface Props {
  value: string;
  /** Texto digitado livremente (limpa qualquer endereço geocodificado). */
  onChange: (text: string) => void;
  /** Endereço escolhido no dropdown — traz coordenadas para filtrar por raio. */
  onSelect: (s: GeoSuggestion) => void;
  datalistId?: string;
}

/**
 * Campo de localização da busca. Com NEXT_PUBLIC_MAPBOX_TOKEN faz geocoding ao
 * vivo (sugestões de endereço/bairro com coordenadas); sem token, cai para o
 * autocomplete de bairros por nome (<datalist> nativo) — modo demonstração.
 */
export function LocationSearch({
  value,
  onChange,
  onSelect,
  datalistId = "buscar-location-list",
}: Props) {
  if (!geocodingEnabled) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-sage-200 bg-white px-3.5 py-2">
        <MapPin className="h-4 w-4 shrink-0 text-blue-500" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Cidade ou bairro"
          list={datalistId}
          autoComplete="off"
          className="w-36 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
        <LocationDatalist id={datalistId} />
      </div>
    );
  }
  return <LocationGeocoder value={value} onChange={onChange} onSelect={onSelect} />;
}

function LocationGeocoder({ value, onChange, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  // Evita refazer a busca quando o próprio onSelect atualiza o texto.
  const justSelected = useRef(false);

  // Busca com debounce a cada alteração do texto (setState só no callback async).
  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    const q = value.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (q.length < 3) {
        setSuggestions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await geocodeAddress(q, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setSuggestions(res);
        setLoading(false);
        setOpen(true);
        setHighlight(-1);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (s: GeoSuggestion) => {
    justSelected.current = true;
    onSelect(s);
    setOpen(false);
    setSuggestions([]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      choose(suggestions[highlight]);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-full border border-sage-200 bg-white px-3.5 py-2">
        <MapPin className="h-4 w-4 shrink-0 text-blue-500" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Endereço, bairro ou cidade"
          autoComplete="off"
          className="w-48 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>

      {open && (loading || suggestions.length > 0) && (
        <ul className="absolute z-30 mt-1 max-h-72 w-72 max-w-[80vw] overflow-auto rounded-2xl border border-line bg-white py-1 shadow-xl">
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">Buscando endereços…</li>
          )}
          {suggestions.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                // mousedown antes do click evita o blur fechar o dropdown cedo
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-2 text-left text-sm",
                  i === highlight ? "bg-surface-2" : "hover:bg-surface-2"
                )}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <span className="text-ink">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
