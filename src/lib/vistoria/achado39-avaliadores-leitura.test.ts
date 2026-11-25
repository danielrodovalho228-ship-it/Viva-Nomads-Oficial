import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("achado 39: /admin/avaliadores não mostra listas vazias quando uma leitura falha", () => {
  const pagina = ler("../../app/(dashboard)/admin/avaliadores/page.tsx");
  assert.match(pagina, /function semFalhaDeLeitura[\s\S]*?if \(falha\) throw new Error/);
  // As três rodadas de leitura passam pela checagem (credenciamento, preços, filas, pedidos, bloqueios, strikes,
  // laudos; contestações, devoluções, atrasos; recusas e contas de teste).
  assert.equal((pagina.match(/semFalhaDeLeitura\(/g) ?? []).length, 3);
  assert.match(pagina, /\] = semFalhaDeLeitura\(await Promise\.all\(\[\s*admin\.from\("avaliadores_credenciamento"\)/);
  assert.match(pagina, /semFalhaDeLeitura\(\[recusasLeitura, perfisLeitura\] as const\)/);
  // O aviso do admin ("Tentar de novo") existe para receber o erro.
  assert.match(ler("../../app/(dashboard)/admin/error.tsx"), /Tentar de novo/);
});

test("achado 39: a fila e o histórico lançam no erro; abrirEscolha não diz 'nenhum avaliador' por falha de leitura", () => {
  const srv = ler("./servidor.ts");
  assert.match(srv, /export async function filaDaCidade[\s\S]*?if \(error\) throw new Error[\s\S]*?if \(erroPerfis\) throw new Error/);
  assert.match(srv, /export async function historicoDoPedido[\s\S]*?if \(falha\) throw new Error/);
  // E648: a leitura da escolha do dono (antes, da designação) lança em erro e abrirEscolha não diz "ninguém" por falha.
  const leitura = srv.slice(srv.indexOf("async function leituraDaEscolha"), srv.indexOf("export async function abrirEscolha"));
  assert.match(leitura, /if \(jaLeitura\.error\) throw/);
  const abrir = srv.slice(srv.indexOf("export async function abrirEscolha"), srv.indexOf("export async function sugeridosDoPedido"));
  const catchAte = abrir.indexOf("} catch (e) {");
  assert.ok(catchAte > 0, "abrirEscolha trata a falha de leitura");
  const bloco = abrir.slice(catchAte, abrir.indexOf("return null;", catchAte));
  assert.match(bloco, /aguardando_avaliador: true/);
  assert.doesNotMatch(bloco, /naFilaDoAdmin|avisarAdmins|sem_avaliador/);
});
