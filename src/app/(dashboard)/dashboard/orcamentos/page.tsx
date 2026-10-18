import { interessadosParaProposta, listarPropostas } from "@/lib/data/propostas-actions";
import { OrcamentosClient } from "./orcamentos-client";

/**
 * Orçamentos (prompt 17): as propostas de verdade, gravadas no banco. O proprietário vê as que enviou e cria
 * "Nova proposta" a partir de um interessado real; o interessado vê as que recebeu. Nada de nome ou contato
 * digitado à mão.
 */
export default async function OrcamentosPage() {
  const [propostas, interessados] = await Promise.all([listarPropostas(), interessadosParaProposta()]);
  return <OrcamentosClient propostas={propostas} interessados={interessados} />;
}
