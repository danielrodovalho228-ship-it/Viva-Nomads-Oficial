/*
  E970 (ligação na casca; Gerente, ronda 23:49 de 16/11/2026) — o selo da aba Mensagens.
  Regra do coordenador (ORDEM-DUET-068, ponto 3): a unidade é a CONVERSA. O selo da aba Mensagens conta as conversas com
  pelo menos uma não lida; no menu do computador e na barra do celular.
  O número vem do contador `conversasNaoLidas`, que entra com o #3892 (dados). Este PR entra antes: a casca lê o
  contador quando ele existir e, enquanto não existe, não mostra selo nenhum (como hoje).
  Trava ao vivo: tests/e2e/specs/t2018-a5-unidade-e-a-conversa.spec.ts (está no #3892).
  Roda: node --test src/lib/painel/e970-selo-na-casca.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { seloDaAbaMensagens } from "./selo-aba-mensagens.ts";
import { CONTADORES_VAZIOS, normalizarContadores } from "./contadores.ts";

test("o selo é o número de conversas com não lida que os contadores trazem", () => {
  assert.equal(seloDaAbaMensagens({ conversasNaoLidas: 2 }), 2);
  assert.equal(seloDaAbaMensagens({ ...CONTADORES_VAZIOS, conversasNaoLidas: 1 }), 1);
  assert.equal(seloDaAbaMensagens({ conversasNaoLidas: 12 }), 12);
});

test("sem o contador, ou com valor que não é contagem, não há selo", () => {
  // Hoje (antes do #3892) os contadores não trazem o campo: a aba fica sem selo, como estava.
  assert.equal(seloDaAbaMensagens(CONTADORES_VAZIOS), 0);
  assert.equal(seloDaAbaMensagens(normalizarContadores({ mensagensRecebidas: 7 })), 0, "mensagens recebidas não são conversas não lidas");
  for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "2", null, undefined, {}, 1.7]) assert.equal(seloDaAbaMensagens({ conversasNaoLidas: v }), v === 1.7 ? 1 : 0, String(v));
  assert.equal(seloDaAbaMensagens(null), 0);
  assert.equal(seloDaAbaMensagens(undefined), 0);
});

test("a casca liga o selo nos dois lugares: menu do computador e barra do celular", () => {
  const casca = readFileSync(new URL("../../components/layout/dashboard-shell.tsx", import.meta.url), "utf8");
  assert.match(casca, /import \{ seloDaAbaMensagens \} from "@\/lib\/painel\/selo-aba-mensagens";/);
  // Menu do computador: a chave é o id do item "Mensagens" (src/config/menu-por-papel.ts).
  assert.match(casca, /const badges = \{[^}]*\bmensagens: seloDaAbaMensagens\(contadores\)[^}]*\};/);
  // Barra do celular: a chave é o `badge` da aba (src/config/abas-painel.ts).
  assert.match(casca, /<MobileTabBar[^>]*badges=\{\{ equipe: badgeDaEquipe\(contadores\), mensagens: seloDaAbaMensagens\(contadores\) \}\}/);
  // Os selos que já existiam continuam lá.
  for (const chave of ['"admin-documentos": docsPendentes', '"admin-agentes": aprovacoesPendentes', '"contratos-inquilino": contratosParaAssinar', '"propostas-inquilino": propostasAguardando']) assert.ok(casca.includes(chave), chave);
  assert.match(readFileSync(new URL("../../config/menu-por-papel.ts", import.meta.url), "utf8"), /\{ id: "mensagens", rotulo: "Mensagens", icone: "mensagens", href: "\/dashboard\/mensagens" \}/);
  assert.match(readFileSync(new URL("../../config/abas-painel.ts", import.meta.url), "utf8"), /href: "\/dashboard\/mensagens"[^}]*badge: "mensagens"/);
});
