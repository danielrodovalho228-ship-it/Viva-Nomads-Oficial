/* Roda: node --test src/lib/anuncio/e1034-rascunho-sem-dados.test.ts
   E1034 (ORDEM-DUET-174 e 175, 19/11/2026): a t296 (caso 5) ficou vermelha na corrida 44495944766. Causa: desde o E614, o
   rascunho que já existe no servidor grava mesmo com o formulário vazio (é assim que o passo do rascunho só com o tipo
   chega ao servidor). Mas o formulário também fica vazio quando a linha do rascunho NÃO tem `draft_data` (tem só as
   colunas e as fotos): abrir o assistente nela regravava a linha inteira com o formulário vazio: título "Rascunho de
   anúncio", preço 0, bairro, quartos, banheiros, área e descrição a zero, e as fotos apagadas.
   Regra: o formulário vazio de um rascunho aberto SEM `draft_data` não é o conteúdo dele; não grava por cima. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { autosaveSemNadaAGravar, formularioVazioNaoEDoRascunho, rascunhoAbertoSemDados } from "./salvo-fantasma.ts";

test("E1034: rascunho aberto sem draft_data é o que não trouxe o estado do editor", () => {
  assert.equal(rascunhoAbertoSemDados(null), true);
  assert.equal(rascunhoAbertoSemDados(undefined), true);
  assert.equal(rascunhoAbertoSemDados("texto"), true);
  // Com o estado do editor (mesmo só com o tipo, ou só com o passo): é um rascunho com dados.
  assert.equal(rascunhoAbertoSemDados({}), false);
  assert.equal(rascunhoAbertoSemDados({ propertyType: "apartamento", step: 1 }), false);
});

test("E1034: formulário vazio sobre um rascunho aberto sem dados não grava; os outros casos seguem como eram", () => {
  assert.equal(formularioVazioNaoEDoRascunho({ vazio: true, abertoSemDados: true }), true);
  // O caso do E614 (rascunho só com o tipo, nascido na Qualificação): tem draft_data, grava o passo.
  assert.equal(formularioVazioNaoEDoRascunho({ vazio: true, abertoSemDados: false }), false);
  // Com conteúdo digitado, esta regra não decide nada.
  assert.equal(formularioVazioNaoEDoRascunho({ vazio: false, abertoSemDados: true }), false);
  assert.equal(formularioVazioNaoEDoRascunho({ vazio: false, abertoSemDados: false }), false);
  // A regra do E614 não mudou.
  assert.equal(autosaveSemNadaAGravar({ vazio: true, rascunhoNoServidor: true }), false);
  assert.equal(autosaveSemNadaAGravar({ vazio: true, rascunhoNoServidor: false }), true);
});

test("E1034: a tela marca o rascunho ao abrir, pergunta antes de gravar e desmarca quando o rascunho muda", () => {
  const pagina = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");
  // Ao abrir o rascunho da URL: marca se ele veio sem draft_data.
  const abrir = pagina.slice(pagina.indexOf("const r = await abrirRascunho(draftParam)"), pagina.indexOf("// E660: sem ficha no rascunho"));
  assert.match(abrir, /abertoSemDadosRef\.current = rascunhoAbertoSemDados\(d\);/);
  // No autosave: a pergunta vem ANTES da regra do E614 e antes de qualquer gravação.
  const efeito = pagina.slice(pagina.indexOf("// Auto-save do rascunho"), pagina.indexOf("// Limites privados do rascunho"));
  const pergunta = efeito.indexOf("if (formularioVazioNaoEDoRascunho({ vazio, abertoSemDados: abertoSemDadosRef.current })) return;");
  assert.ok(pergunta > 0, "o autosave pergunta se o formulário vazio é do rascunho");
  assert.ok(pergunta < efeito.indexOf("if (autosaveSemNadaAGravar("), "antes da regra do E614");
  assert.ok(pergunta < efeito.indexOf("saveDraftData(montarGravacao())"), "antes de gravar");
  // A gravação que deu certo já deixou o estado do editor no servidor: a marca sai.
  assert.match(efeito, /if \(res\.ok\) \{\s+abertoSemDadosRef\.current = false;/);
  // "Começar outro" larga o rascunho aberto: a marca sai junto.
  assert.match(pagina, /draftIdRef\.current = null;\s+comecouOutroRef\.current = true;\s+abertoSemDadosRef\.current = false;/);
});
