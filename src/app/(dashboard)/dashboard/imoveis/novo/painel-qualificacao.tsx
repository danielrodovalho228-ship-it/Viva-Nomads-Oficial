"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import QualificarClient from "@/app/(dashboard)/qualificar/qualificar-client";

/**
 * Painel lateral com a qualificação "Antes de anunciar" (prompt 22): as mesmas perguntas da página /qualificar,
 * abertas DENTRO do cadastro — o dono não sai do anúncio nem perde o que preencheu. Esc ou o X fecham.
 */
export function PainelQualificacao({
  imovelId,
  onSalva,
  onFechar,
}: {
  imovelId: string | null;
  onSalva: (r: { elegivel: boolean; selo: boolean; tHome: boolean; tWork: boolean }) => void;
  onFechar: () => void;
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    const corpo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = corpo;
    };
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="painel-qualificacao-titulo" data-testid="painel-qualificacao">
      <button type="button" className="absolute inset-0 bg-night/40" aria-label="Fechar a qualificação" onClick={onFechar} tabIndex={-1} />
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-surface shadow-flutuante">
        <div className="flex items-center justify-between border-b border-sage-200 bg-white px-4 py-3">
          <p id="painel-qualificacao-titulo" className="font-title text-base font-semibold text-ink">
            Antes de anunciar
          </p>
          <button type="button" onClick={onFechar} className="grid h-9 w-9 place-items-center rounded-full hover:bg-sage-50" aria-label="Fechar" data-testid="painel-qualificacao-fechar">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-24 sm:p-6">
          <QualificarClient imovelIdInicial={imovelId} emPainel onSalva={onSalva} onFechar={onFechar} />
        </div>
      </div>
    </div>
  );
}
