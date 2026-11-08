/*
  E699 — as travas da publicação, ditas desde o passo 1. Módulo puro (node --test).
  A confirmação de identidade e o documento do imóvel (matrícula) são exigidos para PUBLICAR, mas só apareciam no passo 10.
  Este módulo diz, a quem começa o cadastro, o que vai ser pedido e em que pé está cada coisa.
*/
export type EstadoIdentidadeTrava = "carregando" | "indisponivel" | "ok" | "em_breve" | "pendente" | "sem_cpf";
export type EstadoDocumentoTrava = "nenhum" | "revisao" | "corrija" | "aprovado" | string;
export type EstadoTrava = "ok" | "falta" | "em_analise" | "carregando";
export type ItemTrava = {
  chave: "identidade" | "documento";
  rotulo: string;
  estado: EstadoTrava;
  /** Texto curto depois do rótulo quando o estado não basta (ex.: "conferindo…"). */
  detalhe?: string;
  /** Caminho para resolver a trava (só quando falta ou não deu para conferir). */
  href?: string;
};

export const HREF_VERIFICAR_IDENTIDADE = "/dashboard/verificacao";
export const HREF_CPF_NA_CONTA = "/dashboard/conta/dados#documento";
export const HREF_SEGURANCA = "/dashboard/conta/seguranca";

/** Mesmo critério do passo 10 (etapa-onde-fica): confirmada = ok; senão depende de ter CPF. */
export function estadoIdentidadeParaTrava(situacao: { identidade: { estado: string }; temCpf: boolean } | null, leituraFalhou = false): EstadoIdentidadeTrava {
  // E699 (d): sem resposta, "carregando" eterno parecia pendência; se a leitura falhou, diz isso. A resposta do servidor sempre vence.
  if (!situacao) return leituraFalhou ? "indisponivel" : "carregando";
  if (situacao.identidade.estado === "confirmada") return "ok";
  if (situacao.identidade.estado === "em_breve") return "em_breve";
  return situacao.temCpf ? "pendente" : "sem_cpf";
}

export function travasDePublicacao(e: { identidade: EstadoIdentidadeTrava; documento: EstadoDocumentoTrava }): { itens: ItemTrava[]; mostrar: boolean } {
  const identidade: EstadoTrava = e.identidade === "carregando" || e.identidade === "indisponivel" ? "carregando" : e.identidade === "ok" || e.identidade === "em_breve" ? "ok" : "falta";
  const documento: EstadoTrava = e.documento === "aprovado" ? "ok" : e.documento === "revisao" ? "em_analise" : "falta";
  const itemIdentidade: ItemTrava = { chave: "identidade", rotulo: "Confirmação de identidade", estado: identidade };
  if (e.identidade === "carregando") itemIdentidade.detalhe = "conferindo…";
  if (e.identidade === "indisponivel") {
    itemIdentidade.detalhe = "não deu para conferir agora";
    itemIdentidade.href = HREF_SEGURANCA;
  }
  if (e.identidade === "pendente") itemIdentidade.href = HREF_VERIFICAR_IDENTIDADE;
  if (e.identidade === "sem_cpf") itemIdentidade.href = HREF_CPF_NA_CONTA;
  const itens: ItemTrava[] = [itemIdentidade, { chave: "documento", rotulo: "Documento do imóvel (matrícula)", estado: documento }];
  // Só aparece enquanto falta alguma coisa. Carregando não conta como falta (evita piscar o cartão).
  return { itens, mostrar: itens.some((i) => i.estado === "falta" || i.estado === "em_analise") };
}
