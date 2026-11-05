/*
  E550 (parte B, dados) — sino: "Fotografe o item pelo celular" aparecia duas vezes, idêntico, sem imóvel (e com o link
  de uso único na URL do aviso). Agora: evento "só e-mail" não grava aviso; o mesmo aviso pendente é renovado, não
  repetido; o título nomeia o imóvel. Roda: node --test src/lib/notifications/e550-sino-dados.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eventoTemCentral } from "./regra-push.ts";
import { chaveDoAvisoPendente, tituloComImovel } from "./avisos.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("a central (sino) segue a matriz: 'só e-mail' não vira aviso", () => {
  assert.equal(eventoTemCentral("nivel_prova_celular"), false);
  assert.equal(eventoTemCentral("contract_signature_code"), false);
  assert.equal(eventoTemCentral("exclusao_conta"), false);
  assert.equal(eventoTemCentral("proposta_recebida"), true);
  assert.equal(eventoTemCentral("evento_fora_da_matriz"), true, "fora da matriz: como antes");
});

test("o título do aviso nomeia o imóvel", () => {
  assert.equal(tituloComImovel("Documento aprovado", "Casa mobiliada no Centro"), "Documento aprovado · Casa mobiliada no Centro");
  assert.equal(tituloComImovel("Documento aprovado", null), "Documento aprovado");
  assert.equal(tituloComImovel("Documento aprovado", "  "), "Documento aprovado");
  // Já nomeado (ex.: título montado com o imóvel): não repete.
  assert.equal(tituloComImovel("Nova candidatura para Casa X", "Casa X"), "Nova candidatura para Casa X");
  assert.ok(tituloComImovel("A", "x".repeat(300)).length <= 160);
});

test("duplicata: mesmo evento + mesmo objeto (ou mesmo título, sem objeto) é o MESMO aviso pendente", () => {
  assert.deepEqual(chaveDoAvisoPendente({ evento: "proposta_recebida", refId: "abc", titulo: "x" }), { evento: "proposta_recebida", refId: "abc" });
  assert.deepEqual(chaveDoAvisoPendente({ evento: "documento_aprovado", refId: null, titulo: "Documento aprovado · Casa X" }), { evento: "documento_aprovado", titulo: "Documento aprovado · Casa X" });
});

test("servidor: renova o pendente em vez de inserir outro; notify só grava com a central e passa o imóvel", () => {
  const s = ler("./avisos-servidor.ts");
  assert.match(s, /\.is\("lido_em", null\)\.is\("resolvido_em", null\)/);
  assert.match(s, /if \(jaExiste\?\.id\) \{[\s\S]{0,200}update\(\{ criado_em: new Date\(\)\.toISOString\(\), titulo, url, texto \}\)/); // E482: + texto
  assert.match(s, /tituloComImovel\(titulo, guardContactInfo\(nome\)\.text\)/);
  const n = ler("./index.ts");
  assert.match(n, /&& eventoTemCentral\(params\.event\)/);
  assert.match(n, /titulo: params\.tituloAviso \?\? mensagem\?\.titulo, texto: mensagem\?\.texto, imovelId: params\.imovelId \}/);
});
