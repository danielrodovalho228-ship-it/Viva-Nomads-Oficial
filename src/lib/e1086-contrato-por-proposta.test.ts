/*
  E1086 (ORDEM-DUET-420) — cada proposta aceita gera o SEU contrato.
  Prova ao vivo de 21/11: a proposta ORC-2026-0018 (aceita, datas novas) abriu no Fechamento o contrato JÁ ASSINADO de
  outra estadia; "Gerar contrato" não criou contrato nem mandou e-mail. Causa: reserva, registro e índice único eram
  por CANDIDATURA, e a candidatura é uma só por morador + imóvel.
  Roda: node --test src/lib/e1086-contrato-por-proposta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filtroDaChave, PROPOSTA_NENHUMA } from "./contrato-da-proposta.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("a chave do fechamento é a proposta acordada: com proposta filtra por ela; sem proposta, só as linhas SEM proposta", () => {
  // A estadia nova (p2) nunca enxerga a reserva nem o contrato da proposta p1 da mesma candidatura.
  assert.deepEqual(filtroDaChave("p2"), { coluna: "proposta_id", valor: "p2" });
  // Fechamento antigo, sem proposta: só o que não é de proposta nenhuma (nunca o contrato de uma proposta).
  assert.deepEqual(filtroDaChave(null), { coluna: "proposta_id", valor: null });
  // O valor que o índice único do banco usa no lugar de "sem proposta" (0353).
  assert.equal(PROPOSTA_NENHUMA, "00000000-0000-0000-0000-000000000000");
  assert.match(ler("../supabase/migrations/0353_contrato_por_proposta_e1086.sql"), new RegExp(`coalesce\\(proposta_id, '${PROPOSTA_NENHUMA}'::uuid\\)`));
});

test("a rota do contrato reserva, lê e conclui pela proposta acordada", () => {
  const r = ler("app/api/contrato/route.ts");
  assert.match(r, /const chave = acordada \? acordada\.id : null;/);
  assert.match(r, /lerReservaFechamento\(f\.leadId, "contrato", chave\)/);
  assert.match(r, /reservarFechamento\(f\.leadId, "contrato", chave\)/);
  assert.equal((r.match(/concluirFechamento\(f\.leadId, "contrato", chave, /g) ?? []).length, 4);
  assert.doesNotMatch(r, /Fechamento\(f\.leadId, "contrato"\)/, "nenhuma chamada sem a proposta");
});

test("a rota da taxa de serviço cobra o contrato da proposta acordada, com reserva própria", () => {
  const r = ler("app/api/comissao/route.ts");
  assert.match(r, /const chave = contrato\.propostaId;/);
  assert.match(r, /lerReservaFechamento\(f\.leadId, "comissao", chave\)/);
  assert.match(r, /reservarFechamento\(f\.leadId, "comissao", chave\)/);
  assert.equal((r.match(/concluirFechamento\(f\.leadId, "comissao", chave, /g) ?? []).length, 3);
  assert.doesNotMatch(r, /Fechamento\(f\.leadId, "comissao"\)/, "nenhuma chamada sem a proposta");
  // O contrato lido para a taxa é o da proposta acordada (lida no servidor, nunca vinda do navegador).
  const s = ler("lib/data/fechamento-servidor.ts");
  const f = s.slice(s.indexOf("export async function comissaoDoContrato("));
  // E1141: a proposta da taxa é a do fecho (a pedida e validada, ou a de sempre).
  assert.match(f, /const acordada = await propostaDoFechamentoDoLead\(admin, leadId, propostaPedida\);/);
  assert.match(f, /contratoDoFechamentoDoLead\(admin, leadId, propostaId\)/);
});

test("o registro do contrato procura o contrato DA PROPOSTA e marca só essa proposta como 'em contrato'", () => {
  const a = ler("lib/data/actions.ts");
  const i = a.indexOf("export async function registrarContrato");
  const f = a.slice(i, a.indexOf("export async function", i + 10));
  assert.doesNotMatch(f, /from\("contratos"\)\.select\("id"\)\.eq\("lead_id", lead\.id\)\.maybeSingle\(\)/, "a procura só pela candidatura saiu");
  assert.match(f, /contratoDoFechamentoDoLead\(admin, lead\.id as string, acordada \? acordada\.id : null\)/);
  // A proposta é lida ANTES de decidir se já existe contrato.
  // E1141: a leitura chama-se `propostaDoFechamentoDoLead` (com o nome antigo, o indexOf daria -1 e a asserção passaria em vão).
  const leProposta = f.indexOf("propostaDoFechamentoDoLead(admin, lead.id as string");
  assert.ok(leProposta > 0 && leProposta < f.indexOf("contratoDoFechamentoDoLead("));
  assert.match(f, /marcarPropostaEmContrato\(admin, acordada\.id\)/);
  const s = ler("lib/data/propostas-servidor.ts");
  assert.match(s, /export async function marcarPropostaEmContrato\(admin: SupabaseClient, propostaId: string\)/);
  assert.match(s, /\.eq\("id", propostaId\)\s*\.eq\("status", "aceita"\)/);
});

test("o servidor do fechamento: a reserva e o contrato filtram pela chave; nenhuma leitura de contrato só pela candidatura", () => {
  const s = ler("lib/data/fechamento-servidor.ts");
  assert.match(s, /export async function lerReservaFechamento\(leadId: string, tipo: "comissao" \| "contrato", propostaId: string \| null\)/);
  assert.match(s, /export async function reservarFechamento\(leadId: string, tipo: "comissao" \| "contrato", propostaId: string \| null\)/);
  assert.match(s, /export async function concluirFechamento\(leadId: string, tipo: "comissao" \| "contrato", propostaId: string \| null, externoId: string \| null\)/);
  assert.match(s, /insert\(\{ lead_id: leadId, tipo, proposta_id: propostaId \}\)/);
  // Ler, reservar (limpar a vencida), liberar, concluir e achar o contrato: os cinco passam pelo mesmo filtro.
  assert.equal((s.match(/daChave\(/g) ?? []).length, 5, "os cinco usos");
  assert.doesNotMatch(s, /from\("contratos"\)\s*\.select\([^)]*\)\s*\.eq\("lead_id", leadId\)\s*\.maybeSingle\(\)/, "a leitura 'um contrato por candidatura' saiu");
});

test("o Fechamento reaberto mostra o contrato da proposta em curso (não o de outra estadia)", () => {
  const l = ler("lib/data/leads-actions.ts");
  assert.doesNotMatch(l, /select\("id, garantia"\)\.eq\("lead_id", lead\.id\)\.order/, "a leitura só pela candidatura saiu");
  assert.match(l, /acordada \? doLead\.eq\("proposta_id", acordada\.id\) : doLead\.is\("proposta_id", null\)/);
});

test("migração 0353: um contrato por proposta e a proposta na chave da reserva; produção e rollback existem", () => {
  const m = ler("../supabase/migrations/0353_contrato_por_proposta_e1086.sql");
  assert.match(m, /drop index if exists public\.contratos_lead_id_key;/);
  assert.match(m, /create unique index if not exists contratos_proposta_id_key\s+on public\.contratos \(proposta_id\) where proposta_id is not null;/);
  assert.match(m, /alter table public\.cobrancas_fechamento\s+add column if not exists proposta_id uuid references public\.propostas \(id\) on delete cascade;/);
  assert.match(m, /create unique index if not exists cobrancas_fechamento_chave\s+on public\.cobrancas_fechamento \(lead_id, tipo, coalesce\(proposta_id, '00000000-0000-0000-0000-000000000000'::uuid\)\);/);
  // As reservas que já existem ficam com a proposta do contrato delas.
  assert.match(m, /update public\.cobrancas_fechamento cf\s+set proposta_id = c\.proposta_id/);
  // O painel do admin junta a taxa paga com o contrato DELA.
  assert.match(m, /left join contratos c on c\.lead_id = cf\.lead_id and c\.proposta_id is not distinct from cf\.proposta_id/);
  // ORDEM-DUET-426: a migração NÃO toca nos contratos (os legados sem proposta ficam sem proposta) e a reserva de uma
  // candidatura que JÁ tem contrato nunca é ligada à proposta aceita mais recente (seria ligar a estadia antiga à nova).
  assert.doesNotMatch(m, /update public\.contratos\b/);
  assert.doesNotMatch(m, /alter table public\.contratos\b/);
  assert.match(m, /where cf\.proposta_id is null\s+and not exists \(select 1 from public\.contratos c where c\.lead_id = cf\.lead_id\);/);
  assert.match(m, /where c\.lead_id = cf\.lead_id and c\.proposta_id is not null;/);
  const p = ler("../supabase/producao/aplicar-0353.sql");
  assert.match(p, /^begin;$/m);
  assert.match(p, /^commit;$/m);
  assert.match(p, /'20261122000353', '0353_contrato_por_proposta_e1086'/);
  assert.match(ler("../supabase/producao/rollback/0353_rollback.sql"), /contratos_lead_id_key/);
});

test("admin: cada cobrança da taxa vai para o contrato DELA; com dois contratos na candidatura não há chave ambígua", async () => {
  const { cobrancasPorContrato, chaveCobrancaDoContrato, comissoesDosContratos } = await import("./admin/financeiro.ts");
  const contratos = [
    { id: "c1", lead_id: "L", proposta_id: "p1" },
    { id: "c2", lead_id: "L", proposta_id: "p2" },
    { id: "c9", lead_id: "M", proposta_id: null },
  ];
  const mapa = cobrancasPorContrato(
    [
      { lead_id: "L", proposta_id: "p1", status: "pago", pago_em: "2026-11-08T12:00:00Z" },
      { lead_id: "L", proposta_id: "p2", status: "pendente", pago_em: null },
      { lead_id: "M", proposta_id: null, status: "vencido", pago_em: null },
    ],
    contratos
  );
  assert.deepEqual(mapa.get(chaveCobrancaDoContrato("c1")), { status: "pago", pagoEm: "2026-11-08T12:00:00Z" });
  assert.deepEqual(mapa.get(chaveCobrancaDoContrato("c2")), { status: "pendente", pagoEm: null });
  assert.equal(mapa.get("L"), undefined, "duas estadias na candidatura: a chave só pela candidatura não existe");
  assert.deepEqual(mapa.get("M"), { status: "vencido", pagoEm: null }, "um contrato só: a chave pela candidatura continua");
  // A tabela de taxas: a 2ª estadia aparece 'pendente', não 'paga' pela cobrança da 1ª.
  const linha = (id: string, leadId: string) => ({ id, criadoEm: "2026-11-21T10:00:00Z", imovel: "Imóvel", cidade: null, plano: null, taxaPercent: 0.12, aluguelMensal: 2800, taxaValor: 100, leadId });
  const tabela = comissoesDosContratos([linha("c1", "L"), linha("c2", "L"), linha("c9", "M")], mapa);
  assert.deepEqual(tabela.map((l) => l.status), ["pago", "pendente", "vencido"]);
  // Contrato da 2ª estadia ainda sem cobrança: "sem cobrança", nunca a cobrança da 1ª.
  const soPrimeira = cobrancasPorContrato([{ lead_id: "L", proposta_id: "p1", status: "pago", pago_em: null }], contratos);
  assert.deepEqual(comissoesDosContratos([linha("c1", "L"), linha("c2", "L")], soPrimeira).map((l) => l.status), ["pago", "sem_cobranca"]);
});
