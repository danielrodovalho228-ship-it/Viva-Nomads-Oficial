/* Roda: node --test src/components/account/e972-previa-do-servidor.test.ts
  E972 — a prévia do perfil ("como te veem") ficava em esqueleto nos primeiros segundos: a tela do Perfil já vinha pronta
  do servidor (E789), mas a prévia ainda era buscada pelo navegador depois de carregar. Agora a página de servidor lê as
  duas coisas e entrega a prévia junto. Na tela: t1666. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pagina = readFileSync("src/app/(dashboard)/dashboard/conta/[secao]/page.tsx", "utf8");
const tela = readFileSync("src/components/account/perfil-tela.tsx", "utf8");
const previa = readFileSync("src/components/account/espelho-papel.tsx", "utf8");

test("E972: a página lê a prévia no servidor, em paralelo com o perfil, e a falha vira null (nunca derruba a tela)", () => {
  assert.match(pagina, /const leituraDaPrevia = meuPerfilPublico\(\)\.catch\(\(\) => null\);/);
  assert.match(pagina, /const previaInicial = await leituraDaPrevia;/);
  // Em paralelo: a leitura da prévia começa ANTES de esperar o perfil.
  assert.ok(pagina.indexOf("const leituraDaPrevia = meuPerfilPublico()") < pagina.indexOf("const inicial = await getPerfilInicial()"));
  assert.ok(pagina.indexOf("const inicial = await getPerfilInicial()") < pagina.indexOf("const previaInicial = await leituraDaPrevia"));
});

test("E972: as duas prévias da tela (ao lado, no computador; no corpo, no celular) recebem a leitura do servidor", () => {
  assert.equal((tela.match(/<EspelhoPorPapel papel=\{papelEspelho\} inicial=\{previaInicial\} /g) ?? []).length, 2);
  assert.equal((tela.match(/<EspelhoPorPapel /g) ?? []).length, 2, "nenhuma prévia sem a leitura do servidor");
});

test("E972: com a leitura do servidor a prévia nasce com o cartão e não pede de novo; sem ela, lê do navegador (E799)", () => {
  assert.match(previa, /const temInicial = !!p\.inicial;/);
  assert.match(previa, /useState<MeuPerfilPublico \| null>\(p\.inicial \?\? null\)/);
  assert.match(previa, /useState<"carregando" \| "falha" \| "ok">\(temInicial \? "ok" : "carregando"\)/);
  assert.match(previa, /if \(temInicial && tentativa === 0\) return;/);
  // A regra do E799 não mudou: quem decide o cartão é a leitura; sem leitura, espera ou avisa — nunca chuta.
  assert.match(previa, /const estado = estadoDoEspelho\(\{ leitura, ehDono, papelDoModo: p\.papel, visto \}\);/);
  assert.match(previa, /data-testid="espelho-tentar-de-novo"/);
});
