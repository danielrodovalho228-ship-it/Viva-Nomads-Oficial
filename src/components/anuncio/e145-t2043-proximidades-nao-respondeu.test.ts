/*
  t2043 · E145 (Pista 3 — cobertura do mapa das 142; ORDEM-DUET-073 ponto 5) @E145 @ao-vivo-seguro (unitário, sem rede)
  Regra: no "O que tem por perto" do cadastro do anúncio, "a busca NÃO RESPONDEU" (endereço sem ponto, limite do dia,
  falha de rede) é diferente de "NÃO HÁ LUGARES": o primeiro diz que a busca não respondeu e oferece "Tentar de novo";
  o segundo diz que não achou lugares num raio de 2 km, sem botão. E uma lista VAZIA guardada no rascunho não conta como
  "já buscou": ao reabrir, a busca roda de novo; e uma resposta vazia nova não apaga a lista que já havia.
  Renderiza o componente REAL ProximidadesAutomaticas (blocos-cadastro.tsx) com buscaNaoRespondeu REAL; dublês só nos
  componentes vizinhos (ver e145-harness/). As duas regras do rascunho moram dentro da página do cadastro (cliente
  gigante): conferidas pela leitura do código.
  Roda: node --test src/components/anuncio/e145-t2043-proximidades-nao-respondeu.test.ts
*/
import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

register("./e145-harness/loader.mjs", import.meta.url);
const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement } = await import("react");
const { ProximidadesAutomaticas } = await import("./blocos-cadastro.tsx");

const NAO_RESPONDEU = "A busca automática não respondeu agora. Os lugares num raio de 2 km aparecem aqui assim que ela voltar.";
const SEM_LUGARES = "Não achamos lugares por perto deste endereço, num raio de 2 km.";
const BASE = { carregando: false, buscou: true, desmarcados: [], onAlternar() {}, manuais: [], onManuais() {}, medir: async () => null, reportar: null, onTentarDeNovo() {} };
const tela = (o: Record<string, unknown>) => {
  const html = renderToStaticMarkup(createElement(ProximidadesAutomaticas, { ...BASE, itens: [], ...o } as never));
  return { html, estado: html.match(/data-estado="([a-z]+)"/)?.[1], texto: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "), tentar: (html.match(/data-testid="proximidades-tentar"/g) ?? []).length };
};

test("E145: a busca não respondeu (sem ponto, limite, erro) → aviso de indisponível + Tentar de novo; nunca 'não achamos'", () => {
  for (const fonte of ["sem_ponto", "limite", "erro"]) {
    const t = tela({ fonte });
    assert.equal(t.estado, "indisponivel", fonte);
    assert.ok(t.texto.includes(NAO_RESPONDEU), fonte);
    assert.equal(t.tentar, 1, `${fonte}: botão Tentar de novo`);
    assert.equal(t.texto.includes("Não achamos lugares"), false, `${fonte}: não diz que não há lugares`);
  }
});

test("E145: a busca respondeu sem lugares (ou sem fonte) → 'não achamos', sem botão de tentar", () => {
  for (const fonte of ["sem_lugares", "osm", null]) {
    const t = tela({ fonte });
    assert.equal(t.estado, "vazio", String(fonte));
    assert.ok(t.texto.includes(SEM_LUGARES), String(fonte));
    assert.equal(t.tentar, 0, String(fonte));
    assert.equal(t.texto.includes("não respondeu"), false, String(fonte));
  }
});

test("E145: com lugares não há aviso de vazio; sem ter buscado, nenhum dos dois; sem a ação, o aviso fica sem botão", () => {
  const lugar = { tipo: "farmacia", categoria: "saude", nome: "Farmácia Central", distanciaM: 350 };
  const achou = tela({ fonte: "osm", itens: [lugar] });
  assert.equal(achou.estado, "achou");
  assert.match(achou.html, /data-testid="proximidades-cat-saude" data-qtd="1"/);
  assert.equal(achou.texto.includes(SEM_LUGARES) || achou.texto.includes(NAO_RESPONDEU), false);
  const antes = tela({ buscou: false, fonte: null });
  assert.equal(antes.estado, "aguardando");
  assert.equal(antes.texto.includes(SEM_LUGARES) || antes.texto.includes(NAO_RESPONDEU), false);
  const semAcao = tela({ fonte: "limite", onTentarDeNovo: undefined });
  assert.ok(semAcao.texto.includes(NAO_RESPONDEU));
  assert.equal(semAcao.tentar, 0);
});

test("E145: rascunho com lista vazia busca de novo ao reabrir; resposta vazia nova não apaga a lista que já havia", () => {
  const pagina = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  // Ao restaurar: só uma lista COM lugares marca "já buscou" (e grava a chave da busca); vazia → a busca roda de novo.
  assert.match(pagina, /if \(Array\.isArray\(d\.proxOsm\) && d\.proxOsm\.length > 0\) \{\s*setProxOsm\(d\.proxOsm as LugarProximo\[\]\);\s*setProxBuscou\(true\);\s*proxBuscadoRef\.current = chaveBuscaPerto\(/);
  // Nova resposta: vazia só substitui se ainda não havia lugares.
  assert.match(pagina, /if \(Array\.isArray\(data\.itens\) && \(data\.itens\.length > 0 \|\| !proxOsm\?\.length\)\) setProxOsm\(data\.itens\);/);
  // Falha de rede/servidor vira "erro" (= não respondeu), nunca "sem lugares".
  assert.match(pagina, /setProxFonte\(res\.ok \? \(data\.fonte \?\? null\) : "erro"\);/);
});
