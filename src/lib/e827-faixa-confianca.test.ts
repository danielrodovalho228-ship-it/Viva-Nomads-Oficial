/*
  E827 — a faixa de confiança da home só afirma o que é verdade para TODO anúncio.
  Roda: node --test src/lib/e827-faixa-confianca.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SELO_DOCUMENTO_IMOVEL, SELO_VERIFICACOES_ANUNCIANTE } from "../config/textos-regulados.ts";
import { perfilDonoCompleto } from "./anuncio/perfil-dono.ts";

const home = readFileSync(new URL("../app/(public)/page.tsx", import.meta.url), "utf8");
const acoes = readFileSync(new URL("./data/actions.ts", import.meta.url), "utf8");

test("a faixa não promete 'Perfil verificado' para todos: publicar NÃO exige a identidade verificada", () => {
  // O portão de publicação pede nome e telefone válidos — não verificação de identidade.
  assert.equal(perfilDonoCompleto({ full_name: "Rafael Teixeira", phone: "(34) 99999-1234" }), true);
  const faixa = home.slice(home.indexOf('data-testid="faixa-confianca"'), home.indexOf("</section>", home.indexOf('data-testid="faixa-confianca"')));
  assert.doesNotMatch(faixa, /SELO_PERFIL_VERIFICADO|Perfil verificado/);
  assert.match(faixa, /text=\{SELO_VERIFICACOES_ANUNCIANTE\}/);
  assert.equal(SELO_VERIFICACOES_ANUNCIANTE, "Verificações do anunciante à vista em cada anúncio");
});

test("o documento do imóvel: verdade para todo anúncio publicado (o servidor exige aprovado) e dito como regra", () => {
  assert.match(acoes, /if \(!input\.asDraft && qualificacao\.status !== "approved"\)/);
  const faixa = home.slice(home.indexOf('data-testid="faixa-confianca"'));
  assert.match(faixa, /text=\{SELO_DOCUMENTO_IMOVEL\}/);
  assert.equal(SELO_DOCUMENTO_IMOVEL, "Documento do imóvel conferido antes de publicar");
  assert.doesNotMatch(home, /"Documentação do imóvel conferida"/);
});

test("o lastro de 'à vista em cada anúncio': o cartão do dono mostra só os selos reais (e-mail, telefone, identidade)", async () => {
  const { selosReais } = await import("./perfil/perfil-publico.ts");
  // Rafael T. (ube-004): e-mail + telefone, sem identidade → a página mostra exatamente isso.
  assert.deepEqual(selosReais({ emailConfirmado: true, telefoneVerificado: true }), ["E-mail confirmado", "Telefone verificado"]);
  assert.deepEqual(selosReais({}), []);
  const cartao = readFileSync(new URL("../components/property/owner-card.tsx", import.meta.url), "utf8");
  assert.match(cartao, /data-testid="proprietario-selos"/);
  assert.match(cartao, /donoVerificado\(property\) &&/);
  assert.match(cartao, /d\.selos\.map/);
});
