import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { getContratoParaAssinar } from "@/lib/data/contrato-assinar-actions";
import { ROTULO_ETAPA, etapaContrato } from "@/lib/contrato-etapas";
import { AssinarContrato } from "./assinar-contrato";

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
    </>
  );
}
