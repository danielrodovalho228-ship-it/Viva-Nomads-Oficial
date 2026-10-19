"use client";

import { useActionState, useTransition } from "react";
import { alternarAprovacaoFotografo, cadastrarFotografo, type ResultadoAcao } from "@/lib/fotografos/actions";
import { Button } from "@/components/ui/button";

const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";

function Aviso({ res }: { res: ResultadoAcao | null }) {
  if (!res) return null;
  return res.ok ? <p role="status" className="text-sm text-ink">{res.mensagem}</p> : <p role="alert" className="text-sm text-red-600">{res.erro}</p>;
}

export function CadastroForm() {
  const [res, acao, pendente] = useActionState<ResultadoAcao | null, FormData>(cadastrarFotografo, null);
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-2">
      <div><label htmlFor="nome" className="block text-sm font-medium">Nome comercial</label><input id="nome" name="nome" required maxLength={80} className={campo} /></div>
      <div><label htmlFor="cidades" className="block text-sm font-medium">Cidades atendidas (separe por vírgula)</label><input id="cidades" name="cidades" required className={campo} /></div>
      <div><label htmlFor="portfolio" className="block text-sm font-medium">Portfólio (link https)</label><input id="portfolio" name="portfolio" type="url" className={campo} /></div>
      <div><label htmlFor="preco" className="block text-sm font-medium">Preço do pacote Foto Viva (R$)</label><input id="preco" name="preco" inputMode="decimal" required className={campo} /></div>
      <div><label htmlFor="fotos" className="block text-sm font-medium">Nº de fotos</label><input id="fotos" name="fotos" type="number" min={1} max={200} defaultValue={20} required className={campo} /></div>
      <div><label htmlFor="prazo" className="block text-sm font-medium">Prazo (dias)</label><input id="prazo" name="prazo" type="number" min={1} max={30} defaultValue={3} required className={campo} /></div>
      <div><label htmlFor="email" className="block text-sm font-medium">E-mail (só a equipe vê)</label><input id="email" name="email" type="email" maxLength={200} className={campo} /></div>
      <div><label htmlFor="whatsapp" className="block text-sm font-medium">WhatsApp (só a equipe vê)</label><input id="whatsapp" name="whatsapp" maxLength={30} className={campo} /></div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="aprovado" /> Aprovar já (aparece na busca pública)</label>
      <div className="sm:col-span-2"><Button type="submit" disabled={pendente}>Cadastrar fotógrafo</Button> <Aviso res={res} /></div>
    </form>
  );
}

export function AprovarBotao({ id, aprovado }: { id: string; aprovado: boolean }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button type="button" variant="outline" size="sm" disabled={pendente} onClick={() => iniciar(async () => { await alternarAprovacaoFotografo(id, !aprovado); })}>
      {aprovado ? "Suspender" : "Aprovar"}
    </Button>
  );
}
