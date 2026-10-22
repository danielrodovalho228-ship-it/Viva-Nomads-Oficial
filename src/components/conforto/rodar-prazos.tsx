"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { rodarPrazosAgora } from "@/lib/data/conforto-actions";

/** Admin: roda na hora a rotina dos prazos do 59 (a mesma do cron). No laboratório aceita uma data simulada. */
export function RodarPrazos({ laboratorio }: { laboratorio: boolean }) {
  const router = useRouter();
  const [agora, setAgora] = useState("");
  const [imovel, setImovel] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = () =>
    iniciar(async () => {
      const r = await rodarPrazosAgora(laboratorio && agora ? agora : undefined, laboratorio && imovel ? imovel : undefined);
      if (!r.ok) return setMsg({ ok: false, t: r.erro });
      const v = r.valor;
      setMsg({
        ok: true,
        t: `Feito: ${v.lembretes} lembrete(s), ${v.pausados} anúncio(s) fora da busca, ${v.voltaram} de volta, ${v.pendenciasConfirmadas} pendência(s) e ${v.ordensConfirmadas} ordem(ns) confirmadas pelo prazo, ${v.avisosManutencao} aviso(s) de manutenção.`,
      });
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-3">
      {laboratorio && (
        <input
          value={agora}
          onChange={(e) => setAgora(e.target.value)}
          placeholder="Data simulada (ISO)"
          aria-label="Data simulada do laboratório"
          className="h-10 min-w-0 rounded-lg border border-sage-200 px-3 text-sm"
          data-testid="rodar-prazos-agora"
        />
      )}
      {laboratorio && (
        <input
          value={imovel}
          onChange={(e) => setImovel(e.target.value)}
          placeholder="Só o imóvel (id)"
          aria-label="Só este imóvel (laboratório)"
          className="h-10 min-w-0 rounded-lg border border-sage-200 px-3 text-sm"
          data-testid="rodar-prazos-imovel"
        />
      )}
      <Button type="button" variant="secondary" size="sm" disabled={pendente} onClick={rodar} data-testid="rodar-prazos">
        {pendente ? "Rodando…" : "Rodar os prazos agora"}
      </Button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-ink" : "text-sm text-red-700"} data-testid="rodar-prazos-resultado">
          {msg.t}
        </p>
      )}
    </div>
  );
}
