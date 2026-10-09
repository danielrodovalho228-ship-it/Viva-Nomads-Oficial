"use client";

import { useState, useTransition } from "react";
import { enviarPushDeTeste } from "@/lib/data/push-actions";

export function PushTeste() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pend, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pend}
        className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold disabled:opacity-60"
        onClick={() =>
          iniciar(async () => {
            const r = await enviarPushDeTeste();
            setMsg(r.ok ? `Enviado para ${r.enviados} aparelho(s).` : (r.erro ?? "Falhou."));
          })
        }
      >
        {pend ? "Enviando…" : "Enviar push de teste"}
      </button>
      <p role="status" aria-live="polite" className="text-sm text-ink-soft">{msg}</p>
    </div>
  );
}
