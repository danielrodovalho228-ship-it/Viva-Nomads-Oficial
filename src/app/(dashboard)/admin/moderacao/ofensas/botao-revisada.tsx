"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { marcarOfensaRevisada } from "@/lib/data/ofensas-admin-actions";
import { SoLeituraQa } from "@/components/admin/so-leitura-qa";

/** E445: tira o registro da fila depois que a equipe olhou a conversa. */
export function BotaoRevisada({ id, soLeitura = false }: { id: string; soLeitura?: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState(false);
  if (soLeitura) return <SoLeituraQa />;
  return (
    <span className="flex items-center gap-2">
      {erro && <span role="alert" className="text-xs text-red-700">Não foi possível marcar. Tente de novo.</span>}
      <Button
        size="sm"
        variant="secondary"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await marcarOfensaRevisada(id).catch(() => ({ ok: false }));
            setErro(!r.ok);
            if (r.ok) router.refresh();
          })
        }
      >
        {pendente ? "Marcando…" : "Marcar como revisada"}
      </Button>
    </span>
  );
}
