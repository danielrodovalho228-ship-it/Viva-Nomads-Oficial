import { chaveCidade } from "../cidades.ts";

/*
  Cidades liberadas (ordem 335b4064). Módulo puro: a lista vem do banco (tabela cidades_liberadas, leitura pública).
  Sem coordenada, sem endereço: só nome de cidade e UF.
*/

export type CidadeLiberada = { uf: string; chave: string; cidade: string; liberada: boolean };
export type PapelInteresse = "proprietario" | "inquilino";

export const PAPEIS_INTERESSE: readonly PapelInteresse[] = ["proprietario", "inquilino"];

const UF = /^[A-Z]{2}$/;

/** A cidade está liberada? Sem UF (anúncio antigo só guarda o nome), vale qualquer UF com esse nome. */
export function cidadeLiberada(lista: readonly CidadeLiberada[], cidade: string | null | undefined, uf?: string | null): boolean {
  const chave = chaveCidade(cidade);
  if (!chave) return false;
  const ufN = (uf ?? "").trim().toUpperCase();
  return lista.some((c) => c.liberada && c.chave === chave && (!UF.test(ufN) || c.uf === ufN));
}

/** Texto do convite (busca, pedido e cadastro de imóvel). */
export function mensagemCidadeNaoLiberada(cidade: string): string {
  return `A Viva ainda não chegou em ${cidade.trim()}. Deixe seu interesse e avisamos quando abrir.`;
}

export type InteresseValido = { ok: true; uf: string; chave: string; cidade: string; papel: PapelInteresse } | { ok: false; erro: string };

/** Valida o interesse no servidor: nome 2–80 sem caracteres de controle, UF de 2 letras, papel conhecido. */
export function validarInteresse(entrada: { cidade?: unknown; uf?: unknown; papel?: unknown }): InteresseValido {
  const cidade = String(entrada.cidade ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const uf = String(entrada.uf ?? "").trim().toUpperCase();
  const papel = String(entrada.papel ?? "");
  if (cidade.length < 2 || cidade.length > 80) return { ok: false, erro: "Informe a cidade." };
  if (!UF.test(uf)) return { ok: false, erro: "Escolha a cidade na lista de sugestões." };
  if (!(PAPEIS_INTERESSE as readonly string[]).includes(papel)) return { ok: false, erro: "Informe se você é proprietário ou inquilino." };
  return { ok: true, uf, chave: chaveCidade(cidade), cidade, papel: papel as PapelInteresse };
}

export type LinhaInteresse = { uf: string; chave: string; cidade: string; papel: PapelInteresse };
export type RankingCidade = { uf: string; chave: string; cidade: string; proprietarios: number; inquilinos: number; total: number };

/** Ranking de interesse por cidade (proprietários × inquilinos), maior total primeiro — serve para direcionar tráfego pago. */
export function rankingInteresse(linhas: readonly LinhaInteresse[]): RankingCidade[] {
  const mapa = new Map<string, RankingCidade>();
  for (const l of linhas) {
    const k = `${l.uf}:${l.chave}`;
    const r = mapa.get(k) ?? { uf: l.uf, chave: l.chave, cidade: l.cidade, proprietarios: 0, inquilinos: 0, total: 0 };
    if (l.papel === "proprietario") r.proprietarios += 1;
    else r.inquilinos += 1;
    r.total += 1;
    mapa.set(k, r);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total || a.cidade.localeCompare(b.cidade, "pt-BR"));
}
