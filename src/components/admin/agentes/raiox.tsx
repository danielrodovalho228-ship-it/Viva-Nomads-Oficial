"use client";

import { buttonClasses } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { COR_ESQUADRAO, ROTULO_STATUS, statusDoAgente, tempoRelativo, type Agente, type Ronda } from "@/lib/agentes/central";
import { CAMADAS, COR_RONDA_HEX, atencaoDaCamada, corDaRonda, ultimaPorAgente } from "@/lib/agentes/painel";
import { AvatarAgente } from "./avatar";
import styles from "./central.module.css";

const COR_P: Record<string, string> = { P0: "#B91C1C", P1: "#B91C1C", P2: "#B45309", P3: "#0369A1" };

export function ChipPrioridade({ p }: { p: string }) {
  const c = COR_P[p.toUpperCase()] ?? "#6B7280";
  return (
    <span className="mr-2 inline-block rounded-lg px-2 py-px font-mono text-[10.5px] font-semibold" style={{ color: c, background: `${c}22` }}>
      {p.toUpperCase()}
    </span>
  );
}

/** Raio-X da Viva: camadas em 3D; cada uma mostra quem cuida e os achados P0–P2 reais da área. */
export function RaioX({ agentes, rondas, agora, onConversar }: { agentes: Agente[]; rondas: Ronda[]; agora: Date | null; onConversar: (slug: string) => void }) {
  const [sel, setSel] = useState("banco");
  const [aberto, setAberto] = useState(false);
  const porSlug = useMemo(() => Object.fromEntries(agentes.map((a) => [a.slug, a])), [agentes]);
  const ultimas = useMemo(() => ultimaPorAgente(rondas), [rondas]);
  const camada = CAMADAS.find((c) => c.id === sel) ?? CAMADAS[0];
  const pontos = useMemo(() => atencaoDaCamada(camada, rondas), [camada, rondas]);
  const quem = camada.quem.map((s) => porSlug[s]).filter(Boolean) as Agente[];
  const conversavel = quem.find((a) => a.status === "ativo");

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]" data-testid="raio-x">
      <div className={`${styles.palco} ${aberto ? styles.aberto : ""} ${styles.esmaecido} rounded-xl border border-line bg-white`}>
        <div className={styles.pilha}>
          {CAMADAS.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.camada} ${c.id === sel ? styles.escolhida : ""}`}
              style={{ ["--cor" as string]: c.cor, ["--i" as string]: i }}
              onClick={() => setSel(c.id)}
              aria-pressed={c.id === sel}
              aria-label={c.nome}
            >
              <span>
                <b className="block text-[13px] font-semibold tracking-wide text-ink sm:text-[15px]">{c.nome}</b>
                <small className="block font-mono text-[10px] text-muted sm:text-[11px]">{c.sub}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-center gap-2">
          <button className={buttonClasses({ size: "sm" })} onClick={() => setAberto((a) => !a)}>
            {aberto ? "Fechar camadas" : "Abrir camadas"}
          </button>
          <span className="text-xs text-muted">Toque numa camada para ver quem cuida dela.</span>
        </div>
      </div>

      <aside className={`${styles.aparece} flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-4`} key={camada.id} data-testid="raio-x-info">
        <span className="self-start rounded-full border px-2 py-1 text-[11px] font-semibold" style={{ color: camada.cor, borderColor: `${camada.cor}66` }}>
          Camada
        </span>
        <h3 className="text-lg font-semibold text-ink" style={{ fontFamily: "var(--font-display-agentes), var(--font-jakarta), sans-serif" }}>
          {camada.nome}
        </h3>
        <p className="text-sm text-ink">{camada.descricao}</p>

        <p className="mt-1 text-[11px] text-muted">Quem cuida</p>
        <ul className="space-y-2">
          {quem.map((a) => {
            const st = statusDoAgente(a, ultimas[a.slug]);
            const cor = COR_RONDA_HEX[corDaRonda(ultimas[a.slug])];
            return (
              <li key={a.slug} className="grid grid-cols-[32px_1fr_auto] items-center gap-2 text-sm">
                <AvatarAgente slug={a.slug} nome={a.nome} cor={COR_ESQUADRAO[a.esquadrao]} anel={a.status === "ativo" ? cor : undefined} tamanho={32} />
                <span className="min-w-0">
                  <b className="text-ink">{a.nome}</b> <span className="text-xs text-muted">{a.cargo}</span>
                </span>
                <span className="whitespace-nowrap text-xs" style={{ color: a.status === "ativo" ? cor : "#6B7280" }}>
                  {ROTULO_STATUS[st]}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-1 text-[11px] text-muted">Ponto de atenção</p>
        {pontos.length === 0 ? (
          <p className="rounded-r-lg border-l-[3px] border-forest bg-sage-100 px-3 py-2 text-sm text-forest" data-testid="raio-x-sem-atencao">
            Nenhum achado P0–P2 nas últimas rondas desta área.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="raio-x-atencao">
            {pontos.map((p, i) => (
              <li key={i} className="rounded-r-lg border-l-[3px] border-amber-500 bg-white px-3 py-2 text-sm text-ink">
                <ChipPrioridade p={p.prioridade} />
                {p.titulo}
                <span className="block text-xs text-muted">
                  {porSlug[p.agente]?.nome ?? p.agente}
                  {agora ? ` · ${tempoRelativo(p.quando, agora)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {conversavel && (
          <button className="self-start rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-2" onClick={() => onConversar(conversavel.slug)}>
            Conversar com {conversavel.nome}
          </button>
        )}
      </aside>
    </div>
  );
}
