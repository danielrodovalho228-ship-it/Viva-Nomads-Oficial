/*
  E970 (ligação na casca; Gerente, ronda 23:49 de 16/11/2026) — o selo da aba Mensagens.
  Regra do coordenador (ORDEM-DUET-068, ponto 3): a unidade é a CONVERSA. O selo da aba Mensagens conta as conversas com
  pelo menos uma não lida. A aba aparece em três lugares e o selo vai nos três: as abas do topo no computador (morador,
  proprietário e parceiro), a barra inferior no celular e o menu lateral da equipe.
  O número vem do contador `conversasNaoLidas`, que entra com o #3892 (dados). Este PR entra antes: a casca lê o
  contador quando ele existir e, enquanto não existe, não mostra selo nenhum (como hoje).
  Ao vivo: tests/e2e/specs/t1685-e970-selo-da-aba-mensagens.spec.ts.
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

test("a casca liga o selo nos três lugares: abas do topo, barra do celular e menu lateral", () => {
  const casca = readFileSync(new URL("../../components/layout/dashboard-shell.tsx", import.meta.url), "utf8");
  assert.match(casca, /import \{ seloDaAbaMensagens \} from "@\/lib\/painel\/selo-aba-mensagens";/);
  // Abas do topo (computador; morador, proprietário e parceiro): a chave é o `badge` da aba (src/config/abas-painel.ts).
  assert.match(casca, /<TopoPainel[^>]*badges=\{\{ mensagens: seloDaAbaMensagens\(contadores\) \}\}/);
  // Menu lateral (equipe, fora do /admin): a chave é o id do item "Mensagens" (src/config/menu-por-papel.ts).
  assert.match(casca, /const badges = \{[^}]*\bmensagens: seloDaAbaMensagens\(contadores\)[^}]*\};/);
  // Barra do celular: a chave é o `badge` da aba (src/config/abas-painel.ts).
  assert.match(casca, /<MobileTabBar[^>]*badges=\{\{ equipe: badgeDaEquipe\(contadores\), mensagens: seloDaAbaMensagens\(contadores\) \}\}/);
  // Os selos que já existiam continuam lá.
  for (const chave of ['"admin-documentos": docsPendentes', '"admin-agentes": aprovacoesPendentes', '"contratos-inquilino": contratosParaAssinar', '"propostas-inquilino": propostasAguardando']) assert.ok(casca.includes(chave), chave);
  assert.match(readFileSync(new URL("../../config/menu-por-papel.ts", import.meta.url), "utf8"), /\{ id: "mensagens", rotulo: "Mensagens", icone: "mensagens", href: "\/dashboard\/mensagens" \}/);
  assert.match(readFileSync(new URL("../../config/abas-painel.ts", import.meta.url), "utf8"), /href: "\/dashboard\/mensagens"[^}]*badge: "mensagens"/);
});

test("as abas do topo desenham o selo da aba que tem `badge`, e só quando há o que contar", () => {
  const topo = readFileSync(new URL("../../components/layout/topo-dono.tsx", import.meta.url), "utf8");
  const abas = topo.slice(topo.indexOf("export function TopoPainel"), topo.indexOf("export function Sino"));
  assert.match(abas, /badges\?: Partial<Record<NonNullable<AbaPainel\["badge"\]>, number>>;/, "a mesma forma da barra do celular");
  assert.match(abas, /const selo = a\.badge \? \(p\.badges\?\.\[a\.badge\] \?\? 0\) : 0;/);
  assert.match(abas, /\{selo > 0 && \(/, "sem não lidas, a aba fica como estava: só o rótulo");
  assert.match(abas, /data-testid=\{`selo-\$\{px\}-\$\{a\.id\}`\}/);
  // O selo fica DENTRO do link da aba (um alvo só) e diz o que conta para quem não vê.
  assert.ok(abas.indexOf("{a.rotulo}") < abas.indexOf("{selo > 0 && (") && abas.indexOf("{selo > 0 && (") < abas.indexOf("</Link>"));
  assert.match(abas, /aria-label=\{`\$\{selo\} \$\{a\.badge === "mensagens" \? "não lidas" : "novos"\}`\}/);
});
