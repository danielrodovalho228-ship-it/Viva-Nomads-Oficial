"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { marcarContaTeste } from "@/lib/data/conta-teste-actions";
import { AVISO_CONTA_TESTE } from "@/lib/admin/conta-teste";

/** Prompt 36, item 2: "Marcar como conta de teste" / "Desmarcar", com a confirmação na própria página. */
export function BotaoContaTeste({ id, isTeste }: { id: string; isTeste: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1" data-testid="conta-teste" data-usuario-id={id} data-is-teste={isTeste ? "1" : "0"}>
      <ConfirmarNaPagina
        aviso={AVISO_CONTA_TESTE}
        confirmar={isTeste ? "Desmarcar" : "Marcar como teste"}
        size="sm"
        testid={isTeste ? "desmarcar-teste" : "marcar-teste"}
        onConfirmar={async () => {
          setErro(null);
          const r = await marcarContaTeste(id, !isTeste);
          if (!r.ok) setErro(r.erro);
          else startTransition(() => router.refresh());
        }}
      >
        {isTeste ? "Desmarcar" : "Marcar como conta de teste"}
      </ConfirmarNaPagina>
      {erro && (
        <span role="alert" className="text-xs text-red-700" data-testid="conta-teste-erro">
          {erro}
        </span>
      )}
    </span>
  );
}
