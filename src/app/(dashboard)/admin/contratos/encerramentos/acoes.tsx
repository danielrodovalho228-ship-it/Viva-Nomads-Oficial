"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { atualizarPedidoEncerramento } from "@/lib/data/estadia-actions";

/** Conduzir ou concluir o pedido (concluir encerra o contrato em acerto de saída). */
export function AcoesEncerramento({ pedidoId, status }: { pedidoId: string; status: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const rodar = (novo: "em_conducao" | "concluido") =>
    iniciar(async () => {
      setErro(null);
      const r = await atualizarPedidoEncerramento(pedidoId, novo);
      if (!r.ok) setErro(r.erro);
      else router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "aberto" && (
        <Button variant="secondary" size="sm" disabled={pendente} onClick={() => rodar("em_conducao")} data-testid="encerramento-conduzir">
          Assumir a condução
        </Button>
      )}
      <ConfirmarNaPagina aviso="Concluir encerra o contrato (acerto de saída) e avisa o fim aos pedidos automáticos." confirmar="Concluir" size="sm" onConfirmar={() => rodar("concluido")} disabled={pendente} testid="encerramento-concluir">
        Concluir encerramento
      </ConfirmarNaPagina>
      {erro && (
        <p role="alert" className="w-full text-sm font-semibold text-red-700">
          {erro}
        </p>
      )}
    </div>
  );
}
