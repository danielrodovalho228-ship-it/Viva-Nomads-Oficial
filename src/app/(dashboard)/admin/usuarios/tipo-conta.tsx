"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { definirAccountType } from "@/lib/data/planos-actions";
import { MOTIVO_TIPO_MIN, ROTULO_TIPO_CONTA, motivoTipoValido, type AccountType } from "@/lib/planos/gestor";

/**
 * E224 — "Tipo da conta: individual / administradora" no admin, com motivo obrigatório, pela ação que já existe
 * (definirAccountType: só admin, auditada em account_type_audit, recusa o admin observador da QA).
 */
export function TipoConta({ id, tipo }: { id: string; tipo: AccountType }) {
  const router = useRouter();
  const [novo, setNovo] = useState<AccountType>(tipo);
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const mudou = novo !== tipo;
  return (
    <div className="flex flex-col gap-1 text-sm" data-testid="tipo-conta" data-usuario-id={id} data-tipo={tipo}>
      <label className="flex items-center gap-2">
        <span className="text-muted">Tipo da conta:</span>
        <select
          value={novo}
          onChange={(e) => setNovo(e.target.value as AccountType)}
          className="h-10 rounded-lg border border-line bg-white px-2 text-sm"
          data-testid="tipo-conta-select"
        >
          {(Object.keys(ROTULO_TIPO_CONTA) as AccountType[]).map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO_CONTA[t]}
            </option>
          ))}
        </select>
      </label>
      {mudou && (
        <>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
            placeholder={`Motivo (obrigatório, ${MOTIVO_TIPO_MIN}+ letras)`}
            aria-label="Motivo da troca do tipo da conta"
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-base"
            data-testid="tipo-conta-motivo"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={pendente || !motivoTipoValido(motivo)}
            data-testid="tipo-conta-salvar"
            onClick={() =>
              iniciar(async () => {
                setMsg(null);
                const r = await definirAccountType(id, novo, motivo).catch(() => ({ ok: false, error: "Sem conexão. Tente de novo." }));
                if (r.ok) {
                  setMotivo("");
                  setMsg({ ok: true, texto: `Tipo da conta: ${ROTULO_TIPO_CONTA[novo]}.` });
                  router.refresh();
                } else setMsg({ ok: false, texto: r.error ?? "Não foi possível salvar." });
              })
            }
          >
            Salvar o tipo
          </Button>
        </>
      )}
      {msg && (
        <span className={msg.ok ? "text-forest" : "text-red-700"} role={msg.ok ? "status" : "alert"} data-testid="tipo-conta-msg">
          {msg.texto}
        </span>
      )}
    </div>
  );
}
