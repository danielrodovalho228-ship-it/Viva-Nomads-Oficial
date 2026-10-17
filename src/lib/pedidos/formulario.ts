/*
  Formulário do pedido de moradia (prompt 12). Módulo puro: a lista do IBGE entra por parâmetro
  (src/lib/municipios.ts a carrega), para o teste rodar sem o JSON inteiro.
*/
import { chaveCidade } from "../cidades.ts";

/** Tamanho máximo da apresentação do pedido (contador "0/500" na tela; o servidor confere). */
export const APRESENTACAO_MAX = 500;

export interface CidadeUf {
  cidade: string;
  uf: string;
  /** "Uberlândia – MG", o que aparece na lista e no campo. */
  rotulo: string;
}

export function rotuloCidade(cidade: string, uf: string): string {
  return cidade && uf ? `${cidade} – ${uf}` : cidade;
}

/** Separa "Uberlândia – MG", "Uberlândia - MG", "Uberlândia/MG" ou "Uberlândia, MG" em nome e UF. */
function separar(texto: string): { nome: string; uf: string } {
  const m = String(texto ?? "").match(/^(.*?)[\s]*[–—\-/,][\s]*([A-Za-z]{2})\s*$/);
  if (m) return { nome: m[1], uf: m[2].toUpperCase() };
  return { nome: String(texto ?? ""), uf: "" };
}

/**
 * Sugestões do autocomplete: até `limite` cidades de todo o Brasil cujo nome bate com o que a pessoa digitou
 * (sem acento). Primeiro o nome exato, depois as que começam com o termo, depois as que contêm; empate em ordem
 * alfabética. Com "– UF" no fim, filtra a UF.
 */
export function buscarCidades(municipios: Record<string, readonly string[]>, termo: string, limite = 8): CidadeUf[] {
  const { nome, uf } = separar(termo);
  const k = chaveCidade(nome);
  if (k.length < 2) return [];
  const achadas: { c: CidadeUf; peso: number; k: string }[] = [];
  for (const [u, lista] of Object.entries(municipios)) {
    if (uf && u !== uf) continue;
    for (const cidade of lista) {
      const kc = chaveCidade(cidade);
      const peso = kc === k ? 0 : kc.startsWith(k) ? 1 : kc.includes(k) ? 2 : -1;
      if (peso >= 0) achadas.push({ c: { cidade, uf: u, rotulo: rotuloCidade(cidade, u) }, peso, k: kc });
    }
  }
  achadas.sort((a, b) => a.peso - b.peso || a.k.localeCompare(b.k) || a.c.uf.localeCompare(b.c.uf));
  return achadas.slice(0, Math.max(0, limite)).map((a) => a.c);
}

/**
 * Cidade + UF oficiais a partir do texto do campo: "Uberlândia – MG" (o que a lista grava) ou só "Uberlândia"
 * quando o nome existe numa UF só. Nome repetido em mais de uma UF sem a UF → null (a pessoa escolhe na lista).
 */
export function lerCidadeUf(municipios: Record<string, readonly string[]>, texto: string): { cidade: string; uf: string } | null {
  const { nome, uf } = separar(texto);
  const k = chaveCidade(nome);
  if (!k) return null;
  const achadas: { cidade: string; uf: string }[] = [];
  for (const [u, lista] of Object.entries(municipios)) {
    if (uf && u !== uf) continue;
    const cidade = lista.find((c) => chaveCidade(c) === k);
    if (cidade) achadas.push({ cidade, uf: u });
  }
  return achadas.length === 1 ? achadas[0] : null;
}

/** Só os dígitos do valor (sem zeros à esquerda), até 7 dígitos (R$ 9.999.999). */
export function soDigitos(v: string): string {
  return String(v ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 7);
}

/** Máscara de milhar do campo de valor: "3500" → "3.500". Vazio fica vazio. */
export function mascararMilhar(v: string): string {
  const d = soDigitos(v);
  if (!d) return "";
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Contador do rodapé (prompt 12): frase discreta conforme quantos imóveis combinam agora. */
export function fraseContador(combinam: number): string {
  if (combinam > 0) return `${combinam} ${combinam === 1 ? "imóvel combina" : "imóveis combinam"} com seu pedido agora`;
  return "Nenhum imóvel ainda — seu pedido avisa quando entrar um";
}
