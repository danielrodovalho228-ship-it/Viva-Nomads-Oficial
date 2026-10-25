import { getContratosDoInquilino, getMeusContratos } from "@/lib/data/contratos-actions";
import { documentosDosContratos } from "@/lib/data/documentos-actions";
import { listMyProperties } from "@/lib/data/properties";
import { PageTitle } from "@/components/dashboard/primitives";
import { ContratosClient } from "./contratos-client";
import { ContratosInquilino } from "./contratos-inquilino";
import { ContratosPorModo } from "./contratos-por-modo";
import { hojeBR } from "@/lib/utils";
import { BlocoRecibosDono } from "@/components/recibos/blocos-recibos";
import { estadosConferenciaEntradaDaPessoa } from "@/lib/data/conferencia-lista";
import { contratoComConferenciaPendente } from "@/lib/contratos/area-dono";

/**
 * "Contratos & blocos" (Dashboard Fase 4): o servidor busca os contratos REAIS
 * do proprietário (contrato-mãe + blocos + pagamentos declarados); a renderização
 * fica no client, que suporta o modo demonstração do admin (fonte vira o seed).
 * A data de hoje é resolvida no servidor e passada ao client para os estados dos
 * blocos serem determinísticos (SSR-safe).
 * Prompt 28: a mesma rota mostra os contratos do INQUILINO (aguardando assinatura ainda não é locação).
 */
export default async function ContratosPage() {
  const [contratos, doInquilino, imoveis] = await Promise.all([getMeusContratos(), getContratosDoInquilino(), listMyProperties()]);
  const temImovel = imoveis.length > 0 || contratos.length > 0;
  const hojeISO = hojeBR();
  // Recibos, comprovantes e a devolução da caução de cada contrato (o RLS filtra).
  const ids = contratos.map((c) => c.id);
  const [extras, conferencias] = temImovel ? await Promise.all([documentosDosContratos(ids), estadosConferenciaEntradaDaPessoa(ids)]) : [{}, new Map()];
  const conferenciaPendente = contratoComConferenciaPendente(contratos, conferencias);
  const inquilino = (
    <section className="mb-8" data-testid="secao-contratos-inquilino">
      <PageTitle title="Contratos" subtitle="Seus contratos de locação: assine aqui na plataforma e acompanhe a situação de cada um." />
      <ContratosInquilino contratos={doInquilino} />
    </section>
  );
  const dono = temImovel ? (
    <>
      {/* Prompt 39-B1: "Recibos e notas" no celular é um bloco da aba Ganhos (no computador, item do menu). */}
      <BlocoRecibosDono />
      <ContratosClient contratos={contratos} hojeISO={hojeISO} extras={extras} conferenciaPendente={conferenciaPendente} />
    </>
  ) : null;
  return <ContratosPorModo inquilino={inquilino} dono={dono} temInquilino={doInquilino.length > 0} />;
}
