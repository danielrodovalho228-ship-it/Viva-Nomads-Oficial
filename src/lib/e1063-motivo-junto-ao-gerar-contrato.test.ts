/*
  E1063 — trava: quando falta massa, o motivo de o contrato não sair aparece JUNTO do botão "Gerar contrato para
  assinatura" (a área de ação do passo), e não só no aviso do topo da página, que fica fora da tela nesse passo.
  A tela é cobrada pela t1704; aqui a guarda barata de que a área de ação continua a carregar as duas coisas: a pendência
  que o servidor já conhece ao abrir a página e a recusa do clique.
  Roda: node --test src/lib/e1063-motivo-junto-ao-gerar-contrato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tela = readFileSync(new URL("../app/(dashboard)/dashboard/fechamento/closing-flow.tsx", import.meta.url), "utf8");
const inicio = tela.indexOf('data-testid="acao-gerar-contrato"');
const fim = tela.indexOf('data-testid="fechamento-gerar-contrato"');
const area = tela.slice(inicio, fim);

test("E1063 — a área de ação existe e vem antes do botão, no mesmo bloco", () => {
  assert.ok(inicio > 0 && fim > inicio, "a área de ação envolve o botão");
  assert.ok(area.length < 1800, "o motivo fica junto do botão, não longe dele");
});

test("E1063 — a pendência que a página já conhece aparece junto do botão, sem clicar", () => {
  assert.match(tela, /const pendenciaContrato = ctx\.documentoPendente \?\? null;/);
  assert.match(area, /data-testid="pendencia-contrato"/);
  assert.match(area, /\{pendenciaContrato\.mensagem\}/);
});

test("E1063 — a recusa do clique aparece no mesmo lugar e não repete a pendência", () => {
  assert.match(area, /\{erroContrato \? \(\s*<p role="alert"[^>]*data-testid="erro-contrato">/);
  assert.match(area, /\) : pendenciaContrato \? \(/);
});

test("E1063 — quando a pendência é do dono, o caminho para resolver fica junto do botão, com área de toque", () => {
  assert.match(area, /pendenciaContrato\?\.quem === "dono"/);
  assert.match(area, /<Link href=\{LINK_DOCUMENTO\} className="[^"]*\bmin-h-11\b[^"]*">\s*Informar meu documento/);
});

test("E1063 — nenhum caminho de falha do clique fica mudo: toda saída sem contrato grava um motivo", () => {
  const clique = tela.slice(tela.indexOf("async function generateContract()"), tela.indexOf("const canAdvance"));
  // Depois de ligar o "Gerando...", cada `return` antes do fim vem logo depois de um setErroContrato(...).
  const depois = clique.slice(clique.indexOf("setGerando(true)"));
  const saidas = [...depois.matchAll(/\n(\s*)return;/g)];
  assert.ok(saidas.length >= 3, "há saídas antecipadas para conferir");
  for (const s of saidas) {
    const antes = depois.slice(0, s.index).trimEnd().split("\n").at(-1) ?? "";
    assert.match(antes, /setErroContrato\(/, `saída sem motivo depois de: ${antes.trim()}`);
  }
  assert.match(depois, /\} catch \{\s*setErroContrato\(/);
});
