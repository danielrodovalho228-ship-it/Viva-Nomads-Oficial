/*
  Família 4 — textos (RELATORIO-L-045, ORDEM-L-050). Um teste nomeado por item; vermelho na main, verde no PR.
  Roda: node --test src/lib/parceiros/familia-4-textos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linksDoCartaoGestores } from "./tipos-parceria.ts";
import { REGRA_CNPJ_PARCEIRO, hrefSejaParceiro, CATEGORIAS_CATALOGO } from "./regras.ts";
import { FAQ } from "../atendimento/faq.ts";
import { pedacosComRemissoes } from "../ajuda/remissoes.ts";
import { ROTA_RECRUTAMENTO } from "../vistoria/entrada.ts";
import * as T from "../atendimento/parceiros-texto.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const artigo = (id: string) => FAQ.find((f) => f.id === id)!.resposta;

test("E910 — o cartão 'Gestores e administradoras' ganha a ligação de parceria e mantém a das taxas", () => {
  for (const visivel of [false, true]) {
    const links = linksDoCartaoGestores(visivel);
    assert.ok(links.some((l) => l.rotulo === "Pedir parceria" && l.href === "/parceiros?categoria=outro#quero-ser-parceiro"));
    assert.ok(links.some((l) => /Plano Gestor/.test(l.rotulo)), "a ligação das taxas continua");
  }
  assert.equal(linksDoCartaoGestores(false)[0].href, "/para-proprietarios#taxa");
});

test("E933 — as 6 portas de busca e /fotografos declaram a regra do CNPJ; 'Seja parceiro da Viva' marca a categoria", () => {
  assert.match(REGRA_CNPJ_PARCEIRO, /a Viva só trabalha com parceiros que têm CNPJ/i);
  const buscar = ler("src/app/(public)/parceiros/buscar/page.tsx");
  assert.match(buscar, /\{REGRA_CNPJ_PARCEIRO\}/);
  assert.match(buscar, /href=\{hrefSejaParceiro\(categoria\)\}/);
  assert.match(ler("src/app/(public)/parceiros/fotografos/page.tsx"), /data-testid="fotografos-regra-cnpj">\{REGRA_CNPJ_PARCEIRO\}/);
  for (const c of CATEGORIAS_CATALOGO.filter((x) => x.valor !== "outro")) {
    assert.equal(hrefSejaParceiro(c.valor), `/parceiros?categoria=${c.valor}#quero-ser-parceiro`);
  }
  assert.equal(hrefSejaParceiro(""), "/parceiros#quero-ser-parceiro");
});

test("E934 — o artigo do avaliador escreve o caminho /parceiros/avaliadores e ele vira ligação; o pedido diz nota fiscal e telefone", () => {
  const r = artigo("como-ser-avaliador");
  assert.ok(r.includes(ROTA_RECRUTAMENTO));
  const links = pedacosComRemissoes(r).filter((p) => p.href);
  assert.ok(links.some((p) => p.href === "/parceiros/avaliadores"), "ligação para a porta do avaliador");
  // O-30 (âmbito do E934, decisão da L-019): a lista-resumo do pedido diz a nota fiscal e o telefone opcional.
  const virar = artigo("como-virar-parceiro");
  assert.match(virar, /nota fiscal de serviço/);
  assert.match(virar, /telefone, que nunca aparece em público/);
});

test("E935 — o artigo do avaliador inclui a declaração de relações e a exclusão de quem tem relação, pela fonte da porta", () => {
  const r = artigo("como-ser-avaliador");
  assert.match(r, /a declaração de relações/);
  assert.ok(r.includes(T.REGRA_RELACOES_AVALIADOR));
  assert.match(ler("src/app/(public)/parceiros/avaliadores/page.tsx"), /\$\{REGRA_RELACOES_AVALIADOR\}/);
});

test("E937 — /parceiros declara a validade do link (7 dias, uma vez) no passo 2 e as duas regras do O-27, iguais à Ajuda", () => {
  assert.equal(T.VALIDADE_LINK_ATIVACAO, "vale 7 dias, uma vez");
  const p = ler("src/app/(public)/parceiros/page.tsx");
  assert.match(p, /Aprovada, o e-mail traz o link para ativar a sua página \(\$\{VALIDADE_LINK_ATIVACAO\}\)/);
  assert.match(p, /\$\{ENDERECO_APOS_ACEITE\} \$\{PAGAMENTO_DIRETO_TRANSITORIO\}/);
  // A Ajuda diz o mesmo pela mesma fonte.
  assert.ok(artigo("como-virar-parceiro").includes(`(${T.VALIDADE_LINK_ATIVACAO})`));
  const taxa = artigo("taxa-parceria");
  assert.ok(taxa.includes(T.PAGAMENTO_DIRETO_TRANSITORIO) && taxa.includes(T.ENDERECO_APOS_ACEITE));
});
