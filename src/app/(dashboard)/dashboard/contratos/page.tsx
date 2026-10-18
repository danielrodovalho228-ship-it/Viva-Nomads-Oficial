import { getContratosDoInquilino, getMeusContratos } from "@/lib/data/contratos-actions";
import { documentosDosContratos } from "@/lib/data/documentos-actions";
import { listMyProperties } from "@/lib/data/properties";
import { PageTitle } from "@/components/dashboard/primitives";
import { ContratosClient } from "./contratos-client";
import { ContratosInquilino } from "./contratos-inquilino";
import { hojeBR } from "@/lib/utils";

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
  const extras = temImovel ? await documentosDosContratos(contratos.map((c) => c.id)) : {};
  return (
    <>
      {(doInquilino.length > 0 || !temImovel) && (
        <section className="mb-8" data-testid="secao-contratos-inquilino">
          {!temImovel ? (
            <PageTitle title="Contratos" subtitle="Seus contratos de locação: assine aqui na plataforma e acompanhe a situação de cada um." />
          ) : (
            <h2 className="mb-3 font-title text-lg font-bold text-ink">Contratos em que você é o inquilino</h2>
          )}
          <ContratosInquilino contratos={doInquilino} />
        </section>
      )}
      {temImovel && <ContratosClient contratos={contratos} hojeISO={hojeISO} extras={extras} />}
    </>
  );
}
