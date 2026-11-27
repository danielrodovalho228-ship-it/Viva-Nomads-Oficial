/*
  E1199 (ORDEM-DUET-936; família do E1141) — o e-mail da assinatura lê a proposta DO CONTRATO.
  Antes: ao assinar, o quadro do e-mail (o total e as contas) lia `propostaAcordadaDoLead` — a proposta aceite MAIS
  RECENTE da candidatura —, não a proposta de que o contrato nasceu (`contratos.proposta_id`). Com o E1141, o contrato
  de uma estadia ANTERIOR pode ser gerado: ao assinar, o e-mail mostraria o total da estadia nova.
  Depois: o e-mail lê a proposta do contrato (a mesma leitura do fecho, `propostaDoFechamentoDoLead`, com o id dela).
  Massa: duas estadias da mesma candidatura (a ORC antiga e a nova, com valores diferentes).
  Roda: node --test src/lib/notifications/e1199-email-da-assinatura-proposta-do-contrato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../propostas/e722-tela-harness/proposta.ts"; // registra o loader (server-only e os atalhos @/)
import { contaDoContrato } from "./dados-negociacao.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

const { propostaDoFechamentoDoLead, propostaAcordadaDoLead } = await import("../data/propostas-servidor.ts");

/** Supabase de serviço em memória: select + eq/in/order/limit + maybeSingle (o order segue `aceita_em` desc). */
function banco(tabelas: Record<string, Record<string, unknown>[]>) {
  return {
    from(t: string) {
      const f: ((l: Record<string, unknown>) => boolean)[] = [];
      let porData = false;
      const b = {
        select: () => b,
        eq: (c: string, v: unknown) => (f.push((l) => l[c] === v), b),
        in: (c: string, vs: unknown[]) => (f.push((l) => vs.includes(l[c])), b),
        order: (c: string) => ((porData = c === "aceita_em"), b),
        limit: () => b,
        maybeSingle: async () => {
          const linhas = (tabelas[t] ?? []).filter((l) => f.every((x) => x(l)));
          if (porData) linhas.sort((a, z) => String(z.aceita_em).localeCompare(String(a.aceita_em)));
          return { data: linhas[0] ?? null, error: null };
        },
      };
      return b;
    },
  } as never;
}

const versao = (proposta_id: string, valor_mensal: number) => ({
  proposta_id, versao: 1, valor_mensal, meses: 2, dias: 60, data_entrada: "2026-12-20", condominio: 300, consumo: 0, limpezas_mes: 0, limpezas_pacote: null, valor_limpeza: 0, taxa_pet: 0, limpeza_unica: 0,
});
const ANTIGA = "11111111-0000-0000-0000-000000000015";
const NOVA = "11111111-0000-0000-0000-000000000019";
const DUAS_ESTADIAS = () =>
  banco({
    propostas: [
      { id: ANTIGA, lead_id: "l1", numero: "ORC-2026-0015", versao_atual: 1, taxa_congelada: 0.12, status: "em_contrato", aceita_em: "2026-11-21T10:00:00Z" },
      { id: NOVA, lead_id: "l1", numero: "ORC-2026-0019", versao_atual: 1, taxa_congelada: 0.08, status: "contrato_assinado", aceita_em: "2026-11-22T10:00:00Z" },
    ],
    proposta_versoes: [versao(ANTIGA, 3100), versao(NOVA, 2800)],
  });

test("duas estadias: a proposta do contrato da estadia ANTERIOR dá o total DELA, não o da mais recente", async () => {
  const admin = DUAS_ESTADIAS();
  const doContrato = await propostaDoFechamentoDoLead(admin, "l1", ANTIGA);
  assert.ok(doContrato && typeof doContrato === "object");
  assert.equal(doContrato.numero, "ORC-2026-0015");
  assert.equal(doContrato.valorMensal, 3100);
  const maisRecente = (await propostaAcordadaDoLead(admin, "l1"))!;
  assert.equal(maisRecente.numero, "ORC-2026-0019", "a leitura antiga devolvia a nova");
  assert.notEqual(contaDoContrato(doContrato), contaDoContrato(maisRecente), "os dois totais diferem: o e-mail tem de ler o certo");
});

test("a fiação: o e-mail da assinatura lê a proposta pelo proposta_id do contrato", () => {
  const src = fonteSemComentarios(readFileSync("src/lib/data/contrato-assinar-actions.ts", "utf8"));
  assert.match(src, /from\("contratos"\)\.select\("lead_id, proposta_id, contrato_blocos\(caucao\)"\)\.eq\("id", c\.id\)/, "a mesma leitura traz a proposta do contrato");
  assert.match(src, /propostaDoFechamentoDoLead\(admin, leadDoContrato, propostaDoContrato\)/);
  assert.doesNotMatch(src, /propostaAcordadaDoLead\(admin, leadDoContrato\)/, "nunca a proposta mais recente da candidatura");
  assert.match(src, /contaTotal: contaDoContrato\(acordadaDoContrato\),\s*contas: contasDoContrato\(acordadaDoContrato\),/);
});
