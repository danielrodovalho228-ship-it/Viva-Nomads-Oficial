/*
  Filtros em chips da caixa de mensagens (ordem f1b437bb, Pacote Clareza UX6, item b; Prompt 32, item 4) — regra pura.
  Papel da conversa (sai da posição da pessoa em CADA conversa): imóvel do próprio usuário = "Como proprietário";
  imóvel de outra pessoa = "Como morador"; conversa de pedido de serviço (31b, "pedido:") = "Parceiros"; conversa
  sem imóvel (equipe da Viva) = "Falar com a Viva". Os ids ficam estáveis (os testes e o E2E usam os ids).
*/


export type PapelConversa = "inquilino" | "proprietario" | "parceiros" | "suporte";
export type Filtro = "todas" | PapelConversa;

export const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "proprietario", rotulo: "Como proprietário" },
  { id: "inquilino", rotulo: "Como morador" },
  { id: "parceiros", rotulo: "Parceiros" },
  { id: "suporte", rotulo: "Falar com a Viva" },
];

export function papelDaConversa(
  c: { propertyId?: string; donoDoImovelId?: string; pedidoParceiroId?: string | null },
  userId: string
): PapelConversa {
  if (c.pedidoParceiroId) return "parceiros";
  if (!c.propertyId || !c.donoDoImovelId) return "suporte";
  return c.donoDoImovelId === userId ? "proprietario" : "inquilino";
}

export function filtrarConversas<T extends { papel?: PapelConversa }>(lista: T[], filtro: Filtro): T[] {
  return filtro === "todas" ? lista : lista.filter((c) => c.papel === filtro);
}

export function contarPorFiltro(lista: { papel?: PapelConversa }[]): Record<Filtro, number> {
  return {
    todas: lista.length,
    inquilino: filtrarConversas(lista, "inquilino").length,
    proprietario: filtrarConversas(lista, "proprietario").length,
    parceiros: filtrarConversas(lista, "parceiros").length,
    suporte: filtrarConversas(lista, "suporte").length,
  };
}

/** Datas do contrato na lista de conversas: "13/11 – 15/02" (Prompt 32, item 4). */
export function formatarPeriodo(inicio?: string | null, fim?: string | null): string {
  if (!inicio || !fim) return "";
  const ddmm = (iso: string) => {
    const [, m, d] = iso.slice(0, 10).split("-");
    return `${d}/${m}`;
  };
  return `${ddmm(inicio)} – ${ddmm(fim)}`;
}

/*
  E721 — "Adiar" a conversa (regra pura). A pessoa adia a SUA visão da conversa: ela sai de "Todas" e dos chips de papel e
  fica em "Adiadas" até o prazo acabar ou até a outra parte escrever de novo (mensagem recebida depois de adiar). Nada é
  apagado e a outra parte não é avisada. Cada lado adia o seu.
*/
export const PRAZOS_ADIAR = [
  { id: "1d", rotulo: "1 dia", horas: 24 },
  { id: "3d", rotulo: "3 dias", horas: 72 },
  { id: "7d", rotulo: "1 semana", horas: 168 },
] as const;
export type PrazoAdiar = (typeof PRAZOS_ADIAR)[number]["id"];

export function adiarAte(prazo: PrazoAdiar, agora: Date = new Date()): string | null {
  const p = PRAZOS_ADIAR.find((x) => x.id === prazo);
  return p ? new Date(agora.getTime() + p.horas * 3_600_000).toISOString() : null;
}

type ConversaAdiavel = {
  adiadaEm?: string | null;
  adiadaAte?: string | null;
  messages?: { from: "me" | "them"; enviadaEm?: string }[];
};

export function estaAdiada(c: ConversaAdiavel, agora: Date = new Date()): boolean {
  if (!c.adiadaAte || !c.adiadaEm) return false;
  if (new Date(c.adiadaAte).getTime() <= agora.getTime()) return false;
  const desde = new Date(c.adiadaEm).getTime();
  // A outra parte escreveu depois de adiar: a conversa volta para a lista.
  return !(c.messages ?? []).some((m) => m.from === "them" && !!m.enviadaEm && new Date(m.enviadaEm).getTime() > desde);
}

export function separarAdiadas<T extends ConversaAdiavel>(lista: T[], agora: Date = new Date()): { ativas: T[]; adiadas: T[] } {
  const adiadas = lista.filter((c) => estaAdiada(c, agora));
  return { ativas: lista.filter((c) => !adiadas.includes(c)), adiadas };
}
