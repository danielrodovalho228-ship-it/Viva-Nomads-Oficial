import { test } from "node:test";
import assert from "node:assert/strict";
import { filtroNivelDaUrl, filtroNivelNaUrl } from "./filtro-nivel.ts";
import { FILTROS_PAINEL_VAZIOS, contarFiltrosPainel, passaNoPainel } from "./painel-filtros.ts";

const imovel = (nivel: "em_adequacao" | "essencial" | "conforto" | "premium" | null) => ({ monthlyPrice: 3000, bedrooms: 1, tagHomeOffice: false, nivel });

test("59.1: ?nivel=conforto mostra Conforto e Premium; ?nivel=premium só Premium; desligado não tira ninguém", () => {
  const todos = [imovel(null), imovel("essencial"), imovel("conforto"), imovel("premium")];
  const filtra = (nivelMin: "" | "essencial" | "conforto" | "premium") => todos.filter((p) => passaNoPainel(p, { ...FILTROS_PAINEL_VAZIOS, nivelMin })).map((p) => p.nivel);
  assert.deepEqual(filtra(""), [null, "essencial", "conforto", "premium"]);
  assert.deepEqual(filtra("essencial"), ["essencial", "conforto", "premium"]);
  assert.deepEqual(filtra("conforto"), ["conforto", "premium"]);
  assert.deepEqual(filtra("premium"), ["premium"]);
  assert.equal(contarFiltrosPainel({ ...FILTROS_PAINEL_VAZIOS, nivelMin: "conforto" }), 1);
});

test("59.1: o filtro vai e volta pela URL; valor estranho é ignorado", () => {
  assert.equal(filtroNivelDaUrl(new URLSearchParams("nivel=conforto")), "conforto");
  assert.equal(filtroNivelDaUrl(new URLSearchParams("nivel=essencial")), "essencial");
  assert.equal(filtroNivelDaUrl(new URLSearchParams("nivel=hack")), "");
  const p = new URLSearchParams("q=centro");
  filtroNivelNaUrl(p, "premium");
  assert.equal(p.toString(), "q=centro&nivel=premium");
  filtroNivelNaUrl(p, "");
  assert.equal(p.toString(), "q=centro");
});

test("NIVEL-BUSCA-A: opção em 0 desabilitada (o '· 0' fica); as três em 0 tiram o grupo; a escolhida nunca trava", async () => {
  const { TEXTO_SEM_NIVEIS, avisoNivelSemResultado, grupoNivel } = await import("./filtro-nivel.ts");
  assert.deepEqual(grupoNivel({ essencial: 2, conforto: 1, premium: 0 }, ""), { visivel: true, desabilitado: { essencial: false, conforto: false, premium: true } });
  assert.deepEqual(grupoNivel({ essencial: 0, conforto: 0, premium: 0 }, ""), { visivel: false, desabilitado: { essencial: true, conforto: true, premium: true } });
  // ?nivel=premium que zerou tudo: o grupo continua (para desligar) e o Premium escolhido não fica desabilitado.
  assert.deepEqual(grupoNivel({ essencial: 0, conforto: 0, premium: 0 }, "premium"), { visivel: true, desabilitado: { essencial: true, conforto: true, premium: false } });
  assert.equal(TEXTO_SEM_NIVEIS, "Os níveis aparecem quando os anúncios desta busca tiverem o padrão mínimo confirmado.");
  assert.equal(avisoNivelSemResultado("premium"), "Nenhum imóvel com nível Premium nesta busca");
  assert.equal(avisoNivelSemResultado("conforto"), "Nenhum imóvel com nível Conforto nesta busca");
});

test("NIVEL-BUSCA-A: a folha e a busca usam as regras (sem link na linha; 'Ver todos' tira só o nível)", async () => {
  const { readFileSync } = await import("node:fs");
  const folha = readFileSync("src/components/busca/painel-filtros-celular.tsx", "utf8");
  const busca = readFileSync("src/app/(public)/buscar/search-client.tsx", "utf8");
  // E105: o nível mora só na pílula "Nível" (saiu da folha "Mais filtros").
  assert.doesNotMatch(folha, /painel-nivel|filtro-nivel-/);
  const pilulas = readFileSync("src/components/busca/barra-pilulas.tsx", "utf8");
  assert.match(pilulas, /opcao\(v, f\.nivelMin === v, porNivel\[v\], nivel\.desabilitado\[v\]/);
  assert.match(pilulas, /nivel\.visivel \?[\s\S]*data-testid="painel-nivel-vazio"[^>]*>\s*\{TEXTO_SEM_NIVEIS\}\s*<\/p>/);
  assert.match(busca, /data-testid="busca-vazia-nivel"[\s\S]*\{avisoNivelSemResultado\(nivelMin\)\}[\s\S]*onClick=\{\(\) => setNivelMin\(""\)\}[\s\S]*Ver todos/);
});
