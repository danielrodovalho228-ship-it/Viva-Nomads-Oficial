/*
  Correção do #2261 (varredura ampliada) — o aviso P2 ao Daniel ficava no catch de aoEventoDaEstadia, mas a falha de
  atualizarPedido/cancelarAutomaticos é capturada ANTES, no try/catch de cada ação de executarAcoes (que só fazia
  log). O aviso nunca saía nos dois casos que ele devia cobrir. Agora executarAcoes avisa a equipe quando uma ação de
  evento único (remarcar ou cancelar) falha; "criar" não avisa (o cron diário tenta de novo por 5 dias e a chave da
  automação torna a criação idempotente). O aviso fica num só lugar (avisarFalhaAutomacao), usado pelos dois catch.
  Roda: node --test src/lib/automacao/residuo-aviso-acao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./servidor.ts", import.meta.url), "utf8");
const trecho = (de: string) => src.slice(src.indexOf(de), src.indexOf("\n}\n", src.indexOf(de)));

test("executarAcoes: a falha de remarcar ou cancelar avisa a equipe; criar não avisa", () => {
  const fn = trecho("export async function executarAcoes");
  const c = fn.slice(fn.indexOf("} catch (e) {"));
  assert.match(c, /if \(a\.tipo === "atualizar" \|\| a\.tipo === "cancelar_automaticos"\) await avisarFalhaAutomacao\(admin, a\.tipo, ctx\.id\);/);
});

test("o aviso mora num só lugar e aoEventoDaEstadia usa o mesmo", () => {
  assert.equal((src.match(/\.from\("avisos_daniel"\)/g) ?? []).length, 1);
  const av = trecho("async function avisarFalhaAutomacao");
  assert.match(av, /prioridade: "P2"/);
  assert.match(av, /\.then\(undefined, \(\) => \{\}\)/);
  const ev = trecho("export async function aoEventoDaEstadia");
  assert.match(ev.slice(ev.indexOf("} catch (e) {")), /await avisarFalhaAutomacao\(admin, ev\.tipo, contratoId\);/);
});
