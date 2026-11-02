"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENTOS_CONTADORES, INTERVALO_CONTADORES_MS } from "@/lib/painel/contadores";
import type { PrioridadeAviso } from "@/lib/notifications/avisos";
import { COR_PRIORIDADE, ROTA_AVISOS, ROTULO_PRIORIDADE, VER_TODAS, acaoDaFaixa, destinoDoAviso, rotuloContagem, type AvisoTela } from "@/lib/notifications/sino";

/*
  E444 itens 3 e 4 — o sino dos topos (computador e celular) e a faixa de crítico. Uma leitura só para os dois sinos e a
  faixa (loja do módulo): ao montar, ao voltar o foco, a cada minuto com a aba visível, ao abrir o sino e quando uma tela
  avisa (EVENTOS_CONTADORES). Clique no aviso: marca lido (POST, keepalive) e leva à tela do evento.
*/
interface EstadoAvisos {
  naoLidas: number;
  maiorPrioridade: PrioridadeAviso | null;
  recentes: AvisoTela[];
  criticos: AvisoTela[];
  falhou: boolean;
  lido: boolean;
}

const INICIAL: EstadoAvisos = { naoLidas: 0, maiorPrioridade: null, recentes: [], criticos: [], falhou: false, lido: false };
let estado = INICIAL;
const ouvintes = new Set<() => void>();
let emCurso: Promise<void> | null = null;
let pararGlobal = () => {};

function publicar(novo: EstadoAvisos) {
  estado = novo;
  for (const o of ouvintes) o();
}

export function lerAvisos(): Promise<void> {
  if (emCurso) return emCurso;
  emCurso = fetch(ROTA_AVISOS, { cache: "no-store", credentials: "same-origin" })
    .then(async (r) => {
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as Partial<EstadoAvisos>;
      publicar({
        naoLidas: typeof j.naoLidas === "number" && j.naoLidas > 0 ? j.naoLidas : 0,
        maiorPrioridade: j.maiorPrioridade ?? null,
        recentes: Array.isArray(j.recentes) ? j.recentes : [],
        criticos: Array.isArray(j.criticos) ? j.criticos : [],
        falhou: false,
        lido: true,
      });
    })
    .catch(() => publicar({ ...estado, falhou: true, lido: true }))
    .finally(() => {
      emCurso = null;
    });
  return emCurso;
}

function assinar(o: () => void) {
  ouvintes.add(o);
  if (ouvintes.size === 1) {
    void lerAvisos();
    let ultima = 0;
    const ler = () => {
      ultima = Date.now();
      void lerAvisos();
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && Date.now() - ultima > 2000) ler();
    };
    const t = setInterval(() => document.visibilityState === "visible" && ler(), INTERVALO_CONTADORES_MS);
    for (const e of EVENTOS_CONTADORES) window.addEventListener(e, ler);
    window.addEventListener("focus", aoVoltar);
    document.addEventListener("visibilitychange", aoVoltar);
    pararGlobal = () => {
      clearInterval(t);
      for (const e of EVENTOS_CONTADORES) window.removeEventListener(e, ler);
      window.removeEventListener("focus", aoVoltar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }
  return () => {
    ouvintes.delete(o);
    if (ouvintes.size === 0) pararGlobal();
  };
}

export function useAvisos(): EstadoAvisos {
  return useSyncExternalStore(assinar, () => estado, () => INICIAL);
}

/** Marca lido (sem segurar a navegação) e já tira da contagem na tela. */
export function marcarLidoEIr(a: AvisoTela, irPara: (href: string) => void) {
  if (!a.lido_em) {
    fetch(ROTA_AVISOS, {
      method: "POST",
      keepalive: true,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id }),
    })
      .then(() => lerAvisos())
      .catch(() => {});
    const agora = new Date().toISOString();
    const marca = (x: AvisoTela) => (x.id === a.id ? { ...x, lido_em: agora } : x);
    publicar({ ...estado, naoLidas: Math.max(0, estado.naoLidas - 1), recentes: estado.recentes.map(marca), criticos: estado.criticos.map(marca) });
  }
  irPara(destinoDoAviso(a.url));
}

export function SeloPrioridade({ prioridade }: { prioridade: PrioridadeAviso }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-1 text-[11px] font-semibold", COR_PRIORIDADE[prioridade])} data-testid="aviso-prioridade" data-prioridade={prioridade}>
      {ROTULO_PRIORIDADE[prioridade]}
    </span>
  );
}

function quando(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

/** Item 3: o sino com o número de não lidas (até "9+") na cor da maior prioridade e o painel com os últimos 8. */
export function SinoAvisos({ px }: { px: string }) {
  const s = useAvisos();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const idPainel = useId();
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);
  const rotulo = rotuloContagem(s.naoLidas);
  const cor = COR_PRIORIDADE[s.maiorPrioridade ?? "normal"];
  return (
    <div className="relative" ref={caixa}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={aberto ? idPainel : undefined}
        aria-label={rotulo ? `Notificações: ${s.naoLidas} não lidas` : "Notificações"}
        onClick={() => {
          setAberto((v) => !v);
          if (!aberto) void lerAvisos();
        }}
        className="relative grid h-11 w-11 place-items-center rounded-lg text-ink hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
        data-testid={`sino-${px}`}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {rotulo && (
          <span
            className={cn("absolute right-0.5 top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold leading-none", cor)}
            aria-hidden
            data-testid={`sino-${px}-contagem`}
            data-prioridade={s.maiorPrioridade ?? "normal"}
          >
            {rotulo}
          </span>
        )}
      </button>
      {aberto && (
        <div
          id={idPainel}
          role="dialog"
          aria-label="Avisos"
          className="fixed inset-x-4 top-16 z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-line bg-white shadow-flutuante sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
          data-testid={`sino-${px}-painel`}
        >
          <p className="border-b border-line px-4 py-3 font-title text-base font-semibold text-ink">Avisos</p>
          {s.falhou && !s.recentes.length ? (
            <p role="alert" className="px-4 py-4 text-sm text-amber-900">Não foi possível carregar os avisos agora.</p>
          ) : !s.lido ? (
            <p className="px-4 py-4 text-sm text-muted">Carregando…</p>
          ) : !s.recentes.length ? (
            <p className="px-4 py-4 text-sm text-muted">Nenhum aviso por enquanto.</p>
          ) : (
            <ul className="divide-y divide-line">
              {s.recentes.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setAberto(false);
                      marcarLidoEIr(a, (href) => router.push(href));
                    }}
                    className={cn("flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none", !a.lido_em && "bg-sage-50")}
                    data-testid="sino-aviso"
                    data-lido={a.lido_em ? "sim" : "nao"}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm text-ink [overflow-wrap:anywhere]", !a.lido_em && "font-semibold")}>{a.titulo}</span>
                      <span className="mt-1 block text-xs text-muted">{quando(a.criado_em)}</span>
                    </span>
                    <SeloPrioridade prioridade={a.prioridade} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={VER_TODAS}
            onClick={() => setAberto(false)}
            className="flex min-h-11 items-center justify-center border-t border-line text-sm font-semibold text-forest underline underline-offset-4"
            data-testid={`sino-${px}-ver-todas`}
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  );
}

/** Item 4: a faixa no topo do painel para crítico não resolvido, com o botão da ação. */
export function FaixaCritico({ pathname }: { pathname: string }) {
  const s = useAvisos();
  const router = useRouter();
  const c = s.criticos[0];
  if (!c) return null;
  const destino = destinoDoAviso(c.url);
  // Já na tela da ação: a faixa não repete o que a tela mostra.
  if (destino.split(/[?#]/)[0] === pathname) return null;
  const mais = s.criticos.length - 1;
  return (
    <div role="region" aria-label="Aviso crítico" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3" data-testid="faixa-critico">
      <AlertTriangle className="h-5 w-5 shrink-0 text-red-700" aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-ink [overflow-wrap:anywhere]">
        <span className="font-semibold">{c.titulo}</span>
        {mais > 0 && (
          <>
            {" "}
            <Link href={`${VER_TODAS.split("#")[0]}?prioridade=critico#avisos`} className="whitespace-nowrap text-red-800 underline underline-offset-2" data-testid="faixa-critico-mais">
              e mais {mais} {mais === 1 ? "aviso crítico" : "avisos críticos"}
            </Link>
          </>
        )}
      </p>
      <button
        type="button"
        onClick={() => marcarLidoEIr(c, (href) => router.push(href))}
        className="min-h-11 shrink-0 rounded-full border border-red-700 bg-white px-4 text-sm font-semibold text-red-800 hover:bg-red-100"
        data-testid="faixa-critico-acao"
      >
        {acaoDaFaixa(c.evento)}
      </button>
    </div>
  );
}
