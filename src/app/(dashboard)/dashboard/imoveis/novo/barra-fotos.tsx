"use client";

import { useEffect, useRef } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import { ACEITA_FOTOS } from "./cartao-ia";

/**
 * Fotos sempre à vista (prompt 20): no celular, em todos os passos, uma barra fixa no fim da tela com o contador e o
 * botão Adicionar (abre a escolha de arquivos). "Organizar" leva à galeria do passo 2.
 * Anunciar é tela de fluxo (sem barra de abas): a barra encosta no fim da tela (.vn-barra-fotos). A altura real dela
 * vira --altura-barra-fotos; o respiro do fim, a rolagem até um campo e o "Fale com a Viva" se medem por ela, então
 * nenhum controle fica embaixo da barra (QA do Daniel, 22/10).
 */
export function BarraFotos(p: {
  total: number;
  minimo: number;
  enviando: { feitas: number; total: number } | null;
  onFotos: (files: File[]) => void;
  onOrganizar: () => void;
  noPassoFotos: boolean;
  /** E104: o erro do envio pela barra (antes aparecia no cartão da IA do Passo 3, que saiu). */
  erro?: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const barra = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = barra.current;
    if (!el) return;
    const raiz = document.documentElement;
    const medir = () => raiz.style.setProperty("--altura-barra-fotos", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => {
      obs.disconnect();
      raiz.style.removeProperty("--altura-barra-fotos");
    };
  }, []);
  const ok = p.total >= p.minimo;
  return (
    <>
      {/* Respiro no fim da página: altura da barra + o "Fale com a Viva" acima dela + folga (globals.css). */}
      <div aria-hidden className="vn-respiro-barra-fotos md:hidden" data-testid="barra-fotos-respiro" />
      <div ref={barra} className="vn-barra-fotos fixed inset-x-0 z-30 border-t border-sage-200 bg-white/95 px-4 pt-2 backdrop-blur md:hidden" data-testid="barra-fotos">
        <div className="flex items-center gap-3">
          <Camera className="h-5 w-5 shrink-0 text-forest" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-ink" data-testid="barra-fotos-contador">
            {p.enviando ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Enviando {Math.min(p.enviando.feitas + 1, p.enviando.total)} de {p.enviando.total}…
              </span>
            ) : (
              <>
                Fotos: <strong>{p.total}</strong> {ok ? "enviadas" : <>de {p.minimo} mínimas</>}
                {!p.noPassoFotos && p.total > 0 && (
                  <>
                    {" · "}
                    <button type="button" onClick={p.onOrganizar} className="font-medium text-forest underline underline-offset-2">
                      Organizar
                    </button>
                  </>
                )}
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={!!p.enviando}
            className={buttonClasses({ variant: "secondary", size: "sm", className: "disabled:opacity-60" })}
            data-testid="barra-fotos-adicionar"
          >
            Adicionar
          </button>
          <input
            ref={input}
            type="file"
            accept={ACEITA_FOTOS}
            multiple
            className="hidden"
            data-testid="barra-fotos-input"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length) p.onFotos(files);
            }}
          />
        </div>
        {p.erro && (
          <p className="pb-2 text-xs text-red-700" role="alert" data-testid="barra-fotos-erro">
            {p.erro}
          </p>
        )}
      </div>
    </>
  );
}
