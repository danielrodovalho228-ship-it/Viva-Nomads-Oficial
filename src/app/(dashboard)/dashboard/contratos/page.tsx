import { getMeusContratos } from "@/lib/data/contratos-actions";
import { documentosDosContratos } from "@/lib/data/documentos-actions";
import { ContratosClient } from "./contratos-client";
import { hojeBR } from "@/lib/utils";

/**
 * "Contratos & blocos" (Dashboard Fase 4): o servidor busca os contratos REAIS
 * do proprietário (contrato-mãe + blocos + pagamentos declarados); a renderização
 * fica no client, que suporta o modo demonstração do admin (fonte vira o seed).
 * A data de hoje é resolvida no servidor e passada ao client para os estados dos
 * blocos serem determinísticos (SSR-safe).
 */
export default async function ContratosPage() {
  const contratos = await getMeusContratos();
  const hojeISO = hojeBR();
  // Recibos, comprovantes e a devolução da caução de cada contrato (o RLS filtra).
  const extras = await documentosDosContratos(contratos.map((c) => c.id));
  return <ContratosClient contratos={contratos} hojeISO={hojeISO} extras={extras} />;
}
