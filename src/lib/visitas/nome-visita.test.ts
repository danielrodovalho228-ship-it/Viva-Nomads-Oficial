/*
  E328 (regra) — confirmar o horário é o aceite prático da visita: a partir da confirmação, o dono vê o 1º nome de
  quem vem e o morador vê o 1º nome de quem recebe, na visita (detalhe e agenda). Antes da confirmação, segue
  protegido. Caso da prova do E290 (31/10): o dono confirmou e o detalhe seguia "Quem vem: Interessado(a)".
  Roda: node --test src/lib/visitas/nome-visita.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nomeLiberadoNaVisita } from "./nome-visita.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("a regra: confirmada ou feita libera; pedida, remarcar e cancelada não (salvo aceite de fora)", () => {
  assert.equal(nomeLiberadoNaVisita("confirmado"), true);
  assert.equal(nomeLiberadoNaVisita("feito"), true);
  for (const s of ["pedido", "remarcar", "cancelado", null, undefined]) assert.equal(nomeLiberadoNaVisita(s), false, String(s));
  // Candidatura aceita ou contrato: libera como antes (para o dono).
  assert.equal(nomeLiberadoNaVisita("pedido", true), true);
});

test("detalhe da visita: o dono vê quem vem e o morador vê quem recebe, a partir da confirmação", () => {
  const src = ler("src/lib/data/visitas-video-actions.ts");
  const fn = src.slice(src.indexOf("export async function visitaDetalhe"));
  assert.match(fn, /if \(nomeLiberadoNaVisita\(r\.status, aceite\)\) pessoa = await nomeDe\(r\.tenant_id\);/);
  assert.match(fn, /\} else if \(nomeLiberadoNaVisita\(r\.status\)\) \{\n[^\n]*\n\s*pessoa = await nomeDe\(r\.owner_id\);/);
  // Só o 1º nome — nunca telefone ou e-mail.
  assert.doesNotMatch(fn, /select\("[^"]*(phone|telefone|email)[^"]*"\)\.eq\("id", (id|r\.tenant_id|r\.owner_id)\)/);
  const cartao = ler("src/components/visitas/cartao-visita.tsx");
  assert.match(cartao, /papel !== "dono" && v\.pessoa && \(\n\s*<p className="text-xs text-muted" data-testid="visita-pessoa-dono">\n\s*Quem recebe: \{v\.pessoa\}/);
  assert.match(cartao, /Quem vem: \{v\.pessoa \?\? "Interessado\(a\)"\}/);
});

test("agenda do dono: a visita confirmada mostra o 1º nome de quem vem (sem foto antes do aceite)", () => {
  const src = ler("src/lib/data/agenda-servidor.ts");
  assert.match(src, /const confirmadas = \(\(visitas \?\? \[\]\) as LinhaVisita\[\]\)\.filter\(\(v\) => nomeLiberadoNaVisita\(v\.status\)\)/);
  assert.match(src, /pessoa: pessoa\(v\.tenant_id, v\.property_id\) \?\? \(nomeLiberadoNaVisita\(v\.status\) \? \{ nome: nomes\.get\(v\.tenant_id\) \?\? "Interessado\(a\)", fotoUrl: null \} : null\)/);
});
