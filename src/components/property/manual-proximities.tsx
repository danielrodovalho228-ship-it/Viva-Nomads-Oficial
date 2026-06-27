"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { Proximity, ProximityCategory } from "@/lib/types";

const CATS: { value: ProximityCategory; label: string }[] = [
  { value: "saude", label: "Saúde" },
  { value: "educacao", label: "Educação" },
  { value: "trabalho", label: "Trabalho" },
  { value: "mercado", label: "Mercado" },
  { value: "transporte", label: "Transporte" },
];

const CAT_LABEL: Record<string, string> = Object.fromEntries(CATS.map((c) => [c.value, c.label]));

/**
 * Proximidades digitadas à mão (nome + distância/observação), sem depender do
 * Google. Aparecem na seção "O que tem por perto" da página. Para distância
 * automática via Google Maps, use o seletor de Proximidades (requer a chave).
 */
export function ManualProximities({
  value,
  onChange,
}: {
  value: Proximity[];
  onChange: (next: Proximity[]) => void;
}) {
  const [categoria, setCategoria] = useState<ProximityCategory>("saude");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  function add() {
    if (!name.trim()) return;
    onChange([...value, { category: categoria, name: name.trim(), note: note.trim() || undefined }]);
    setName("");
    setNote("");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as ProximityCategory)}
          aria-label="Categoria"
          className="rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sage sm:w-40"
        >
          {CATS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do lugar (ex.: Hospital Santa Mônica)"
          className="flex-1 rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sage"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Distância (ex.: 10 min a pé)"
          className="rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sage sm:w-44"
        />
        <button
          type="button"
          onClick={add}
          disabled={!name.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-forest px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((p, i) => (
            <li key={`${p.name}-${i}`} className="flex items-center gap-2 rounded-xl border border-sage-200 px-3 py-2 text-sm">
              <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-medium text-forest">
                {CAT_LABEL[p.category] ?? p.category}
              </span>
              <span className="line-clamp-1 flex-1 text-ink">
                {p.name}
                {p.note ? <span className="text-muted"> · {p.note}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label="Remover"
                className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
