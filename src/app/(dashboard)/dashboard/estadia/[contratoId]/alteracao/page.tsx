import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { carregarEstadia } from "@/lib/data/estadia";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";
import { ROTULO_RENOVAR, TEXTO_NO_MAXIMO, previaDaRenovacao, renovacaoPossivel, type PreviaRenovacao } from "@/lib/estadia/renovacao";
import { AlteracaoTela } from "./alteracao-tela";
import { VoltarLista } from "@/components/ui/voltar-lista";

export const metadata: Metadata = { title: "Propor alteração", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Propor alteração (Prompt 32, item 6): entrada, meses (saída), ocupantes ou valor mensal. A outra parte tem 7 dias;
 * aceito, o aditivo é assinado pelas duas partes com código, e só então blocos e datas mudam.
 * E222-B: com ?renovar=1 é a RENOVAÇÃO — o mesmo aditivo, já preenchido como prorrogação (mais 1 bloco padrão, até o
 * teto de 180 dias), com as datas e o valor do período acrescentado. Sem espaço no teto, só a frase do máximo.
 */
export default async function AlteracaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ contratoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { contratoId } = await params;
  const renovar = (await searchParams).renovar === "1";
  if (!UUID_RE.test(contratoId)) notFound();
  const e = await carregarEstadia(contratoId);
  if (!e) notFound();
  const aberto = e.aditivos.find((a) => a.status === "proposto" || a.status === "aceito");
  const podePropor = e.status === "ativo" && e.assinadoPelasDuas && !aberto && e.topo.fase !== "encerrada";
  const renovacao = renovar ? renovacaoPossivel(e.blocos, e.tamanhoBlocoMeses) : null;
  const previas: Record<number, PreviaRenovacao> = {};
  for (const m of renovacao?.opcoes ?? []) {
    const p = previaDaRenovacao(e.blocos, e.valorMensal, m);
    if (p) previas[m] = p;
  }
  return (
    <div className="space-y-4" data-testid="pagina-alteracao" data-modo={renovar ? "renovar" : "alterar"}>
      <VoltarLista href={HREF_ESTADIA(e.id)} rotulo="Minha estadia" />
      <PageTitle title={renovar ? ROTULO_RENOVAR : "Propor alteração"} subtitle={`${e.imovel.titulo} · Contrato ${e.numero}`} />
      {renovar && (
        <Panel>
          <p className="text-sm text-ink" data-testid="renovacao-explica">
            A renovação é um aditivo de prorrogação: a outra parte aceita, as duas assinam com código e só então os novos blocos entram no contrato.
          </p>
        </Panel>
      )}
      <Panel>
        <p className="text-sm text-ink">
          O aditivo registra só o que muda (antes e depois). Ocupantes e valor mensal valem para os blocos que ainda não começaram. Nada muda antes do aceite da outra parte e das duas assinaturas.
        </p>
        {e.papel === "proprietario" && (
          <p className="mt-2 text-sm text-muted">Taxa de serviço: só sobre a parte acrescentada ou retirada; o que já foi contratado mantém a taxa congelada no aceite.</p>
        )}
      </Panel>
      {renovar && podePropor && !renovacao ? (
        <p className="text-sm font-semibold text-ink" data-testid="renovacao-no-maximo">
          {TEXTO_NO_MAXIMO}
        </p>
      ) : podePropor ? (
        <AlteracaoTela
          contratoId={e.id}
          atual={{ inicio: e.periodo.inicio, meses: e.meses, ocupantes: e.ocupantesPrevistos, valorMensal: e.valorMensal, capacidade: e.capacidade }}
          entradaAberta={!e.blocos.some((b) => b.iniciado)}
          temFuturo={e.blocos.some((b) => !b.iniciado)}
          renovacao={renovacao ? { opcoes: renovacao.opcoes, sugeridos: renovacao.mesesSugeridos, previas } : undefined}
        />
      ) : (
        <p className="text-sm text-muted" data-testid="alteracao-indisponivel">
          {aberto
            ? "Já existe uma proposta de alteração aberta. Ela aparece na página da estadia."
            : "A alteração vale para contrato assinado pelas duas partes e em vigor."}
        </p>
      )}
    </div>
  );
}
