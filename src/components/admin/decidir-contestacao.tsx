"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { agirNaPendencia } from "@/lib/data/conforto-actions";

export function DecidirContestacao({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const router = useRouter();
  const decidir = (decisao: "procedente" | "improcedente") =>
    iniciar(async () => {
      const r = await agirNaPendencia(id, "decidir", { decisao });
      setMsg(r.ok ? { ok: true, t: r.mensagem ?? "Decisão registrada." } : { ok: false, t: r.erro });
      if (r.ok) router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Button size="sm" variant="secondary" disabled={pendente} onClick={() => decidir("procedente")} data-testid="contestacao-procedente">
        Procedente
      </Button>
      <Button size="sm" variant="outline" disabled={pendente} onClick={() => decidir("improcedente")} data-testid="contestacao-improcedente">
        Improcedente
      </Button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-xs text-ink" : "text-xs text-red-700"}>
          {msg.t}
        </p>
      )}
    </div>
  );
}
