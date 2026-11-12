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

test("a página do Início não espera leitura: topo e partes fixas fora do Suspense; os dados dentro, com o próprio marcador", () => {
  const p = ler(`${D}/page.tsx`);
  assert.doesNotMatch(p, /export default async function/, "a página não é assíncrona (nada a esperar no 1º quadro)");
  assert.doesNotMatch(p, /await /);
  const iTopo = p.indexOf("<InicioTopo />");
  const iSusp = p.indexOf("<Suspense fallback={<MarcadorSecaoInicio />}>");
  const iDados = p.indexOf("<InicioDados />");
  const iFixo = p.indexOf("<InicioFixo />");
  assert.ok(iTopo > -1 && iSusp > iTopo && iDados > iSusp && iFixo > iDados, "topo → Suspense(dados) → fixos");
  // As leituras moraram para InicioDados, sem mudar (o mesmo Promise.all).
  const d = ler(`${D}/inicio-dados.tsx`);
  assert.match(d, /export async function InicioDados\(\)/);
  assert.match(d, /listMyProperties\(\{ exigir: true \}\)/);
});

test("o loading.tsx do painel nunca mostra o esqueleto de página inteira no Início", () => {
  const l = ler(`${D}/loading.tsx`);
  assert.match(l, /usePathname\(\) === "\/dashboard"/);
  const iInicio = l.indexOf('usePathname() === "/dashboard"');
  const iLista = l.indexOf("<SkeletonLista />");
  assert.ok(iInicio > -1 && iLista > iInicio, "o Início sai antes do SkeletonLista");
  assert.match(l.slice(iInicio, iLista), /<InicioTopo \/>/);
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
