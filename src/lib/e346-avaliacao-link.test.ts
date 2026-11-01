/*
  E346 — "Avaliar a estadia" ia para /dashboard/avaliacoes (a lista de avaliações RECEBIDAS), sem âncora. Agora o link
  abre o formulário daquela estadia: dono → Contratos#avaliar-<contrato>; morador → Locações#avaliar-<contrato>.
  Roda: node --test src/lib/e346-avaliacao-link.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ancoraAvaliacao, hrefAvaliarEstadia } from "./avaliacoes.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const ID = "a0268b00-0000-4000-8000-000000000011";

test("o link de avaliar aponta para a estadia certa de cada lado", () => {
  assert.equal(hrefAvaliarEstadia(ID, "dono"), `/dashboard/contratos#avaliar-${ID}`);
  assert.equal(hrefAvaliarEstadia(ID, "morador"), `/dashboard/locacoes#avaliar-${ID}`);
  assert.equal(ancoraAvaliacao(ID), `avaliar-${ID}`);
});

test("o cron manda o link da estadia (por papel) e as duas telas têm a âncora no formulário", () => {
  const cron = ler("src/app/api/cron/automacoes/route.ts");
  assert.match(cron, /tipo: "avaliacao_pedido", usuarioId: u, refId: c\.id as string, url: hrefAvaliarEstadia\(c\.id as string, u === prop\?\.owner_id \? "dono" : "morador"\)/);
  assert.doesNotMatch(cron, /tipo: "avaliacao_pedido"[^\n]*url: `\/dashboard\/avaliacoes`/);
  const dono = ler("src/app/(dashboard)/dashboard/contratos/contratos-client.tsx");
  assert.match(dono, /<div id=\{ancoraAvaliacao\(contrato\.id\)\} className="scroll-mt-24">\s*<AvaliacaoForm/);
  const morador = ler("src/app/(dashboard)/dashboard/locacoes/locacoes-client.tsx");
  assert.match(morador, /<div id=\{ancoraAvaliacao\(l\.id\)\} className="scroll-mt-24">\s*<AvaliacaoForm/);
});
