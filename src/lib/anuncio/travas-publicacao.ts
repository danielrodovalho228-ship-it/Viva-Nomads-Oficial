/*
  E699 — as travas da publicação, ditas desde o passo 1. Módulo puro (node --test).
  A confirmação de identidade e o documento do imóvel (matrícula) são exigidos para PUBLICAR, mas só apareciam no passo 10.
  Este módulo diz, a quem começa o cadastro, o que vai ser pedido e em que pé está cada coisa.
*/
export type EstadoIdentidadeTrava = "carregando" | "ok" | "em_breve" | "pendente" | "sem_cpf";
export type EstadoDocumentoTrava = "nenhum" | "revisao" | "corrija" | "aprovado" | string;
export type EstadoTrava = "ok" | "falta" | "em_analise" | "carregando";
export type ItemTrava = { chave: "identidade" | "documento"; rotulo: string; estado: EstadoTrava };

/** Mesmo critério do passo 10 (etapa-onde-fica): confirmada = ok; senão depende de ter CPF. */
export function estadoIdentidadeParaTrava(situacao: { identidade: { estado: string }; temCpf: boolean } | null): EstadoIdentidadeTrava {
  if (!situacao) return "carregando";
  if (situacao.identidade.estado === "confirmada") return "ok";
  if (situacao.identidade.estado === "em_breve") return "em_breve";
  return situacao.temCpf ? "pendente" : "sem_cpf";
}

export function travasDePublicacao(e: { identidade: EstadoIdentidadeTrava; documento: EstadoDocumentoTrava }): { itens: ItemTrava[]; mostrar: boolean } {
  const identidade: EstadoTrava = e.identidade === "carregando" ? "carregando" : e.identidade === "ok" || e.identidade === "em_breve" ? "ok" : "falta";
  const documento: EstadoTrava = e.documento === "aprovado" ? "ok" : e.documento === "revisao" ? "em_analise" : "falta";
  const itens: ItemTrava[] = [
    { chave: "identidade", rotulo: "Confirmação de identidade", estado: identidade },
    { chave: "documento", rotulo: "Documento do imóvel (matrícula)", estado: documento },
  ];
  // Só aparece enquanto falta alguma coisa. Carregando não conta como falta (evita piscar o cartão).
  return { itens, mostrar: itens.some((i) => i.estado === "falta" || i.estado === "em_analise") };
}
