/*
  DETECTA-B — detecção de itens nas fotos como sugestão.
  Roda: node --test src/lib/fotos/deteccao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAVES_NIVEL_FOTO, MATRIZ } from "../../config/niveis.ts";
import { COMODIDADES_FILTRO } from "../busca/filtro-comodidades.ts";
import { nivelAgoraEFalta } from "../niveis/exibicao.ts";
import { VERSAO_CONFORTO, ITENS_CONFORTO } from "../../config/conforto-minimo.ts";
import {
  AVISO_FOTO_COM_PESSOA,
  CHAVES_DETECCAO,
  DETECCAO_OUTPUT_SCHEMA,
  caminhoDaGaleria,
  deteccaoLigada,
  estimativaCusto,
  MODELO_DETECCAO,
  faltaSemSugestao,
  linhasDaAnalise,
  respostaLab,
  sugestoesParaConfirmar,
  tokensDaImagem,
  validarDeteccao,
  type SugestaoVisivel,
} from "./deteccao.ts";
import { analisarFotosNovas, type AnaliseParaGravar, type DepsDeteccao } from "./deteccao-fluxo.ts";

const DONO = "11111111-1111-1111-1111-111111111111";
const foto = (n: number) => `${DONO}/0000000${n}-0000-0000-0000-000000000000.webp`;

test("lista fechada: itens de foto de Conforto/Premium + comodidades dos filtros, nada mais", () => {
  const nivel = CHAVES_DETECCAO.filter((c) => c.tipo === "nivel").map((c) => c.chave);
  const confPrem = new Set(Object.values(MATRIZ).flatMap((m) => [...m.conforto, ...m.premium]));
  assert.ok(nivel.length > 0);
  for (const k of nivel) assert.ok(CHAVES_NIVEL_FOTO.includes(k as never) && confPrem.has(k as never), k);
  assert.deepEqual(
    CHAVES_DETECCAO.filter((c) => c.tipo === "comodidade").map((c) => c.chave),
    COMODIDADES_FILTRO.map((c) => c.amenityKey),
  );
  assert.ok(!CHAVES_DETECCAO.some((c) => c.chave.startsWith("internet_medida")), "medida não se prova por foto");
  assert.deepEqual(DETECCAO_OUTPUT_SCHEMA.properties.itens.items.properties.chave.enum, CHAVES_DETECCAO.map((c) => c.chave));
});

test("chave desligada: não liga sem a chave; o cookie só vale no laboratório", () => {
  assert.equal(deteccaoLigada({ chave: false, simulado: false, cookieLab: true }), false);
  assert.equal(deteccaoLigada({ chave: false, simulado: true, cookieLab: false }), false);
  assert.equal(deteccaoLigada({ chave: false, simulado: true, cookieLab: true }), true);
  assert.equal(deteccaoLigada({ chave: true, simulado: false, cookieLab: false }), true);
});

test("validação no servidor: chave desconhecida sai, confiança presa a 0–1, repetida fica a maior, baixa sai", () => {
  const r = validarDeteccao({
    pessoa: false,
    itens: [
      { chave: "cozinha_microondas", confianca: 0.7 },
      { chave: "cozinha_microondas", confianca: 0.95 },
      { chave: "piscina_aquecida", confianca: 0.99 },
      { chave: "maquina_lavar", confianca: 7 },
      { chave: "cozinha_forno", confianca: 0.2 },
      { chave: "sala_assentos", confianca: "alta" },
      null,
    ],
  });
  assert.ok(r.ok);
  assert.deepEqual(r.itens, [
    { chave: "maquina_lavar", tipo: "comodidade", confianca: 1 },
    { chave: "cozinha_microondas", tipo: "nivel", confianca: 0.95 },
  ]);
});

test("JSON inválido não quebra: qualquer outra forma vira { ok: false }", () => {
  for (const x of [null, "texto", 42, [], {}, { pessoa: "não", itens: [] }, { pessoa: false }, { pessoa: false, itens: "x" }]) {
    assert.deepEqual(validarDeteccao(x), { ok: false });
  }
});

test("foto com pessoa: tudo descartado com o motivo, e o aviso tem o texto pedido", () => {
  const v = validarDeteccao(respostaLab(1));
  assert.ok(v.ok && v.pessoa);
  const linhas = linhasDaAnalise(v);
  assert.ok(linhas.length > 0);
  assert.ok(linhas.every((l) => l.status === "descartada" && l.motivo === "pessoa"));
  assert.equal(AVISO_FOTO_COM_PESSOA, "Foto com pessoa não serve de prova");
  const sem = linhasDaAnalise({ pessoa: false, itens: [{ chave: "cozinha_forno", tipo: "nivel", confianca: 0.9 }] });
  assert.deepEqual(sem, [{ chave: "cozinha_forno", tipo: "nivel", confianca: 0.9, status: "sugerida", motivo: null }]);
});

test("caminho da galeria: só a pasta do dono e o formato que o item de nível aceita", () => {
  const base = "https://x.supabase.co/storage/v1/object/public/property-photos/";
  assert.equal(caminhoDaGaleria(base + foto(1), DONO), foto(1));
  assert.equal(caminhoDaGaleria(base + foto(1).replace(DONO, "22222222-2222-2222-2222-222222222222"), DONO), null);
  assert.equal(caminhoDaGaleria(base + `${DONO}/x.jpg`, DONO), null);
  assert.equal(caminhoDaGaleria("https://x/storage/v1/object/public/avatars/" + foto(1), DONO), null, "foto de perfil nunca");
  assert.equal(caminhoDaGaleria("https://x/storage/v1/object/public/inquilino-docs/" + foto(1), DONO), null, "documento nunca");
});

const sug = (o: Partial<SugestaoVisivel>): SugestaoVisivel => ({ id: "s", chave: "cozinha_microondas", tipo: "nivel", confianca: 0.9, status: "sugerida", caminho: foto(1), ...o });

test("o que a tela mostra: só sugerida, foto ainda na galeria, sem item com foto valendo nem comodidade marcada", () => {
  const ctx = { galeria: new Set([foto(1)]), nivelComFoto: new Set(["cozinha_forno"]), comodidadesMarcadas: new Set(["vaga_garagem"]) };
  const r = sugestoesParaConfirmar(
    [
      sug({ id: "a" }),
      sug({ id: "a2", confianca: 0.7 }),
      sug({ id: "b", chave: "cozinha_forno" }),
      sug({ id: "c", chave: "vaga_garagem", tipo: "comodidade" }),
      sug({ id: "d", chave: "maquina_lavar", tipo: "comodidade", status: "aceita" }),
      sug({ id: "e", chave: "sala_assentos", caminho: foto(2) }),
      sug({ id: "f", chave: "inventada" }),
    ],
    ctx,
  );
  assert.deepEqual(r.map((s) => s.id), ["a"]);
});

const TODO_MINIMO = ITENS_CONFORTO.map((i) => ({ chave: i.chave, confirmado: true, versao_lista: VERSAO_CONFORTO }));
const entrada = (itens: { chave: string; declarado: boolean; fotoStatus: "pendente" | "aceita" | "recusada" | null }[]) => ({
  declaracoesConforto: TODO_MINIMO,
  itens: itens as never,
  medidas: [],
  ruido: null,
  bloqueadas: [],
  agora: new Date("2026-10-24T12:00:00Z"),
});

test("sugestão não conta para o nível antes de confirmar; o 'o que falta' tira só o item sugerido", () => {
  const antes = nivelAgoraEFalta(entrada([]));
  const sugeridas = new Set(["cozinha_microondas"]);
  // A sugestão não entra no cálculo: o nível e a lista de nivelAgoraEFalta são os mesmos com ou sem ela.
  assert.deepEqual(nivelAgoraEFalta(entrada([])), antes);
  const itensFalta = antes.falta.flatMap((g) => g.itens.map((i) => i.chave));
  assert.ok(itensFalta.includes("cozinha_microondas"));
  const semSug = faltaSemSugestao(antes.falta, sugeridas).flatMap((g) => g.itens.map((i) => i.chave));
  assert.ok(!semSug.includes("cozinha_microondas"));
  assert.equal(semSug.length, itensFalta.length - 1);
});

test("FOTO-NA-HORA-B: confirmar item de nível NÃO grava a foto da galeria como prova; abre a câmera e fica 'falta a foto'", () => {
  const acoes = readFileSync(new URL("../data/deteccao-actions.ts", import.meta.url), "utf8");
  assert.doesNotMatch(acoes, /salvarItemNivel\(|from "@\/lib\/data\/nivel-actions"/, "a sugestão nunca chama salvarItemNivel (nem com a foto da galeria)");
  assert.match(acoes, /update\(\{ status: "confirmada_sem_foto", decidida_em: new Date\(\)\.toISOString\(\) \}\)/);
  assert.match(acoes, /fotografar: s\.chave/);
  assert.doesNotMatch(acoes, /from\("nivel_itens"\)\s*\.(insert|upsert|update)/, "nunca grava nivel_itens por fora");
  assert.doesNotMatch(acoes, /from\("property_amenities"\)/, "a comodidade não é marcada pela sugestão");
  const tela = readFileSync(new URL("../../components/niveis/sugestoes-fotos.tsx", import.meta.url), "utf8");
  assert.match(tela, /onComodidade\(r\.comodidade\)/);
  assert.match(tela, /SUGESTAO_FOTOGRAFAR/);
  assert.match(tela, /SUGESTAO_SO_REFERENCIA/);
  assert.match(tela, /<ProvaNaHora/);
  // A sugestão confirmada sem foto continua na lista (com a câmera) e não conta.
  const s = (status: SugestaoVisivel["status"]): SugestaoVisivel => ({ id: status, chave: "cozinha_microondas", tipo: "nivel", confianca: 0.9, status, caminho: "a" });
  const ctx = { galeria: new Set(["a"]), nivelComFoto: new Set<string>(), comodidadesMarcadas: new Set<string>() };
  assert.deepEqual(sugestoesParaConfirmar([s("sugerida"), s("confirmada_sem_foto")], ctx).map((x) => x.status), ["confirmada_sem_foto"]);
  assert.deepEqual(sugestoesParaConfirmar([s("aceita"), s("descartada")], ctx), []);
});


test("custo: tokens da imagem pela regra da Anthropic e conta por foto e por anúncio", () => {
  assert.equal(tokensDaImagem(1024, 768), 1049);
  const e = estimativaCusto("claude-opus-5-5", 20, 150);
  assert.ok(e.tokensEntradaPorFoto > 1049 && e.tokensEntradaPorFoto < 2500);
  const esperado = (e.tokensEntradaPorFoto * 4 + 150 * 20) / 1e6;
  assert.ok(Math.abs(e.usdPorFoto - esperado) < 1e-5);
  assert.ok(Math.abs(e.usdPorAnuncio - esperado * 20) < 1e-3);
  assert.ok(estimativaCusto("claude-haiku-5-5").usdPorFoto < e.usdPorFoto / 10);
  // Aprovado pelo Daniel (24/10): o equilibrado da tabela do #1259, pela metade do custo do forte.
  assert.equal(MODELO_DETECCAO, "claude-sonnet-5-5");
  assert.ok(Math.abs(estimativaCusto().usdPorFoto - e.usdPorFoto / 2) < 1e-5);
});

/* ---------- A rodada (dependências falsas) ---------- */

function deps(o: Partial<DepsDeteccao> = {}) {
  const chamadas = { modelo: 0, baixar: 0, fotos: 0, limite: 0 };
  const gravadas: AnaliseParaGravar[] = [];
  const d: DepsDeteccao = {
    ligada: true,
    fotos: async () => (chamadas.fotos++, [foto(1), foto(2), foto(3)]),
    analisadas: async () => ({ caminhos: new Set(), hashes: new Set() }),
    baixar: async (c) => (chamadas.baixar++, new TextEncoder().encode(c)),
    hash: async (b) => new TextDecoder().decode(b),
    limite: async () => (chamadas.limite++, true),
    modelo: async (_b, i) => (chamadas.modelo++, respostaLab(i)),
    gravar: async (a) => void gravadas.push(a),
    ...o,
  };
  return { d, chamadas, gravadas };
}

test("desligada: não chama nada (nem galeria, nem bucket, nem modelo, nem grava)", async () => {
  const { d, chamadas, gravadas } = deps({ ligada: false });
  const r = await analisarFotosNovas(d);
  assert.equal(r.ligada, false);
  assert.deepEqual(chamadas, { modelo: 0, baixar: 0, fotos: 0, limite: 0 });
  assert.equal(gravadas.length, 0);
});

test("cache por hash: foto já analisada não vai ao modelo; a mesma foto com outro caminho também não", async () => {
  const { d, chamadas, gravadas } = deps({
    analisadas: async () => ({ caminhos: new Set([foto(1)]), hashes: new Set([foto(2)]) }),
  });
  const r = await analisarFotosNovas(d);
  assert.equal(chamadas.modelo, 1, "só a foto 3 é nova");
  assert.equal(chamadas.baixar, 2, "a foto 1 nem é baixada (caminho já visto)");
  assert.equal(r.analisadas, 1);
  assert.deepEqual(gravadas.find((g) => g.caminho === foto(2))?.linhas, [], "foto 2: só registra o caminho");
  // Segunda rodada com o que foi gravado: nada novo vai ao modelo.
  const ja = { caminhos: new Set(gravadas.map((g) => g.caminho).concat(foto(1))), hashes: new Set(gravadas.map((g) => g.hash)) };
  const dois = deps({ analisadas: async () => ja });
  await analisarFotosNovas(dois.d);
  assert.equal(dois.chamadas.modelo, 0);
});

test("JSON inválido não quebra: a rodada segue, grava sem itens e conta como inválida", async () => {
  const { d, gravadas } = deps();
  const r = await analisarFotosNovas(d);
  assert.equal(r.invalidas, 1);
  assert.equal(r.comPessoa, 1);
  const g3 = gravadas.find((g) => g.caminho === foto(3))!;
  assert.equal(g3.valida, false);
  assert.deepEqual(g3.linhas, []);
  const g1 = gravadas.find((g) => g.caminho === foto(1))!;
  assert.deepEqual(g1.linhas.map((l) => l.chave), ["cozinha_microondas", "maquina_lavar"], "chave inventada descartada");
  const g2 = gravadas.find((g) => g.caminho === foto(2))!;
  assert.ok(g2.pessoa && g2.linhas.every((l) => l.status === "descartada"));
});

test("falha da API: não grava (tenta de novo depois) e não derruba a rodada", async () => {
  const { d, gravadas } = deps({ modelo: async () => Promise.reject(new Error("529")) });
  const r = await analisarFotosNovas(d);
  assert.equal(r.falhas, 3);
  assert.equal(gravadas.length, 0);
});

test("limite por anúncio/dono: para de chamar o modelo quando a cota acaba", async () => {
  let n = 0;
  const { d, chamadas } = deps({ limite: async () => ++n <= 1 });
  const r = await analisarFotosNovas(d);
  assert.equal(chamadas.modelo, 1);
  assert.equal(r.limite, true);
  assert.equal(r.restantes, 2);
});

test("rodada curta: no máximo N fotos por vez, o resto fica para a próxima", async () => {
  const { d, chamadas } = deps({ porRodada: 2 });
  const r = await analisarFotosNovas(d);
  assert.equal(chamadas.modelo, 2);
  assert.equal(r.restantes, 1);
});

test("rota/ação: chave e limites no servidor; perfil e documento nunca entram", () => {
  const acoes = readFileSync(new URL("../data/deteccao-actions.ts", import.meta.url), "utf8");
  assert.match(acoes, /consumirLimite\(`deteccao:anuncio:\$\{/);
  assert.match(acoes, /consumirLimite\(`deteccao:dono:\$\{/);
  assert.match(acoes, /from\("property_photos"\)/);
  assert.doesNotMatch(acoes, /avatars|inquilino-docs|triagem-vinculos|documentos/);
});

test("contador do admin: fotos por dia de Brasília, 7 dias com zero onde não houve análise", async () => {
  const { fotosPorDia } = await import("./deteccao.ts");
  const r = fotosPorDia(["2026-10-24", "2026-10-24", "2026-10-22", null, "2026-10-01"], "2026-10-24");
  assert.equal(r.length, 7);
  assert.deepEqual(r.slice(0, 3), [
    { dia: "2026-10-24", fotos: 2 },
    { dia: "2026-10-23", fotos: 0 },
    { dia: "2026-10-22", fotos: 1 },
  ]);
  assert.equal(r[6].dia, "2026-10-18");
  assert.equal(r.reduce((t, d) => t + d.fotos, 0), 3, "fora da janela não conta");
});
