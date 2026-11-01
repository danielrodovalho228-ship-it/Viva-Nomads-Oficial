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

test("achado 39: a fila e o histórico lançam no erro; designar não diz 'nenhum elegível' por falha de leitura", () => {
  const srv = ler("./servidor.ts");
  assert.match(srv, /export async function filaDaCidade[\s\S]*?if \(error\) throw new Error[\s\S]*?if \(erroPerfis\) throw new Error/);
  assert.match(srv, /export async function historicoDoPedido[\s\S]*?if \(falha\) throw new Error/);
  const designar = srv.slice(srv.indexOf("export async function designar"), srv.indexOf("export async function passarAoProximo") > 0 ? srv.indexOf("export async function passarAoProximo") : undefined);
  const catchAte = designar.indexOf("} catch (e) {");
  assert.ok(catchAte > 0, "designar trata a falha de leitura");
  const bloco = designar.slice(catchAte, designar.indexOf("return null;", catchAte));
  assert.match(bloco, /aguardando_avaliador: true/);
  assert.doesNotMatch(bloco, /naFilaDoAdmin|avisarAdmins|sem_avaliador/);
  assert.match(designar, /if \(jaLeitura\.error\) throw/);
});
