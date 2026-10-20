/*
  Assinar: o cartão "quem assinou" muda na hora, com o texto que a própria ação devolve (lab: t205 passo 4 viu
  "Nenhuma assinatura ainda." por 30 s depois de assinar, em 3 de 8 execuções).
  Roda: node --test src/lib/contrato-aviso-na-hora.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const acao = ler("./data/contrato-assinar-actions.ts");
const form = ler("../components/contrato/assinar-contrato.tsx");
const aviso = ler("../components/contrato/aviso-assinatura.tsx");
const detalhe = ler("../components/contrato/contrato-detalhe.tsx");

test("a ação devolve o cartão já com a assinatura nova (nome, papel, data e o que falta)", () => {
  assert.match(acao, /return \{ ok: true, aviso \}/);
  assert.match(acao, /em: visao\.papel === "inquilino" \? agora : c\.assinado_inquilino_em/);
});

test("o formulário publica o texto novo e o cartão o mostra sem esperar o servidor", () => {
  assert.match(form, /dispatchEvent\(new CustomEvent\(EVENTO_AVISO_ASSINATURA/);
  assert.match(aviso, /addEventListener\(EVENTO_AVISO_ASSINATURA/);
  assert.match(aviso, /\{local \?\? aviso\}/);
  assert.match(aviso, /d\?\.contratoId === contratoId/); // só o contrato aberto
  assert.match(aviso, /setLocal\(null\)/); // texto novo do servidor volta a valer
});

test("o detalhe usa o cartão com o mesmo data-testid", () => {
  assert.match(detalhe, /<AvisoAssinatura contratoId=\{c\.id\} aviso=\{c\.aviso\} \/>/);
  assert.match(aviso, /data-testid="contrato-aviso-assinatura"/);
  assert.doesNotMatch(detalhe, /data-testid="contrato-aviso-assinatura"/);
});
