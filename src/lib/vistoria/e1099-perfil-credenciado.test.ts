/*
  E1099 (ORDEM-DUET-458, Parceiros, Code 2): a conformidade restante do perfil público do CREDENCIADO com o desenho
  aprovado (docs/mockups-avaliadores/). Parte 1 (sem migração): a caixa "Novo na Viva" no perfil do credenciado, com a
  mesma regra do cartão de escolha e do perfil do piloto (novoNaViva: sem avaliações concluídas). O quadro número /
  avaliações / nota continua (as travas telas-exibicao leem os testids dele).
  Parte 2 ("Sobre", campo novo do avaliador): migração — só depois da palavra do Gerente.
  Roda: node --test src/lib/vistoria/e1099-perfil-credenciado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { novoNaViva, TEXTO_NOVO_NA_VIVA, TITULO_NOVO_NA_VIVA } from "./vitrine-avaliadores.ts";

const pagina = readFileSync("src/app/(public)/avaliadores/[numero]/page.tsx", "utf8");
const credenciado = pagina.slice(pagina.indexOf("export default async function AvaliadorPage"), pagina.indexOf("async function PerfilPublico"));

test("E1099: a regra do 'Novo na Viva' é a mesma do cartão de escolha (sem avaliações concluídas)", () => {
  assert.equal(novoNaViva(0, null), true);
  assert.equal(novoNaViva(3, 4.8), false);
  assert.equal(TITULO_NOVO_NA_VIVA, "Novo na Viva");
});

test("E1099: o perfil do credenciado mostra a caixa 'Novo na Viva' quando ainda não tem avaliações", () => {
  assert.match(credenciado, /const novo = novoNaViva\(a\.avaliacoes_feitas, nota\);/);
  assert.match(credenciado, /\{novo && \(\s*<div[^>]*data-testid="avaliador-novo"/);
  assert.match(credenciado, /\{TITULO_NOVO_NA_VIVA\}/);
  assert.match(credenciado, /\{TEXTO_NOVO_NA_VIVA\}/);
  assert.ok(TEXTO_NOVO_NA_VIVA.length > 0);
  // O quadro de sempre continua (telas-exibicao).
  for (const id of ["avaliador-numero", "avaliador-feitas", "avaliador-nota"]) assert.match(credenciado, new RegExp(`data-testid="${id}"`));
});
