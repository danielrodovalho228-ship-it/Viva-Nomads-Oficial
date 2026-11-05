/*
  E537 — em Conta › Papéis, o interruptor "Quero morar" aparecia DESLIGADO num papel ATIVO: o resumo "Como você usa a
  Viva" dizia Morador "Em uso" (e "Quero anunciar" ligado). Causa: o interruptor lia só a intenção declarada
  (profiles.intencao); contas como inquilino2@ e qa-muse-2@ têm o papel de morador em uso com intenção ["anunciar"].
  Correção: "Quero morar" fica LIGADO quando a intenção tem "morar" OU o papel de morador está em uso (a mesma regra do
  "Em uso", agora num hook único). Em uso, o interruptor fica travado ligado, com a frase de como trocar de papel.
  Roda: node --test src/lib/conta/e537-quero-morar-papel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoQueroMorar, TEXTO_MORAR_EM_USO } from "./tela-papeis.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("estadoQueroMorar: em uso → ligado e travado; senão segue a intenção", () => {
  assert.deepEqual(estadoQueroMorar(["anunciar"], true), { ligado: true, travado: true }, "o caso do QA (inquilino2/qa-muse-2)");
  assert.deepEqual(estadoQueroMorar(["morar"], true), { ligado: true, travado: true });
  assert.deepEqual(estadoQueroMorar(["morar"], false), { ligado: true, travado: false });
  assert.deepEqual(estadoQueroMorar(["anunciar"], false), { ligado: false, travado: false });
  assert.deepEqual(estadoQueroMorar([], false), { ligado: false, travado: false });
  assert.match(TEXTO_MORAR_EM_USO, /Em uso/);
});

test("a tela usa a mesma regra do 'Em uso' (hook único) para o interruptor e o selo", () => {
  const tela = ler("components/account/tela-papeis.tsx");
  assert.match(tela, /const emUso = usePapelEmUso\(\);/);
  assert.match(tela, /const \{ ligado: morar, travado: morarTravado \} = estadoQueroMorar\(intencao, emUso === "morador"\);/);
  assert.match(tela, /<CartaoPapel id="morar" foto=\{PHOTOS\.papeis\.morar\} ativo=\{morar\}>/);
  assert.match(tela, /<Switch checked=\{morar\} disabled=\{morarTravado\}/);
  assert.match(tela, /data-testid="papel-morar-em-uso"/);
  const seus = ler("components/account/seus-papeis.tsx");
  assert.match(seus, /const emUso = usePapelEmUso\(\);/);
  const hook = ler("components/account/use-papel-em-uso.ts");
  assert.match(hook, /parceiroAtivo && aprovado \? "parceiro" : papelDoModo\(mode === "owner" \? "owner" : "tenant"\)/);
  assert.match(hook, /if \(admin\) return null;/);
});
