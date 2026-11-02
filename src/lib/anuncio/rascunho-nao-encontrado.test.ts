/*
  E420 — rascunho da URL desconhecido ou de outra conta: avisa em vez de abrir cadastro novo em silêncio.
  Roda: node --test src/lib/anuncio/rascunho-nao-encontrado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_RASCUNHO_FECHADO, idDeRascunhoValido, rascunhoDaConta } from "./rascunho-nao-encontrado.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("id da URL: só uuid vai ao servidor", () => {
  assert.equal(idDeRascunhoValido("7216d0e9-6246-482a-a1de-524fd5231dc2"), true);
  for (const ruim of ["", null, undefined, "123", "abc", "7216d0e9-6246-482a-a1de-524fd5231dc2x"]) assert.equal(idDeRascunhoValido(ruim), false, String(ruim));
});

test("uma mensagem só para 'não existe' e 'é de outra conta' (não revela o anúncio dos outros)", () => {
  assert.equal(TEXTO_RASCUNHO_FECHADO.nao_encontrado.titulo, "Rascunho não encontrado");
  assert.match(TEXTO_RASCUNHO_FECHADO.nao_encontrado.texto, /não existe ou não é desta conta/);
  assert.doesNotMatch(JSON.stringify(TEXTO_RASCUNHO_FECHADO), /aluguel|inquilino/i);
});

test("servidor: abrirRascunho só devolve o rascunho do dono; sem linha = não encontrado; erro = indisponível", () => {
  const src = ler("../data/actions.ts");
  const fn = src.slice(src.indexOf("export async function abrirRascunho"), src.indexOf("async function semFotosApagadas"));
  assert.match(fn, /if \(!idDeRascunhoValido\(id\)\) return \{ ok: false, motivo: "nao_encontrado" \};/);
  assert.match(fn, /property_private_details/);
  assert.match(fn, /if \(error\) return \{ ok: false, motivo: "indisponivel" \};/);
  assert.match(fn, /if \(!row\) return \{ ok: false, motivo: "nao_encontrado" \};/);
});

test("página: rascunho fechado mostra o aviso e NÃO adota o id nem libera o formulário (nada é gravado por cima)", () => {
  const pagina = ler("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  const efeito = pagina.slice(pagina.indexOf("const r = await abrirRascunho(draftParam)"), pagina.indexOf("// eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [draftParam]);"));
  const fecha = efeito.indexOf("setFechado({ id: draftParam, motivo: r.motivo });");
  assert.ok(fecha > 0);
  // O return vem antes de adotar o id (draftServerId) e de liberar o formulário (approved).
  assert.ok(fecha < efeito.indexOf("setDraftServerId(draftParam)"));
  assert.ok(fecha < efeito.indexOf("setApproved(true)"));
  assert.match(pagina, /if \(rascunhoFechado\) \{[\s\S]*?data-testid="rascunho-fechado"[\s\S]*?Ver meus imóveis[\s\S]*?Começar um anúncio novo/);
  assert.match(pagina, /const rascunhoFechado = fechado && fechado\.id === draftParam \? fechado\.motivo : null;/);
  assert.doesNotMatch(pagina, /loadDraftData\(/);
  // Código morto removido: o rascunho só abre por abrirRascunho (que distingue "não encontrado" de "indisponível").
  assert.doesNotMatch(ler("../data/actions.ts"), /loadDraftData/);
});

test("L-88 (t943): o aviso vem ANTES do 'approved === null → return null' — senão a página fica em branco", () => {
  const pagina = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  const aviso = pagina.indexOf("  if (rascunhoFechado) {");
  const espera = pagina.indexOf("  if (approved === null) return null;");
  assert.ok(aviso > 0 && espera > 0, "os dois trechos existem");
  assert.ok(aviso < espera, "o aviso do rascunho fechado é desenhado antes da espera do approved");
  // Rascunho que não abre NÃO libera o formulário (approved segue null; nada é gravado por cima nem nasce rascunho novo).
  const efeito = pagina.slice(pagina.indexOf("const r = await abrirRascunho(draftParam)"), pagina.indexOf("const d = r.draft;"));
  assert.match(efeito, /if \(!r\.ok\) \{[\s\S]*?setFechado\(\{ id: draftParam, motivo: r\.motivo \}\);\s*return;\s*\}/);
  assert.doesNotMatch(efeito, /setApproved/);
  // "Começar um anúncio novo" (mesma rota, sem ?draft=) libera o assistente: o efeito depende do draftParam.
  assert.match(pagina, /if \(editId \|\| draftParam\) return;[\s\S]*?setApproved\(true\);[\s\S]*?\}, \[editId, draftParam, userId\]\);/);
});

test("E420 (resíduo): rascunho de OUTRA conta → 'não encontrado' (nunca o cadastro vazio em cima do anúncio alheio)", () => {
  const eu = "11111111-1111-4111-8111-111111111111";
  const outra = "22222222-2222-4222-8222-222222222222";
  assert.equal(rascunhoDaConta({ owner_id: eu }, eu), true);
  // A leitura privada devolve a linha ao admin e a quem tem candidatura (draft_data nulo): mesmo assim, não é desta conta.
  assert.equal(rascunhoDaConta({ owner_id: outra }, eu), false);
  assert.equal(rascunhoDaConta(null, eu), false);
  assert.equal(rascunhoDaConta({ owner_id: eu }, null), false);
  const src = ler("../data/actions.ts");
  const fn = src.slice(src.indexOf("export async function abrirRascunho"), src.indexOf("async function semFotosApagadas"));
  const dono = fn.indexOf('.from("properties").select("owner_id").eq("id", id).maybeSingle()');
  assert.ok(dono > 0 && dono < fn.indexOf("property_private_details"), "confere o dono antes de ler o rascunho");
  assert.match(fn, /if \(erroDono\) return \{ ok: false, motivo: "indisponivel" \};/);
  assert.match(fn, /if \(!rascunhoDaConta\(dono as \{ owner_id\?: string \| null \} \| null, user\.id\)\) return \{ ok: false, motivo: "nao_encontrado" \};/);
  // A RPC continua devolvendo a linha ao admin e a quem tem candidatura — é por isso que a conferência do dono existe.
  assert.match(ler("../../../supabase/migrations/0052_p0_seguranca_compativel.sql"), /or public\.is_admin\(\)/);
});
