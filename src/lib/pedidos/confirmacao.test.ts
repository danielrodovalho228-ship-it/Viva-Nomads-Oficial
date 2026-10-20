/*
  Pedido de moradia: quando chega aos proprietários (Prompt 30, chave SMS_ATIVO; antes, ordem 8dca1437, item 3).
  Roda: node --test src/lib/pedidos/confirmacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  avisoConfirmacao,
  chegaAosDonos,
  contatoConfirmado,
  faltaConfirmar,
  selosDoPedido,
  textoAvisoTelefone,
  tituloFaltaConfirmar,
} from "./confirmacao.ts";

const ok = { emailConfirmadoEm: "2026-10-01T00:00:00Z", telefoneConfirmadoEm: "2026-10-02T00:00:00Z", telefoneVerificadoEm: "2026-10-02T00:00:00Z" };
const semTelefone = { ...ok, telefoneConfirmadoEm: null, telefoneVerificadoEm: null };
const DESLIGADA = { ligada: false, ligadaEm: null };
const LIGADA = { ligada: true, ligadaEm: "2026-10-20T12:00:00Z" };
const agora = new Date("2026-10-22T12:00:00Z");

test("chave desligada: e-mail confirmado basta — o pedido chega ao dono mesmo sem telefone", () => {
  assert.equal(chegaAosDonos(semTelefone, DESLIGADA, "2026-10-21T00:00:00Z", agora), true);
  assert.deepEqual(faltaConfirmar(semTelefone, DESLIGADA), []);
  assert.equal(contatoConfirmado(semTelefone), true);
  assert.equal(chegaAosDonos({ ...semTelefone, emailConfirmadoEm: null }, DESLIGADA, "2026-10-21T00:00:00Z", agora), false);
});

test("chave ligada: pedido novo sem telefone confirmado não aparece até confirmar", () => {
  assert.equal(chegaAosDonos(semTelefone, LIGADA, "2026-10-21T00:00:00Z", agora), false);
  assert.deepEqual(faltaConfirmar(semTelefone, LIGADA), ["telefone"]);
  assert.equal(chegaAosDonos(ok, LIGADA, "2026-10-21T00:00:00Z", agora), true);
  assert.equal(chegaAosDonos({ ...ok, telefoneVerificadoEm: undefined }, LIGADA, "2026-10-21T00:00:00Z", agora), false);
});

test("chave ligada: pedido publicado antes de ligar tem 7 dias para confirmar", () => {
  assert.equal(chegaAosDonos(semTelefone, LIGADA, "2026-10-18T00:00:00Z", new Date("2026-10-26T12:00:00Z")), true);
  assert.equal(chegaAosDonos(semTelefone, LIGADA, "2026-10-18T00:00:00Z", new Date("2026-10-27T12:00:01Z")), false);
  assert.match(textoAvisoTelefone("2026-10-27T12:00:00Z"), /confirme o seu telefone até 27\/10\/2026/);
});

test("textos acompanham a chave: desligada, nenhum texto pede telefone para os donos verem", () => {
  assert.doesNotMatch(avisoConfirmacao(false), /telefone/i);
  assert.match(avisoConfirmacao(false), /e-mail confirmado/);
  assert.match(avisoConfirmacao(true), /e-mail e telefone confirmados/);
  for (const t of [avisoConfirmacao(false), avisoConfirmacao(true)]) assert.doesNotMatch(t, /aluguel|comiss|corretag|intermedia/i);
  assert.equal(tituloFaltaConfirmar(["e-mail"]), "Falta confirmar seu e-mail.");
  assert.equal(tituloFaltaConfirmar(["e-mail", "telefone"]), "Falta confirmar seu e-mail e telefone.");
});

test("GUARDA: com a chave desligada nenhuma tela ou e-mail diz 'confirme o telefone para os donos verem'", () => {
  const raiz = new URL("../../", import.meta.url).pathname;
  const proibido = /confirm\w* (?:o |seu )?(?:e-mail e )?telefone para (?:os )?(?:donos|propriet\w+) (?:verem|ver)|Falta confirmar seu e-mail e telefone\.<\/strong>/i;
  const ruins: string[] = [];
  const andar = (d: string) => {
    for (const n of readdirSync(d)) {
      const c = join(d, n);
      if (statSync(c).isDirectory()) andar(c);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) && proibido.test(readFileSync(c, "utf8"))) ruins.push(c);
    }
  };
  andar(raiz);
  assert.deepEqual(ruins, []);
  // O formulário lê o texto da chave (avisoConfirmacao), nunca um texto fixo com telefone.
  const form = readFileSync(new URL("../../app/(public)/pedidos/novo/page.tsx", import.meta.url), "utf8");
  assert.match(form, /avisoConfirmacao\(/);
});

test("selos do cartão: e-mail ✓, identidade ✓ com laudo, telefone ✓ ou 'ainda não confirmado'", () => {
  assert.deepEqual(
    selosDoPedido({ emailConfirmado: true, telefoneConfirmado: false, identidadeConfirmada: true }).map((s) => s.texto),
    ["E-mail confirmado", "Identidade confirmada", "Telefone ainda não confirmado"],
  );
  assert.deepEqual(
    selosDoPedido({ emailConfirmado: true, telefoneConfirmado: true, identidadeConfirmada: false }).map((s) => s.texto),
    ["E-mail confirmado", "Telefone confirmado"],
  );
});

test("migração 0184: a chave mora no banco, desligada, e o mural usa a mesma regra", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/0184_pedido_moradia_completo.sql", import.meta.url), "utf8");
  assert.match(sql, /insert into public\.chaves_plataforma \(chave, ligada\) values \('SMS_ATIVO', false\)/);
  assert.match(sql, /pedido_visivel_para_donos/);
  assert.match(sql, /interval '7 days'/);
  assert.match(sql, /email_confirmed_at is not null/);
  const aplicar = readFileSync(new URL("../../../supabase/producao/aplicar-0184.sql", import.meta.url), "utf8");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /20261019000184/);
  const volta = readFileSync(new URL("../../../supabase/producao/rollback/0184_rollback.sql", import.meta.url), "utf8");
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261019000184'/);
});
