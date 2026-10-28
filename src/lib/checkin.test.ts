/*
  Check-in garantido (ordem 404cd213, item 2): regras puras.
  Roda: node --test src/lib/checkin.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LIMITE_INSTRUCOES,
  MSG_FALTAM_INSTRUCOES,
  hojeEmBrasilia,
  inicioDaEstadia,
  lembreteDoDia,
  motivoFaltamInstrucoes,
  textoLembrete,
  MSG_ABRIU_ACESSO,
  inquilinoVeInstrucoes,
  normalizarTelefone,
  podeEditarInstrucoes,
  podeNaoConsegui,
  telefoneParaExibir,
  validarInstrucoes,
} from "./checkin.ts";

const ok = { horario: "14:00", instrucoes: "Retire a chave no cofre da portaria.", plantao: "(34) 99999-0000" };

test("instruções válidas: horário, como entrar e telefone de plantão são obrigatórios", () => {
  const r = validarInstrucoes(ok);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.dados, { horario: "14:00", instrucoes: "Retire a chave no cofre da portaria.", plantao: "34999990000" });
});

test("negativos: sem horário, horário inválido, instrução curta/longa e telefone ruim são recusados", () => {
  for (const ruim of [
    { ...ok, horario: "" },
    { ...ok, horario: "25:00" },
    { ...ok, horario: "9h" },
    { ...ok, instrucoes: "chave" },
    { ...ok, instrucoes: "x".repeat(LIMITE_INSTRUCOES + 1) },
    { ...ok, plantao: "" },
    { ...ok, plantao: "12345" },
    { ...ok, plantao: "abc" },
    { horario: 1, instrucoes: null, plantao: undefined },
  ]) {
    assert.equal(validarInstrucoes(ruim as never).ok, false, JSON.stringify(ruim));
  }
});

test("telefone: aceita +55, espaços e traço; recusa o que não tem DDD", () => {
  assert.equal(normalizarTelefone("+55 (34) 99999-0000"), "5534999990000");
  assert.equal(normalizarTelefone("99999-0000"), null);
  assert.equal(telefoneParaExibir("34999990000"), "(34) 99999-0000");
  assert.equal(telefoneParaExibir("5534999990000"), "(34) 99999-0000");
});

test("quem vê e quem age: inquilino só vê depois das duas assinaturas; botão só do inquilino", () => {
  const base = { status: "ativo", assinadoProprietarioEm: "2026-11-01", assinadoInquilinoEm: "2026-11-02" };
  assert.equal(inquilinoVeInstrucoes({ ...base, papel: "inquilino" }), true);
  assert.equal(inquilinoVeInstrucoes({ ...base, papel: "inquilino", assinadoInquilinoEm: null }), false);
  assert.equal(inquilinoVeInstrucoes({ ...base, papel: "inquilino", assinadoProprietarioEm: null }), false);
  assert.equal(inquilinoVeInstrucoes({ ...base, papel: "proprietario" }), false);
  assert.equal(inquilinoVeInstrucoes({ ...base, papel: "inquilino", status: "concluido" }), false);
  assert.equal(podeNaoConsegui({ ...base, papel: "inquilino" }), true);
  assert.equal(podeNaoConsegui({ ...base, papel: "proprietario" }), false);
  assert.equal(podeNaoConsegui({ ...base, papel: "inquilino", assinadoProprietarioEm: null }), false);
  assert.equal(podeEditarInstrucoes({ ...base, papel: "proprietario" }), true);
  assert.equal(podeEditarInstrucoes({ ...base, papel: "inquilino" }), false);
  assert.equal(podeEditarInstrucoes({ ...base, papel: "proprietario", status: "concluido" }), false);
});

test("texto do chamado de acesso não usa 'vistoria' nem expõe contato", () => {
  assert.ok(!/vistoria/i.test(MSG_ABRIU_ACESSO));
  assert.ok(MSG_ABRIU_ACESSO.length >= 5);
});

test("abrirChamado abre ordem URGENTE para 'acesso_imovel' com contrato (ligação no código)", () => {
  const src = readFileSync(new URL("./data/atendimento-actions.ts", import.meta.url), "utf8");
  assert.match(src, /abreOrdem/);
  assert.match(src, /acesso_imovel/);
  assert.match(src, /urgencia: cat\.key === "acesso_imovel" \? "urgente"/);
});

test("proprietário só assina com as instruções de entrada completas; inquilino assina sempre", () => {
  assert.equal(motivoFaltamInstrucoes({ papel: "proprietario", preenchidas: false }), MSG_FALTAM_INSTRUCOES);
  assert.equal(motivoFaltamInstrucoes({ papel: "proprietario", preenchidas: true }), null);
  assert.equal(motivoFaltamInstrucoes({ papel: "inquilino", preenchidas: false }), null);
  assert.match(MSG_FALTAM_INSTRUCOES, /Check-in garantido/);
});

test("as duas ações de assinatura conferem as instruções no servidor, e a leitura vem da tabela fechada", () => {
  const src = readFileSync(new URL("./data/contrato-assinar-actions.ts", import.meta.url), "utf8");
  assert.equal((src.match(/motivoFaltamInstrucoes\(/g) ?? []).length, 2); // pedir código + assinar
  const acoes = readFileSync(new URL("./data/checkin-actions.ts", import.meta.url), "utf8");
  assert.match(acoes, /from\("contratos_checkin"\)/);
  assert.doesNotMatch(acoes, /checkin_(horario|plantao|instrucoes)/);
});

test("lembretes: 2 dias antes = 48 h, 1 dia antes = 24 h, o resto não envia", () => {
  assert.equal(lembreteDoDia("2026-11-10", "2026-11-08"), "48h");
  assert.equal(lembreteDoDia("2026-11-10", "2026-11-09"), "24h");
  for (const hoje of ["2026-11-10", "2026-11-11", "2026-11-07", "2026-11-01"]) assert.equal(lembreteDoDia("2026-11-10", hoje), null, hoje);
  assert.equal(lembreteDoDia("2026-12-01T00:00:00Z", "2026-11-29"), "48h"); // vira o mês
});

test("dia de Brasília: 02h UTC ainda é o dia anterior; 12h UTC é o mesmo dia", () => {
  assert.equal(hojeEmBrasilia(new Date("2026-11-09T02:00:00Z")), "2026-11-08");
  assert.equal(hojeEmBrasilia(new Date("2026-11-09T12:00:00Z")), "2026-11-09");
});

test("início da estadia é o menor início dos blocos; sem bloco, nada", () => {
  assert.equal(inicioDaEstadia([{ inicio: "2026-12-01" }, { inicio: "2026-11-10" }, { inicio: null }]), "2026-11-10");
  assert.equal(inicioDaEstadia([]), null);
});

test("texto do lembrete: dia e horário, sem telefone nem instrução", () => {
  const t48 = textoLembrete("48h", "2026-11-10", "14:00");
  assert.match(t48, /10\/11\/2026/);
  assert.match(t48, /14:00/);
  assert.match(textoLembrete("24h", "2026-11-10", null), /amanhã/);
  assert.doesNotMatch(t48, /\d{8,}|vistoria/i);
});

test("cron de lembretes: exige segredo, marca antes de enviar e está agendado; tabela fechada na migração", () => {
  const rota = readFileSync(new URL("../app/api/cron/checkin-lembretes/route.ts", import.meta.url), "utf8");
  assert.match(rota, /CRON_SECRET/);
  assert.match(rota, /status: 401/);
  assert.ok(rota.indexOf(".upsert(") < rota.indexOf("notify("), "marca o lembrete antes de enviar");
  // E209 (Muse, 28/10): as instruções de chegada vão no corpo — só ao morador; o telefone de plantão nunca.
  assert.doesNotMatch(rota, /plantao/);
  assert.match(rota, /corpoDaChegada\(estadia, instrucoes, uid === c\.tenant_id, texto\)/);
  assert.match(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"), /\/api\/cron\/checkin-lembretes/);
  const mig = readFileSync(new URL("../../supabase/migrations/0127_contrato_checkin_tabela.sql", import.meta.url), "utf8");
  assert.match(mig, /enable row level security/);
  assert.match(mig, /revoke all on public\.contratos_checkin from anon, authenticated/);
  assert.match(mig, /drop column if exists checkin_plantao/);
  assert.doesNotMatch(mig, /create policy/i);
});
