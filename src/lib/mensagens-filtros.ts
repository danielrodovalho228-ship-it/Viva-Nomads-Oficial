/*
  Filtros em chips da caixa de mensagens (ordem f1b437bb, Pacote Clareza UX6, item b) — regra pura.
  Papel da conversa: imóvel do próprio usuário = "Como proprietário"; imóvel de outra pessoa = "Como
  inquilino"; conversa sem imóvel (equipe da Viva) = "Suporte".
*/
import { formatarDiaCurto } from "./estadia-linha-tempo.ts";

export type PapelConversa = "inquilino" | "proprietario" | "suporte";
export type Filtro = "todas" | PapelConversa;

export const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "inquilino", rotulo: "Como inquilino" },
  { id: "proprietario", rotulo: "Como proprietário" },
  { id: "suporte", rotulo: "Suporte" },
];

export function papelDaConversa(
  c: { propertyId?: string; donoDoImovelId?: string },
  userId: string
): PapelConversa {
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
    suporte: filtrarConversas(lista, "suporte").length,
  };
}

export function formatarPeriodo(inicio?: string | null, fim?: string | null): string {
  if (!inicio || !fim) return "";
  return `${formatarDiaCurto(inicio)} – ${formatarDiaCurto(fim)}`;
}
