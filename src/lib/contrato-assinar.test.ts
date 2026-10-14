/*
  F40 — assinatura na plataforma: papéis, resumo/hash, quem pode assinar, aviso por parte e janela de avaliação.
  Roda: node --test src/lib/contrato-assinar.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assuntoAvisoOutraParte,
  avisoAssinatura,
  hashResumo,
  motivoNaoPodeAssinar,
  papelNoContrato,
  podeAvaliarLocacao,
  resumoContrato,
  petsRegrasDoResumo,
} from "./contrato-assinar.ts";

const dados = { contratoId: "c1", imovel: "Studio Centro", aluguelMensal: 2500, prazoDias: 90, ocupantes: 1, criadoEm: "2026-10-13" };

test("papel: inquilino, proprietário e quem não é parte", () => {
  assert.equal(papelNoContrato("t", "t", "o"), "inquilino");
  assert.equal(papelNoContrato("o", "t", "o"), "proprietario");
  assert.equal(papelNoContrato("x", "t", "o"), null);
});

test("resumo leva a marca de minuta e o hash muda se qualquer valor mudar", () => {
  const r = resumoContrato(dados);
  assert.equal(r[0], "MINUTA DE TESTE — sem validade");
  assert.match(hashResumo(r), /^[0-9a-f]{64}$/);
  assert.equal(hashResumo(r), hashResumo(resumoContrato(dados)));
  assert.notEqual(hashResumo(r), hashResumo(resumoContrato({ ...dados, aluguelMensal: 2600 })));
});

test("assinar: caso positivo e os negativos (não é parte, não ativo, já assinou, sem aceite)", () => {
  const ok = { status: "ativo", papel: "inquilino" as const, assinadoEm: null, aceite: true };
  assert.equal(motivoNaoPodeAssinar(ok), null);
  assert.match(motivoNaoPodeAssinar({ ...ok, papel: null })!, /não é parte/);
  assert.match(motivoNaoPodeAssinar({ ...ok, status: "cancelado" })!, /não está mais aguardando/);
  assert.match(motivoNaoPodeAssinar({ ...ok, assinadoEm: "2026-10-13" })!, /já assinou/);
  assert.match(motivoNaoPodeAssinar({ ...ok, aceite: false })!, /Li e concordo/);
});

test("aviso: cada parte vê 'você já assinou / falta o outro'", () => {
  const t = "2026-10-13";
  assert.equal(avisoAssinatura("inquilino", { proprietario: null, inquilino: t }), "Você já assinou — falta o outro assinar.");
  assert.equal(avisoAssinatura("proprietario", { proprietario: null, inquilino: t }), "O outro já assinou — falta você assinar.");
  assert.equal(avisoAssinatura("inquilino", { proprietario: t, inquilino: t }), "As duas partes assinaram.");
  assert.equal(avisoAssinatura("inquilino", { proprietario: null, inquilino: null }), "Nenhuma assinatura ainda.");
});

test("avaliar: nunca em contrato ativo/aguardando assinatura; só até 14 dias depois do fim", () => {
  const agora = new Date("2026-10-20T12:00:00Z");
  assert.equal(podeAvaliarLocacao("ativo", null, agora), false);
  assert.equal(podeAvaliarLocacao("ativo", "2026-10-19T00:00:00Z", agora), false);
  assert.equal(podeAvaliarLocacao("concluido", "2026-10-15T00:00:00Z", agora), true);
  assert.equal(podeAvaliarLocacao("concluido", "2026-09-01T00:00:00Z", agora), false);
  assert.equal(podeAvaliarLocacao("concluido", null, agora), false);
});

test("aviso à outra parte: pede a assinatura que falta, ou diz que o contrato está completo", () => {
  assert.equal(assuntoAvisoOutraParte(false), "O outro lado assinou o contrato — falta a sua assinatura");
  assert.equal(assuntoAvisoOutraParte(true), "As duas partes assinaram o contrato");
  assert.doesNotMatch(assuntoAvisoOutraParte(true), /falta/);
});

test("resumo traz a cláusula de pets só quando o anúncio tem regras (ordem 022afabb, item 5)", () => {
  const sem = resumoContrato(dados);
  assert.ok(!sem.some((l) => l.startsWith("Pets")));
  const regras = { especies: ["cao" as const, "gato" as const], porteMax: "M" as const, qtdMax: 2, reforcoCaucao: 500, regrasCondominio: "" };
  const com = resumoContrato({ ...dados, petsRegras: regras });
  const linha = com.find((l) => l.startsWith("Pets"))!;
  assert.match(linha, /cão e gato/);
  assert.match(linha, /Reforço de Caução/);
  assert.notEqual(hashResumo(sem), hashResumo(com));
  assert.ok(!/vistoria/i.test(linha));
});

test("dono assina, o anúncio muda as regras de pets e o inquilino assina o mesmo hash (achado do Moacir, PR #486)", () => {
  const antes = { especies: ["cao"], porteMax: "M", qtdMax: 1, reforcoCaucao: 0, regrasCondominio: "" };
  const depois = { especies: ["cao", "gato"], porteMax: "G", qtdMax: 3, reforcoCaucao: 900, regrasCondominio: "" };
  // 1ª assinatura (ninguém assinou): vale o anúncio; o servidor congela essas regras no contrato.
  const hashDono = hashResumo(
    resumoContrato({ ...dados, petsRegras: petsRegrasDoResumo({ algumaAssinatura: false, vivas: antes, congeladas: null }) }),
  );
  // 2ª assinatura: o dono já mudou o anúncio, mas vale o congelado.
  const hashInquilino = hashResumo(
    resumoContrato({ ...dados, petsRegras: petsRegrasDoResumo({ algumaAssinatura: true, vivas: depois, congeladas: antes }) }),
  );
  assert.equal(hashInquilino, hashDono);
  // Contrato já assinado antes do congelamento existir: sem a linha, como quando foi assinado.
  assert.equal(petsRegrasDoResumo({ algumaAssinatura: true, vivas: depois, congeladas: null }), null);
  // Congelado vazio ({}): anúncio sem regras na 1ª assinatura continua sem a linha.
  assert.equal(petsRegrasDoResumo({ algumaAssinatura: true, vivas: depois, congeladas: {} }), null);
});
