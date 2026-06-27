"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, Search, MapPin } from "lucide-react";

export interface CuratedPlace {
  placeId: string;
  categoria: string;
  rotulo?: string;
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: "hospital", label: "Hospital / saúde" },
  { value: "universidade", label: "Universidade / escola" },
  { value: "coworking", label: "Coworking / trabalho" },
  { value: "mercado", label: "Mercado" },
  { value: "academia", label: "Academia" },
  { value: "farmacia", label: "Farmácia" },
  { value: "transporte", label: "Transporte" },
];

/**
 * Seletor de proximidades reais (curado). Busca lugares pela rota servidor
 * /api/places/autocomplete (a chave do Google fica no servidor). Guarda apenas
 * place_id + categoria + rótulo. Sem chave configurada, a busca volta vazia e o
 * proprietário pode adicionar manualmente nas seções de texto.
 */
export function PlacesPicker({
  center,
  value,
  onChange,
}: {
  center?: { lat: number; lng: number };
  value: CuratedPlace[];
  onChange: (next: CuratedPlace[]) => void;
}) {
  const [categoria, setCategoria] = useState("coworking");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{ placeId: string; description: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    timer.current = setTimeout(async () => {
      if (q.length < 3) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({ q });
        if (center) {
          params.set("lat", String(center.lat));
          params.set("lng", String(center.lng));
        }
        const r = await fetch(`/api/places/autocomplete?${params}`);
        const d = await r.json();
        setSuggestions(Array.isArray(d?.suggestions) ? d.suggestions : []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, center]);

  function add(s: { placeId: string; description: string }) {
    if (value.some((v) => v.placeId === s.placeId)) return;
    onChange([...value, { placeId: s.placeId, categoria, rotulo: s.description }]);
    setQuery("");
    setSuggestions([]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          aria-label="Categoria do lugar"
          className="rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sage sm:w-56"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar lugar real (ex.: ASA Coworking)…"
            className="w-full rounded-xl border border-sage-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-sage"
          />
          {(suggestions.length > 0 || loading) && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-sage-200 bg-white shadow-lg">
              {loading && <p className="px-3 py-2 text-xs text-muted">buscando…</p>}
              {suggestions.map((s) => (
                <button
                  key={s.placeId}
                  type="button"
                  onClick={() => add(s)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-sage" />
                  <span className="line-clamp-1">{s.description}</span>
                  <Plus className="ml-auto h-3.5 w-3.5 shrink-0 text-forest" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((v) => (
            <li key={v.placeId} className="flex items-center gap-2 rounded-xl border border-sage-200 px-3 py-2 text-sm">
              <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-medium text-forest">
                {CATEGORIES.find((c) => c.value === v.categoria)?.label ?? v.categoria}
              </span>
              <span className="line-clamp-1 flex-1 text-ink">{v.rotulo}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.placeId !== v.placeId))}
                aria-label="Remover"
                className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        Guardamos só a referência do lugar; nome e distância aparecem ao vivo na página (Google).
      </p>
    </div>
  );
}
