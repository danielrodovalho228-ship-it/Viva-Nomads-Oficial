"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { confirmarPedidoAutomatico, trocarParceiro } from "@/lib/automacao/acoes";

/** 1 toque do dono: confirmar o pedido automático ou trocar de parceiro (Prompt 38). */
export function BotaoPedidoAutomatico({ pedidoId, acao }: { pedidoId: string; acao: "confirmar" | "trocar" }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = () =>
    iniciar(async () => {
      setErro(null);
      const r = acao === "confirmar" ? await confirmarPedidoAutomatico(pedidoId) : await trocarParceiro(pedidoId);
      if (!r.ok) setErro(r.erro);
      router.refresh();
    });
  return (
    <>
      <Button type="button" variant="secondary" size="sm" disabled={pendente} onClick={rodar} data-testid={acao === "confirmar" ? "depois-da-saida-confirmar" : "depois-da-saida-trocar"}>
        {pendente ? (acao === "confirmar" ? "Confirmando…" : "Trocando…") : acao === "confirmar" ? "Confirmar" : "Trocar parceiro"}
      </Button>
      {erro && (
        <span role="alert" className="text-sm text-red-700">
          {erro}
        </span>
      )}
    </>
  );
}
