/*
  E615: o parâmetro `etapa` da URL não acompanhava a navegação do assistente — atualizar a página ou abrir o link
  devolvia ao passo errado (ficava etapa=4 dos Passos 5 a 10). Agora a URL diz sempre o passo atual, pelo nome.
  Roda: node --test src/lib/anuncio/e615-etapa-na-url.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { urlComEtapa } from "./etapa-na-url.ts";
import { etapaDaUrl } from "../etapas-anuncio.ts";
import { ETAPA } from "./etapas-ids.ts";

test("E615: troca o etapa velho pelo passo atual e mantém o resto da URL", () => {
  assert.equal(urlComEtapa("?draft=abc&etapa=4", ETAPA.descricao), "?draft=abc&etapa=descricao");
  assert.equal(urlComEtapa("?draft=abc", ETAPA.preco), "?draft=abc&etapa=preco");
  assert.equal(urlComEtapa("", ETAPA.tipo), "?etapa=tipo");
  assert.equal(urlComEtapa("?draft=abc&qualificacao=1&etapa=fotos", ETAPA.fotos), "?draft=abc&qualificacao=1&etapa=fotos");
});

test("E615: ida e volta — o que vai para a URL é lido de volta no mesmo passo (todos os 10)", () => {
  for (let s = 0; s <= 9; s++) {
    const busca = new URLSearchParams(urlComEtapa("?draft=x", s).slice(1));
    assert.equal(etapaDaUrl(busca.get("etapa")), s);
  }
});

test("E615: a página regrava a URL a cada troca de passo (sem Qualificação nem edição)", () => {
  const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  const i = tela.indexOf("urlComEtapa(window.location.search, step)");
  assert.ok(i > 0, "o efeito usa urlComEtapa com o passo atual");
  const efeito = tela.slice(tela.lastIndexOf("useEffect(", i), tela.indexOf("}, [", i) + 80);
  assert.match(efeito, /mostrarQualificacao/);
  assert.match(efeito, /editId/);
  assert.match(efeito, /window\.history\.replaceState\(/);
  assert.match(efeito, /\}, \[[^\]]*step[^\]]*\]/);
});
