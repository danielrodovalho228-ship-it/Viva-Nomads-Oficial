/*
  Varredura de erros (rodada 28): a falha de leitura da proposta não vira "não encontrada".
  Achado 139: o detalhe da proposta (as duas partes) tratava a falha do banco como proposta inexistente — a página dava
    404 e o interessado ou o dono achava que a proposta tinha sumido. Agora a falha LANÇA (tela de erro com "Tentar de
    novo"); "não encontrada" fica só para quem não é parte (a RLS devolve vazio, sem erro) ou para o id inexistente.
  Achado 140: responder (aceitar, recusar, contrapropor) com a leitura falhando dizia "Proposta não encontrada."; agora diz
    que não foi possível carregar e que dá para tentar de novo.
  Roda: node --test src/lib/data/achado139-140-proposta-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./propostas-actions.ts", import.meta.url), "utf8");

test("Achado 139: o detalhe lança na falha ao ler a proposta e as versões", () => {
  const fn = src.slice(src.indexOf("export async function lerProposta"), src.indexOf("export type Resposta"));
  assert.match(fn, /const \{ data: pRow, error: erroProposta \} = await s\.supabase\.from\("propostas"\)/);
  assert.match(fn, /if \(erroProposta\) throw new Error\(MSG_PROPOSTA_NAO_CARREGOU\);/);
  assert.match(fn, /const \{ data: vs, error: erroVersoes \} = await s\.supabase\.from\("proposta_versoes"\)/);
  assert.match(fn, /if \(erroVersoes\) throw new Error\(MSG_PROPOSTA_NAO_CARREGOU\);/);
  // quem não é parte (RLS vazia, sem erro) segue recebendo null → 404
  assert.ok(fn.indexOf("if (erroProposta)") < fn.indexOf("if (!p) return null;"));
});

test("Achado 140: responder diz 'não foi possível carregar' (e não 'não encontrada') quando a leitura falha", () => {
  const car = src.slice(src.indexOf("async function carregarParaResponder"), src.indexOf("/** E444: responder"));
  assert.match(car, /const \{ data, error \} = await s\.supabase\.from\("propostas"\)/);
  assert.match(car, /const \{ data: v, error: erroV \} = await s\.admin\.from\("proposta_versoes"\)/);
  assert.match(car, /if \(error\) return "falhou" as const;/);
  assert.match(car, /if \(erroV\) return "falhou" as const;/);
  assert.match(src, /if \(c === "falhou"\) return \{ ok: false, error: "Não foi possível carregar a proposta agora\. Tente de novo\." \};\s*\n\s*if \(!c\) return \{ ok: false, error: "Proposta não encontrada\." \};/);
});

test("a página da proposta segue com notFound() só para o null (quem não é parte)", () => {
  const pagina = readFileSync(new URL("../../app/(dashboard)/dashboard/propostas/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /if \(!p\) notFound\(\);/);
});
