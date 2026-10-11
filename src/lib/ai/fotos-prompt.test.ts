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

test("tela: botão 'Preencher com IA' no passo Fotos, marcado 'sugerido pela IA', só preenche o que está vazio", () => {
  const src = readFileSync(join(process.cwd(), "src/app/(dashboard)/dashboard/imoveis/novo/page.tsx"), "utf8");
  assert.match(src, /Preencher com IA/);
  assert.match(src, /Sugerido pela IA/);
  assert.match(src, /\/api\/ai\/fotos/);
});
