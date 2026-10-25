/* Roda: node --test src/lib/anuncio/qualificacao-conforto.test.ts — E132-A: a Qualificação antes do Passo 1. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAVES_CONFORTO } from "../../config/conforto-minimo.ts";
import { TELAS_QUALIFICACAO, aplicarRespostas, chavesCobertas, estadoDoRascunho, faltamDoEssencial, jaTemDoConforto, nivelDoResultado, tituloResultado } from "./qualificacao-conforto.ts";

const TUDO = {
  cama: true, apoio: true, ventilacao: "ventilacao", cozinha: "fogao", roupa: "todos", agua: true, lavanderia: "predio",
  luz: true, fechadura: true, limpa: true, mobilia: true, internet: "300",
};

test("as 5 telas cobrem EXATAMENTE os 12 itens do essencial (nunca uma lista própria)", () => {
  assert.equal(TELAS_QUALIFICACAO.length, 5);
  assert.deepEqual([...chavesCobertas()].sort(), [...CHAVES_CONFORTO].sort());
  assert.equal(new Set(chavesCobertas()).size, chavesCobertas().length, "nenhum item em duas perguntas");
  assert.deepEqual(TELAS_QUALIFICACAO.map((t) => t.titulo), ["Quarto", "Cozinha e roupa", "Banho e lavanderia", "A casa", "Internet"]);
});

test("respostas → as mesmas confirmações e comodidades do Passo 5", () => {
  const r = aplicarRespostas(TUDO);
  assert.deepEqual(r.conforto, [...CHAVES_CONFORTO]);
  assert.equal(r.internetMbps, "300");
  // As 3 opções de cozinha cumprem; só a completa marca a comodidade "cozinha_equipada".
  for (const c of ["fogao", "micro", "completa"]) assert.ok(aplicarRespostas({ cozinha: c }).conforto.includes("cozinha_basica"), c);
  assert.deepEqual(aplicarRespostas({ cozinha: "completa" }).comodidades, ["cozinha_equipada"]);
  assert.deepEqual(aplicarRespostas({ cozinha: "fogao" }).comodidades, []);
  // Roupa: só "Sim, para todos" cumpre.
  assert.ok(aplicarRespostas({ roupa: "todos" }).conforto.includes("roupa_cama_banho"));
  assert.ok(!aplicarRespostas({ roupa: "so-cama" }).conforto.includes("roupa_cama_banho"));
  // Sem internet: não cumpre e registra o caminho do E102.
  const sem = aplicarRespostas({ internet: "nao_tem" });
  assert.equal(sem.semInternet, true);
  assert.ok(!sem.conforto.includes("internet_informada"));
  // Toggle desligado não cumpre.
  assert.ok(!aplicarRespostas({ cama: false }).conforto.includes("cama_colchao"));
});

test("resultado: título pela situação real, nunca 'já pode anunciar' com item faltando; nível real", () => {
  assert.equal(tituloResultado(0).titulo, "Seu imóvel tem o essencial da Viva");
  assert.equal(tituloResultado(2).titulo, "Faltam 2 itens do essencial para publicar");
  assert.equal(tituloResultado(1).titulo, "Faltam 1 item do essencial para publicar");
  assert.match(tituloResultado(2).subtitulo, /começar o cadastro agora e resolver até publicar/);
  for (const n of [1, 2, 12]) assert.doesNotMatch(tituloResultado(n).titulo, /já pode anunciar/i);
  const tudo = aplicarRespostas(TUDO).conforto;
  assert.equal(faltamDoEssencial(tudo).length, 0);
  assert.equal(nivelDoResultado(tudo).nivel, "Essencial");
  assert.equal(nivelDoResultado([]).nivel, null);
  // "Para subir" vem da matriz (ex.: ar no quarto principal, mesa de trabalho) — nunca itens inventados.
  const subir = nivelDoResultado(tudo).paraSubir;
  assert.ok(subir.includes("Ar-condicionado no quarto principal"));
  assert.ok(subir.includes("Mesa e cadeira de trabalho"));
  assert.ok(!subir.some((s) => /panelas/i.test(s)));
});

test("estado no rascunho: só formatos válidos", () => {
  assert.equal(estadoDoRascunho(null), null);
  assert.equal(estadoDoRascunho({ status: "x" }), null);
  assert.deepEqual(estadoDoRascunho({ status: "pulada", respostas: { cama: true, lixo: 3 } }), { status: "pulada", respostas: { cama: true } });
});

test("E179: 'Para subir a Conforto' não pede o que as respostas já mostram que o imóvel tem", () => {
  const comMicro = { ...TUDO, cozinha: "micro" };
  const subir = nivelDoResultado(aplicarRespostas(comMicro).conforto, comMicro).paraSubir;
  assert.ok(!subir.includes("Micro-ondas"), "a cozinha já tem micro-ondas");
  assert.ok(subir.includes("Mesa de jantar para todos"), "o resto da cozinha continua");
  // Sem micro-ondas na resposta, o item continua na lista.
  assert.ok(nivelDoResultado(aplicarRespostas(TUDO).conforto, TUDO).paraSubir.includes("Micro-ondas"));
  // Ar em todos os quartos e máquina no imóvel também saem; a escala da cozinha "completa" inclui o micro-ondas.
  const tudoMais = { ...TUDO, cozinha: "completa", ventilacao: "ar", lavanderia: "imovel" };
  assert.deepEqual(jaTemDoConforto(tudoMais).sort(), ["ar_quarto_principal", "cozinha_microondas", "lavadora_no_imovel"]);
  const resto = nivelDoResultado(aplicarRespostas(tudoMais).conforto, tudoMais).paraSubir;
  for (const r of ["Micro-ondas", "Ar-condicionado no quarto principal", "Máquina de lavar no imóvel"]) assert.ok(!resto.includes(r), r);
  assert.ok(resto.includes("Mesa e cadeira de trabalho"));
  // Nada respondido: nada sai.
  assert.deepEqual(jaTemDoConforto({}), []);
});
