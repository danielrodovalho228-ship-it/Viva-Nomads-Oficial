/*
  Varredura de erros e estados vazios (rodada 19) — leitura que falha nunca vira "vazio" que regrava ou decide.
  Achado 92: proximidades — as leituras do CEP guardado, do cache do CEP e das gravadas engoliam o erro → a regravação
             perdia as distâncias; e qualquer falha do teste de colunas gravava no formato antigo (sem "não mostrar").
  Achado 93: idsContasTeste/leadsDeTeste engoliam o erro → contas de teste nos números do admin (e em Correções).
  Achado 94: localDaEntrada → a falha virava "local inválido" (a pessoa trocaria um local certo).
  Roda: node --test src/lib/data/achado92-94.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const fn = (s: string, de: string) => {
  const i = s.indexOf(de);
  const j = s.indexOf("\nexport ", i + 1);
  return s.slice(i, j < 0 ? undefined : j);
};

test("achado 92: proximidades lançam na falha (as gravadas ficam como estão); só a coluna ausente usa o formato antigo", () => {
  const s = ler("src/lib/data/proximidades-gravar.ts");
  const para = fn(s, "export async function proximidadesParaGravar");
  for (const v of ["lido", "lidoCep", "lidasAntigas"]) assert.match(para, new RegExp(`if \\(${v}\\?\\.error\\) throw new Error\\(MSG_PROXIMIDADES_SEM_LEITURA\\);`), v);
  assert.match(fn(s, "export async function gravarProximidades"), /if \(teste\.error && teste\.error\.code !== "42703"\) throw new Error\(MSG_PROXIMIDADES_SEM_LEITURA\);/);
  // Quem chama (criar e editar o anúncio) segue em try/catch: o anúncio salva; as proximidades antigas ficam.
  const a = ler("src/lib/data/actions.ts");
  assert.equal(a.match(/try \{\s*const admin = createAdminClient\(\);\s*await gravarProximidades\(/g)?.length, 2);
});

test("achado 93: contas e candidaturas de teste lançam; a Inicial do admin não conta teste como real", () => {
  const s = ler("src/lib/data/admin-indicadores.ts");
  assert.match(fn(s, "export async function idsContasTeste"), /if \(error\) throw new Error\("Não foi possível ler as contas de teste\."\);/);
  assert.match(fn(s, "export async function leadsDeTeste"), /if \(error\) throw new Error\(/);
  const p = ler("src/app/(dashboard)/admin/page.tsx");
  assert.match(p, /idsContasTeste\(admin\)\.catch\(\(\) => null\)/);
  assert.match(p, /admin && teste \? numerosDaInicial\(admin, teste\)/);
  assert.match(p, /admin && teste \? atividadeRecente\(admin, teste\)/);
  assert.doesNotMatch(p, /catch\(\(\) => new Set<string>\(\)\)/);
});

test("achado 94: local de trabalho — falha da leitura pede para tentar de novo, nunca 'inválido'", () => {
  assert.match(fn(ler("src/lib/data/local-trabalho.ts"), "export async function localDaEntrada"), /if \(error\) throw new Error\(/);
  const acao = ler("src/lib/data/local-trabalho-actions.ts");
  assert.match(acao, /localDaEntrada\(admin, entrada\)\.catch\(\(\) => "falhou" as const\);\s*if \(local === "falhou"\) return/);
  const ped = ler("src/lib/data/pedidos-actions.ts");
  assert.match(ped, /localDaEntrada\(admin, input\.destino \?\? null\)\.catch\(\(\) => "falhou" as const\)/);
  assert.equal(ped.match(/if \(destino === "falhou"\) return \{ ok: false, error: /g)?.length, 2);
});
