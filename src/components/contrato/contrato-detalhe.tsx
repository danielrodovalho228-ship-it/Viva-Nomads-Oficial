import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { getContratoParaAssinar } from "@/lib/data/contrato-assinar-actions";
import { ROTULO_ETAPA, etapaContrato } from "@/lib/contrato-etapas";
import { conferenciasDoContrato } from "@/lib/data/conferencia-actions";
import { AssinarContrato } from "./assinar-contrato";
import { LinhaDoTempoEstadia } from "./linha-do-tempo-estadia";
import { ConferenciaContrato } from "./conferencia-contrato";

/**
 * Detalhe do contrato para as DUAS partes (ordens 0fd301f0 e f375fdc1): o inquilino chega por
 * /dashboard/locacoes/[id] e o proprietário por /dashboard/contratos/[id]. A leitura passa pelo RLS;
 * quem não é parte (ou id inexistente) recebe 404.
 */
export async function ContratoDetalhe({
  id,
  voltarHref,
  voltarRotulo,
}: {
  id: string;
  voltarHref: string;
  voltarRotulo: string;
}) {
  const c = await getContratoParaAssinar(id);
  if (!c) notFound();
  const etapa = etapaContrato({
    assinadoProprietarioEm: c.assinadoProprietarioEm,
    assinadoInquilinoEm: c.assinadoInquilinoEm,
    primeiroPagamentoConfirmado: false,
  });
  // Conferência de entrada e de saída: só com contrato em andamento ou encerrado e assinado pelas duas partes.
  const mostraConferencia = ["ativo", "concluido", "encerrado_sem_renovacao"].includes(c.status) && !!c.assinadoProprietarioEm && !!c.assinadoInquilinoEm;
  const conferencia = mostraConferencia ? await conferenciasDoContrato(c.id) : null;
  return (
    <>
      <Link href={voltarHref} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {voltarRotulo}
      </Link>
      <PageTitle title={c.imovel} subtitle={c.status === "ativo" ? ROTULO_ETAPA[etapa] : c.status} />
      <Panel className="p-5">
        <h2 className="font-title text-base font-bold text-ink">Contrato</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-ink" data-testid="contrato-resumo">
          {c.resumo.map((linha) => (
            <li key={linha}>{linha}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted" data-testid="contrato-aviso-assinatura">
          {c.aviso}
        </p>
        {!c.euAssinei && c.status === "ativo" && <AssinarContrato contratoId={c.id} />}
      </Panel>
      <LinhaDoTempoEstadia etapas={c.linhaDoTempo} />
      {conferencia && (
        <Panel className="mt-5 p-5">
          <h2 className="font-title text-base font-bold text-ink">Conferência de entrada e saída</h2>
          <p className="mt-1 text-sm text-muted">Fotos e itens por cômodo, confirmados ou contestados pelas duas partes. É a base para conversar sobre a Caução.</p>
          <div className="mt-4">
            <ConferenciaContrato contratoId={c.id} statusContrato={c.status} dados={conferencia} />
          </div>
        </Panel>
      )}
    </>
  );
}
