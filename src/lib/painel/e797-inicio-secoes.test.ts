/*
  E797 (opção b do chat principal): o Início chega em seções. Roda: node --test src/lib/painel/e797-inicio-secoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textoDoTopo } from "./inicio-secoes.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const D = "src/app/(dashboard)/dashboard";

test("o topo saúda pelo primeiro nome; sem nome, neutro", () => {
  assert.equal(textoDoTopo("Bruno"), "Olá, Bruno!");
  assert.equal(textoDoTopo("  "), "Olá!");
  assert.equal(textoDoTopo(null), "Olá!");
});

test("a página do Início: topo → dados → fixos; as leituras em InicioDados (o 1º quadro é a casca do loading.tsx)", () => {
  const p = ler(`${D}/page.tsx`);
  assert.doesNotMatch(p, /await /);
  assert.doesNotMatch(p, /<Suspense/, "sem Suspense interno: o bloco ficava visível e inerte (t266)");
  const iTopo = p.indexOf("<InicioTopo />");
  const iDados = p.indexOf("<InicioDados />");
  const iFixo = p.indexOf("<InicioFixo />");
  assert.ok(iTopo > -1 && iDados > iTopo && iFixo > iDados, "topo → dados → fixos");
  const d = ler(`${D}/inicio-dados.tsx`);
  assert.match(d, /export async function InicioDados\(\)/);
  assert.match(d, /listMyProperties\(\{ exigir: true \}\)/);
});

test("o loading.tsx do painel: no Início, a casca (topo, marcador, fixos) — nunca o esqueleto de página inteira", () => {
  const l = ler(`${D}/loading.tsx`);
  assert.match(l, /usePathname\(\) === "\/dashboard"/);
  const iInicio = l.indexOf('usePathname() === "/dashboard"');
  const iLista = l.indexOf("<SkeletonLista />");
  assert.ok(iInicio > -1 && iLista > iInicio, "o Início sai antes do SkeletonLista");
  const casca = l.slice(iInicio, iLista);
  for (const c of ["<InicioTopo />", "<MarcadorSecaoInicio />", "<InicioFixo />"]) assert.ok(casca.includes(c), c);
});

test("Peça na Viva e Ferramentas do dono saíram do bloco de dados (pintam no 1º quadro), com os mesmos testids", () => {
  const c = ler("src/components/painel/inicio-dono.tsx");
  const iFixo = c.indexOf("export function InicioDonoFixo()");
  assert.ok(iFixo > -1);
  const dono = c.slice(c.indexOf("export function InicioDono("), iFixo);
  assert.doesNotMatch(dono, /data-testid="inicio-dono-peca"|data-testid="inicio-dono-atalhos"/);
  for (const t of ["inicio-dono-peca", "inicio-dono-pedido", "inicio-dono-servico", "inicio-dono-atalhos", "inicio-dono-todas-ferramentas"]) {
    assert.match(c.slice(iFixo), new RegExp(`data-testid="${t}"`));
  }
});

test("o código do bloco de dados vem com a casca: topo, marcador e fixos moram no módulo do VisaoGeral (o bloco hidrata ao chegar)", () => {
  assert.match(ler(`${D}/page.tsx`), /import \{ InicioTopo, InicioFixo \} from "\.\/visao-geral-client"/);
  const v = ler(`${D}/visao-geral-client.tsx`);
  for (const f of ["InicioTopo", "MarcadorSecaoInicio", "InicioFixo", "VisaoGeral"]) assert.match(v, new RegExp(`export function ${f}\\(`));
});
