/*
  t2043 · E145 + E952 (Pista 3 — cobertura do mapa das 142; ORDEM-DUET-073 ponto 5; adaptado ao E952 na ronda 06:55Z)
  @E145 @E952 @ao-vivo-seguro (unitário, sem rede)
  Regra do E145 (o que segue valendo): no "O que tem por perto" do cadastro do anúncio, "a busca NÃO RESPONDEU" (endereço
  sem ponto, limite do dia, falha) é diferente de "NÃO HÁ LUGARES": o primeiro avisa e oferece "Tentar de novo"; o
  segundo diz que não achou lugares num raio de 2 km, sem botão. E uma lista VAZIA guardada no rascunho não conta como
  "já buscou": ao reabrir, a busca roda de novo.
  Onde o E145 colidia com o E952 (a correção mais nova, do relato do Daniel), manda o E952 — decisão do Gerente, 06:55Z:
    - o erro é honesto e tem o texto próprio ("Não conseguimos buscar agora.") — antes, o mesmo de "não respondeu";
    - a lista some NA HORA ao mudar o endereço; resposta atrasada (número velho) ou de outro endereço é descartada;
    - a resposta aceita SUBSTITUI a lista, inclusive vazia; o erro deixa a lista vazia — nunca a lista anterior
      (antes, o E145 dizia "resposta vazia nova não apaga a lista que já havia").
  Renderiza o componente REAL ProximidadesAutomaticas (blocos-cadastro.tsx); dublês só nos componentes vizinhos (ver
  e145-harness/). As regras do E952 são as da função pura real (lib/proximidades/estado-perto.ts).
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
const { ESTADO_PERTO_INICIAL, TEXTO_ERRO_PERTO, aplicarRespostaPerto, iniciarBuscaPerto } = await import("../../lib/proximidades/estado-perto.ts");

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
    // E952: o erro diz o que aconteceu ("Não conseguimos buscar agora."); sem ponto e limite seguem "não respondeu".
    assert.ok(t.texto.includes(fonte === "erro" ? TEXTO_ERRO_PERTO : NAO_RESPONDEU), fonte);
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

test("E145: rascunho com lista vazia (ou de outro endereço) não volta — a busca roda de novo ao reabrir", () => {
  const pagina = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  // Só uma lista COM lugares é restaurada (e, pelo E952, só a do mesmo endereço — proxChave); vazia → busca de novo.
  assert.match(pagina, /if \(Array\.isArray\(d\.proxOsm\) && d\.proxOsm\.length > 0\) \{/);
  assert.match(pagina, /if \(d\.proxChave === chaveRascunho && cepRascunho\) \{/);
});

const LUGAR = { tipo: "farmacia", categoria: "saude", nome: "Farmácia Central", distanciaM: 350 };
const ALVO = { cep: "38414536", rua: "Rua das Flores" };

test("E952: mudou o endereço → a lista some NA HORA (carregando, sem itens), com número novo", () => {
  const pronto = aplicarRespostaPerto(iniciarBuscaPerto(ESTADO_PERTO_INICIAL, ALVO), { seq: 1, itens: [LUGAR as never], fonte: "osm" });
  assert.equal(pronto.itens?.length, 1);
  const nova = iniciarBuscaPerto(pronto, { cep: "38400000", rua: "Av. Nova" });
  assert.equal(nova.itens, null);
  assert.equal(nova.status, "carregando");
  assert.equal(nova.seq, pronto.seq + 1);
});

test("E952: resposta atrasada (número velho) ou de outro endereço é descartada", () => {
  const e = iniciarBuscaPerto(iniciarBuscaPerto(ESTADO_PERTO_INICIAL, ALVO), ALVO); // seq 2
  assert.deepEqual(aplicarRespostaPerto(e, { seq: 1, itens: [LUGAR as never], fonte: "osm" }), e);
  assert.deepEqual(aplicarRespostaPerto(e, { seq: 2, referencia: { cep: "38400000", rua: "Av. Nova" }, itens: [LUGAR as never], fonte: "osm" }), e);
});

test("E952: a resposta aceita SUBSTITUI a lista, inclusive vazia; o erro deixa a lista vazia — nunca a anterior", () => {
  const comLista = aplicarRespostaPerto(iniciarBuscaPerto(ESTADO_PERTO_INICIAL, ALVO), { seq: 1, itens: [LUGAR as never], fonte: "osm" });
  const tentar = iniciarBuscaPerto(comLista, ALVO);
  const vazia = aplicarRespostaPerto(tentar, { seq: tentar.seq, itens: [], fonte: "sem_lugares" });
  assert.deepEqual(vazia.itens, []);
  assert.equal(vazia.status, "pronto");
  // Mesmo com a lista ainda na tela (resposta do mesmo número), a vazia substitui — nunca a lista anterior.
  const vaziaSobreLista = aplicarRespostaPerto(comLista, { seq: comLista.seq, itens: [], fonte: "sem_lugares" });
  assert.deepEqual(vaziaSobreLista.itens, []);
  const erroSobreLista = aplicarRespostaPerto(comLista, { seq: comLista.seq, erro: true });
  assert.deepEqual(erroSobreLista.itens, []);
  const erro = aplicarRespostaPerto(tentar, { seq: tentar.seq, erro: true });
  assert.deepEqual(erro.itens, []);
  assert.equal(erro.status, "erro");
  assert.equal(erro.fonte, "erro");
});
