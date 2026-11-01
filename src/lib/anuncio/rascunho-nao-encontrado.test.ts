/*
  E420 — rascunho da URL desconhecido ou de outra conta: avisa em vez de abrir cadastro novo em silêncio.
  Roda: node --test src/lib/anuncio/rascunho-nao-encontrado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_RASCUNHO_FECHADO, idDeRascunhoValido } from "./rascunho-nao-encontrado.ts";

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
  const fn = src.slice(src.indexOf("export async function abrirRascunho"), src.indexOf("export async function loadDraftData"));
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
});
