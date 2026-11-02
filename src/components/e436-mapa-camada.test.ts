/*
  E436 (D-V11, lab 02/11): o aviso do E419 ("Não foi possível carregar o mapa agora.") passava por cima do cabeçalho a
  1280 px. Causa: o aviso usa z-[500] (acima dos painéis do Leaflet, z 400) e o quadro do mapa não isolava as camadas —
  o z valia na página inteira, acima do cabeçalho fixo (z-40). Agora o quadro é `isolate`; o mesmo no mapa do bairro do
  cadastro (selo do bairro em z-[400]).
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("o quadro do mapa isola as camadas (o aviso z-[500] não sobe acima do cabeçalho)", () => {
  const m = ler("src/components/property-map.tsx");
  assert.match(m, /<div className=\{cn\("relative isolate", className\)\} data-testid="mapa-quadro">/);
  assert.match(m, /<div className="absolute inset-0 z-\[500\]">\n\s*<MapaIndisponivel/);
});

test("mapa do bairro no cadastro também isolado", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/resumo-endereco.tsx"), /className="relative isolate overflow-hidden rounded-xl border border-line" data-testid="mapa-bairro"/);
});
