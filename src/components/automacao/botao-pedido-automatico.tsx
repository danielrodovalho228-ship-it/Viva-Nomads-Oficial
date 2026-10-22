"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * 1 toque do dono: confirmar o pedido automático ou trocar de parceiro (Prompt 38). Vai por uma rota com prazo de 20 s
 * e recarrega a página no fim: o toque nunca fica preso esperando a fila do roteador.
 */
export function BotaoPedidoAutomatico({ pedidoId, acao }: { pedidoId: string; acao: "confirmar" | "trocar" }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);
  const rodar = async () => {
    setErro(null);
    setPendente(true);
    const prazo = new AbortController();
    const relogio = setTimeout(() => prazo.abort(), 20_000);
    try {
      const resp = await fetch(`/api/automacao/pedidos/${pedidoId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao }),
        signal: prazo.signal,
      });
      const r = (await resp.json().catch(() => null)) as { ok: boolean; erro?: string } | null;
      if (r?.ok) {
        window.location.reload();
        return;
      }
      setErro(r?.erro ?? "Não foi possível concluir. Tente de novo.");
    } catch {
      setErro("Não foi possível concluir agora. Tente de novo.");
    } finally {
      clearTimeout(relogio);
      setPendente(false);
    }
  };
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
