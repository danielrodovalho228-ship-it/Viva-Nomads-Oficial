"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { denunciaNotaProcedente } from "@/lib/parceiros/admin-actions";
import { MOTIVO_NOTA_NAO_EMITIDA } from "@/lib/parceiros/fiscal";

/**
 * FISCAL-PARCEIRO-B: denúncia "Não emitiu a nota fiscal declarada" vinda da página do parceiro. Procedente = o selo
 * sai (emite_nota = false), o motivo fica registrado e o parceiro é avisado uma vez. Improcedente: só resolver o chamado.
 */
export function DenunciaNota({ chamadoId, jaProcedente }: { chamadoId: string; jaProcedente: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  if (jaProcedente) {
    return (
      <p className="mt-2 text-sm text-ink" data-testid="denuncia-nota-feita">
        Denúncia procedente: o selo de nota fiscal saiu ({MOTIVO_NOTA_NAO_EMITIDA}).
      </p>
    );
  }
  return (
    <div className="mt-3" data-testid="denuncia-nota">
      <ConfirmarNaPagina
        aviso={`Tirar o selo "Emite nota fiscal" deste parceiro? O motivo "${MOTIVO_NOTA_NAO_EMITIDA}" fica registrado e ele é avisado.`}
        confirmar="Tirar o selo"
        disabled={pendente}
        size="sm"
        testid="denuncia-nota-procedente"
        onConfirmar={() =>
          iniciar(async () => {
            const r = await denunciaNotaProcedente(chamadoId).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
            setMsg(r.ok ? { ok: true, texto: "Selo removido e parceiro avisado." } : { ok: false, texto: r.erro });
            if (r.ok) router.refresh();
          })
        }
      >
        Denúncia procedente
      </ConfirmarNaPagina>
      {msg && (
        <p className={`mt-2 text-sm ${msg.ok ? "text-forest" : "text-red-700"}`} role={msg.ok ? "status" : "alert"} data-testid="denuncia-nota-msg">
          {msg.texto}
        </p>
      )}
    </div>
  );
}
