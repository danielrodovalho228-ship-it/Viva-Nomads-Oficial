/*
  "Hoje você tem N decisões" do /admin (Prompt 46, D5) — PURO.

  O início do admin abre com o que espera uma decisão da equipe. Cada linha conta pela MESMA fonte da lista que abre
  (regra de 13/10: número = lista) e leva à tela onde a decisão é tomada — nunca se decide aqui.
    • chamados P1 / P2 → chamados abertos (não resolvidos nem encerrados, sem simulação), a fila do Atendimento;
    • cópia de segurança → estadoBackup(...).vermelho (o cartão do próprio /admin);
    • documentos que não saíram → documentos_falhas em aberto + pagamentos confirmados sem recibo (/admin/documentos);
    • documentos na fila → filaDocumentos (a mesma do selo e de /admin/documentos);
    • encerramentos → contrato_encerramento_pedidos aberto ou em condução (/admin/contratos/encerramentos);
    • parcerias para aprovar → parceiro_solicitacoes pendente ou aguardando e-mail (a aba "Pendentes");
    • pedidos a parceiros sem orçamento → parceiro_pedidos "solicitado";
    • e as filas que já existiam ("Precisa de você agora"): candidaturas 48 h, manutenção urgente 4 h, taxas vencidas,
      pedidos expirando.
  Só entram as linhas com n > 0; N é a soma. Ordem: o que é mais urgente primeiro.
  Roda: node --test src/lib/admin/decisoes-admin.test.ts
*/

export type ChaveDecisaoAdmin =
  | "chamados_p1"
  | "chamados_p2"
  | "backup"
  | "falhas_documento"
  | "documentos_pendentes"
  | "encerramentos"
  | "parceiros_para_aprovar"
  | "pedidos_parceiro_sem_resposta"
  | "chamados_urgentes_sem_resposta"
  | "candidaturas_sem_resposta_48h"
  | "comissoes_vencidas"
  | "pedidos_sem_resposta_expirando";

export interface DefinicaoDecisaoAdmin {
  chave: ChaveDecisaoAdmin;
  /** Nome curto da fila, para o aviso de "não deu para ler". */
  fila: string;
  /** Rótulo no singular e no plural ("1 chamado P1 aberto" / "3 chamados P1 abertos"). */
  um: string;
  varios: string;
  /** Verbo do botão: a decisão que a tela de destino toma. */
  acao: string;
  href: string;
}

/** Em ordem de urgência. */
export const DECISOES_ADMIN: readonly DefinicaoDecisaoAdmin[] = [
  { chave: "chamados_p1", fila: "chamados P1", um: "chamado P1 aberto", varios: "chamados P1 abertos", acao: "Atender", href: "/admin/atendimento?aba=fila&prioridade=p1" },
  { chave: "chamados_p2", fila: "chamados P2", um: "chamado P2 aberto", varios: "chamados P2 abertos", acao: "Atender", href: "/admin/atendimento?aba=fila&prioridade=p2" },
  { chave: "backup", fila: "backup", um: "alerta de backup", varios: "alertas de backup", acao: "Ver o backup", href: "/admin#backup" },
  { chave: "falhas_documento", fila: "recibos", um: "recibo ou documento que não saiu", varios: "recibos ou documentos que não saíram", acao: "Emitir de novo", href: "/admin/documentos#falhas" },
  { chave: "documentos_pendentes", fila: "documentos", um: "documento na fila para conferir", varios: "documentos na fila para conferir", acao: "Conferir", href: "/admin/documentos" },
  { chave: "encerramentos", fila: "encerramentos", um: "pedido de encerramento de contrato", varios: "pedidos de encerramento de contrato", acao: "Conduzir", href: "/admin/contratos/encerramentos" },
  { chave: "parceiros_para_aprovar", fila: "parcerias", um: "pedido de parceria para aprovar", varios: "pedidos de parceria para aprovar", acao: "Analisar", href: "/admin/parceiros?aba=pendentes" },
  { chave: "pedidos_parceiro_sem_resposta", fila: "pedidos a parceiros", um: "pedido a parceiro sem orçamento", varios: "pedidos a parceiros sem orçamento", acao: "Acompanhar", href: "/admin/parceiros/pedidos?filtro=solicitado#lista" },
  { chave: "chamados_urgentes_sem_resposta", fila: "manutenção urgente", um: "manutenção urgente sem resposta há mais de 4 h", varios: "manutenções urgentes sem resposta há mais de 4 h", acao: "Cobrar", href: "/admin/solicitacoes?prioridade=urgente&sem_resposta=1" },
  { chave: "candidaturas_sem_resposta_48h", fila: "candidaturas", um: "candidatura sem resposta há mais de 48 h", varios: "candidaturas sem resposta há mais de 48 h", acao: "Cobrar", href: "/admin/candidaturas?status=sem_resposta" },
  { chave: "comissoes_vencidas", fila: "taxas vencidas", um: "taxa vencida", varios: "taxas vencidas", acao: "Cobrar", href: "/admin/financeiro?situacao=vencida" },
  { chave: "pedidos_sem_resposta_expirando", fila: "pedidos de moradia", um: "pedido de moradia vencendo sem resposta", varios: "pedidos de moradia vencendo sem resposta", acao: "Ver", href: "/admin/pedidos?expirando=1" },
];

export interface ContagemDecisao {
  /** null = não foi possível ler (a linha não aparece e a chave vai para `semLeitura`). */
  n: number | null;
  /** Frase curta de contexto ("mais antigo há 3 h", "a última cópia falhou"). */
  detalhe?: string | null;
}

export interface LinhaDecisaoAdmin {
  chave: ChaveDecisaoAdmin;
  n: number;
  texto: string;
  detalhe: string | null;
  acao: string;
  href: string;
}

export interface DecisoesAdmin {
  total: number;
  linhas: LinhaDecisaoAdmin[];
  /** Fontes que não puderam ser lidas: a tela avisa, sem fingir zero. */
  semLeitura: ChaveDecisaoAdmin[];
}

export function montarDecisoesAdmin(contagens: Partial<Record<ChaveDecisaoAdmin, ContagemDecisao | null>>): DecisoesAdmin {
  const linhas: LinhaDecisaoAdmin[] = [];
  const semLeitura: ChaveDecisaoAdmin[] = [];
  for (const d of DECISOES_ADMIN) {
    const c = contagens[d.chave];
    if (!c || c.n === null || !Number.isFinite(c.n)) {
      semLeitura.push(d.chave);
      continue;
    }
    const n = Math.max(0, Math.floor(c.n));
    if (n === 0) continue;
    linhas.push({ chave: d.chave, n, texto: `${n} ${n === 1 ? d.um : d.varios}`, detalhe: c.detalhe?.trim() || null, acao: d.acao, href: d.href });
  }
  return { total: linhas.reduce((s, l) => s + l.n, 0), linhas, semLeitura };
}

/** "Não deu para ler agora: backup e recibos." — nomes das filas fora da conta. */
export function avisoSemLeitura(chaves: readonly ChaveDecisaoAdmin[]): string | null {
  const nomes = DECISOES_ADMIN.filter((d) => chaves.includes(d.chave)).map((d) => d.fila);
  if (!nomes.length) return null;
  const lista = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  return `Não deu para ler agora: ${lista}. ${nomes.length === 1 ? "Essa fila fica" : "Essas filas ficam"} fora da conta.`;
}

/** "Hoje você tem 1 decisão" / "Hoje você tem 7 decisões" / sem nenhuma, "Nada pede sua decisão hoje". */
export function tituloDecisoesAdmin(total: number): string {
  if (total <= 0) return "Nada pede sua decisão hoje";
  return `Hoje você tem ${total} ${total === 1 ? "decisão" : "decisões"}`;
}

/** "há 5 h" / "há 2 dias" a partir das horas; null sem dado. */
export function haQuantoTempo(horas: number | null | undefined): string | null {
  if (horas === null || horas === undefined || !Number.isFinite(horas) || horas < 0) return null;
  if (horas < 1) return "há menos de 1 h";
  if (horas < 48) return `há ${Math.round(horas)} h`;
  return `há ${Math.round(horas / 24)} dias`;
}
