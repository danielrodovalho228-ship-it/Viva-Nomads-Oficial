/**
 * Fotógrafos parceiros — regras puras (ordem 46edeaa5).
 * A taxa fixa por pedido saiu no complemento do Prompt 29: vale a taxa de serviço de 10% sobre o
 * valor do serviço (config/taxa-servico-parceiros.ts). a coluna do valor fixo em fotografo_pedidos fica obsoleta (nem lida nem escrita).
 */
import { mesmaCidade } from "../cidades.ts";
import { lerReais } from "../reais.ts";

export const MAX_DIAS_ANTECEDENCIA = 90;

export type StatusPedido = "enviado" | "aceito" | "recusado" | "cancelado" | "entregue" | "concluido";

export interface FotografoPublico {
  id: string;
  nome_comercial: string;
  cidades: string[];
  portfolio_url: string | null;
  pacote_fotos: number;
  pacote_prazo_dias: number;
  pacote_preco: number;
  nota_media: number | null;
  avaliacoes_qtd: number;
}

/** CEP só com 8 dígitos, ou null. */
export function normalizarCep(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length === 8 ? d : null;
}

export function formatarCep(cep: string): string {
  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

/** O fotógrafo atende a cidade (lista de cidades atendidas, sem diferenciar acento/caixa). */
export function atendeCidade(f: Pick<FotografoPublico, "cidades">, cidade: string): boolean {
  return f.cidades.some((c) => mesmaCidade(c, cidade));
}

export function filtrarPorCidade<T extends Pick<FotografoPublico, "cidades">>(lista: readonly T[], cidade: string): T[] {
  return lista.filter((f) => atendeCidade(f, cidade));
}

/**
 * Contato e endereço do dono só são liberados ao fotógrafo com o pedido aceito E a taxa paga.
 * (O banco também barra: check fotografo_pedidos_aceite_exige_taxa.)
 */
export function contatoLiberado(p: { status: string; taxa_paga_em: string | null | undefined }): boolean {
  return (p.status === "aceito" || p.status === "entregue" || p.status === "concluido") && !!p.taxa_paga_em;
}

/** O fotógrafo só pode aceitar depois de pagar a taxa de parceria. */
export function podeAceitar(p: { status: string; taxa_paga_em: string | null | undefined }): boolean {
  return p.status === "enviado" && !!p.taxa_paga_em;
}

export function taxaValida(v: unknown): number | null {
  const lido = lerReais(typeof v === "number" ? v : String(v ?? ""));
  const n = lido.ok && lido.valor != null ? lido.valor : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 10000 ? Math.round(n * 100) / 100 : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export interface PedidoEntrada {
  fotografoId: unknown;
  cep: unknown;
  cidade: unknown;
  uf: unknown;
  data: unknown;
  observacao: unknown;
}
export interface PedidoValido {
  fotografo_id: string;
  cep: string;
  cidade: string;
  uf: string;
  data_sugerida: string;
  observacao: string | null;
}

/** Valida o pedido no servidor (formato, tamanho, data). `hoje` = AAAA-MM-DD. */
export function validarPedido(e: PedidoEntrada, hoje: string): { ok: true; dados: PedidoValido } | { ok: false; erro: string } {
  if (!ehUuid(e.fotografoId)) return { ok: false, erro: "Escolha um fotógrafo da lista." };
  const cep = normalizarCep(e.cep);
  if (!cep) return { ok: false, erro: "Informe o CEP do imóvel com 8 dígitos." };
  const cidade = String(e.cidade ?? "").trim();
  if (cidade.length < 2 || cidade.length > 80) return { ok: false, erro: "Informe a cidade do imóvel." };
  const uf = String(e.uf ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) return { ok: false, erro: "Informe o estado do imóvel (UF)." };
  const data = String(e.data ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T00:00:00Z`))) return { ok: false, erro: "Informe a data sugerida." };
  if (data < hoje) return { ok: false, erro: "A data sugerida não pode ser no passado." };
  const limite = new Date(Date.parse(`${hoje}T00:00:00Z`) + MAX_DIAS_ANTECEDENCIA * 86400000).toISOString().slice(0, 10);
  if (data > limite) return { ok: false, erro: `Escolha uma data nos próximos ${MAX_DIAS_ANTECEDENCIA} dias.` };
  const obs = String(e.observacao ?? "").trim();
  if (obs.length > 300) return { ok: false, erro: "A observação pode ter até 300 caracteres." };
  return { ok: true, dados: { fotografo_id: e.fotografoId, cep, cidade, uf, data_sugerida: data, observacao: obs || null } };
}

/** Link de portfólio só https (Instagram/site); qualquer outra coisa é descartada. */
export function portfolioSeguro(url: unknown): string | null {
  if (typeof url !== "string" || url.length > 300) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Cidade/UF de um CEP via ViaCEP (fetch injetável para teste). Falha → null. */
export async function cidadeDoCep(
  cep: string,
  buscar: typeof fetch = fetch
): Promise<{ cidade: string; uf: string } | null> {
  const c = normalizarCep(cep);
  if (!c) return null;
  try {
    const res = await buscar(`https://viacep.com.br/ws/${c}/json/`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const d = (await res.json()) as { erro?: unknown; localidade?: unknown; uf?: unknown };
    if (d.erro || typeof d.localidade !== "string" || typeof d.uf !== "string") return null;
    return { cidade: d.localidade, uf: d.uf.toUpperCase() };
  } catch {
    return null;
  }
}

/** E52 (onda 1C): "Buscar" com CEP e cidade vazios avisa o que fazer, em vez de recarregar a página em silêncio. */
export const MSG_BUSCA_VAZIA = "Digite a cidade ou o CEP para buscar.";
/** Busca enviada (os dois campos vieram na URL) e os dois vazios. */
export const buscaVazia = (cep: string | undefined, cidade: string | undefined): boolean =>
  cep !== undefined && cidade !== undefined && !cep.trim() && !cidade.trim();
