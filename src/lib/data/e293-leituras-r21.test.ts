/*
  E293 / erros e estados vazios (r21): falha de leitura não vira "não" falso.
  Roda: node --test src/lib/data/e293-leituras-r21.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("Pedidos: a falha de leitura das respostas não vira 'nenhuma resposta ainda'", () => {
  const a = ler("src/lib/data/pedidos-actions.ts");
  assert.match(a, /export async function getRespostasRecebidas\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(a, /if \(error && opcoes\.exigir\) throw new Error\(MSG_PEDIDOS_NAO_CARREGARAM\);\s+\/\/ A RLS já limita/);
  assert.match(ler("src/app/(dashboard)/dashboard/pedidos/page.tsx"), /getRespostasRecebidas\(\{ exigir: true \}\)/);
});

test("Detecção de fotos: galeria, sugestões, itens e 'com pessoa' falham alto, não viram lista vazia", () => {
  const a = ler("src/lib/data/deteccao-actions.ts");
  assert.match(a, /if \(error\) throw new Error\("Não foi possível ler as fotos do anúncio\."\)/);
  assert.match(a, /for \(const r of \[sug, itens, pessoas\]\) if \(r\.error\) throw/);
});

test("Provas do nível e medição: erro ao conferir o dono não vira 'Sem permissão.'", () => {
  const a = ler("src/lib/data/prova-actions.ts");
  assert.equal([...a.matchAll(/return "falhou" as const;/g)].length, 2);
  assert.equal([...a.matchAll(/c === "falhou"\) return \{ ok: false, erro: MSG_NAO_CONFERIU \}/g)].length, 3, "abrirCapturaProva, pedirLinkCelular, pedirLinkMedicao");
  assert.match(a, /const MSG_NAO_CONFERIU = "Não foi possível conferir o anúncio agora\. Tente de novo em instantes\."/);
});
