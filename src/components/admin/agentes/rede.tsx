"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { iniciais, type Agente, type Ronda } from "@/lib/agentes/central";
import {
  COR_FLUXO,
  COR_RONDA_HEX,
  corDaRonda,
  fluxosDaRede,
  nosDaRede,
  rondaRecente,
  roteiroBriefing,
  ultimaPorAgente,
  type PassoBriefing,
} from "@/lib/agentes/painel";
import { fotoDoAgente } from "./avatar";

/*
  Rede ao vivo: quem passa trabalho para quem. Cor do nó = status da última
  ronda; anel pulsando = ronda de menos de 15 min. O briefing leva a "câmera"
  de agente em agente, com legenda escrita na hora a partir do resumo REAL.
  prefers-reduced-motion: sem pacotes andando, sem pulso, câmera sem animação.
*/

const NEUTRO = "#E8EEFF";

function useMenosMovimento(): boolean {
  const [reduz, setReduz] = useState(false);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const ler = () => setReduz(m.matches);
    ler();
    m.addEventListener("change", ler);
    return () => m.removeEventListener("change", ler);
  }, []);
  return reduz;
}

export function RedeAoVivo({ agentes, rondas, agora, fotoDono = null }: { agentes: Agente[]; rondas: Ronda[]; agora: Date | null; fotoDono?: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduz = useMenosMovimento();
  const nos = useMemo(() => nosDaRede(agentes), [agentes]);
  const fluxos = useMemo(() => fluxosDaRede(nos), [nos]);
  const ultimas = useMemo(() => ultimaPorAgente(rondas), [rondas]);
  const passos = useMemo<PassoBriefing[]>(() => (agora ? roteiroBriefing(agentes, rondas, agora) : []), [agentes, rondas, agora]);

  const [passo, setPasso] = useState(-1);
  const [digitado, setDigitado] = useState(0);
  const foco = passo >= 0 ? passos[passo]?.no ?? null : null;
  const focoRef = useRef<string | null>(null);
  const agoraRef = useRef<Date | null>(agora);
  const redesenhar = useRef<(() => void) | null>(null);
  useEffect(() => {
    focoRef.current = foco;
    agoraRef.current = agora;
    // Com movimento reduzido não há laço de animação: redesenha na mudança.
    if (reduz) redesenhar.current?.();
  }, [foco, agora, reduz]);

  // Desenho contínuo (ou um quadro só, com movimento reduzido).
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const fotos: Record<string, HTMLImageElement | null> = {};
    for (const n of nos) {
      if (n.doc || (n.id === "daniel" && !fotoDono)) continue;
      const img = new Image();
      img.onload = () => {
        fotos[n.id] = img;
        if (reduz) desenhar();
      };
      img.onerror = () => (fotos[n.id] = null);
      img.src = n.id === "daniel" ? fotoDono! : fotoDoAgente(n.id);
    }
    const pacotes = fluxos.map((_, i) => ({ t: (i * 0.37) % 1, v: 0.0025 + ((i * 7) % 5) * 0.0007 }));
    const cam = { x: 0, y: 0, s: 1 };
    let W = 0;
    let H = 0;
    let raf = 0;

    const medir = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth;
      H = cv.clientHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const estreito = () => W < 600;
    const P = (id: string): [number, number] => {
      const n = nos.find((x) => x.id === id)!;
      const [px, py] = estreito() ? n.posEstreito : n.pos;
      const mx = estreito() ? 34 : 56;
      return [mx + px * (W - mx * 2), 30 + py * (H - 64)];
    };
    const raio = (id: string, doc?: boolean) => (doc ? 14 : id === "daniel" || id === "moacir" ? 21 : estreito() ? 16 : 18);
    const corNo = (id: string, doc?: boolean) => (doc || id === "daniel" ? NEUTRO : COR_RONDA_HEX[corDaRonda(ultimas[id])]);

    function hexagono(x: number, y: number, r: number) {
      ctx!.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const px = x + r * Math.cos(a);
        const py = y + r * Math.sin(a);
        if (i) ctx!.lineTo(px, py);
        else ctx!.moveTo(px, py);
      }
      ctx!.closePath();
    }

    function desenhar() {
      const f = focoRef.current;
      // Câmera: aproxima e centraliza o nó em foco.
      const alvo = f && nos.some((n) => n.id === f) ? (() => {
        const [x, y] = P(f);
        const s = estreito() ? 1.5 : 1.7;
        // Um pouco abaixo do meio: a legenda do briefing ocupa o topo.
        return { x: W / 2 - x * s, y: H * 0.62 - y * s, s };
      })() : { x: 0, y: 0, s: 1 };
      const k = reduz ? 1 : 0.08;
      cam.x += (alvo.x - cam.x) * k;
      cam.y += (alvo.y - cam.y) * k;
      cam.s += (alvo.s - cam.s) * k;

      ctx!.save();
      ctx!.clearRect(0, 0, W, H);
      ctx!.translate(cam.x, cam.y);
      ctx!.scale(cam.s, cam.s);
      const agoraMs = Date.now();

      fluxos.forEach(([a, b, tipo], i) => {
        const [x1, y1] = P(a);
        const [x2, y2] = P(b);
        const quente = f && (a === f || b === f);
        ctx!.strokeStyle = COR_FLUXO[tipo] + (quente ? "cc" : f ? "1c" : "40");
        ctx!.lineWidth = quente ? 2.4 : 1.2;
        ctx!.beginPath();
        ctx!.moveTo(x1, y1);
        ctx!.lineTo(x2, y2);
        ctx!.stroke();
        const p = pacotes[i];
        const x = x1 + (x2 - x1) * p.t;
        const y = y1 + (y2 - y1) * p.t;
        ctx!.fillStyle = COR_FLUXO[tipo];
        ctx!.shadowColor = COR_FLUXO[tipo];
        ctx!.shadowBlur = 10;
        ctx!.beginPath();
        ctx!.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;
        if (!reduz) p.t = (p.t + p.v) % 1;
      });

      for (const n of nos) {
        const [x, y] = P(n.id);
        const r = raio(n.id, n.doc);
        const cor = corNo(n.id, n.doc);
        ctx!.globalAlpha = f && n.id !== f ? 0.35 : 1;
        if (f === n.id) {
          const g = ctx!.createRadialGradient(x, y, 0, x, y, r * 4);
          g.addColorStop(0, cor + "55");
          g.addColorStop(1, cor + "00");
          ctx!.fillStyle = g;
          ctx!.beginPath();
          ctx!.arc(x, y, r * 4, 0, Math.PI * 2);
          ctx!.fill();
        }
        const ag = agoraRef.current;
        if (!n.doc && n.id !== "daniel" && ag && rondaRecente(ultimas[n.id], ag)) {
          const pulso = reduz ? 0 : (Math.sin(agoraMs / 260) + 1) * 3;
          ctx!.strokeStyle = cor;
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.arc(x, y, r + 6 + pulso, 0, Math.PI * 2);
          ctx!.stroke();
        }
        ctx!.fillStyle = "#0B1638";
        ctx!.strokeStyle = cor;
        ctx!.lineWidth = 2;
        if (n.doc) {
          ctx!.beginPath();
          ctx!.rect(x - r, y - r * 0.75, r * 2, r * 1.5);
          ctx!.fill();
          ctx!.stroke();
          ctx!.fillStyle = cor;
          ctx!.font = "500 9px ui-monospace, monospace";
          ctx!.textAlign = "center";
          ctx!.fillText("DOC", x, y + 3);
        } else {
          hexagono(x, y, r);
          ctx!.fill();
          const img = fotos[n.id];
          if (img) {
            ctx!.save();
            hexagono(x, y, r - 1);
            ctx!.clip();
            ctx!.drawImage(img, x - r, y - r, r * 2, r * 2);
            ctx!.restore();
          } else {
            ctx!.fillStyle = cor;
            ctx!.font = "600 10px ui-monospace, monospace";
            ctx!.textAlign = "center";
            ctx!.fillText(n.id === "daniel" ? "DR" : iniciais(n.rotulo), x, y + 3.5);
          }
          hexagono(x, y, r);
          ctx!.stroke();
        }
        ctx!.fillStyle = "#C3CDEB";
        ctx!.font = `600 ${estreito() ? 10 : 12}px system-ui, sans-serif`;
        ctx!.textAlign = "center";
        ctx!.fillText(n.rotulo, x, y + r + 20);
      }
      ctx!.globalAlpha = 1;
      ctx!.restore();
      if (!reduz) raf = requestAnimationFrame(desenhar);
    }

    redesenhar.current = desenhar;
    medir();
    desenhar();
    const aoMudar = () => {
      medir();
      if (reduz) desenhar();
    };
    window.addEventListener("resize", aoMudar);
    return () => {
      cancelAnimationFrame(raf);
      redesenhar.current = null;
      window.removeEventListener("resize", aoMudar);
    };
  }, [nos, fluxos, ultimas, reduz, fotoDono]);

  // Briefing: legenda digitada e avanço automático.
  const atual = passo >= 0 ? passos[passo] : null;
  useEffect(() => {
    if (!atual) return;
    const total = atual.texto.length;
    const avancar = setTimeout(() => setPasso((p) => (p + 1 < passos.length ? p + 1 : -1)), Math.max(4500, total * 55));
    if (reduz) {
      const t = setTimeout(() => setDigitado(total), 0);
      return () => {
        clearTimeout(t);
        clearTimeout(avancar);
      };
    }
    let n = 0;
    const digita = setInterval(() => {
      n += 2;
      setDigitado(Math.min(n, total));
      if (n >= total) clearInterval(digita);
    }, 18);
    return () => {
      clearInterval(digita);
      clearTimeout(avancar);
    };
  }, [atual, passos.length, reduz]);

  const ir = (i: number) => {
    setDigitado(0);
    setPasso(i < passos.length ? i : -1);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#081028]/80" data-testid="rede-ao-vivo">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
        <button className="rounded-lg bg-[#005DFC] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#2C7BFF] disabled:opacity-50" onClick={() => ir(0)} disabled={!passos.length}>
          {passo >= 0 ? "↺ Recomeçar" : "▶ Assistir ao briefing"}
        </button>
        {passo >= 0 && (
          <>
            <button className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/5" onClick={() => ir(passo + 1)}>
              Próximo
            </button>
            <button className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/5" onClick={() => ir(passos.length)}>
              Parar
            </button>
            <div className="h-1 min-w-20 flex-1 overflow-hidden rounded bg-white/10" aria-hidden>
              <div className="h-full bg-gradient-to-r from-[#38BDF8] to-[#7FD321] transition-[width] duration-300" style={{ width: `${((passo + 1) / passos.length) * 100}%` }} />
            </div>
          </>
        )}
      </div>
      <div className="relative">
        <canvas ref={canvas} className="block h-[540px] w-full" aria-label="Mapa de quem passa trabalho para quem, com a cor do status da última ronda de cada agente" role="img" />
        {atual && (
          <div className="absolute inset-x-3 top-3 rounded-xl border border-white/15 bg-[#050A18]/90 px-4 py-3 text-sm backdrop-blur" aria-live="polite" data-testid="briefing-legenda">
            <span className="block font-mono text-[11px] text-[#8C9AC4]">
              {String(passo + 1).padStart(2, "0")} / {passos.length}
            </span>
            <b style={{ color: atual.cor === "sem" ? "#38BDF8" : COR_RONDA_HEX[atual.cor] }}>{atual.titulo}</b>
            <p className="mt-0.5 text-[#DCE3FA]">{atual.texto.slice(0, digitado)}</p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 px-4 py-2.5 text-xs text-[#8C9AC4]">
        <span><i className="mr-1.5 inline-block h-0.5 w-4 align-middle" style={{ background: COR_FLUXO.achados }} />achados para a fila</span>
        <span><i className="mr-1.5 inline-block h-0.5 w-4 align-middle" style={{ background: COR_FLUXO.pendencias }} />pendências do Daniel</span>
        <span><i className="mr-1.5 inline-block h-0.5 w-4 align-middle" style={{ background: COR_FLUXO.relatorio }} />relatórios</span>
        <span><i className="mr-1.5 inline-block h-0.5 w-4 align-middle" style={{ background: COR_FLUXO.pacote }} />pacote para o Claude Code</span>
        <span>Nó: <b className="text-[#7FD321]">ok</b> · <b className="text-[#FFB547]">alerta</b> · <b className="text-[#FF5470]">falhou</b> · anel pulsando = ronda há menos de 15 min</span>
      </div>
    </div>
  );
}
