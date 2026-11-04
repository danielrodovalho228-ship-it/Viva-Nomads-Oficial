"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { pedirOrcamento } from "@/lib/data/pedido-orcamento-actions";
import { semQuedaDeRede } from "@/lib/erro-de-rede";

/** E440: "Pedir orçamento" — manda ao dono, no chat, o pedido com o número VN-PD-… (o servidor confere tudo de novo). */
export function PedirOrcamento({ leadId, numeroPedido }: { leadId: string; numeroPedido: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, comecar] = useTransition();
  return (
    <div className="mt-3 border-t border-sage-200 pt-3 text-sm" data-testid="candidatura-pedir-orcamento">
      <p className="text-muted">
        Pedido nº <strong className="text-ink" data-testid="candidatura-numero-pedido">{numeroPedido}</strong>
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-2"
        disabled={pendente || msg?.ok === true}
        onClick={() =>
          comecar(async () => {
            const r = await semQuedaDeRede(pedirOrcamento(leadId));
            setMsg({ ok: r.ok, texto: "mensagem" in r ? r.mensagem : r.erro });
          })
        }
        data-testid="candidatura-pedir-orcamento-botao"
      >
        Pedir orçamento
      </Button>
      {msg && (
        <p role="status" className={msg.ok ? "mt-2 text-forest" : "mt-2 text-red-700"} data-testid="candidatura-pedir-orcamento-msg">
          {msg.texto}
        </p>
      )}
    </div>
  );
}
