"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { rodarAutomacaoAgora } from "@/lib/automacao/acoes";

/** Admin: roda o passo diário do Prompt 38 na hora (de verdade só no laboratório ou com AUTOMACOES_ATIVO=1). */
export function RodarAutomacao() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = () =>
    iniciar(async () => {
      const r = await rodarAutomacaoAgora();
      if (!r.ok) return setMsg(r.erro);
      const v = r.valor;
      setMsg(`${v.simulado ? "Simulação" : "Feito"}: ${v.automaticos} pedido(s) automático(s), ${v.sugestoesMorador} sugestão(ões) ao morador, ${v.semResposta} aviso(s) de 24 h.`);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" size="sm" disabled={pendente} onClick={rodar} data-testid="rodar-automacao">
        {pendente ? "Rodando…" : "Rodar a automação de hoje"}
      </Button>
      {msg && (
        <p role="status" className="text-sm text-ink" data-testid="rodar-automacao-resultado">
          {msg}
        </p>
      )}
    </div>
  );
}
