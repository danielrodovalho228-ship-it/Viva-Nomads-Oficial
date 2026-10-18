"use client";

import { useRef } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import { ACEITA_FOTOS } from "./cartao-ia";

/**
 * Fotos sempre à vista (prompt 20): no celular, em todos os passos, uma barra fixa logo acima da barra de abas com
 * o contador e o botão Adicionar (abre a escolha de arquivos). "Organizar" leva à galeria do passo 2.
 */
export function BarraFotos(p: {
  total: number;
  minimo: number;
  enviando: { feitas: number; total: number } | null;
  onFotos: (files: File[]) => void;
  onOrganizar: () => void;
  noPassoFotos: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const ok = p.total >= p.minimo;
  return (
    <>
      {/* Respiro no fim da página: a barra não cobre o último botão. */}
      <div aria-hidden className="h-16 md:hidden" />
      <div className="vn-barra-fixa fixed inset-x-0 z-30 border-t border-sage-200 bg-white/95 px-4 py-2 backdrop-blur md:hidden" data-testid="barra-fotos">
        <div className="flex items-center gap-3">
          <Camera className="h-5 w-5 shrink-0 text-forest" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-ink" data-testid="barra-fotos-contador">
            {p.enviando ? (
              <span className="inline-flex items-center gap-1.5">
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
            className={buttonClasses({ size: "sm", className: "disabled:opacity-60" })}
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
      </div>
    </>
  );
}
