"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ROTULO_URGENCIA_MANUTENCAO, type UrgenciaManutencao } from "@/config/atendimento";
import { reclassificarOrdem } from "@/lib/data/manutencao-actions";

/** Prompt 59 — o atendimento da Viva reclassifica a prioridade (com motivo). Os prazos recalculam da abertura. */
export function ReclassificarOrdem({ id, atual }: { id: string; atual: UrgenciaManutencao }) {
  const [aberto, setAberto] = useState(false);
  const [nova, setNova] = useState<UrgenciaManutencao>(atual === "urgente" ? "media" : "urgente");
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  if (!aberto) {
    return (
      <button type="button" className="text-xs font-medium text-forest underline" onClick={() => setAberto(true)} data-testid="admin-reclassificar">
        Reclassificar
      </button>
    );
  }
  return (
    <div className="mt-2 grid w-full gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]" data-testid="admin-reclassificar-form">
      <select value={nova} onChange={(e) => setNova(e.target.value as UrgenciaManutencao)} aria-label="Prioridade nova" className="h-10 rounded-lg border border-sage-200 px-2 text-sm">
        {(["urgente", "media", "baixa"] as const)
          .filter((p) => p !== atual)
          .map((p) => (
            <option key={p} value={p}>
              {ROTULO_URGENCIA_MANUTENCAO[p]}
            </option>
          ))}
      </select>
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} placeholder="Motivo" aria-label="Motivo da reclassificação" className="h-10 min-w-0 rounded-lg border border-sage-200 px-3 text-sm" data-testid="admin-reclassificar-motivo" />
      <Button
        size="sm"
        disabled={pendente || motivo.trim().length < 5}
        onClick={() =>
          iniciar(async () => {
            const r = await reclassificarOrdem(id, nova, motivo);
            setMsg(r.ok ? { ok: true, t: "Reclassificada. Os prazos foram recalculados a partir da abertura." } : { ok: false, t: r.error });
            if (r.ok) router.refresh();
          })
        }
        data-testid="admin-reclassificar-salvar"
      >
        Salvar
      </Button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-xs text-ink sm:col-span-3" : "text-xs text-red-700 sm:col-span-3"}>
          {msg.t}
        </p>
      )}
    </div>
  );
}
