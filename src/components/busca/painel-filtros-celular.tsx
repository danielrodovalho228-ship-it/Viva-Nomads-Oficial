"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FILTROS_PAINEL_VAZIOS,
  OPCOES_PRECO,
  OPCOES_QUARTOS,
  rotuloMostrar,
  type FiltrosPainel,
} from "@/lib/busca/painel-filtros";

/**
 * Painel de filtros do celular (ordem 314f764e, print 03): sobe de baixo,
 * edita um RASCUNHO e mostra quantos imóveis aparecem antes de aplicar.
 * "Mostrar N imóveis" aplica e volta à lista já filtrada; "Limpar" zera.
 */
export function PainelFiltrosCelular({
  inicial,
  contar,
  onAplicar,
  onFechar,
}: {
  inicial: FiltrosPainel;
  contar: (f: FiltrosPainel) => number;
  onAplicar: (f: FiltrosPainel) => void;
  onFechar: () => void;
}) {
  const [rascunho, setRascunho] = useState<FiltrosPainel>(inicial);
  const n = contar(rascunho);
  const muda = <K extends keyof FiltrosPainel>(k: K, v: FiltrosPainel[K]) => setRascunho((r) => ({ ...r, [k]: v }));

  // Esc fecha; a página por trás não rola enquanto o painel está aberto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", onKey);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = antes;
    };
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-[90] sm:hidden">
      <button type="button" aria-label="Fechar filtros" onClick={onFechar} className="absolute inset-0 bg-night/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="painel-filtros-titulo"
        data-testid="painel-filtros"
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-white shadow-2xl"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-sage-200" aria-hidden />
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 id="painel-filtros-titulo" className="font-title text-lg font-bold text-ink">
            Filtros
          </h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-surface-2">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <Grupo titulo="Preço por mês">
            {OPCOES_PRECO.map((o) => (
              <Opcao key={o.valor} nome="preco" ativo={rascunho.maxPrice === o.valor} onClick={() => muda("maxPrice", o.valor)}>
                {o.rotulo}
              </Opcao>
            ))}
          </Grupo>
          <Grupo titulo="Quartos">
            {OPCOES_QUARTOS.map((o) => (
              <Opcao key={o.valor} nome="quartos" ativo={rascunho.minBedrooms === o.valor} onClick={() => muda("minBedrooms", o.valor)}>
                {o.rotulo}
              </Opcao>
            ))}
          </Grupo>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink">Do seu jeito</legend>
            <div className="divide-y divide-line rounded-2xl border border-line">
              <Marcar rotulo="Aceita pets" dica="Cachorro, gato e outros, conforme as regras do imóvel" ligado={rascunho.petsOnly} onChange={(v) => muda("petsOnly", v)} />
              <Marcar rotulo="Para trabalhar de casa" dica="Home office com mesa, cadeira e internet boa" ligado={rascunho.homeOfficeOnly} onChange={(v) => muda("homeOfficeOnly", v)} />
              <Marcar rotulo="Pronto para Morar" dica="Selo do imóvel equipado para entrar com a mala" ligado={rascunho.readyToLiveOnly} onChange={(v) => muda("readyToLiveOnly", v)} />
            </div>
          </fieldset>
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-3 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setRascunho(FILTROS_PAINEL_VAZIOS)}
            className="h-12 rounded-xl px-4 text-sm font-semibold text-forest underline underline-offset-2 hover:bg-surface-2"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => onAplicar(rascunho)}
            disabled={n === 0}
            data-testid="aplicar-filtros"
            className="h-12 rounded-xl bg-forest px-4 text-sm font-bold text-white transition-colors hover:bg-forest/90 disabled:cursor-not-allowed disabled:bg-sage-200 disabled:text-muted"
          >
            {rotuloMostrar(n)}
          </button>
        </div>
      </div>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink">{titulo}</legend>
      <div className="grid grid-cols-4 gap-2">{children}</div>
    </fieldset>
  );
}

function Opcao({ nome, ativo, onClick, children }: { nome: string; ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-1 text-center text-xs font-semibold leading-tight transition-colors",
        ativo ? "border-forest bg-forest text-white" : "border-line bg-white text-ink hover:border-sage"
      )}
    >
      <input type="radio" name={nome} checked={ativo} onChange={onClick} className="sr-only" />
      {children}
    </label>
  );
}

function Marcar({ rotulo, dica, ligado, onChange }: { rotulo: string; dica: string; ligado: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
      <input type="checkbox" checked={ligado} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-forest" />
      <span>
        <span className="block text-sm font-medium text-ink">{rotulo}</span>
        <span className="block text-xs text-muted">{dica}</span>
      </span>
    </label>
  );
}
