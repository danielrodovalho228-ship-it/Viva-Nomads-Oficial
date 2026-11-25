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
