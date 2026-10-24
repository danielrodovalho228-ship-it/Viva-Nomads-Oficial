/*
  L2-B itens 12 e 13 — UM estado da caução, lido pela /dashboard/garantias, pelos Contratos (dono) e pelas telas do
  inquilino (Minhas locações e a Estadia). Antes, a Garantias olhava só contrato_blocos.caucao_status e marcava
  "pendente" até em contrato sem blocos; os Contratos olhavam pagamentos_bloco. Agora as duas fontes entram aqui,
  junto com o acerto da devolução (caucao_acertos) e a garantia do contrato. PURO.
    • Seguro-fiança → "Sem caução (seguro-fiança)".
    • Sem valor de caução em nenhum bloco e nenhum recebimento registrado → "Sem caução neste contrato" (nunca pendente).
    • Acerto da devolução manda (devolvida, com desconto, contestada, aguardando o inquilino confirmar).
    • Recebida: bloco com a caução comprovada OU recebimento da caução confirmado pelo inquilino.
    • Registrada e ainda não confirmada → "Aguardando a confirmação do inquilino".
    • Senão → "A receber".
*/

export type ChaveCaucao =
  | "dispensada"
  | "sem_caucao"
  | "a_receber"
  | "aguardando_confirmacao"
  | "recebida"
  | "devolucao_aguardando"
  | "devolvida"
  | "devolvida_com_desconto"
  | "desconto_contestado";

export interface EntradaCaucao {
  garantia?: string | null;
  blocos: readonly { caucao?: number | string | null; caucaoStatus?: string | null }[];
  /** Pagamentos do contrato (só os do tipo "caucao" contam). Anulados ficam fora. */
  pagamentos: readonly { tipo: string; valor: number | string; confirmado: boolean; anulado?: boolean }[];
  /** Acerto mais recente da devolução (caucao_acertos), se houver. */
  acerto?: { status: string; valorDevolvido?: number | string | null } | null;
}

export interface EstadoCaucao {
  chave: ChaveCaucao;
  /** Valor da caução do contrato (soma dos blocos; sem blocos, o recebimento registrado). */
  valor: number;
  rotulo: string;
  /** Falta alguma ação para a caução ficar em dia (a receber ou à espera de confirmação). */
  pendente: boolean;
}

const ROTULO: Record<ChaveCaucao, string> = {
  dispensada: "Sem caução (seguro-fiança)",
  sem_caucao: "Sem caução neste contrato",
  a_receber: "A receber",
  aguardando_confirmacao: "Registrada · aguardando a confirmação do inquilino",
  recebida: "Recebida (em custódia do proprietário)",
  devolucao_aguardando: "Devolução registrada · aguardando a confirmação do inquilino",
  devolvida: "Devolvida",
  devolvida_com_desconto: "Devolvida com desconto",
  desconto_contestado: "Desconto contestado pelo inquilino",
};

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export function estadoCaucao(e: EntradaCaucao): EstadoCaucao {
  const pagos = e.pagamentos.filter((p) => p.tipo === "caucao" && !p.anulado);
  const somaBlocos = Math.round(e.blocos.reduce((s, b) => s + n(b.caucao), 0) * 100) / 100;
  const valor = somaBlocos > 0 ? somaBlocos : Math.round(pagos.reduce((s, p) => s + n(p.valor), 0) * 100) / 100;
  const de = (chave: ChaveCaucao): EstadoCaucao => ({ chave, valor, rotulo: ROTULO[chave], pendente: chave === "a_receber" || chave === "aguardando_confirmacao" });

  if (e.garantia === "seguro_fianca") return { ...de("dispensada"), valor: 0 };
  const acerto = e.acerto?.status;
  if (acerto === "devolvida_integral") return de("devolvida");
  if (acerto === "desconto_confirmado") return de("devolvida_com_desconto");
  if (acerto === "desconto_contestado") return de("desconto_contestado");
  if (acerto === "aguardando_confirmacao") return de("devolucao_aguardando");
  if (valor <= 0) return de("sem_caucao");
  if (e.blocos.some((b) => b.caucaoStatus === "comprovada") || pagos.some((p) => p.confirmado)) return de("recebida");
  if (pagos.length > 0) return de("aguardando_confirmacao");
  return de("a_receber");
}

/** O checklist da Estadia fala em três estados; a mesma fonte decide qual. */
export function caucaoDoChecklist(e: EstadoCaucao): "pendente" | "recebida" | "dispensada" {
  if (e.chave === "dispensada" || e.chave === "sem_caucao") return "dispensada";
  return e.pendente ? "pendente" : "recebida";
}

/** Acerto mais recente de uma lista (created_at decrescente). */
export function acertoMaisRecente<T extends { created_at?: string | null }>(lista: readonly T[] | null | undefined): T | null {
  if (!lista?.length) return null;
  return [...lista].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
}
