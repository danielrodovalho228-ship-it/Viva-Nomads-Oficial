/*
  Câmera escondida (ordem f92bc582, item 4): quem tem contrato e abre o chamado
  "Encontrei câmera ou dispositivo de gravação" tira o anúncio da busca na hora,
  até a equipe decidir. PURO (a gravação fica em servidor.ts).
  Só vale para o INQUILINO DO CONTRATO: ninguém tira anúncio alheio da busca só
  abrindo um chamado. E só de contrato em andamento: ex-inquilino de contrato
  encerrado não tira o anúncio da busca (achado do Moacir, #508).
*/

const STATUS_CONTRATO_EM_ANDAMENTO = ["ativo", "encerrado_em_acerto"];

export interface ContratoParaCamera {
  status?: string | null;
  tenant_id: string | null;
  property_id: string | null;
}

/** Qual anúncio sai da busca? null = nenhum (categoria errada, sem contrato ou não é o inquilino). */
export function anuncioParaPausarPorCamera(
  categoria: string,
  usuarioId: string | null,
  contrato: ContratoParaCamera | null,
): string | null {
  if (categoria !== "camera" || !usuarioId || !contrato) return null;
  if (contrato.tenant_id !== usuarioId || !contrato.property_id) return null;
  if (!contrato.status || !STATUS_CONTRATO_EM_ANDAMENTO.includes(contrato.status)) return null;
  return contrato.property_id;
}

export const AVISO_ANUNCIO_PAUSADO =
  "Por segurança, o anúncio saiu da busca até a equipe da Viva analisar o caso.";
