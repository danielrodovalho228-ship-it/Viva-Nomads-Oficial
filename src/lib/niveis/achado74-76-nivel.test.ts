/*
  Varredura de erros e estados vazios (rodada 13) — leitura que falha nunca rebaixa o nível do anúncio.
  Achado 74: entradaDoNivel engolia o erro das 5 leituras → itens, medidas e ruído "vazios" → recalcularNivel gravava
             um nível MAIS BAIXO em imovel_nivel (o público vê) e mandava ao dono o aviso "seu nível caiu".
  Achado 75: laudoQuePrevalece engolia o erro → sem laudo, a autodeclaração passava por cima do laudo no recálculo.
  Achado 76: o bloco "Nível do anúncio" do cadastro abria vazio (nível mais baixo, ruído em branco) na falha.
  Roda: node --test src/lib/niveis/achado74-76-nivel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const srv = ler("src/lib/niveis/servidor.ts");

test("achado 74: entradaDoNivel lança na falha de qualquer das 5 leituras; recalcularNivel então não grava nem avisa", () => {
  const fn = srv.slice(srv.indexOf("export async function entradaDoNivel"), srv.indexOf("export async function nivelGravado"));
  assert.match(fn, /if \(decl\.error \|\| itens\.error \|\| medidas\.error \|\| ruido\.error \|\| pend\.error\) throw new Error\(MSG_NIVEL_SEM_LEITURA\);/);
  const rec = srv.slice(srv.indexOf("export async function recalcularNivel"));
  // A leitura vem ANTES de gravar e de avisar; o try/catch devolve null (nada gravado).
  assert.ok(rec.indexOf("await entradaDoNivel(") < rec.indexOf('.from("imovel_nivel").upsert('));
  assert.ok(rec.indexOf("await laudoQuePrevalece(") < rec.indexOf('.from("imovel_nivel").upsert('));
  assert.match(rec, /\} catch \(e\) \{\s*console\.error\("\[recalcularNivel\]", e\);\s*return null;/);
  // A tela do dono: itens e extras não lidos não viram "não declarado".
  assert.match(ler("src/lib/data/nivel-actions.ts"), /if \(itens\.error \|\| extras\.error\) throw new Error/);
});

test("achado 75: laudoQuePrevalece lança na falha do laudo e dos strikes", () => {
  const fn = srv.slice(srv.indexOf("export async function laudoQuePrevalece"), srv.indexOf("export async function recalcularNivel"));
  assert.match(fn, /const \{ data, error \} = await admin\s*\.from\("vistoria_laudos"\)/);
  assert.match(fn, /if \(error\) throw new Error\(MSG_NIVEL_SEM_LEITURA\);/);
  assert.match(fn, /if \(erroStrikes\) throw new Error\(MSG_NIVEL_SEM_LEITURA\);/);
});

test("achado 76: o bloco do cadastro avisa a falha com Tentar de novo, sem o nível vazio", () => {
  const acao = ler("src/lib/data/nivel-cadastro-actions.ts");
  assert.doesNotMatch(acao, /catch \{\s*return null;/);
  assert.match(acao, /if \(fotos\.error\) throw new Error/);
  const tela = ler("src/components/niveis/nivel-cadastro.tsx");
  assert.equal((tela.match(/entradaNivelDoCadastro\(propertyId\)\.catch\(\(\) => "falhou" as const\)/g) ?? []).length, 2);
  assert.match(tela, /data-testid="nivel-cadastro-falha"/);
  assert.match(tela, /data-testid="nivel-cadastro-tentar"/);
  assert.ok(tela.indexOf("if (falhou)") < tela.indexOf('data-testid="nivel-cadastro" data-nivel'));
});
