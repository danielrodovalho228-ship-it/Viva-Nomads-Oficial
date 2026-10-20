/*
  Rede de segurança dos documentos (Prompt 35A, item 1). Puro (node --test).
  O cron diário (/api/cron/automacoes) lista os arquivos do bucket privado property-docs e acha os que têm mais de
  2 h e não aparecem em lugar nenhum (qualificação, conferência de matrícula, caso da matrícula, autorização do
  imóvel): o documento chegou ao bucket mas não entrou na fila. Avisa a equipe com o dono e a data. NUNCA apaga.
*/
import { dataHoraBRT } from "../datas-brasilia.ts";

export interface ArquivoDoBucket {
  path: string;
  /** Pasta = id do dono (o upload grava em <user.id>/<uuid>.<ext>). */
  ownerId: string;
  criadoEm: string;
}

export const ORFAO_MIN_HORAS = 2;
/** Só olha os últimos dias: o aviso sai uma vez por arquivo (automacoes_envios) e não reabre o histórico inteiro. */
export const ORFAO_MAX_DIAS = 14;

/** Arquivos com mais de `minHoras` (e menos de `maxDias`) sem nenhuma referência, do mais antigo ao mais novo. */
export function documentosOrfaos(
  arquivos: ArquivoDoBucket[],
  referenciados: ReadonlySet<string>,
  agora: Date,
  minHoras = ORFAO_MIN_HORAS,
  maxDias = ORFAO_MAX_DIAS
): ArquivoDoBucket[] {
  const limiteNovo = agora.getTime() - minHoras * 3_600_000;
  const limiteVelho = agora.getTime() - maxDias * 86_400_000;
  return arquivos
    .filter((a) => {
      const t = Date.parse(a.criadoEm);
      return Number.isFinite(t) && t <= limiteNovo && t >= limiteVelho && !referenciados.has(a.path);
    })
    .sort((a, b) => Date.parse(a.criadoEm) - Date.parse(b.criadoEm));
}

/** Chave do aviso único por arquivo (automacoes_envios). */
export function chaveOrfao(path: string): string {
  return `documento_orfao:${path}`;
}

/** Texto do aviso à equipe: um arquivo por linha, com o dono e a data/hora de Brasília. Sem dado do documento. */
export function textoAvisoOrfaos(itens: { dono: string; criadoEm: string }[]): string {
  const linhas = itens.map((i) => `• ${i.dono || "Proprietário"}: enviado em ${dataHoraBRT(i.criadoEm)}`);
  return [
    `${itens.length === 1 ? "1 documento chegou" : `${itens.length} documentos chegaram`} ao armazenamento há mais de ${ORFAO_MIN_HORAS} h sem entrar na fila de conferência. Nada foi apagado.`,
    ...linhas,
    "Peça ao proprietário para reenviar pelo /qualificar ou confira o arquivo na fila.",
  ].join("\n");
}
