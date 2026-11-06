import { notFound } from "next/navigation";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { VoltarLista } from "@/components/ui/voltar-lista";
import { FICHA_RESUMO_ATIVA } from "@/lib/flags";
import { getFichaResumo } from "@/lib/data/ficha-resumo-actions";
import { FormContaRecebimento } from "./form-conta-recebimento";

export const metadata = { title: "Ficha-resumo do contrato" };

/**
 * E634 — ficha-resumo do contrato: datas, valor, vencimento e conta de recebimento, com a autorização expressa quando a conta é
 * de terceiro. Atrás da chave FICHA_RESUMO_ATIVA (desligada): desligada, a página não existe (404).
 */
export default async function FichaResumoPage({ params }: { params: Promise<{ id: string }> }) {
  if (!FICHA_RESUMO_ATIVA) notFound();
  const { id } = await params;
  const dados = await getFichaResumo(id);
  if (!dados) notFound();
  return (
    <>
      <VoltarLista href={`/dashboard/contratos/${id}`} rotulo="Contrato" />
      <PageTitle title="Ficha-resumo do contrato" subtitle="Os dados principais do contrato numa página só." />
      <Panel title="Resumo" className="mt-4">
        <dl className="grid gap-3 sm:grid-cols-2" data-testid="ficha-resumo">
          {dados.ficha.linhas.map((l) => (
            <div key={l.rotulo}>
              <dt className="text-xs font-semibold text-muted">{l.rotulo}</dt>
              <dd className="text-sm text-ink">{l.valor}</dd>
            </div>
          ))}
        </dl>
        {dados.ficha.pendencias.length > 0 && (
          <ul className="mt-4 list-disc space-y-1 pl-4 text-sm text-amber-800" data-testid="ficha-pendencias">
            {dados.ficha.pendencias.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </Panel>
      {dados.souProprietario && (
        <Panel title="Vencimento e conta de recebimento" className="mt-4">
          <FormContaRecebimento contratoId={id} diaInicial={dados.diaVencimento} />
        </Panel>
      )}
    </>
  );
}
