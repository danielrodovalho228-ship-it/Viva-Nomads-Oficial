"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { encerrarVinculo, responderConviteFixo } from "@/lib/automacao/acoes";

/** Aceitar ou recusar o convite de imóvel fixo; com o vínculo ativo, sair dele. */
export function RespostaConvite({ vinculoId, status }: { vinculoId: string; status: "pendente" | "ativo" }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>) =>
    iniciar(async () => {
      setErro(null);
      const r = await fn();
      if (!r.ok) setErro(r.erro ?? "Não foi possível concluir.");
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "pendente" ? (
        <>
          <Button type="button" variant="secondary" size="sm" disabled={pendente} onClick={() => rodar(() => responderConviteFixo(vinculoId, true))} data-testid="aceitar-convite-fixo">
            Aceitar
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pendente} onClick={() => rodar(() => responderConviteFixo(vinculoId, false))} data-testid="recusar-convite-fixo">
            Recusar
          </Button>
        </>
      ) : (
        <ConfirmarNaPagina aviso="Deixar de ser o parceiro fixo deste imóvel?" confirmar="Sair" onConfirmar={() => rodar(() => encerrarVinculo(vinculoId))} disabled={pendente} size="sm" testid="sair-imovel-fixo">
          Sair
        </ConfirmarNaPagina>
      )}
      {erro && (
        <p role="alert" className="w-full text-sm text-red-700">
          {erro}
        </p>
      )}
    </div>
  );
}
