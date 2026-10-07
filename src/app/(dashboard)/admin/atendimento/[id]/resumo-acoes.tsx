"use client";

import { useEffect, useState } from "react";
import { ListChecks, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resumoDoChamado } from "@/lib/data/atendimento-actions";
import type { ResumoChamado } from "@/lib/atendimento/resumo";

/**
 * "Resumo e ações" no topo do chamado. Gerado sozinho ao abrir (a primeira vez)
 * e guardado como nota interna — reabrir não gasta IA. "Atualizar resumo" refaz.
 * O checklist marcado fica neste navegador.
 */
const NOME_AGENTE: Record<string, string> = { thiago: "Thiago (parcerias)", sergio: "Sérgio (jurídico)", renato: "Renato (engenheiro)", helena: "Helena", carla: "Carla", luana: "Luana", bruno: "Bruno", viva: "Viva" };

export function ResumoEAcoes({ chamadoId, quemEh, sla }: { chamadoId: string; quemEh: string; sla: { texto: string; cor: string; risco: string } }) {
  const [r, setR] = useState<ResumoChamado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const chave = `vivanomads-chamado-acoes-${chamadoId}`;
  // O checklist só aparece depois que o resumo chega (no navegador), então ler aqui não diverge do servidor.
  const [feitas, setFeitas] = useState<string[]>(() => {
    try {
      return typeof window === "undefined" ? [] : (JSON.parse(localStorage.getItem(chave) ?? "[]") as string[]);
    } catch {
      return []; // sem armazenamento: checklist só nesta visita
    }
  });

  async function carregar(refazer: boolean) {
    setCarregando(true);
    setErro(null);
    const res = await resumoDoChamado(chamadoId, refazer).catch(() => ({ ok: false as const, error: "Falha de conexão." }));
    setCarregando(false);
    if (!res.ok) return setErro(res.error);
    setR(res.resumo);
  }

  // Ao abrir: o guardado (ou gera na primeira vez). O estado só muda quando a resposta chega.
  useEffect(() => {
    let vivo = true;
    resumoDoChamado(chamadoId, false)
      .catch(() => ({ ok: false as const, error: "Falha de conexão." }))
      .then((res) => {
        if (!vivo) return;
        setCarregando(false);
        if (res.ok) setR(res.resumo);
        else setErro(res.error);
      });
    return () => {
      vivo = false;
    };
  }, [chamadoId]);

  function marcar(t: string) {
    const novas = feitas.includes(t) ? feitas.filter((x) => x !== t) : [...feitas, t];
    setFeitas(novas);
    try {
      localStorage.setItem(chave, JSON.stringify(novas));
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-forest/20 bg-sage-100/60 p-5" data-testid="resumo-acoes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-title text-lg font-bold text-ink">
          <Sparkles className="h-5 w-5 text-forest" /> Resumo e ações
        </h2>
        <Button size="sm" variant="outline" disabled={carregando} onClick={() => carregar(true)}>
          <RefreshCw className={cn("h-3.5 w-3.5", carregando && "animate-spin")} /> Atualizar resumo
        </Button>
      </div>
      {carregando && !r ? (
        <p className="mt-3 text-sm text-muted">A Viva está lendo o chamado…</p>
      ) : erro && !r ? (
        <p className="mt-3 text-sm text-red-700">{erro}</p>
      ) : r ? (
        <div className="mt-3 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-sm leading-relaxed text-ink" data-testid="resumo-texto">{r.resumo}</p>
            <p className="mt-2 text-xs text-muted">
              {r.origem === "ia" ? "Resumo da Viva (IA)" : "Resumo por regras (sem IA)"} · {new Date(r.geradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted">Quem é</dt><dd className="text-ink" data-testid="resumo-quem">{quemEh}</dd></div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-muted">Prazo</dt>
                <dd><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", sla.cor)}>{sla.texto}</span> <span className="text-xs text-muted">{sla.risco}</span></dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><ListChecks className="h-4 w-4" /> O que você precisa fazer</p>
            <ul className="mt-2 space-y-1.5" data-testid="resumo-acoes-lista">
              {r.acoes.map((a) => (
                <li key={a.texto}>
                  <label className="flex items-start gap-2 text-sm text-ink">
                    <input type="checkbox" className="mt-1" checked={feitas.includes(a.texto)} onChange={() => marcar(a.texto)} />
                    <span className={cn(feitas.includes(a.texto) && "text-muted line-through")}>
                      {a.texto}
                      {a.para && <span className="ml-1 text-xs text-forest">· {NOME_AGENTE[a.para] ?? a.para}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
