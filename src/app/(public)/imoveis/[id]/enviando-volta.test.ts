import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Ordem fe7ac2e7 (F12): depois de enviar a dúvida ao proprietário, o rótulo "Enviando..." não pode ficar na tela.
 * O estado `pending` precisa voltar a null em TODO desfecho do envio (sucesso, falha do servidor, rede caída),
 * e o botão da dúvida troca para "Mensagem enviada" quando dá certo.
 */
const fonte = readFileSync(new URL("./property-detail.tsx", import.meta.url), "utf8");

function corpoDoHandleLead(): string {
  const inicio = fonte.indexOf("async function handleLead(");
  assert.ok(inicio >= 0, "handleLead existe");
  const fim = fonte.indexOf("\n  }\n", inicio);
  assert.ok(fim > inicio);
  return fonte.slice(inicio, fim);
}

test("F12: pending volta a null antes de qualquer saída depois do envio", () => {
  const corpo = corpoDoHandleLead();
  const liga = corpo.indexOf("setPending(kind)");
  const envio = corpo.indexOf("await requestLead(");
  const desliga = corpo.indexOf("setPending(null)");
  assert.ok(liga >= 0 && envio > liga && desliga > envio, "liga → envia → desliga, nesta ordem");
  // Nenhum return entre ligar o pending e desligá-lo (senão o "Enviando..." fica preso).
  assert.doesNotMatch(corpo.slice(liga, desliga), /\breturn\b/);
  // O envio não pode lançar sem passar pelo setPending(null): a promessa tem .catch ou o reset está num finally.
  const trecho = corpo.slice(envio, desliga);
  const temCatch = /\.catch\(\s*\(\)\s*=>\s*null\s*\)/.test(trecho);
  const temFinally = /finally\s*\{[^}]*setPending\(null\)/.test(corpo);
  assert.ok(temCatch || temFinally, "erro de rede não pode pular o setPending(null)");
});

test("F12: o botão da dúvida mostra 'Mensagem enviada' depois do sucesso, não 'Enviando...'", () => {
  assert.match(fonte, /sent\.duvida \? \([\s\S]{0,120}Mensagem enviada/);
  assert.match(fonte, /pending === "duvida" \? "Enviando\.\.\." : "Enviar mensagem"/);
});

test("F12: o modal da mensagem fecha quando o envio dá certo", () => {
  assert.match(fonte, /const ok = await handleLead\(composeKind, composeText\);\s*if \(ok\) setComposeKind\(null\);/);
});
