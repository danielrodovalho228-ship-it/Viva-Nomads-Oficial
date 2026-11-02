/*
  E433 (02/11, auditoria de links dos e-mails): o botão "Publicar meu anúncio" tinha DOIS destinos para a mesma ação
  (/dashboard/imoveis/<id>/editar num modelo; /dashboard/imoveis/novo?draft=<id>&etapa=9 em outro — o catálogo montava
  sem o status). Agora todo e-mail com esse botão aponta para UM destino, /dashboard/imoveis/<id>/publicar, que decide no
  clique o caminho mais curto até o botão Publicar (rascunho → Revisão do assistente; fora do cadastro → editor).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOTAO_PUBLICAR, emailDecisaoDocumento } from "./aviso-decisao.ts";
import { destinoPublicar, hrefPublicarAnuncio } from "../anuncio/destino-pendencia.ts";
import { ETAPA } from "../anuncio/etapas-ids.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";

const ID = "11111111-2222-4333-8444-555555555555";
const linhas = [{ documento: "Comprovante de propriedade do imóvel", aprovado: true, motivo: null }];

test("um destino só para 'Publicar meu anúncio', com ou sem status (catálogo e envio real)", () => {
  const destinos = new Set(
    ([undefined, null, "draft", "paused", "active"] as const).map((status) => {
      const e = emailDecisaoDocumento({ propertyId: ID, titulo: "Apto", bairro: "Centro", linhas, prontoParaPublicar: true, status });
      assert.equal(e.cta.label, BOTAO_PUBLICAR);
      return e.cta.path;
    }),
  );
  assert.deepEqual([...destinos], [hrefPublicarAnuncio(ID)]);
  assert.equal(hrefPublicarAnuncio(ID), `/dashboard/imoveis/${ID}/publicar`);
});

test("a rota /publicar leva ao caminho mais curto até o botão Publicar", () => {
  assert.equal(destinoPublicar({ id: ID, status: "draft" }), `/dashboard/imoveis/novo?draft=${ID}&etapa=${ETAPA.revisao}`);
  for (const st of ["paused", "active"]) assert.equal(destinoPublicar({ id: ID, status: st }), `/dashboard/imoveis/${ID}/editar`);
  const rota = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/[id]/publicar/page.tsx", import.meta.url), "utf8");
  assert.match(rota, /redirect\(achou \? destinoPublicar\(\{ id, status \}\) : "\/dashboard\/imoveis"\)/);
});

test("nenhum modelo de e-mail usa o rótulo com outro destino", () => {
  for (const [ev, cfg] of Object.entries(TEMPLATES)) {
    if (cfg.cta === BOTAO_PUBLICAR) assert.match(cfg.path ?? "", /\/publicar$/, ev);
  }
});
