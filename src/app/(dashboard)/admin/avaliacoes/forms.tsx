"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirRevisaoAvaliacao } from "@/lib/data/avaliacoes-resposta-actions";
import { Button } from "@/components/ui/button";

export function DecidirForm({ id }: { id: string }) {
  const [just, setJust] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, start] = useTransition();
  const router = useRouter();
  const decidir = (d: "removida" | "mantida") =>
    start(async () => {
      const r = await decidirRevisaoAvaliacao(id, d, just);
      if (!r.ok) return setErro(r.error ?? "Não foi possível decidir.");
      setErro(null);
      router.refresh();
    });
  return (
    <div className="mt-3 space-y-2">
      <label htmlFor={`just-${id}`} className="block text-sm font-semibold text-ink">Justificativa da decisão</label>
      <textarea
        id={`just-${id}`}
        value={just}
        onChange={(e) => setJust(e.target.value)}
        maxLength={500}
        rows={2}
        className="w-full rounded-lg border border-sage-200 px-3 py-2 text-base"
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" type="button" disabled={pendente} onClick={() => decidir("removida")}>Tirar do ar</Button>
        <Button type="button" variant="outline" disabled={pendente} onClick={() => decidir("mantida")}>Manter no ar</Button>
      </div>
      {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
