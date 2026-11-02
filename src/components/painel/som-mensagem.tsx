"use client";

import { useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { CHAVE_SOM_MENSAGEM, deveTocarSom, somLigadoDe, valorDoSom } from "@/lib/painel/som-mensagem";

/** Disparado a cada toque (os testes escutam; nada mais depende dele). */
export const EVENTO_SOM_TOCOU = "vn:som-mensagem-tocou";

function lerPreferencia(): boolean {
  try {
    return somLigadoDe(window.localStorage.getItem(CHAVE_SOM_MENSAGEM));
  } catch {
    return true;
  }
}

/** Dois tons curtos e baixos (sem arquivo de áudio). Navegador sem áudio ou sem gesto prévio: fica em silêncio. */
function tocar() {
  window.dispatchEvent(new Event(EVENTO_SOM_TOCOU));
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const ganho = ctx.createGain();
    ganho.gain.setValueAtTime(0.0001, ctx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    ganho.connect(ctx.destination);
    for (const [freq, inicio] of [[660, 0], [880, 0.12]] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(ganho);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + 0.18);
    }
    setTimeout(() => void ctx.close().catch(() => {}), 600);
  } catch {
    /* sem áudio: silêncio */
  }
}

/**
 * E445 item 6: com o site aberto, um som discreto quando chega mensagem nova. `recebidas` é null até a 1ª leitura real
 * (a 1ª leitura nunca toca — só o que chegar depois).
 */
export function useSomDeMensagemNova(recebidas: number | null) {
  const anterior = useRef<number | null>(null);
  useEffect(() => {
    if (recebidas === null) return;
    if (deveTocarSom(anterior.current, recebidas, lerPreferencia())) tocar();
    anterior.current = recebidas;
  }, [recebidas]);
}

/** O interruptor em /dashboard/notificacoes. Vale para este aparelho; grava na hora (sem "Salvar"). */
export function InterruptorSomMensagem() {
  const [ligado, setLigado] = useState<boolean | null>(null);
  useEffect(() => {
    // Lido depois da montagem: o servidor não conhece a preferência do aparelho.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLigado(lerPreferencia());
  }, []);
  function alternar(v: boolean) {
    setLigado(v);
    try {
      window.localStorage.setItem(CHAVE_SOM_MENSAGEM, valorDoSom(v));
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  }
  if (ligado === null) return <span className="block h-6 w-11 shrink-0 rounded-full bg-surface-2" aria-hidden data-testid="notif-som-carregando" />;
  return <Switch checked={ligado} onChange={alternar} label="Som de mensagem nova" testId="notif-som-mensagem" />;
}
