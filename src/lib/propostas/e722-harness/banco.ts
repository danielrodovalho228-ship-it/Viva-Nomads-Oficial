/*
  Harness de teste (Pista 3, lote 2 — bloco E do E722): banco em memória com o pedaço da API do Supabase que o
  pre-aceitacao-servidor.ts usa (select/update + eq/is/not + maybeSingle/then). Guarda cada UPDATE pedido, para o teste
  provar o que foi escrito (ex.: taxa_congelada nunca). Não entra no app; só os testes o importam.
*/
import { register } from "node:module";

register("./loader.mjs", import.meta.url);

type Linha = Record<string, unknown>;
type Filtro = (l: Linha) => boolean;

export interface Mundo {
  agora: Date | null;
  avisos: { userId: string; subject: string; corpo: string; em: Date | null }[];
  /** Mensagem de conflito de período por imóvel (null = datas livres). */
  conflito: (propertyId: string) => Promise<string | null>;
}

export function novoBanco(tabelas: Record<string, Linha[]>) {
  const updates: { tabela: string; valores: Linha }[] = [];
  const lidas: string[] = [];
  function from(tabela: string) {
    lidas.push(tabela);
    const filtros: Filtro[] = [];
    let valores: Linha | null = null;
    const linhas = () => (tabelas[tabela] ?? []).filter((l) => filtros.every((f) => f(l)));
    const executar = () => {
      const achadas = linhas();
      if (valores) {
        updates.push({ tabela, valores: { ...valores } });
        for (const l of achadas) Object.assign(l, valores);
      }
      return achadas.map((l) => ({ ...l }));
    };
    const b = {
      select: () => b,
      update: (v: Linha) => ((valores = v), b),
      eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), b),
      is: (c: string, v: unknown) => (filtros.push((l) => (l[c] ?? null) === v), b),
      not: (c: string, op: string, v: unknown) => (filtros.push((l) => (op === "is" ? (l[c] ?? null) !== v : true)), b),
      maybeSingle: async () => ({ data: executar()[0] ?? null, error: null }),
      then: (ok: (r: unknown) => unknown, erro?: (e: unknown) => unknown) => Promise.resolve({ data: executar(), error: null }).then(ok, erro),
    };
    return b;
  }
  return { admin: { from } as never, tabelas, updates, lidas };
}

export function novoMundo(): Mundo {
  const g = globalThis as unknown as { __E722: Mundo };
  g.__E722 = { agora: null, avisos: [], conflito: async () => null };
  return g.__E722;
}

/** Uma proposta aceita em pré-aceitação, com o morador e o dono que recebem os avisos. */
export function cenario(p: { id?: string; prazo: Date; reaberturas?: number; taxa?: number | null; entrada?: string; aceitaEm?: Date; property?: string; tenant?: string }) {
  const id = p.id ?? "prop-1";
  const tenant = p.tenant ?? `morador-${id}`;
  return {
    propostas: [
      {
        id, numero: `PR-${id}`, owner_id: "dono-1", tenant_id: tenant, lead_id: `lead-${id}`, property_id: p.property ?? "imovel-1", versao_atual: 1, status: "aceita",
        aceita_em: (p.aceitaEm ?? new Date(p.prazo.getTime() - 72 * 3_600_000)).toISOString(),
        pre_aceitacao_reaberturas: p.reaberturas ?? 0, pre_aceitacao_ate: p.prazo.toISOString(), pre_aceitacao_lembrete_24h_em: null, pre_aceitacao_lembrete_6h_em: null,
        pre_aceitacao_expirou_em: null, pre_aceitacao_perdeu_em: null, pre_aceitacao_encerrada_em: null, pre_aceitacao_dono_ate: null,
        taxa_congelada: p.taxa === undefined ? 0.08 : p.taxa, properties: { title: "Apto Centro" },
      },
    ] as Linha[],
    proposta_versoes: [{ proposta_id: id, versao: 1, data_entrada: p.entrada ?? "2026-12-20" }] as Linha[],
    profiles: [
      { id: tenant, email: `${tenant}@teste.invalid`, full_name: "Morador" },
      { id: "dono-1", email: "dono-1@teste.invalid", full_name: "Dono" },
    ] as Linha[],
  };
}
