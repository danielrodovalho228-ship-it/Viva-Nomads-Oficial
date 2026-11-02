/*
  Estados vazios — publicar anúncio (criar e editar): a falha ao ler o perfil do dono não vira "Complete seu perfil".
  Antes, o erro da leitura deixava o perfil null e o dono com nome e telefone em dia recebia MSG_PERFIL_DONO_INCOMPLETO.
  Agora a falha devolve MSG_PERFIL_SEM_LEITURA ("tente de novo"); a regra F45 segue igual.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_PERFIL_DONO_INCOMPLETO, MSG_PERFIL_SEM_LEITURA, perfilDonoCompleto } from "../anuncio/perfil-dono.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("perfil null (o que a falha produzia) é tratado como incompleto — por isso a falha precisa de mensagem própria", () => {
  assert.equal(perfilDonoCompleto(null), false);
  assert.notEqual(MSG_PERFIL_SEM_LEITURA, MSG_PERFIL_DONO_INCOMPLETO);
  assert.doesNotMatch(MSG_PERFIL_SEM_LEITURA, /Complete/);
});

test("criar e editar: erro de leitura do perfil devolve MSG_PERFIL_SEM_LEITURA antes da regra F45", () => {
  const src = ler("./actions.ts");
  const leituras = src.match(/const \{ data: perfil, error: ePerfil \} = await supabase\.from\("profiles"\)\.select\("full_name, phone"\)/g) ?? [];
  assert.equal(leituras.length, 2, "createProperty e updateProperty");
  assert.equal((src.match(/if \(ePerfil\) return \{ ok: false, error: MSG_PERFIL_SEM_LEITURA \};\n\s+if \(!perfilDonoCompleto\(/g) ?? []).length, 2);
  assert.doesNotMatch(src, /const \{ data: perfil \} = await supabase\.from\("profiles"\)\.select\("full_name, phone"\)/);
});
