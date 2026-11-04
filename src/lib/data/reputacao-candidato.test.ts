/*
  Estados vazios (cartão do candidato em Interessados): getReputacao devolvia {media: 0, n: 0} quando a leitura falhava
  — e o mesmo para quem ainda não tem avaliação. Como o objeto é "verdadeiro", o cartão mostrava "0,0 · 0 avaliações de
  proprietários": nota zero inventada por falha, e um selo vazio para quem só não foi avaliado ainda. Agora a falha
  LANÇA (o cartão fica sem o selo, como já tratava o .catch) e o selo só aparece com pelo menos uma avaliação.
  Roda: node --test src/lib/data/reputacao-candidato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("getReputacao: a falha da leitura lança (nunca vira nota 0)", () => {
  const s = readFileSync("src/lib/data/avaliacoes-actions.ts", "utf8");
  const fn = s.slice(s.indexOf("export async function getReputacao"), s.indexOf("export async function getReputacao") + 900);
  assert.match(fn, /const \{ data, error \} = await supabase\.from\("avaliacoes"\)/);
  assert.match(fn, /if \(error\) throw new Error\(/);
});

test("cartão do candidato: o selo de avaliações só com pelo menos uma avaliação", () => {
  const s = readFileSync("src/lib/data/leads.ts", "utf8");
  assert.match(s, /if \(rep && rep\.n > 0\) reputacoes\.set\(id, rep\);/);
});
