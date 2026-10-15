"use client";

import { useActionState, useState } from "react";
import { criarPedidoFotografo, type ResultadoAcao } from "@/lib/fotografos/actions";
import { Button } from "@/components/ui/button";

export function PedidoForm({ fotografoId, cep, cidade, uf, minData, maxData }: { fotografoId: string; cep: string; cidade: string; uf: string; minData: string; maxData: string }) {
  const [res, acao, pendente] = useActionState<ResultadoAcao | null, FormData>(criarPedidoFotografo, null);
  // Campos controlados: o React 19 limpa o formulário depois de cada envio, e um erro (ex.: telefone na observação)
  // não pode apagar a data que o dono já escolheu.
  const [dataSugerida, setDataSugerida] = useState("");
  const [observacao, setObservacao] = useState("");
  if (res?.ok) return <p role="status" className="mt-3 rounded-lg bg-sage-50 p-3 text-sm text-ink">{res.mensagem}</p>;
  const id = `data-${fotografoId}`;
  return (
    <form action={acao} className="mt-3 space-y-3">
      <input type="hidden" name="fotografoId" value={fotografoId} />
      <input type="hidden" name="cep" value={cep} />
      <input type="hidden" name="cidade" value={cidade} />
      <input type="hidden" name="uf" value={uf} />
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-ink">Data sugerida</label>
        <input id={id} name="data" type="date" required value={dataSugerida} onChange={(e) => setDataSugerida(e.target.value)} min={minData} max={maxData} className="mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
      </div>
      <div>
        <label htmlFor={`obs-${fotografoId}`} className="block text-sm font-medium text-ink">Observação (opcional)</label>
        <textarea id={`obs-${fotografoId}`} name="observacao" maxLength={300} value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
        <p className="mt-1 text-xs text-ink/60">Não coloque telefone nem e-mail: seu contato só é liberado depois que o fotógrafo aceitar.</p>
      </div>
      {res?.erro && <p role="alert" className="text-sm text-red-600">{res.erro}</p>}
      <Button type="submit" disabled={pendente} className="w-full sm:w-auto">{pendente ? "Enviando…" : "Pedir este fotógrafo"}</Button>
    </form>
  );
}
