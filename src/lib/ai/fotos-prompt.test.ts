/*
  Ordem 721a139a, parte B — "Preencher com IA" a partir das fotos.
  Roda: node --test src/lib/ai/fotos-prompt.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validarMiniaturas, sanearSugestao, FOTOS_MAX_MINIATURAS, FOTOS_MAX_BASE64 } from "./fotos-prompt.ts";

const jpeg = "/9j/" + "A".repeat(200);

test("miniaturas: aceita JPEG em base64, recusa vazio, excesso, URL, prefixo data: e tamanho gigante", () => {
  assert.equal(validarMiniaturas([jpeg]).ok, true);
  assert.equal(validarMiniaturas([]).ok, false);
  assert.equal(validarMiniaturas(undefined).ok, false);
  assert.equal(validarMiniaturas(Array(FOTOS_MAX_MINIATURAS + 1).fill(jpeg)).ok, false);
  assert.equal(validarMiniaturas(["https://exemplo.com/foto.jpg"]).ok, false);
  assert.equal(validarMiniaturas(["data:image/jpeg;base64," + jpeg]).ok, false);
  assert.equal(validarMiniaturas(["iVBOR" + "A".repeat(200)]).ok, false); // PNG, não JPEG
  assert.equal(validarMiniaturas(["/9j/" + "A".repeat(FOTOS_MAX_BASE64)]).ok, false);
  assert.equal(validarMiniaturas([42]).ok, false);
});

test("sugestão: não é imóvel (capa de livro, pessoa) → recusa sem sugerir nada", () => {
  assert.deepEqual(sanearSugestao({ ehImovel: false }), { ok: false, motivo: "nao_imovel" });
  assert.deepEqual(sanearSugestao("lixo"), { ok: false, motivo: "invalida" });
  assert.deepEqual(sanearSugestao({ tipo: "casa" }), { ok: false, motivo: "invalida" });
});

test("sugestão: descarta tipo fora do catálogo, números absurdos e comodidades inventadas", () => {
  const r = sanearSugestao({
    ehImovel: true,
    tipo: "castelo",
    quartos: 99,
    banheiros: 2,
    comodidades: ["mesa_trabalho", "piscina_olimpica", "mesa_trabalho", 7],
    titulo: "Studio mobiliado",
    descricao: "Sala clara com mesa de trabalho.",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.sugestao.tipo, undefined);
  assert.equal(r.sugestao.quartos, undefined);
  assert.equal(r.sugestao.banheiros, 2);
  assert.deepEqual(r.sugestao.comodidades, ["mesa_trabalho"]);
});

test("sugestão: tipo válido passa; texto com contato é limpo/descartado", () => {
  const r = sanearSugestao({
    ehImovel: true,
    tipo: "studio",
    quartos: 1,
    banheiros: 1,
    comodidades: [],
    titulo: "Studio claro — fale pelo (34) 99999-8888",
    descricao: "Veja em www.exemplo.com ou fulano@x.com",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.sugestao.tipo, "studio");
  assert.doesNotMatch(r.sugestao.titulo ?? "", /99999|\(34\)/);
  assert.doesNotMatch(r.sugestao.descricao ?? "", /www|@/);
});

test("rota /api/ai/fotos: login de proprietário, flag, limite diário e corpo limitado antes de chamar o modelo", () => {
  const src = readFileSync(join(process.cwd(), "src/app/api/ai/fotos/route.ts"), "utf8");
  assert.match(src, /GERACAO_IA_ATIVA/);
  assert.match(src, /getUser\(\)/);
  assert.match(src, /status: 401/);
  assert.match(src, /status: 403/);
  assert.match(src, /FOTOS_MAX_CORPO/);
  assert.match(src, /consumirLimite\(`ia:user:/);
  assert.ok(src.indexOf("consumirLimite") < src.indexOf("messages.create"));
  assert.doesNotMatch(src, /NEXT_PUBLIC_/);
});

test("tela (prompt 10): a IA roda sozinha ao terminar o envio das fotos, uma vez por rascunho, e marca 'Sugerido · confira'", () => {
  const dir = join(process.cwd(), "src/app/(dashboard)/dashboard/imoveis/novo");
  const pagina = readFileSync(join(dir, "page.tsx"), "utf8");
  assert.match(pagina, /\/api\/ai\/fotos/);
  assert.match(pagina, /precisaReanalisar\(iaAnalisadas, fotosUrls\)/);
  assert.match(pagina, /miniaturaBase64\(u, FOTOS_LADO_MAX_PX\)/);
  assert.match(readFileSync(join(dir, "campos.tsx"), "utf8"), /MARCA_SUGERIDO/);
  assert.match(readFileSync(join(dir, "etapa-fotos.tsx"), "utf8"), /Analisando as fotos/);
});

test("IA das fotos: 7 fotos bloqueia, 8 libera (ordem abc34d72)", async () => {
  const { iaFotosLiberada, mensagemFaltamFotosIa } = await import("./fotos-prompt.ts");
  assert.equal(iaFotosLiberada(7), false);
  assert.equal(iaFotosLiberada(8), true);
  assert.equal(iaFotosLiberada(0), false);
  assert.equal(mensagemFaltamFotosIa(6), "Faltam 2 fotos para a IA montar seu anúncio.");
  assert.equal(mensagemFaltamFotosIa(7), "Falta 1 foto para a IA montar seu anúncio.");
  assert.equal(mensagemFaltamFotosIa(8), "");
});

test("prompt 10: rejeita comodidade fora da lista, título acima de 60, palavra proibida; sinais de trabalho viram comodidades", async () => {
  const { sanearSugestao: s, SUGESTAO_LAB_BRUTA, TITULO_MAX } = await import("./fotos-prompt.ts");
  const base = { ehImovel: true, tipo: "apartamento", quartos: 1, banheiros: 1, mobiliado: true, comodos: [], capa: null };
  const r = s({
    ...base,
    comodidades: ["piscina_olimpica", "ar_condicionado"],
    titulo: "x".repeat(TITULO_MAX + 1),
    descricao: "Ótimo para temporada e para hóspedes.",
    trabalho: { mesa: true, cadeira: false, iluminacao: true },
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.sugestao.comodidades, ["ar_condicionado", "mesa_trabalho", "iluminacao_boa"]);
  assert.equal(r.sugestao.titulo, undefined);
  assert.equal(r.sugestao.descricao, undefined);
  for (const proibida of ["Aluguel mensal", "Vistoria feita", "Para 2 hóspedes"]) {
    const x = s({ ...base, comodidades: [], trabalho: { mesa: false, cadeira: false, iluminacao: false }, titulo: proibida, descricao: null });
    assert.ok(x.ok && x.sugestao.titulo === undefined, proibida);
  }
  const lab = s(SUGESTAO_LAB_BRUTA);
  assert.ok(lab.ok);
  if (!lab.ok) return;
  assert.ok((lab.sugestao.titulo ?? "").length <= 60);
  assert.equal(lab.sugestao.capa, 0);
  assert.equal(lab.sugestao.comodos?.length, 6);
  assert.ok(lab.sugestao.comodidades.includes("mesa_trabalho") && lab.sugestao.comodidades.includes("cadeira_ergonomica"));
});

test("prompt 10: uma análise por rascunho; refaz só quando mais de 3 fotos mudaram", async () => {
  const { precisaReanalisar } = await import("./fotos-prompt.ts");
  const fotos = ["a", "b", "c", "d", "e", "f", "g", "h"];
  assert.equal(precisaReanalisar(null, fotos), true);
  assert.equal(precisaReanalisar(fotos, fotos), false);
  assert.equal(precisaReanalisar(fotos, [...fotos.slice(0, 5), "x", "y", "z"]), false); // 3 trocadas
  assert.equal(precisaReanalisar(fotos, [...fotos.slice(0, 4), "w", "x", "y", "z"]), true); // 4 trocadas
  assert.equal(precisaReanalisar(fotos, [...fotos, "x", "y", "z"]), false); // 3 novas
  assert.equal(precisaReanalisar(fotos, [...fotos, "w", "x", "y", "z"]), true); // 4 novas
});
