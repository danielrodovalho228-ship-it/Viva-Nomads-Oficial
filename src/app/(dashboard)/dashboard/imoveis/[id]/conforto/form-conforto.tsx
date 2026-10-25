"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChecklistConforto } from "@/components/conforto/checklist-conforto";
import { useConfortoSalvo } from "@/components/conforto/use-conforto-salvo";
import { confirmarConforto } from "@/lib/data/conforto-actions";

export function FormConforto({ propertyId, inicial }: { propertyId: string; inicial: string[] }) {
  // 59-C1: cada item marcado ou desmarcado grava na hora (a mesma ação do editor do anúncio).
  const conf = useConfortoSalvo(propertyId, inicial);
  const [pendente, iniciar] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; texto: string } | null>(null);
  const router = useRouter();
  return (
    <div className="space-y-4">
      <ChecklistConforto
        marcados={conf.marcados}
        onChange={(l) => {
          setRes(null);
          conf.alterar(l);
        }}
        desabilitado={pendente || !conf.carregado}
        salvamento={conf.salvamento}
        onTentarDeNovo={conf.tentarDeNovo}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={pendente || !conf.carregado}
          data-testid="conforto-salvar"
          onClick={() =>
            iniciar(async () => {
              const r = await confirmarConforto(propertyId, conf.marcados);
              setRes(r.ok ? { ok: true, texto: r.mensagem ?? "Salvo." } : { ok: false, texto: r.erro });
              if (r.ok) router.refresh();
            })
          }
        >
          {pendente ? "Salvando..." : "Salvar"}
        </Button>
        {res && (
          <p role={res.ok ? "status" : "alert"} className={res.ok ? "text-sm text-ink" : "text-sm text-red-600"} data-testid="conforto-resultado">
            {res.texto}
          </p>
        )}
      </div>
    </div>
  );
}
