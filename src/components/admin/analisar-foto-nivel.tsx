"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { analisarFotoNivel } from "@/lib/data/nivel-actions";

/** Adendo 59.1 — o atendimento aceita a foto do item de nível ou recusa com motivo (o item deixa de contar). */
export function AnalisarFotoNivel({ imovel, chave }: { imovel: string; chave: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("Não mostra o item.");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const agir = (decisao: "aceita" | "recusada") =>
    iniciar(async () => {
      const r = await analisarFotoNivel(imovel, chave, decisao, decisao === "recusada" ? motivo : undefined);
      setMsg(r.ok ? { ok: true, t: r.mensagem ?? "Feito." } : { ok: false, t: r.erro });
      if (r.ok) router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {recusando ? (
        <>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} aria-label="Motivo da recusa" className="h-10 min-w-0 rounded-lg border border-sage-200 px-3 text-sm" data-testid="foto-nivel-motivo" />
          <Button size="sm" variant="secondary" disabled={pendente || motivo.trim().length < 5} onClick={() => agir("recusada")} data-testid="foto-nivel-confirmar-recusa">
            Recusar
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" disabled={pendente} onClick={() => agir("aceita")} data-testid="foto-nivel-aceitar">
            Aceitar
          </Button>
          <Button size="sm" variant="outline" disabled={pendente} onClick={() => setRecusando(true)} data-testid="foto-nivel-recusar">
            Recusar
          </Button>
        </>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-xs text-ink" : "text-xs text-red-700"}>
          {msg.t}
        </p>
      )}
    </div>
  );
}
