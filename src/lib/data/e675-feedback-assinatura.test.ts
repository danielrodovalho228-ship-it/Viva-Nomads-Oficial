/*
  E675 (07/11, retomada do E652): feedback da assinatura não confiável — o 1º clique mostrava erro embora a assinatura
  estivesse registrada; a confirmação inline era inconsistente.
  Causas no código: (1) o 2º envio (toque duplo, reenvio depois de a resposta demorar) recebia "Você já assinou este
  contrato." como ERRO, mesmo com a assinatura gravada pelo 1º; (2) a tela não tratava exceção da ação depois do registro
  (rede, versão nova no ar) nem impedia o 2º envio enquanto o 1º corria, e não relia o contrato para refletir o estado
  real.
  Roda: node --test src/lib/data/e675-feedback-assinatura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
const acao = ler("lib/data/contrato-assinar-actions.ts");
const corpo = acao.slice(acao.indexOf("export async function assinarContrato"));
const tela = ler("components/contrato/assinar-contrato.tsx");
const assinar = tela.slice(tela.indexOf("async function assinar("), tela.indexOf("if (assinado) return null;"));

test("E675: quem já assinou e envia de novo recebe sucesso (a assinatura existe), não erro, e sem gastar código nem gravar de novo", () => {
  const antes = corpo.slice(0, corpo.indexOf("const motivo = motivoNaoPodeAssinar"));
  assert.match(antes, /if \(jaAssinou[^)]*\)[\s\S]{0,700}return \{\s*ok: true,/);
});

test("E675: a tela não envia duas vezes ao mesmo tempo", () => {
  assert.match(assinar, /if \(enviando\) return;/);
});

test("E675: exceção da ação não deixa a tela muda: mensagem clara e o contrato é relido para mostrar o estado real", () => {
  assert.match(assinar, /catch \{/);
  assert.match(assinar, /Atualize a página|Não conseguimos confirmar/);
  assert.match(assinar, /router\.refresh\(\)/);
});

test("E675: resposta de erro também relê o contrato (se a assinatura entrou, a tela mostra assinado)", () => {
  const erroRamo = assinar.slice(assinar.indexOf("if (!r.ok)"), assinar.indexOf("setAssinado(true)"));
  assert.match(erroRamo, /router\.refresh\(\)/);
});
