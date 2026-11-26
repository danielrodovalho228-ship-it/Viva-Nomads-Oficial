/*
  E1074 — o falhar-fechado da leitura nova dos recibos e comprovantes (documentos_fiscais), pelo COMPORTAMENTO (o
  padrão da ORDEM-DUET-1059 no E1069). Nas duas cargas do pacote de provas — a das partes (carregarProvas) e a da equipe
  (carregarContratoAdmin) — se a leitura de documentos_fiscais falhar, a carga LANÇA (a rota responde 503, nada é
  registrado): não sai pacote com "ainda não emitido" no lugar de um recibo que existe. Controlo: com a leitura boa, o
  número do recibo e o do comprovante chegam ao pagamento certo.
  Corre os módulos REAIS com o cliente Supabase falso (harness em ./e1074-harness/loader.mjs).
  Roda: node --test src/lib/data/e1074-provas-falha-fechada.test.ts
*/
import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

register("./e1074-harness/loader.mjs", import.meta.url);
const { carregarProvas } = await import("./contrato-provas.ts");
const { carregarContratoAdmin } = await import("./contrato-admin.ts");

const g = globalThis as unknown as { __e1074Db: unknown; __e1074Base: unknown };
const CONTRATO = "11111111-2222-4333-8444-555555555555";
const PAG_ALUGUEL = "aaaaaaaa-0000-4000-8000-000000000001";
const PAG_CAUCAO = "aaaaaaaa-0000-4000-8000-000000000002";

const PAGAMENTOS = [
  { id: PAG_ALUGUEL, tipo: "aluguel", valor: 2500, forma: "pix", data_pagamento: "2026-11-20", confirmado_pelo_inquilino: true, confirmado_em: "2026-11-20T22:31:00Z", anulado_em: null, anulado_motivo: null, created_at: "2026-11-20T22:20:00Z" },
  { id: PAG_CAUCAO, tipo: "caucao", valor: 5000, forma: "pix", data_pagamento: "2026-11-20", confirmado_pelo_inquilino: true, confirmado_em: "2026-11-20T22:32:00Z", anulado_em: null, anulado_motivo: null, created_at: "2026-11-20T22:21:00Z" },
];
const DOCUMENTOS = [
  { tipo: "recibo_aluguel", numero: "REC-2026-000123", pagamento_id: PAG_ALUGUEL, anulado_em: null },
  { tipo: "comprovante_caucao", numero: "CAU-2026-000045", pagamento_id: PAG_CAUCAO, anulado_em: null },
];

/** Cliente falso: cada tabela devolve as suas linhas; documentos_fiscais devolve o que o caso mandar. */
function dbFalso(documentos: { data: unknown; error: unknown }) {
  const lidas: string[] = [];
  const linhas: Record<string, { data: unknown; error: unknown }> = {
    contratos: { data: { created_at: "2026-11-20T18:00:00Z", assinado_proprietario_em: null, assinado_inquilino_em: null, property_id: null, aluguel_mensal: 2500, prazo_total_dias: 30, comissao_valor: null, comissao_percent: null, leads: null, properties: null, contrato_blocos: [] }, error: null },
    contrato_assinaturas: { data: [], error: null },
    pagamentos_bloco: { data: PAGAMENTOS, error: null },
    conferencias: { data: [], error: null },
    contrato_aditivos: { data: [], error: null },
    documentos_fiscais: documentos,
  };
  return {
    lidas,
    from(tabela: string) {
      lidas.push(tabela);
      const r = linhas[tabela] ?? { data: [], error: null };
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "is", "not", "limit"]) b[m] = () => b;
      b.maybeSingle = async () => r;
      b.single = async () => r;
      b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(r).then(ok, ko);
      return b;
    },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: null }), createSignedUrls: async () => ({ data: [], error: null }) }) },
  };
}

const FALHA = { data: null, error: { message: "permission denied for table documentos_fiscais" } };

test("1. partes: a leitura de documentos_fiscais falha → carregarProvas LANÇA (a rota responde 503)", async () => {
  const db = dbFalso(FALHA);
  g.__e1074Db = db;
  await assert.rejects(carregarProvas(CONTRATO), /Não foi possível ler o contrato para o pacote de provas/);
  assert.ok(db.lidas.includes("documentos_fiscais"), "a carga tem de ter tentado ler os documentos");
});

test("2. partes, controlo: com a leitura boa, cada pagamento leva o número do seu documento", async () => {
  g.__e1074Db = dbFalso({ data: DOCUMENTOS, error: null });
  const d = await carregarProvas(CONTRATO);
  assert.ok(d);
  assert.deepEqual(d.pagamentos.map((p) => [p.tipo, p.documento]), [["aluguel", "REC-2026-000123"], ["caucao", "CAU-2026-000045"]]);
});

test("3. equipe: a leitura de documentos_fiscais falha → carregarContratoAdmin LANÇA", async () => {
  const db = dbFalso(FALHA);
  g.__e1074Db = db;
  g.__e1074Base = { id: CONTRATO };
  await assert.rejects(carregarContratoAdmin(CONTRATO), /documentos_fiscais/);
  assert.ok(db.lidas.includes("documentos_fiscais"), "a carga tem de ter tentado ler os documentos");
});
