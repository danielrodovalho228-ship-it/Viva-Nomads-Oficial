"use client";

import { useMemo, useState } from "react";
import { COR_ESQUADRAO, ROTULO_STATUS, statusDoAgente, tempoRelativo, type Agente, type Ronda } from "@/lib/agentes/central";
import { CAMADAS, COR_RONDA_HEX, atencaoDaCamada, corDaRonda, ultimaPorAgente } from "@/lib/agentes/painel";
import { AvatarAgente } from "./avatar";
import styles from "./central.module.css";

const COR_P: Record<string, string> = { P0: "#FF5470", P1: "#FF5470", P2: "#FFB547", P3: "#38BDF8" };

export function ChipPrioridade({ p }: { p: string }) {
  const c = COR_P[p.toUpperCase()] ?? "#8C9AC4";
  return (
    <span className="mr-1.5 inline-block rounded-md px-1.5 py-px font-mono text-[10.5px] font-bold" style={{ color: c, background: `${c}22` }}>
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
      <div className={`${styles.palco} ${aberto ? styles.aberto : ""} ${styles.esmaecido} rounded-2xl border border-white/10 bg-[radial-gradient(500px_300px_at_50%_60%,rgba(0,93,252,.2),transparent)] bg-[#081028]/80`}>
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
                <b className="block text-[13px] font-semibold tracking-wide text-white sm:text-[15px]">{c.nome}</b>
                <small className="block font-mono text-[10px] text-[#8C9AC4] sm:text-[11px]">{c.sub}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-center gap-2">
          <button className="rounded-lg bg-[#005DFC] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#2C7BFF]" onClick={() => setAberto((a) => !a)}>
            {aberto ? "Fechar camadas" : "Abrir camadas"}
          </button>
          <span className="text-xs text-[#8C9AC4]">Toque numa camada para ver quem cuida dela.</span>
        </div>
      </div>

      <aside className={`${styles.aparece} flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0A1430]/70 p-4`} key={camada.id} data-testid="raio-x-info">
        <span className="self-start rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ color: camada.cor, borderColor: `${camada.cor}66` }}>
          Camada
        </span>
        <h3 className="text-lg font-semibold text-white" style={{ fontFamily: "var(--font-display-agentes), var(--font-jakarta), sans-serif" }}>
          {camada.nome}
        </h3>
        <p className="text-sm text-[#C3CDEB]">{camada.descricao}</p>

        <p className="mt-1 text-[11px] uppercase tracking-[.14em] text-[#8C9AC4]">Quem cuida</p>
        <ul className="space-y-2">
          {quem.map((a) => {
            const st = statusDoAgente(a, ultimas[a.slug]);
            const cor = COR_RONDA_HEX[corDaRonda(ultimas[a.slug])];
            return (
              <li key={a.slug} className="grid grid-cols-[32px_1fr_auto] items-center gap-2 text-sm">
                <AvatarAgente slug={a.slug} nome={a.nome} cor={COR_ESQUADRAO[a.esquadrao]} anel={a.status === "ativo" ? cor : undefined} tamanho={32} />
                <span className="min-w-0">
                  <b className="text-white">{a.nome}</b> <span className="text-xs text-[#8C9AC4]">{a.cargo}</span>
                </span>
                <span className="whitespace-nowrap text-xs" style={{ color: a.status === "ativo" ? cor : "#8C9AC4" }}>
                  {ROTULO_STATUS[st]}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-1 text-[11px] uppercase tracking-[.14em] text-[#8C9AC4]">Ponto de atenção</p>
        {pontos.length === 0 ? (
          <p className="rounded-r-lg border-l-[3px] border-[#7FD321] bg-[#7FD321]/5 px-3 py-2 text-sm text-[#CDE9B0]" data-testid="raio-x-sem-atencao">
            Nenhum achado P0–P2 nas últimas rondas desta área.
          </p>
        ) : (
          <ul className="space-y-1.5" data-testid="raio-x-atencao">
            {pontos.map((p, i) => (
              <li key={i} className="rounded-r-lg border-l-[3px] border-[#FFB547] bg-[#FFB547]/5 px-3 py-2 text-sm text-[#E6D9BD]">
                <ChipPrioridade p={p.prioridade} />
                {p.titulo}
                <span className="block text-xs text-[#8C9AC4]">
                  {porSlug[p.agente]?.nome ?? p.agente}
                  {agora ? ` · ${tempoRelativo(p.quando, agora)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {conversavel && (
          <button className="self-start rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/5" onClick={() => onConversar(conversavel.slug)}>
            Conversar com {conversavel.nome}
          </button>
        )}
      </aside>
    </div>
  );
}
