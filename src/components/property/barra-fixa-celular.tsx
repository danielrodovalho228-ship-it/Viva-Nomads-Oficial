"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { buttonClasses, marcaCta } from "@/components/ui/button";
import type { BarraFixaImovel } from "@/lib/barra-fixa-imovel";
import { FRASE_NAO_SEGURA_DINHEIRO } from "@/config/dinheiro";

/**
 * Rodapé fixo do celular (< lg) da página do imóvel (Prompt 41, item 1): "R$ X/mês · R$ Y em N meses" (N = 1 → só
 * "/mês"), o detalhe "Caução e taxas" (leva ao cartão de preço), "A Viva não segura dinheiro", e UM primário:
 * "Solicitar" (a candidatura de sempre; só o rótulo mudou). A visita é opção: "Agendar visita" em texto terciário,
 * nunca trava a solicitação. Mensagem e WhatsApp da Viva seguem no cartão de preço.
 * Fica acima da barra de abas (.vn-barra-fixa); `data-cta` na barra faz o botão flutuante "Fale com a Viva" subir
 * acima dela. Flutua: sombra única --shadow-flutuante. O link "Caução e taxas" tem alvo de toque de 44 px (ordem
 * c9d21980, D1); ao voltar pelo cache de página (bfcache do Safari) a página é recarregada (D2).
 */
export function BarraFixaCelular({
  barra,
  pending,
  bloqueio,
  onSolicitar,
  onAgendarVisita,
}: {
  barra: BarraFixaImovel;
  pending: boolean;
  /** E93: o "Solicitar" desativado com este texto (anúncio de teste visto por quem não é o dono nem admin). */
  bloqueio?: string;
  onSolicitar: () => void;
  onAgendarVisita: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    const aoVoltar = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh();
    };
    window.addEventListener("pageshow", aoVoltar);
    return () => window.removeEventListener("pageshow", aoVoltar);
  }, [router]);
  // A altura real da barra (muda com o aviso de exemplo, a quebra de linha e a fonte) vira --altura-barra-fixa: o
  // "Fale com a Viva" e a folga do rodapé (globals.css, D-V) se posicionam por ela, sem número fixo.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const raiz = document.documentElement;
    const medir = () => raiz.style.setProperty("--altura-barra-fixa", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => {
      obs.disconnect();
      raiz.style.removeProperty("--altura-barra-fixa");
    };
  }, [barra.visivel]);
  if (!barra.visivel) return null;
  return (
    <div
      ref={ref}
      data-testid="barra-fixa-imovel"
      data-cta
      className="vn-barra-fixa fixed inset-x-0 z-30 border-t border-line bg-white px-4 py-2 shadow-flutuante lg:hidden print:hidden"
    >
      <div className="mx-auto max-w-xl">
        {barra.demonstracao && (
          <p data-testid="barra-demo" className="text-[11px] leading-snug text-muted">
            Anúncio de exemplo: esta solicitação não é enviada.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <Link
            href="#cartao-preco"
            data-testid="barra-total"
            aria-label={`${barra.mes}${barra.estadia ? ` · ${barra.estadia}` : ""}: ver caução e taxas no detalhe`}
            className="flex min-h-11 min-w-0 flex-1 flex-col justify-center"
          >
            <span className="tabular-nums">
              <span data-testid="barra-preco-mes" className="text-lg font-semibold text-forest">
                {barra.valor}
              </span>
              <span className="text-sm text-ink">/mês</span>
              {barra.estadia && (
                <span data-testid="barra-total-estadia" className="text-sm text-muted">
                  {" "}
                  · {barra.estadia}
                </span>
              )}
            </span>
            <span data-testid="barra-detalhe" className="text-xs leading-snug text-muted underline">
              {barra.linha}
            </span>
          </Link>
          <span data-testid="barra-status" className="max-w-[45%] text-right text-xs font-semibold leading-snug text-forest">
            {barra.status}
          </span>
        </div>
        <p data-testid="barra-nao-segura" className="text-[11px] leading-snug text-muted">
          {FRASE_NAO_SEGURA_DINHEIRO}: o valor vai direto ao proprietário.
        </p>
        <div className="mt-1 flex items-center gap-4">
          {barra.estado === "candidatou" ? (
            <Link href="/dashboard/mensagens" className={buttonClasses({ variant: "secondary", size: "sm", className: "h-11 flex-1 px-3" })}>
              <Check className="h-4 w-4" /> Candidatura enviada
            </Link>
          ) : (
            <button
              type="button"
              onClick={onSolicitar}
              disabled={pending || !!bloqueio}
              data-cta={marcaCta("primary")}
              data-testid="barra-solicitar"
              className={buttonClasses({ variant: "primary", size: "sm", className: bloqueio ? "h-auto min-h-11 flex-1 px-3 py-1 text-xs leading-snug" : "h-11 flex-1 px-3" })}
            >
              {bloqueio ? bloqueio : <>{pending ? "Enviando..." : "Solicitar"}</>}
            </button>
          )}
          <button type="button" onClick={onAgendarVisita} data-testid="barra-agendar-visita" className={buttonClasses({ variant: "tertiary", size: "sm" })}>
            Agendar visita
          </button>
        </div>
      </div>
    </div>
  );
}
