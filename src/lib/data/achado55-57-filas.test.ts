/*
  Varredura de erros (rodada 7) — falha de leitura não vira fila vazia nem contagem falsa.
  Achado 55: meusPedidosDeAjuda → o andamento (e a decisão do rascunho montado pela equipe) sumia; o dono pedia de novo.
  Achado 56: filaAjudaPublicacaoAdmin → a fila da equipe aparecia vazia.
  Achado 57: pedidosExpirandoSemResposta → "0 expirando" (falha nos pedidos) ou TODOS "sem resposta" (falha nas respostas).
  Roda: node --test src/lib/data/achado55-57-filas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const trecho = (s: string, de: string, ate: string) => s.slice(s.indexOf(de), s.indexOf(ate, s.indexOf(de) + de.length));

test("achado 55: o dono vê o aviso quando o andamento da ajuda não carrega (a lista de imóveis continua)", () => {
  const s = ler("src/lib/data/ajuda-publicacao-actions.ts");
  assert.match(trecho(s, "export async function meusPedidosDeAjuda", "export async function filaAjudaPublicacaoAdmin"), /if \(error\) throw new Error/);
  const pagina = ler("src/app/(dashboard)/dashboard/imoveis/page.tsx");
  assert.match(pagina, /meusPedidosDeAjuda\(\)\.catch\(\(\) => null\)/);
  assert.match(pagina, /\{ajudas === null && \(/);
  assert.match(pagina, /data-testid="ajuda-andamento-falha"/);
});

test("achado 56: a fila de ajuda do admin lança na falha (a página cai no aviso de erro do admin)", () => {
  const s = ler("src/lib/data/ajuda-publicacao-actions.ts");
  assert.match(trecho(s, "export async function filaAjudaPublicacaoAdmin", "\n}\n"), /if \(error\) throw new Error\("Não foi possível ler a fila de ajuda para publicar agora\."\);/);
  assert.ok(readFileSync(new URL("../../../src/app/(dashboard)/admin/error.tsx", import.meta.url), "utf8").length > 0);
});

test("achado 57: os pedidos expirando lançam nas duas leituras; os chamadores tratam a falha", () => {
  const s = ler("src/lib/data/admin-indicadores.ts");
  const fn = trecho(s, "export async function pedidosExpirandoSemResposta", "\n}\n");
  assert.match(fn, /if \(error\) throw new Error\("Não foi possível ler os pedidos ativos agora\."\);/);
  assert.match(fn, /if \(eResp\) throw new Error\("Não foi possível ler as respostas aos pedidos agora\."\);/);
  assert.match(ler("src/lib/data/admin-decisoes.ts"), /ler\(pedidosExpirandoSemResposta\(admin\)\)/);
  assert.match(ler("src/lib/data/admin-visao-geral.ts"), /pedidosExpirandoSemResposta\(admin\)\.catch\(\(\) => null\)/);
});
