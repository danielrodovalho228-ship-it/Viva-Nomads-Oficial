/*
  Etapas do editor de anúncio — assistente em 10 passos (mockups cadastro-imovel-01..10, Entrega 3 do CONTA-A), com a
  retomada dos rascunhos das ordens antigas (6 passos do Prompt 43, 5 etapas do prompt 10, 7 etapas) + bug 13 da L2
  (retomar o rascunho não trava as etapas já visitadas). Roda: node --test src/lib/etapas-anuncio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ETAPAS,
  ORDEM_ETAPAS,
  VERSAO_ORDEM_ETAPAS,
  etapaDaUrl,
  etapaDoRascunho,
  etapaLiberada,
  etapaMaisAvancada,
  etapaMaxDoRascunho,
  etapaNaPosicao,
  posMaxDoRascunho,
  posicaoDaEtapa,
  primeiraEtapaIncompleta,
} from "./etapas-anuncio.ts";
import { ETAPA } from "./anuncio/etapas-ids.ts";
import { ETAPAS_ASSISTENTE } from "./anuncio/assistente-dez-etapas.ts";

test("10 passos, na ordem dos mockups (e do mapa de dados da Pista B)", () => {
  assert.deepEqual([...ETAPAS], ["tipo", "fotos", "endereco", "detalhes", "comodidades", "regras", "descricao", "preco", "disponibilidade", "revisao"]);
  assert.deepEqual([...ORDEM_ETAPAS], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(ETAPAS_ASSISTENTE.map((e) => e.id), [...ETAPAS], "a mesma ordem de assistente-dez-etapas.ts");
  for (const nome of ETAPAS) assert.equal(ETAPAS[ETAPA[nome]], nome, "ETAPA e ETAPAS concordam");
  // Os nomes dos 6 passos continuam como apelidos.
  assert.equal(ETAPA.onde, ETAPA.endereco);
  assert.equal(ETAPA.espaco, ETAPA.detalhes);
  assert.equal(ETAPA.revisar, ETAPA.revisao);
});

test("etapa já visitada fica liberada mesmo depois de voltar", () => {
  const max = etapaMaisAvancada(0, 7); // chegou até Preço
  assert.equal(etapaLiberada(7, 1, max), true); // voltou às Fotos: Preço segue clicável
  assert.equal(etapaLiberada(8, 1, max), false); // etapa nunca visitada: só pelo "Continuar"
  assert.equal(etapaLiberada(0, 1, max), true);
});

test("rascunho guarda a etapa mais avançada; antigos usam a etapa atual", () => {
  assert.equal(etapaMaxDoRascunho({ step: 1, etapaMax: 3 }, 9), 3);
  assert.equal(etapaMaxDoRascunho({ step: 2, etapaMax: 99 }, 9), 9);
  assert.equal(etapaMaxDoRascunho({ etapaMax: "x" }, 9), 0);
});

test("posição e etapa são inversas; valores fora do intervalo são limitados", () => {
  for (let p = 0; p < ORDEM_ETAPAS.length; p++) assert.equal(posicaoDaEtapa(etapaNaPosicao(p)), p);
  assert.equal(etapaNaPosicao(-3), 0);
  assert.equal(etapaNaPosicao(99), 9);
  assert.equal(etapaNaPosicao(Number.NaN), 0);
  assert.equal(posicaoDaEtapa(42), 0);
});

const FOTOS_8 = Array.from({ length: 8 }, (_, i) => ({ url: `https://x/${i}.jpg` }));
const COMPLETO = {
  street: "Rua A, 10",
  neighborhood: "Centro",
  city: "Uberlândia",
  photos: FOTOS_8,
  bathrooms: "1",
  areaM2: "40",
  maxGuests: "2",
  title: "Studio no Centro",
  monthlyPrice: "3200",
  garantias: { caucao_avista: true },
};

test("rascunho antigo abre na PRIMEIRA etapa ainda incompleta, na ordem dos 10 passos (fotos antes do endereço)", () => {
  assert.equal(primeiraEtapaIncompleta({}), ETAPA.fotos);
  assert.equal(primeiraEtapaIncompleta({ ...COMPLETO, street: "" }), ETAPA.endereco);
  assert.equal(primeiraEtapaIncompleta({ ...COMPLETO, areaM2: "" }), ETAPA.detalhes);
  assert.equal(primeiraEtapaIncompleta({ ...COMPLETO, photos: FOTOS_8.slice(0, 7) }), ETAPA.fotos);
  assert.equal(primeiraEtapaIncompleta({ ...COMPLETO, title: "" }), ETAPA.descricao);
  assert.equal(primeiraEtapaIncompleta({ ...COMPLETO, garantias: { caucao_avista: false } }), ETAPA.preco);
  assert.equal(primeiraEtapaIncompleta(COMPLETO), ETAPA.revisao);
  // Ordem antiga (versão 2, "fotos primeiro", step 3 = Fotos): ignora o step e procura o que falta.
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 3, ordemEtapas: 2, title: "" }), ETAPA.descricao);
  assert.equal(posMaxDoRascunho({ ...COMPLETO, step: 6, etapaMax: 6, ordemEtapas: 2, monthlyPrice: "" }), ETAPA.preco);
});

test("rascunho dos 6 passos (versão 4) reabre na mesma etapa dentro dos 10 passos", () => {
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 0, ordemEtapas: 4 }), ETAPA.endereco);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 1, ordemEtapas: 4 }), ETAPA.detalhes);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 2, ordemEtapas: 4 }), ETAPA.fotos);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 3, ordemEtapas: 4 }), ETAPA.comodidades);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 4, ordemEtapas: 4 }), ETAPA.regras);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 5, ordemEtapas: 4 }), ETAPA.revisao);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 9, ordemEtapas: 4, title: "" }), ETAPA.descricao);
  // A mais avançada também vem para os 10 passos (tinha chegado às Comodidades).
  assert.equal(posMaxDoRascunho({ ...COMPLETO, step: 0, etapaMax: 3, ordemEtapas: 4 }), ETAPA.comodidades);
});

test("rascunho das 5 etapas (versão 3) reabre na mesma etapa dentro dos 10 passos", () => {
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 0, ordemEtapas: 3 }), ETAPA.endereco);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 1, ordemEtapas: 3 }), ETAPA.fotos);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 2, ordemEtapas: 3 }), ETAPA.detalhes);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 3, ordemEtapas: 3 }), ETAPA.preco);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 4, ordemEtapas: 3 }), ETAPA.revisao);
  assert.equal(etapaDoRascunho({ ...COMPLETO, step: 9, ordemEtapas: 3, title: "" }), ETAPA.descricao);
});

test("nenhum campo do rascunho se perde na troca de ordem: só a etapa muda", () => {
  const antes = { ...COMPLETO, step: 2, ordemEtapas: 4, etapaMax: 3, extra: { pets: true } };
  const copia = structuredClone(antes);
  etapaDoRascunho(antes);
  posMaxDoRascunho(antes);
  assert.deepEqual(antes, copia, "ler a etapa não altera o rascunho");
});

test("rascunho da ordem atual mantém a etapa e a mais avançada", () => {
  assert.equal(VERSAO_ORDEM_ETAPAS, 5);
  assert.equal(etapaDoRascunho({ step: 2, ordemEtapas: VERSAO_ORDEM_ETAPAS }), 2);
  assert.equal(etapaDoRascunho({ step: 12, ordemEtapas: VERSAO_ORDEM_ETAPAS }), 0);
  assert.equal(posMaxDoRascunho({ step: 1, etapaMax: 7, ordemEtapas: VERSAO_ORDEM_ETAPAS }), 7);
  assert.equal(posMaxDoRascunho({ step: 8, etapaMax: 1, ordemEtapas: VERSAO_ORDEM_ETAPAS }), 8);
});

test("etapaDaUrl: número 0..9 ou o nome do passo (os nomes dos 6 passos ainda valem); o resto vira null", () => {
  assert.equal(etapaDaUrl("3"), 3);
  assert.equal(etapaDaUrl("9"), 9);
  assert.equal(etapaDaUrl("0"), 0);
  assert.equal(etapaDaUrl("fotos"), ETAPA.fotos, "o nome do passo vale mais que o número");
  assert.equal(etapaDaUrl("disponibilidade"), ETAPA.disponibilidade);
  assert.equal(etapaDaUrl("onde"), ETAPA.endereco);
  assert.equal(etapaDaUrl("revisar"), ETAPA.revisao);
  for (const v of ["Fotos", "encontramos", "10", "-1", "3.5", "abc", "", null, undefined, "03", "toString", "constructor"]) assert.equal(etapaDaUrl(v), null, String(v));
});

test("a tela do cadastro fala em 10 passos (nenhum texto visível com '5 etapas' ou '6 passos')", async () => {
  const { readFileSync } = await import("node:fs");
  const pagina = readFileSync(new URL("../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  const semComentario = pagina.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  assert.doesNotMatch(semComentario, /5 etapas|6 passos/);
  assert.match(semComentario, /<RodapeAssistente\s+pos=\{pos\}\s+total=\{ORDEM_ETAPAS\.length\}/);
});
