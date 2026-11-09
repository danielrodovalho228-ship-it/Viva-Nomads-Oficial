/*
  E727 — "Continuar" de /parceiros ignorava a sessão ativa e mandava a pessoa logada a /auth (novo código por e-mail).
  E728 — o CNPJ digitado se perdia na volta do /auth. Roda: node --test src/lib/parceiros/e727-e728-continuar.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("E727: /parceiros passa pelo proxy, que renova a sessão (cookies novos na resposta) antes de a página lê-la", () => {
  const proxy = ler("src/proxy.ts");
  const matcher = proxy.slice(proxy.indexOf("matcher: ["));
  assert.match(matcher, /"\/parceiros",\s*"\/parceiros\/:path\*"/);
  // A renovação existe e grava os cookies na resposta (E428): é ela que o /parceiros agora recebe.
  assert.match(proxy, /const comCookies = \(r: NextResponse\) =>/);
  // A página lê a sessão no servidor.
  assert.match(ler("src/lib/parceiros/solicitacao-actions.ts"), /export async function minhaParceria\(\)/);
});

test("E727: com sessão, o botão é 'Enviar pedido de parceria' e nunca manda a /auth", () => {
  const f = ler("src/components/parceiros/seja-parceiro-form.tsx");
  // E731: o rótulo vem da função pura (sessão do servidor OU do navegador).
  assert.match(f, /rotuloEnvioParceria\(estado\.logado, logadoNoNavegador\)/);
  assert.match(f, /return irParaConta\(\);/); // /auth só para quem não tem sessão nenhuma
  assert.match(f, /if \(logadoNoNavegador\) return setErro\(ERRO_SESSAO_NAO_CONFIRMADA\)/);
});

test("E728: o CNPJ entra no rascunho da ida ao /auth e volta como os outros campos; só o aceite não é guardado", () => {
  const f = ler("src/components/parceiros/seja-parceiro-form.tsx");
  assert.match(f, /const \{ aceite: _a, \.\.\.resto \} = c;/);
  assert.doesNotMatch(f, /const \{ documento: _doc/);
  assert.match(f, /documento: typeof salvo\.documento === "string" && salvo\.documento \? salvo\.documento : x\.documento, aceite: false/);
  // O CNPJ só chega ao rascunho depois de conferido (CPF é recusado antes de ir ao /auth).
  assert.ok(f.indexOf("validarDocumentoParceiro(c.documento)") < f.indexOf("return irParaConta();", f.indexOf("function enviar")));
  // Sai do armazenamento quando a pessoa volta logada.
  assert.match(f, /if \(estado\.logado\) sessionStorage\.removeItem\(RASCUNHO\)/);
});
