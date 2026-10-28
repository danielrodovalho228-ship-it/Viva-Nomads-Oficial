import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { carregarEstadia } from "@/lib/data/estadia";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";
import { AlteracaoTela } from "./alteracao-tela";
import { VoltarLista } from "@/components/ui/voltar-lista";

export const metadata: Metadata = { title: "Propor alteração", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Propor alteração (Prompt 32, item 6): entrada, meses (saída), ocupantes ou valor mensal. A outra parte tem 7 dias;
 * aceito, o aditivo é assinado pelas duas partes com código, e só então blocos e datas mudam.
 */
export default async function AlteracaoPage({ params }: { params: Promise<{ contratoId: string }> }) {
  const { contratoId } = await params;
  if (!UUID_RE.test(contratoId)) notFound();
  const e = await carregarEstadia(contratoId);
  if (!e) notFound();
  const aberto = e.aditivos.find((a) => a.status === "proposto" || a.status === "aceito");
  const podePropor = e.status === "ativo" && e.assinadoPelasDuas && !aberto && e.topo.fase !== "encerrada";
  return (
    <div className="space-y-4" data-testid="pagina-alteracao">
      <VoltarLista href={HREF_ESTADIA(e.id)} rotulo="Minha estadia" />
      <PageTitle title="Propor alteração" subtitle={`${e.imovel.titulo} · Contrato ${e.numero}`} />
      <Panel>
        <p className="text-sm text-ink">
          O aditivo registra só o que muda (antes e depois). Ocupantes e valor mensal valem para os blocos que ainda não começaram. Nada muda antes do aceite da outra parte e das duas assinaturas.
        </p>
        {e.papel === "proprietario" && (
          <p className="mt-2 text-sm text-muted">Taxa de serviço: só sobre a parte acrescentada ou retirada; o que já foi contratado mantém a taxa congelada no aceite.</p>
        )}
      </Panel>
      {podePropor ? (
        <AlteracaoTela
          contratoId={e.id}
          atual={{ inicio: e.periodo.inicio, meses: e.meses, ocupantes: e.ocupantesPrevistos, valorMensal: e.valorMensal, capacidade: e.capacidade }}
          entradaAberta={!e.blocos.some((b) => b.iniciado)}
          temFuturo={e.blocos.some((b) => !b.iniciado)}
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
