"use client";

import { Building2, KeyRound, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Papel } from "@/lib/papel/papel-ativo";
import type { PilulaDoModo as Pilula } from "@/lib/papel/pilula-do-modo";
import { useTrocar } from "@/components/papel/use-troca-papel";

/** E900: um ícone por modo (a chave de quem mora, o prédio de quem anuncia, a ferramenta de quem presta serviço). */
const ICONE: Record<Papel, LucideIcon> = { morador: KeyRound, proprietario: Building2, parceiro: Wrench };

/**
 * E900 — a pílula do modo, em todas as telas do painel: no computador dentro do cabeçalho ("topo"); no celular numa
 * linha logo abaixo do topo ("linha"), porque entre o logo e o sino ela não cabe. O modo em uso tem ícone, palavra e
 * cor própria (globals.css, .modo-pilula); um toque no outro segmento troca — a MESMA troca de "Como você usa a Viva"
 * (useTrocar). Com um papel só, é o selo do modo, sem interruptor. Regras em lib/papel/pilula-do-modo.ts.
 */
export function PilulaDoModo(p: { pilula: Pilula; variante: "topo" | "linha" }) {
  const { trocando, erro, trocar } = useTrocar();
  const alto = p.variante === "linha" ? "min-h-11" : "h-9";

  if (p.pilula.tipo === "selo") {
    const s = p.pilula.segmentos[0];
    const Icone = ICONE[s.papel];
    return (
      <span className="modo-pilula inline-flex" data-testid={`modo-selo-${p.variante}`}>
        <span data-modo={s.papel} data-ativo="1" className="inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-semibold">
          <Icone className="h-4 w-4 shrink-0" aria-hidden />
          <span className="sr-only">Modo: </span>
          <span>{s.rotulo}</span>
        </span>
      </span>
    );
  }

  return (
    <div className="relative">
      <div
        role="group"
        aria-label="Modo do painel"
        aria-busy={trocando ? true : undefined}
        data-testid={`modo-pilula-${p.variante}`}
        className="modo-pilula inline-flex items-center gap-1 rounded-full border border-line bg-white p-1"
      >
        {p.pilula.segmentos.map((s) => {
          const Icone = ICONE[s.papel];
          // No cabeçalho entre 1024 e 1279 px só o modo em uso leva a palavra (os outros, ícone com nome acessível).
          const soIcone = p.variante === "topo" && !s.ativo;
          return (
            <button
              key={s.papel}
              type="button"
              data-modo={s.papel}
              data-ativo={s.ativo ? "1" : "0"}
              data-testid={`modo-${p.variante}-${s.papel}`}
              aria-pressed={s.ativo}
              title={soIcone ? s.rotulo : undefined}
              disabled={!!trocando}
              onClick={() => {
                if (!s.ativo) void trocar(s.papel);
              }}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors",
                alto,
                s.ativo ? "cursor-default" : "text-ink hover:bg-surface-2",
                soIcone && "max-xl:w-9 max-xl:px-0",
                trocando === s.papel && "opacity-60",
              )}
            >
              <Icone className="h-4 w-4 shrink-0" aria-hidden />
              <span className={cn(soIcone && "max-xl:sr-only")}>{s.rotulo}</span>
            </button>
          );
        })}
      </div>
      {erro && (
        <p role="alert" className={cn("text-sm text-red-700", p.variante === "topo" ? "absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-lg border border-line bg-white px-3 py-2" : "mt-1")} data-testid={`modo-erro-${p.variante}`}>
          {erro}
        </p>
      )}
    </div>
  );
}
