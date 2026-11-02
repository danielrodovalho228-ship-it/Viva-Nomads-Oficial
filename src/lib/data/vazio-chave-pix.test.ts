/*
  Estados vazios — Conta › Pagamentos ("Como você recebe"): a leitura da chave Pix que falha não vira "sem chave".
  Antes, minhaChavePix devolvia null no erro e a tela abria o formulário vazio, como se o dono não tivesse chave.
  Agora a leitura lança e a tela mostra o aviso com "Tentar de novo", sem o formulário.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVISO_PIX_FALHOU } from "../conta/tela-pagamentos.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("minhaChavePix lança quando a leitura falha; só a ausência de linha é 'sem chave'", () => {
  const src = ler("./recebimento-actions.ts");
  const i = src.indexOf("export async function minhaChavePix(");
  const f = src.slice(i, src.indexOf("\n}\n", i));
  assert.match(f, /if \(error\) throw new Error\(MSG_PIX_SEM_LEITURA\);\n\s+if \(!data\) return null;/);
  assert.doesNotMatch(f, /error \|\| !data/);
});

test("a tela distingue falha de vazio e oferece tentar de novo", () => {
  const tela = ler("../../components/account/pagamentos-conta.tsx");
  assert.match(tela, /\.catch\(\(\) => vivo && setLeituraFalhou\(true\)\)/);
  assert.ok(tela.includes("leituraFalhou && !pix && !editando ?"));
  assert.match(tela, /data-testid="conta-pix-falhou"/);
  assert.match(tela, /onClick=\{\(\) => setTentativa\(\(t\) => t \+ 1\)\}/);
  assert.match(tela, /\}, \[dono, tentativa\]\);/);
  assert.doesNotMatch(tela, /minhaChavePix\(\)\s*\.then\(\(c\) => vivo && setPix\(c\)\)\s*\.catch\(\(\) => \{\}\)/);
  assert.match(AVISO_PIX_FALHOU, /^Não conseguimos ler a sua chave Pix agora\./);
});
