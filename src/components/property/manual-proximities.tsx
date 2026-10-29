"use client";

import { Pilula } from "@/components/anuncio/escolha-assistente";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { Proximity, ProximityCategory } from "@/lib/types";
import { buttonClasses } from "@/components/ui/button";
import { manualSemEndereco, textoDistancia } from "@/lib/anuncio/proximidades";

const CATS: { value: ProximityCategory; label: string }[] = [
  { value: "saude", label: "Saúde" },
  { value: "educacao", label: "Educação" },
  { value: "trabalho", label: "Trabalho" },
  { value: "mercado", label: "Mercado" },
  { value: "transporte", label: "Transporte" },
];

const CAT_LABEL: Record<string, string> = Object.fromEntries(CATS.map((c) => [c.value, c.label]));
const campo = "rounded-xl border border-sage-200 bg-white px-3 py-3 text-sm outline-none focus:border-sage";
export const NAO_ACHAMOS_ENDERECO = "Não achamos este endereço.";

/**
 * Lugar adicionado à mão (PERTO-B): só o que faltou na busca automática — nome, categoria e o ENDEREÇO do lugar. A
 * distância é CALCULADA pelo mesmo caminho do OpenStreetMap (nunca digitada); no salvamento o servidor calcula de novo.
 * Lugar antigo só com a "Distância" em texto: fica fora da página até ganhar o endereço.
 */
export function ManualProximities({
  value,
  onChange,
  medir,
}: {
  value: Proximity[];
  onChange: (next: Proximity[]) => void;
  /** Distância do endereço do lugar até o do anúncio (metros), ou null se o endereço não foi encontrado. */
  medir: (endereco: string) => Promise<number | null>;
}) {
  const [categoria, setCategoria] = useState<ProximityCategory>("saude");
  const [name, setName] = useState("");
  const [endereco, setEndereco] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [medindo, setMedindo] = useState(false);
  const [enderecoDe, setEnderecoDe] = useState<Record<number, string>>({});

  async function add() {
    if (!name.trim() || endereco.trim().length < 3) return;
    setErro(null);
    setMedindo(true);
    const d = await medir(endereco.trim()).catch(() => null);
    setMedindo(false);
    if (d == null) return setErro(NAO_ACHAMOS_ENDERECO);
    onChange([...value, { category: categoria, name: name.trim(), origem: "manual", endereco: endereco.trim(), distanciaM: d }]);
    setName("");
    setEndereco("");
  }

  async function completar(i: number) {
    const e = (enderecoDe[i] ?? "").trim();
    if (e.length < 3) return;
    setErro(null);
    const d = await medir(e).catch(() => null);
    if (d == null) return setErro(NAO_ACHAMOS_ENDERECO);
    onChange(value.map((p, j) => (j === i ? { ...p, origem: "manual", endereco: e, distanciaM: d, note: undefined } : p)));
  }

  return (
    <div className="space-y-3" data-testid="proximidade-manual">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {/* E193: escolha única em pílulas (antes, lista suspensa). */}
        <div className="flex w-full flex-wrap gap-2" role="radiogroup" aria-label="Categoria" data-testid="proximidade-manual-categoria">
          {CATS.map((c) => (
            <Pilula key={c.value} papel="radio" on={categoria === c.value} onClick={() => setCategoria(c.value as ProximityCategory)}>
              {c.label}
            </Pilula>
          ))}
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do lugar (ex.: Hospital Santa Mônica)" aria-label="Nome do lugar" className={`min-w-0 flex-1 ${campo} sm:min-w-[14rem]`} data-testid="proximidade-manual-nome" />
        <input
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Endereço do lugar (rua e número)"
          aria-label="Endereço do lugar"
          className={`min-w-0 flex-1 ${campo} sm:min-w-[14rem]`}
          data-testid="proximidade-manual-endereco"
        />
        <button type="button" onClick={add} disabled={!name.trim() || endereco.trim().length < 3 || medindo} className={buttonClasses({ size: "sm" })} data-testid="proximidade-manual-adicionar">
          <Plus className="h-4 w-4" /> {medindo ? "Calculando…" : "Adicionar"}
        </button>
      </div>
      {erro && (
        <p className="text-sm text-red-700" role="alert" data-testid="proximidade-manual-erro">
          {erro}
        </p>
      )}
      <p className="text-xs text-muted">A distância é calculada pelo endereço do lugar.</p>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((p, i) => (
            <li key={`${p.name}-${i}`} className="rounded-xl border border-sage-200 px-3 py-2 text-sm" data-testid="proximidade-manual-item">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-sage-100 px-2 py-1 text-xs font-medium text-forest">{CAT_LABEL[p.category] ?? p.category}</span>
                <span className="line-clamp-1 flex-1 text-ink">
                  {p.name}
                  {p.distanciaM != null ? <span className="text-muted"> · {textoDistancia(p.distanciaM)}</span> : null}
                </span>
                <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remover" className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {manualSemEndereco(p) && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row" data-testid="proximidade-sem-endereco">
                  <p className="text-xs text-red-700 sm:flex-1">Sem endereço: não aparece no anúncio até você informar onde fica.</p>
                  <input
                    value={enderecoDe[i] ?? ""}
                    onChange={(e) => setEnderecoDe((m) => ({ ...m, [i]: e.target.value }))}
                    placeholder="Endereço do lugar"
                    aria-label={`Endereço de ${p.name}`}
                    className={`min-w-0 ${campo} sm:w-64`}
                  />
                  <button type="button" onClick={() => completar(i)} className={buttonClasses({ size: "sm", variant: "secondary" })}>
                    Informar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
