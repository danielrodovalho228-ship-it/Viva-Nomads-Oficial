"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { atualizarStatusInteresse } from "@/lib/parceiros/admin-actions";

const OPCOES = [
  { valor: "novo", rotulo: "Novo" },
  { valor: "contatado", rotulo: "Contatado" },
  { valor: "arquivado", rotulo: "Arquivado" },
] as const;

/** Troca o status de um interesse de parceria (admin). */
export function StatusInteresse({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [valor, setValor] = useState(status);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`st-${id}`}>Status</label>
      <select
        id={`st-${id}`}
        value={valor}
        disabled={pendente}
        onChange={(e) => {
          const novo = e.target.value;
          const anterior = valor;
          setValor(novo);
          setErro(null);
          iniciar(async () => {
            const r = await atualizarStatusInteresse(id, novo);
            if (!r.ok) {
              setValor(anterior);
              setErro(r.erro ?? "Erro");
            } else router.refresh();
          });
        }}
        className="min-h-11 rounded-lg border border-sage-200 bg-white px-2 text-sm"
      >
        {OPCOES.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {erro && <span role="alert" className="text-xs text-red-600">{erro}</span>}
    </div>
  );
}
