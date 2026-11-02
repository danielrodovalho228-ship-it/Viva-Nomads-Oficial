/*
  Varredura ampliada (funções internas) — automação da estadia (médio-baixo): quando a estadia é remarcada ou o
  contrato é encerrado, aoEventoDaEstadia atualiza ou cancela os pedidos automáticos de limpeza/lavanderia do parceiro
  fixo. atualizarPedido e cancelarAutomaticos liam os pedidos sem conferir o erro: na falha, nada era atualizado ou
  cancelado, EM SILÊNCIO — o parceiro podia ir na data velha ou depois do contrato encerrado. O evento é único (não há
  nova tentativa), então: as leituras LANÇAM e aoEventoDaEstadia, além do log, deixa um aviso P2 ao Daniel com o
  evento e o contrato (sem dado pessoal), para a equipe conferir os pedidos à mão.
  Roda: node --test src/lib/automacao/residuo-evento-estadia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./servidor.ts", import.meta.url), "utf8");
const trecho = (de: string) => src.slice(src.indexOf(de), src.indexOf("\n}\n", src.indexOf(de)));

test("atualizarPedido e cancelarAutomaticos lançam na falha da leitura (nunca 'nada a fazer' em silêncio)", () => {
  const atu = trecho("async function atualizarPedido(");
  assert.match(atu, /const \{ data, error: erroPedido \} = await admin\.from\("parceiro_pedidos"\)/);
  assert.ok(atu.indexOf("if (erroPedido) throw new Error(") < atu.indexOf("if (!p) return false;"));
  const can = trecho("async function cancelarAutomaticos(");
  assert.match(can, /const \{ data, error: erroPedidos \} = await admin/);
  assert.ok(can.indexOf("if (erroPedidos) throw new Error(") < can.indexOf("for (const p of"));
});

test("aoEventoDaEstadia: a falha avisa a equipe (avisos_daniel P2, sem dado pessoal) além do log", () => {
  const ev = trecho("export async function aoEventoDaEstadia");
  const c = ev.slice(ev.indexOf("} catch (e) {"));
  // O aviso mora em avisarFalhaAutomacao (o mesmo de executarAcoes, residuo-aviso-acao.test.ts).
  assert.match(c, /await avisarFalhaAutomacao\(admin, ev\.tipo, contratoId\);/);
  assert.match(c, /return null;/);
  const av = trecho("async function avisarFalhaAutomacao");
  assert.match(av, /\.from\("avisos_daniel"\)\s*\.insert\(\{/);
  assert.match(av, /prioridade: "P2"/);
  assert.match(av, /contrato \$\{contratoId\}/);
  assert.match(av, /\.then\(undefined, \(\) => \{\}\)/, "o aviso é best-effort");
});
