/* E679-B parte 3 — a avaliação de conduta do avaliador é CEGA (mesmo modelo da estadia). Roda: node --test src/lib/vistoria/conduta-cega-e679.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { CONDUTA_AVALIADOR, CONDUTA_DONO, CONDUTA_TEXTO_MAX, validarConduta } from "./regras.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const servidor = ler("src/lib/vistoria/servidor.ts");
const acoes = ler("src/lib/vistoria/actions.ts");
const cron = ler("src/app/api/cron/automacoes/route.ts");

test("o desenho NÃO mudou: dono avalia 3 pontos, avaliador avalia 2, texto até 300", () => {
  assert.deepEqual([...CONDUTA_DONO], ["pontualidade", "cordialidade", "cuidado"]);
  assert.deepEqual([...CONDUTA_AVALIADOR], ["imovel_pronto", "horario_respeitado"]);
  assert.equal(CONDUTA_TEXTO_MAX, 300);
  assert.equal(validarConduta("dono", { pontualidade: 5, cordialidade: 5, cuidado: 5, imovel_pronto: 4 }, "", () => false).ok, false);
});

test("a nota de conduta do avaliador (revisão de critérios) só conta o PUBLICADO", () => {
  const i = servidor.indexOf('from("vistoria_conduta")');
  assert.ok(i > 0);
  const trecho = servidor.slice(i, servidor.indexOf(")", servidor.indexOf("publicada_em", i)) + 1);
  assert.match(trecho, /not\("publicada_em", "is", null\)/);
});

test("avaliarConduta: depois do envio publica pelo mesmo modelo cego e explica o prazo", () => {
  const f = acoes.slice(acoes.indexOf("export async function avaliarConduta"));
  assert.match(f, /publicar_conduta_avaliador/);
  assert.match(f, /14 dias/);
});

test("o cron diário publica a conduta cuja janela fechou (junto das avaliações de parceiro)", () => {
  assert.match(cron, /publicar_conduta_avaliador/);
});
