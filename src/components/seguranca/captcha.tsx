"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TURNSTILE_SCRIPT, captchaLigado } from "@/lib/seguranca/captcha";

/*
  Widget do Cloudflare Turnstile. Sem NEXT_PUBLIC_TURNSTILE_SITE_KEY não
  renderiza nada e o token fica null (podeEnviar libera). O token vale UMA
  vez: depois de cada tentativa, chame reset().
*/
const CHAVE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface Turnstile {
  render(el: HTMLElement, opcoes: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let carregando: Promise<void> | null = null;
function carregarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  carregando ??= new Promise<void>((ok, falha) => {
    const s = document.createElement("script");
    s.src = TURNSTILE_SCRIPT;
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => {
      carregando = null;
      falha(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return carregando;
}

export function useCaptcha() {
  const ligado = captchaLigado(CHAVE);
  const [token, setToken] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const reset = useCallback(() => {
    setToken(null);
    setVersao((v) => v + 1);
  }, []);
  const widget = ligado ? <CaptchaWidget versao={versao} onToken={setToken} /> : null;
  return { ligado, token, reset, widget };
}

function CaptchaWidget({ versao, onToken }: { versao: number; onToken: (t: string | null) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    carregarScript()
      .then(() => {
        if (!vivo || !caixa.current || !window.turnstile || id.current) return;
        id.current = window.turnstile.render(caixa.current, {
          sitekey: CHAVE,
          language: "pt-br",
          callback: (t: string) => onToken(t),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
      onToken(null); // widget saiu da tela (troca de aba/modo): o token dele não vale mais
    };
  }, [onToken]);

  useEffect(() => {
    if (versao > 0 && id.current && window.turnstile) window.turnstile.reset(id.current);
  }, [versao]);

  return (
    <div data-testid="captcha" className="min-h-[65px]">
      <div ref={caixa} />
      {falhou && <p className="text-xs text-red-600">Não foi possível carregar a verificação anti-robô. Recarregue a página.</p>}
    </div>
  );
}
