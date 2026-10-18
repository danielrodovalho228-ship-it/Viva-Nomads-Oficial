import { ufBateComCep } from "./faixas-uf.ts";

/**
 * CEP que sempre responde (prompt 20). Devolve SEMPRE um resultado que a tela transforma em mensagem: com rua, só a
 * cidade (CEP geral), não encontrado ou sem rede. Nada de `catch` mudo.
 * Prompt 25: o ViaCEP é a fonte. Quando ele diz "não existe", a resposta é DEFINITIVA — a BrasilAPI inventava
 * endereço (99999-999 → "Avenida das Torres, Sarandi/PR", service "open-cep"). A BrasilAPI só entra quando o ViaCEP
 * FALHA (rede, 5xx, tempo esgotado), e a resposta dela só vale se a UF bater com a faixa do CEP (Correios).
 *
 * O `buscar` é injetável (os testes simulam as respostas; a tela usa o `fetch` do navegador).
 */

export type ResultadoCep =
  | { tipo: "rua"; rua: string; bairro: string; cidade: string; uf: string }
  | { tipo: "cidade"; cidade: string; uf: string }
  | { tipo: "nao_encontrado" }
  | { tipo: "sem_rede" };

export type Buscar = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export const URL_VIACEP = "https://viacep.com.br/ws";
export const URL_BRASILAPI = "https://brasilapi.com.br/api/cep/v2";

/** Só os 8 dígitos; qualquer outra coisa → null. */
export function digitosCep(valor: string): string | null {
  const d = valor.replace(/\D/g, "");
  return d.length === 8 ? d : null;
}

/** "38400100" → "38400-100". */
export function formatarCep(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function montar(rua: string, bairro: string, cidade: string, uf: string): ResultadoCep | null {
  if (!cidade) return null;
  const u = uf.slice(0, 2).toUpperCase();
  return rua ? { tipo: "rua", rua, bairro, cidade, uf: u } : { tipo: "cidade", cidade, uf: u };
}

/** Uma fonte: resultado, "não achou" (resposta definitiva) ou null (falha de rede/servidor). */
type Fonte = ResultadoCep | "nao_achou" | null;

async function viaCep(cep: string, buscar: Buscar): Promise<Fonte> {
  try {
    const r = await buscar(`${URL_VIACEP}/${cep}/json/`);
    if (r.status === 400 || r.status === 404) return "nao_achou";
    if (!r.ok) return null;
    const d = (await r.json()) as Record<string, unknown>;
    if (d.erro === true || d.erro === "true") return "nao_achou";
    return montar(txt(d.logradouro), txt(d.bairro), txt(d.localidade), txt(d.uf)) ?? "nao_achou";
  } catch {
    return null;
  }
}

async function brasilApi(cep: string, buscar: Buscar): Promise<Fonte> {
  try {
    const r = await buscar(`${URL_BRASILAPI}/${cep}`);
    if (r.status === 404 || r.status === 400) return "nao_achou";
    if (!r.ok) return null;
    const d = (await r.json()) as Record<string, unknown>;
    // Conferência de sanidade: UF fora da faixa do CEP = endereço inventado → "não achou".
    if (!ufBateComCep(cep, txt(d.state))) return "nao_achou";
    return montar(txt(d.street), txt(d.neighborhood), txt(d.city), txt(d.state)) ?? "nao_achou";
  } catch {
    return null;
  }
}

/** ViaCEP; a BrasilAPI só quando o ViaCEP FALHA. "Sem rede" só quando nenhuma das duas respondeu de forma definitiva. */
export async function buscarCep(valor: string, buscar: Buscar): Promise<ResultadoCep> {
  const cep = digitosCep(valor);
  if (!cep) return { tipo: "nao_encontrado" };
  const a = await viaCep(cep, buscar);
  if (a === "nao_achou") return { tipo: "nao_encontrado" }; // definitivo: a BrasilAPI NÃO é chamada
  if (a) return a; // rua ou CEP geral (só cidade)
  const b = await brasilApi(cep, buscar); // ViaCEP fora do ar
  if (b && b !== "nao_achou") return b;
  return b === null ? { tipo: "sem_rede" } : { tipo: "nao_encontrado" };
}

export interface OpcaoEndereco {
  cep: string;
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
}

/** Mínimos do ViaCEP para a busca pelo endereço (UF, cidade e rua com 3+ letras). */
export function podeBuscarEndereco(uf: string, cidade: string, rua: string): boolean {
  return /^[A-Za-z]{2}$/.test(uf.trim()) && cidade.trim().length >= 3 && rua.trim().length >= 3;
}

/**
 * "Buscar pelo endereço": busca reversa do ViaCEP (/ws/UF/cidade/rua/json/), até 5 opções para tocar.
 * Sem rede ou nada encontrado → lista vazia + o motivo, para a tela dizer o que houve.
 */
export async function buscarPorEndereco(
  uf: string,
  cidade: string,
  rua: string,
  buscar: Buscar,
): Promise<{ opcoes: OpcaoEndereco[]; semRede: boolean }> {
  if (!podeBuscarEndereco(uf, cidade, rua)) return { opcoes: [], semRede: false };
  const url = `${URL_VIACEP}/${encodeURIComponent(uf.trim().toUpperCase())}/${encodeURIComponent(cidade.trim())}/${encodeURIComponent(rua.trim())}/json/`;
  try {
    const r = await buscar(url);
    if (!r.ok) return { opcoes: [], semRede: r.status >= 500 };
    const lista = (await r.json()) as unknown;
    if (!Array.isArray(lista)) return { opcoes: [], semRede: false };
    const opcoes = lista
      .map((o) => o as Record<string, unknown>)
      .map((o) => ({ cep: formatarCep(txt(o.cep)), rua: txt(o.logradouro), bairro: txt(o.bairro), cidade: txt(o.localidade), uf: txt(o.uf).toUpperCase() }))
      .filter((o) => digitosCep(o.cep) && o.rua);
    return { opcoes: opcoes.slice(0, 5), semRede: false };
  } catch {
    return { opcoes: [], semRede: true };
  }
}

/** Mensagem da tela para cada resultado (uma frase; o link "buscar pelo endereço" é a tela que põe). */
export function mensagemCep(r: ResultadoCep): string {
  switch (r.tipo) {
    case "rua":
      return "Endereço encontrado";
    case "cidade":
      return "Este CEP é da cidade toda — digite a rua";
    case "nao_encontrado":
      return "Não encontramos esse CEP — buscar pelo endereço";
    case "sem_rede":
      return "Não conseguimos buscar agora — preencha o endereço abaixo";
  }
}
