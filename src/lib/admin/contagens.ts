/*
  ADMIN-4 — números do /admin de UMA fonte só (PURO). Cada número tem uma função; a inicial e a página de destino
  chamam a MESMA (src/lib/data/admin-contagens.ts). A regra das contas de teste é uma só (profiles.is_teste, 0181) e o
  número aparece como "N reais · M de teste" onde as duas coisas existem. Sem denominador, a razão é "—".
*/
export interface Contagem {
  reais: number;
  teste: number;
}

export interface NumeroDoAdmin {
  chave: "estadias" | "anuncios" | "pedidos" | "chamados";
  rotulo: string;
  href: string;
  contagem: Contagem;
}

/** Separa as linhas pela regra única das contas de teste. */
export function contarRealETeste<T>(linhas: readonly T[], ehTeste: (l: T) => boolean): Contagem {
  let teste = 0;
  for (const l of linhas) if (ehTeste(l)) teste++;
  return { reais: linhas.length - teste, teste };
}

/** "3 reais · 1 de teste"; sem teste, só "3 reais"; o singular sai certo. */
export function textoRealTeste(c: Contagem): string {
  const reais = `${c.reais} ${c.reais === 1 ? "real" : "reais"}`;
  return c.teste > 0 ? `${reais} · ${c.teste} de teste` : reais;
}

/** Razão para exibir: sem denominador (0) é "—", nunca "8 de 0" nem "0 por 100". */
export function razaoOuTraco(numerador: number, denominador: number, formatar: (x: number) => string = (x) => String(x)): string {
  if (!Number.isFinite(denominador) || denominador <= 0) return "—";
  return formatar(numerador / denominador);
}

export const ROTULOS_NUMEROS: Record<NumeroDoAdmin["chave"], { rotulo: string; href: string }> = {
  estadias: { rotulo: "Estadias ativas", href: "/admin/contratos?status=ativo" },
  anuncios: { rotulo: "Anúncios publicados", href: "/admin/imoveis?tipo=real" },
  pedidos: { rotulo: "Pedidos de moradia no ar", href: "/admin/pedidos" },
  chamados: { rotulo: "Chamados abertos", href: "/admin/atendimento" },
};

export const RODAPE_CONTAGENS = "Contas de teste não entram nestas contagens.";

/** "Precisa da sua atenção": os 5 primeiros, sem duplicata (mesma chave), na ordem que chegaram. */
export function primeirosSemDuplicata<T>(itens: readonly T[], chave: (x: T) => string, n = 5): T[] {
  const vistos = new Set<string>();
  const out: T[] = [];
  for (const i of itens) {
    const k = chave(i);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(i);
    if (out.length === n) break;
  }
  return out;
}

/** Base escrita de uma etapa do funil: "3 de 10." — sem base (total 0) é "Base: —." em vez de "8 de 0.". */
export function baseDoFunil(tipo: "percentual" | "horas", base: { de: number; total: number }): string {
  if (base.total <= 0) return "Base: —.";
  return tipo === "percentual" ? `${base.de} de ${base.total}.` : `${base.total} tempo(s).`;
}
