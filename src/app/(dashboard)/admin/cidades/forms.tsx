"use client";

import { useActionState, useTransition } from "react";
import { alternarCidade, cadastrarCidade, type ResultadoCidade } from "@/lib/cidades-liberadas/actions";
import { Button } from "@/components/ui/button";

const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";

export function CadastroCidadeForm() {
  const [res, acao, pendente] = useActionState<ResultadoCidade | null, FormData>(cadastrarCidade, null);
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div><label htmlFor="cidade" className="block text-sm font-semibold">Cidade</label><input id="cidade" name="cidade" required maxLength={80} className={campo} /></div>
      <div><label htmlFor="uf" className="block text-sm font-semibold">UF</label><input id="uf" name="uf" required maxLength={2} className={`${campo} uppercase`} /></div>
      <div className="sm:col-span-2"><label htmlFor="observacao" className="block text-sm font-semibold">Observação (só a equipe vê)</label><input id="observacao" name="observacao" maxLength={300} className={campo} /></div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="liberada" /> Liberar já (pode publicar imóvel)</label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pendente}>Salvar cidade</Button>
        {res && (res.ok ? <p role="status" className="text-sm text-ink">{res.mensagem}</p> : <p role="alert" className="text-sm text-red-600">{res.erro}</p>)}
      </div>
    </form>
  );
}

export function CidadeBotao({ uf, chave, liberada }: { uf: string; chave: string; liberada: boolean }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button type="button" variant="outline" size="sm" disabled={pendente} onClick={() => iniciar(async () => { await alternarCidade(uf, chave, !liberada); })}>
      {liberada ? "Pausar" : "Liberar"}
    </Button>
  );
}
