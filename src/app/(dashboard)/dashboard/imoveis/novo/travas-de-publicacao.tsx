"use client";

import { CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import { useEstadoIdentidade } from "@/lib/identidade/use-estado-identidade";
import { estadoIdentidadeParaTrava, travasDePublicacao, type EstadoDocumentoTrava } from "@/lib/anuncio/travas-publicacao";

/**
 * E699: o que a publicação vai exigir, dito desde o PASSO 1 (antes só aparecia no passo 10). Some quando está tudo certo.
 * Não trava nada: é só o aviso, com o estado de cada item. Enviar o documento e confirmar a identidade continua onde já era.
 */
export function TravasDePublicacao({ documento }: { documento: EstadoDocumentoTrava }) {
  const { situacao } = useEstadoIdentidade();
  const { itens, mostrar } = travasDePublicacao({ identidade: estadoIdentidadeParaTrava(situacao), documento });
  if (!mostrar) return null;
  return (
    <div className="rounded-xl border border-sage-200 bg-white p-4" data-testid="travas-publicacao">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <ShieldCheck className="h-4 w-4 text-forest" aria-hidden /> Para publicar, a Viva pede duas coisas
      </p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {itens.map((i) => (
          <li key={i.chave} className="flex items-center gap-2" data-testid={`trava-${i.chave}`} data-estado={i.estado}>
            {i.estado === "ok" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-forest" aria-hidden />
            ) : i.estado === "em_analise" || i.estado === "carregando" ? (
              <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
            )}
            <span className={i.estado === "ok" ? "text-ink" : "text-muted"}>
              {i.rotulo}
              {i.estado === "falta" && " — falta"}
              {i.estado === "em_analise" && " — em análise"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Você pode ir preenchendo o anúncio e enviar essas duas coisas quando quiser; só travam a publicação.</p>
    </div>
  );
}
