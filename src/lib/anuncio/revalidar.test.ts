import test from "node:test";
import assert from "node:assert/strict";
import { caminhosDoAnuncio, revalidarAnuncio, REVALIDAR_SEGUNDOS } from "./revalidar.ts";

const ID = "ddf86c66-a214-463d-8563-66a5204010b5";

test("invalida a página do anúncio, a home, a busca, as cidades, as páginas de polo/dono e o sitemap", () => {
  const chamados: string[] = [];
  revalidarAnuncio(ID, (c, t) => chamados.push(t ? `${c}|${t}` : c));
  assert.deepEqual(chamados, [
    `/imoveis/${ID}`,
    "/",
    "/buscar",
    "/cidades/[cidade]|page",
    "/cidades/[cidade]/[polo]|page",
    "/imoveis-perto-de/[slug]|page",
    "/proprietario/[id]|page",
    "/sitemap.xml",
  ]);
});

test("id vazio ou com formato estranho não monta caminho de imóvel (caso negativo)", () => {
  for (const ruim of [null, undefined, "", "../admin", "a/b", "x y"]) {
    const c = caminhosDoAnuncio(ruim).map((x) => x.caminho);
    assert.ok(!c.some((p) => p.startsWith("/imoveis/")), String(ruim));
  }
});

test("erro ao invalidar não derruba a ação", () => {
  assert.doesNotThrow(() =>
    revalidarAnuncio(ID, () => {
      throw new Error("fora do contexto");
    }),
  );
});

test("rede de segurança curta (<= 60 s)", () => {
  assert.ok(REVALIDAR_SEGUNDOS > 0 && REVALIDAR_SEGUNDOS <= 60);
});

import { readFileSync } from "node:fs";

test("páginas públicas do anúncio têm revalidate <= 60 e as ações invalidam o cache", () => {
  const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  for (const p of [
    "app/(public)/page.tsx",
    "app/(public)/imoveis/[id]/page.tsx",
    "app/(public)/buscar/page.tsx",
    "app/(public)/cidades/[cidade]/page.tsx",
    "app/sitemap.ts",
  ]) {
    const m = ler(p).match(/export const revalidate = (\d+);/);
    assert.ok(m && Number(m[1]) > 0 && Number(m[1]) <= 60, `${p} sem revalidate <= 60`);
  }
  assert.equal((ler("lib/data/actions.ts").match(/revalidarAnuncio\(/g) ?? []).length, 5, "4 ações + revalidarPausa (E33)");
  assert.match(ler("lib/data/documentos-admin.ts"), /revalidarAnuncio\(/);
});

test("E33: toda página pública que lista anúncios é invalidada pelas ações (sem página presa no build)", () => {
  const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  const rotas: Record<string, string> = {
    "app/(public)/page.tsx": "/",
    "app/(public)/buscar/page.tsx": "/buscar",
    "app/(public)/cidades/[cidade]/page.tsx": "/cidades/[cidade]",
    "app/(public)/cidades/[cidade]/[polo]/page.tsx": "/cidades/[cidade]/[polo]",
    "app/(public)/imoveis-perto-de/[slug]/page.tsx": "/imoveis-perto-de/[slug]",
    "app/(public)/proprietario/[id]/page.tsx": "/proprietario/[id]",
  };
  const caminhos = caminhosDoAnuncio(ID).map((c) => c.caminho);
  for (const [arquivo, rota] of Object.entries(rotas)) {
    assert.match(ler(arquivo), /listProperties(DoProprietario)?\(|listarPorCidade|properties/, arquivo);
    assert.ok(caminhos.includes(rota), `${rota} fora de caminhosDoAnuncio`);
  }
  // Pausar (dono e câmera) e reativar passam pela mesma invalidação.
  assert.match(ler("lib/data/actions.ts"), /function revalidarPausa[\s\S]*?revalidarAnuncio\(id, revalidatePath\)/);
  assert.match(ler("lib/atendimento/servidor.ts"), /revalidarAnuncio\(propId, revalidatePath\)/);
});
