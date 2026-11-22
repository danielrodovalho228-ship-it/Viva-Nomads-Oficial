/*
  E1083, parte 1 (ORDEM-DUET-399). A perna 7 da prova do piloto falhou com "Sem o CNPJ do avaliador no cadastro, o laudo
  não pode ser assinado.". Em MODO PILOTO/TESTE — pedido de teste ou avaliador na lista do piloto (vistoria_piloto) — a
  assinatura não exige o CNPJ; FORA do piloto a regra do CNPJ fica intacta.
  ATENÇÃO (condição do coordenador): regra legal, com o Daniel para decidir. Este PR é separável e fica SEM merge até a resposta.
  Roda: node --test src/lib/vistoria/e1083-piloto-sem-cnpj.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assinaturaDoLaudo } from "./escolha.ts";

const base = { pdfSha256: "a".repeat(64), avaliadorUserId: "u1", numeroCredenciado: "UDI-009", nomePublico: "Avaliador Teste", cnpj: "", em: "2026-11-22T12:00:00Z", declarou: true };

test("E1083 parte 1: fora do piloto, sem CNPJ, o laudo NÃO é assinado (a regra fica intacta)", () => {
  const r = assinaturaDoLaudo(base);
  assert.deepEqual(r, { ok: false, erro: "Sem o CNPJ do avaliador no cadastro, o laudo não pode ser assinado." });
  assert.equal(assinaturaDoLaudo({ ...base, pilotoSemCnpj: false }).ok, false);
});

test("E1083 parte 1: no piloto/teste, sem CNPJ, o laudo é assinado — o termo diz que é piloto e não cita CNPJ", () => {
  const r = assinaturaDoLaudo({ ...base, pilotoSemCnpj: true });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.match(r.termo, /piloto de teste, sem CNPJ/);
  assert.doesNotMatch(r.termo, /CNPJ \d/);
  assert.match(r.hash, /^[0-9a-f]{64}$/);
  // Com CNPJ válido, o piloto assina como antes (o termo com o CNPJ).
  const c = assinaturaDoLaudo({ ...base, cnpj: "11.222.333/0001-81", pilotoSemCnpj: true });
  assert.equal(c.ok, true);
  if (c.ok) assert.match(c.termo, /CNPJ 11222333000181/);
  // A declaração continua obrigatória no piloto.
  assert.equal(assinaturaDoLaudo({ ...base, declarou: false, pilotoSemCnpj: true }).ok, false);
});

test("E1083 parte 1: a emissão só dispensa o CNPJ em pedido de teste ou avaliador do piloto", () => {
  const srv = readFileSync("src/lib/vistoria/laudo-servidor.ts", "utf8");
  const emitir = srv.slice(srv.indexOf("export async function emitirLaudo"), srv.indexOf("export async function registrarCorrecao"));
  assert.match(emitir, /from\("vistoria_piloto"\)\.select\("user_id"\)\.eq\("user_id", parc\.user_id\)/);
  assert.match(emitir, /const pilotoSemCnpj = p\.teste === true \|\| noPiloto;/);
  assert.match(emitir, /pilotoSemCnpj \}/);
});
