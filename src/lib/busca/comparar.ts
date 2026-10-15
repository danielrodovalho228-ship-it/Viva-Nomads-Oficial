/**
 * Comparar imóveis lado a lado (ordem fdd61de0). Puro: sem banco, sem tela.
 * A seleção vive na URL (?comparar=id1,id2) para dar para compartilhar. Só campos públicos —
 * nunca coordenada exata nem dado pessoal. Campo sem dado = "—" (nunca inventar).
 */
import type { Property } from "../types.ts";
import { garantiaLabel } from "../faixas.ts";
import { textoValorPet } from "../anuncio/pets-regras.ts";

export const MAX_COMPARAR = 3;
export const MIN_COMPARAR = 2;
export const SEM_DADO = "—";
export const AVISO_LIMITE = `Você pode comparar até ${MAX_COMPARAR} imóveis. Tire um para escolher outro.`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lê ?comparar=id1,id2: só ids válidos, sem repetir, no máximo 3. */
export function idsDeComparar(valor: string | string[] | undefined | null): string[] {
  const bruto = Array.isArray(valor) ? valor.join(",") : valor ?? "";
  const ids: string[] = [];
  for (const parte of bruto.split(",")) {
    const id = parte.trim();
    if (UUID.test(id) && !ids.includes(id)) ids.push(id);
    if (ids.length === MAX_COMPARAR) break;
  }
  return ids;
}

/** Marca/desmarca um imóvel. No 4º, não muda e devolve o aviso amigável. */
export function alternarSelecao(atual: readonly string[], id: string): { ids: string[]; aviso: string | null } {
  if (atual.includes(id)) return { ids: atual.filter((x) => x !== id), aviso: null };
  if (atual.length >= MAX_COMPARAR) return { ids: [...atual], aviso: AVISO_LIMITE };
  return { ids: [...atual, id], aviso: null };
}

/** Endereço do comparativo (com a seleção na URL). */
export function hrefComparar(ids: readonly string[]): string {
  return `/comparar?comparar=${ids.slice(0, MAX_COMPARAR).join(",")}`;
}

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const num = (v: number | undefined | null) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? String(v) : SEM_DADO);

export interface LinhaComparar {
  chave: string;
  rotulo: string;
  valores: string[];
}

/** Monta as linhas da tabela, na ordem dos imóveis recebidos (um valor por imóvel). */
export function montarTabela(imoveis: readonly Property[]): LinhaComparar[] {
  const por = (chave: string, rotulo: string, f: (p: Property) => string): LinhaComparar => ({
    chave,
    rotulo,
    valores: imoveis.map(f),
  });
  return [
    por("mensal", "Valor mensal", (p) => (p.monthlyPrice > 0 ? brl(p.monthlyPrice) : SEM_DADO)),
    por("quartos", "Quartos", (p) => num(p.bedrooms)),
    por("banheiros", "Banheiros", (p) => num(p.bathrooms)),
    por("area", "Área (m²)", (p) => num(p.areaM2)),
    por("condominio", "Condomínio", (p) => (p.condoFee && p.condoFee > 0 ? `${brl(p.condoFee)}/mês` : SEM_DADO)),
    por("limpeza", "Limpeza de entrada", (p) => (p.prepFee > 0 ? brl(p.prepFee) : SEM_DADO)),
    por("caucao", "Caução", (p) => {
      const r = p.petsRegras?.reforcoCaucao ?? 0;
      if (r > 0) return `Reforço de ${brl(r)} por causa do pet`;
      const g = p.garantiasAceitas ?? [];
      return g.length > 0 ? g.map(garantiaLabel).join(", ") : SEM_DADO;
    }),
    por("pet", "Aceita pet", (p) => (p.petsAllowed === undefined ? SEM_DADO : p.petsAllowed ? "Sim" : "Não")),
    por("valorPet", "Valor pet", (p) => (p.petsAllowed ? textoValorPet(p.petsRegras) ?? SEM_DADO : SEM_DADO)),
    por("avaliacao", "Avaliação", (p) =>
      p.reviewCount > 0 && p.rating > 0 ? `${p.rating.toFixed(1).replace(".", ",")} (${p.reviewCount})` : SEM_DADO,
    ),
  ];
}
