/*
  Estados vazios — Central de Ajuda: falha ao ler os contratos do morador não vira "sem contrato" (a categoria
  "Manutenção" sumia sem aviso para quem mora no imóvel). O servidor lança; a tela avisa e deixa tentar de novo.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVISO_CONTRATOS_INDISPONIVEIS, MSG_CONTRATOS_SEM_LEITURA } from "./contratos-aviso.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("servidor: erro de leitura lança (não devolve lista vazia)", () => {
  const src = ler("../data/atendimento-actions.ts");
  const i = src.indexOf("export async function meusContratosAtivos(");
  const f = src.slice(i, src.indexOf("\n}\n", i));
  assert.match(f, /const \{ data, error \} = await supabase/);
  assert.match(f, /if \(error\) throw new Error\(MSG_CONTRATOS_SEM_LEITURA\);/);
  assert.ok(f.indexOf("if (error)") < f.indexOf("return (data ?? [])"));
  assert.match(MSG_CONTRATOS_SEM_LEITURA, /contratos/);
});

test("tela: falha avisa e oferece tentar de novo; não zera os contratos já lidos", () => {
  const tela = ler("../../components/ajuda/central-ajuda.tsx");
  assert.match(tela, /\.catch\(\(\) => setContratosFalhou\(true\)\)/);
  assert.doesNotMatch(tela, /meusContratosAtivos\(\)\.then\(setContratos\)\.catch\(\(\) => setContratos\(\[\]\)\);\n  \}, \[user\]\);\n\n  const recarregar/);
  assert.match(tela, /data-testid="contratos-indisponiveis"/);
  assert.match(tela, /contratosFalhou=\{contratosFalhou\}/);
  assert.match(tela, /onTentarContratos=\{carregarContratos\}/);
  assert.match(AVISO_CONTRATOS_INDISPONIVEIS, /tente de novo/);
});
