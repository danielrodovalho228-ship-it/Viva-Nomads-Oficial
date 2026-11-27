import { test, expect, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2138 — E992 @E992: a perna que GERA e GUARDA a lista de proximidades do anúncio publicado (depois do #3923).
  Regra decidida (E992; unitário src/lib/proximidades/e992-perna-osm-fiavel.test.ts):
    • com o token do Mapbox no servidor, o editor vê o Mapbox AO VIVO; a lista que se GUARDA (proximidades_cep) é só do
      OSM (ponto do Nominatim + Overpass), gerada DEPOIS da resposta (after);
    • ao salvar o anúncio, a lista gravada (property_proximities, a da página pública) vem dessa lista do OSM, nunca do
      Mapbox;
    • falha honesta: com o Overpass a falhar nos dois servidores (rodízio, dentro do orçamento), não se grava "nada por
      perto" como lista do OSM, nada do Mapbox entra no que se guarda, e uma lista já guardada não é apagada.
  O laboratório usa proximidades simuladas, por isso esta perna nunca corria lá. Aqui ela corre de verdade num 2.º
  servidor do mesmo build (porta 3134, padrão do t597/t2130), com:
    • INTEGRACOES_SIMULADAS desligado e um token do Mapbox de mentira (MAPBOX_SERVER_TOKEN);
    • o OSM e o Mapbox respondidos por um fetch falso, carregado no servidor (--import): Nominatim dá sempre o mesmo
      ponto; o Overpass dá 3 lugares ("… Perna OSM") ou 504 nos dois servidores, conforme um arquivo de modo; o Mapbox
      dá "Lugar Mapbox Ao Vivo". Nada sai para a rede, e o resto (Supabase, rotas falsas do lab) passa direto.
  A sessão do dono é a do laboratório (o cookie vale para localhost em qualquer porta).
    A. Overpass OK, CEP novo: a rota responde Mapbox ao vivo; a perna guarda a lista do OSM (fonte "osm"); "Salvar
       seção" no editor grava as proximidades do OSM, sem nada do Mapbox; a página pública mostra os lugares do OSM.
    B. Overpass em 504, CEP novo: rodízio pelos dois servidores, 2 rodadas; fica só o ponto (fonte "erro", lista
       vazia), nunca uma lista; o registro diz "overpass:esgotado"; salvar não grava nada do Mapbox.
    C. Overpass em 504, CEP com lista do OSM já guardada (e vencida): a falha não apaga a lista guardada.
*/
const PORTA = 3134;
const SAIDA_LOG = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2138.${sufixo}@lab.vivanomads.test`, nome: "Otávio Overpass", role: "owner" as const };
const ids: Record<string, string> = {};
let servidor: ChildProcess | null = null;
const BASE = `http://localhost:${PORTA}`;
const PONTO = { lat: -18.9186, lng: -48.2772 };
const LUGARES_OSM = ["Farmácia Perna OSM", "Mercado Perna OSM", "Parada Perna OSM"];
const NOME_MAPBOX = "Lugar Mapbox Ao Vivo";
// CEPs só deste teste (8 dígitos, faixa de Uberlândia), para o cache por CEP não vir de outro spec.
const cepAleatorio = () => `384${String(Math.floor(Math.random() * 100_000)).padStart(5, "0")}`;
const CEP_A = cepAleatorio();
let CEP_B = cepAleatorio();
while (CEP_B === CEP_A) CEP_B = cepAleatorio();

const DIR = mkdtempSync(join(tmpdir(), "t2138-"));
const MODO = join(DIR, "modo.txt");
const PEDIDOS = join(DIR, "pedidos.jsonl");
const PRELOAD = join(DIR, "osm-falso.mjs");
const LOG_SERVIDOR = `${SAIDA_LOG}/t2138-servidor-perna-osm.log`;

/** O fetch falso do 2.º servidor: só os hosts do OSM e do Mapbox; o resto vai ao fetch original. */
const OSM_FALSO = `
import { readFileSync, appendFileSync } from "node:fs";
const MODO = ${JSON.stringify(MODO)};
const PEDIDOS = ${JSON.stringify(PEDIDOS)};
const P = ${JSON.stringify(PONTO)};
const original = globalThis.fetch;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async function (input, init) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input && input.url) || String(input);
  let host = "";
  try { host = new URL(url).hostname; } catch {}
  const modo = (() => { try { return readFileSync(MODO, "utf8").trim(); } catch { return "ok"; } })();
  const anotar = (r) => { try { appendFileSync(PEDIDOS, JSON.stringify({ host, modo, r }) + "\\n"); } catch {} };
  if (host === "nominatim.openstreetmap.org") { anotar("ponto"); return json([{ lat: String(P.lat), lon: String(P.lng) }]); }
  if (host === "overpass-api.de" || host === "overpass.kumi.systems") {
    if (modo === "falha") { anotar(504); return new Response("Gateway Timeout", { status: 504 }); }
    anotar(200);
    return json({ elements: [
      { type: "node", id: 1, lat: P.lat + 0.002, lon: P.lng, tags: { amenity: "pharmacy", name: ${JSON.stringify(LUGARES_OSM[0])} } },
      { type: "node", id: 2, lat: P.lat, lon: P.lng + 0.003, tags: { shop: "supermarket", name: ${JSON.stringify(LUGARES_OSM[1])} } },
      { type: "node", id: 3, lat: P.lat + 0.001, lon: P.lng + 0.001, tags: { highway: "bus_stop", name: ${JSON.stringify(LUGARES_OSM[2])} } },
    ] });
  }
  if (host === "api.mapbox.com") {
    if (url.includes("/search/searchbox/v1/category/")) {
      anotar("mapbox");
      return json({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [P.lng + 0.002, P.lat] }, properties: { name: ${JSON.stringify(NOME_MAPBOX)} } }] });
    }
    anotar("mapbox-404");
    return json({ message: "Not Found" }, 404);
  }
  return original(input, init);
};
`;

type Pedido = { host: string; modo: string; r: string | number };
const pedidos = (): Pedido[] => {
  try {
    return readFileSync(PEDIDOS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Pedido);
  } catch {
    return [];
  }
};
const falhasOverpass = () => pedidos().filter((p) => p.r === 504);
const logServidor = () => (existsSync(LOG_SERVIDOR) ? readFileSync(LOG_SERVIDOR, "utf8") : "");

/** Espera a perna que estiver a correr acabar: nenhum pedido novo ao OSM/Mapbox falso durante 8 s (no máximo 90 s). */
async function aguardarSilencio() {
  let ultimo = -1;
  let desde = Date.now();
  const limite = Date.now() + 90_000;
  while (Date.now() < limite) {
    const n = pedidos().length;
    if (n !== ultimo) {
      ultimo = n;
      desde = Date.now();
    } else if (Date.now() - desde >= 8_000) return;
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function cacheDoCep(cep: string) {
  const { data } = await adm().from("proximidades_cep").select("itens, fonte, lat, lng, atualizado_em").eq("cep", cep).maybeSingle();
  return data as { itens: { nome: string }[] | null; fonte: string; lat: number | null; lng: number | null; atualizado_em: string } | null;
}
const nomes = (itens: { nome?: string; name?: string }[] | null | undefined) => (itens ?? []).map((i) => String(i.nome ?? i.name ?? ""));

async function gravadas(imovel: string): Promise<string[]> {
  const { data } = await adm().from("property_proximities").select("name, origem").eq("property_id", imovel);
  return ((data ?? []) as { name: string }[]).map((r) => r.name);
}

/** POST /api/proximidades no 2.º servidor, com a sessão do dono (o fetch corre na página aberta nesse servidor). */
const pedir = (p: Page, corpo: Record<string, unknown>) =>
  p.evaluate(async (c) => {
    const r = await fetch("/api/proximidades", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c) });
    return { status: r.status, json: (await r.json().catch(() => null)) as { itens?: { nome: string }[]; fonte?: string } | null };
  }, corpo);

async function anuncio(titulo: string, cep: string): Promise<string> {
  const id = await criarImovelPronto(ids.dono, titulo, { ativo: true });
  const { error } = await adm().from("properties").update({ exact_address: "Rua dos Testes, 100", cep_proximidades: cep, lat: PONTO.lat, lng: PONTO.lng, lat_exata: PONTO.lat, lng_exata: PONTO.lng }).eq("id", id);
  if (error) throw error;
  await adm().from("property_proximities").delete().eq("property_id", id);
  return id;
}

async function salvarNoEditor(browser: Browser, imovel: string) {
  const contexto = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await entrarNaPagina(await contexto.newPage(), dono.email, senha);
  await page.goto(`${BASE}/dashboard/imoveis/${imovel}/editar`, { waitUntil: "domcontentloaded" });
  const secao = page.getByTestId("secao-titulo-descricao");
  await expect(secao).toBeVisible({ timeout: 60_000 });
  if ((await secao.getAttribute("data-aberta")) !== "true") await secao.locator("button").first().click();
  await secao.getByRole("button", { name: "Salvar seção" }).click();
  await expect(secao.getByText("Alterações salvas."), "o editor salvou o anúncio").toBeVisible({ timeout: 60_000 });
  await contexto.close();
}

async function paginaNoServidor(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await entrarNaPagina(await contexto.newPage(), dono.email, senha);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  return page;
}

test.describe("T2138 — E992: a perna do OSM gera e guarda a lista; falha honesta quando o Overpass falha @E992", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    await adm().from("proximidades_cep").delete().in("cep", [CEP_A, CEP_B]);
    ids.a = await anuncio(`Studio perna OSM ${sufixo}`, CEP_A);
    ids.b = await anuncio(`Studio perna sem Overpass ${sufixo}`, CEP_B);

    writeFileSync(PRELOAD, OSM_FALSO);
    writeFileSync(MODO, "ok");
    writeFileSync(PEDIDOS, "");
    const log = createWriteStream(LOG_SERVIDOR);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: {
        ...process.env,
        PORT: String(PORTA),
        INTEGRACOES_SIMULADAS: "",
        MAPBOX_SERVER_TOKEN: "pk.lab-t2138-falso",
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import ${pathToFileURL(PRELOAD).href}`.trim(),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    // Sem sessão, a rota responde 401: o servidor está de pé.
    await expect
      .poll(async () => (await fetch(`${BASE}/api/proximidades`, { method: "POST", body: "{}" }).catch(() => null))?.status ?? 0, { timeout: 90_000 })
      .toBe(401);
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    await adm().from("proximidades_cep").delete().in("cep", [CEP_A, CEP_B]);
    for (const k of ["a", "b"]) if (ids[k]) await adm().from("properties").delete().eq("id", ids[k]);
    await apagarContas([ids.dono]);
  });

  test("A — Overpass OK: o editor vê o Mapbox ao vivo; guarda-se a lista do OSM; salvar grava só o OSM; a página mostra o OSM", async ({ browser }) => {
    writeFileSync(MODO, "ok");
    const p = await paginaNoServidor(browser);
    const r = await pedir(p, { propertyId: ids.a });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json?.fonte, "com o token, o editor responde com o Mapbox ao vivo").toBe("mapbox");
    expect(nomes(r.json?.itens), "a resposta ao vivo é a do Mapbox").toContain(NOME_MAPBOX);
    await p.context().close();

    // A perna do OSM roda depois da resposta e guarda a lista do CEP.
    await expect.poll(async () => (await cacheDoCep(CEP_A))?.fonte ?? "(sem linha)", { timeout: 60_000, message: "a perna do OSM guarda a lista do CEP" }).toBe("osm");
    const guardada = await cacheDoCep(CEP_A);
    expect(nomes(guardada?.itens).sort(), "a lista guardada é a do OSM").toEqual([...LUGARES_OSM].sort());
    expect(nomes(guardada?.itens).some((n) => n.includes("Mapbox")), "nada do Mapbox no que se guarda").toBe(false);
    expect(Number(guardada?.lat)).toBeCloseTo(PONTO.lat, 4);
    expect(pedidos().some((x) => x.host === "nominatim.openstreetmap.org" || x.host === "overpass-api.de"), "a perna foi ao OSM (falso)").toBe(true);

    // Salvar o anúncio grava as proximidades a partir da lista do OSM.
    await salvarNoEditor(browser, ids.a);
    await expect.poll(async () => (await gravadas(ids.a)).sort(), { timeout: 30_000, message: "salvar grava as proximidades do OSM" }).toEqual(expect.arrayContaining(LUGARES_OSM));
    expect((await gravadas(ids.a)).some((n) => n.includes("Mapbox")), "nenhum nome do Mapbox gravado").toBe(false);

    // A página pública (servidor do laboratório) mostra a lista guardada.
    const contexto = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const publica = await contexto.newPage();
    await publica.goto(`/imoveis/${ids.a}`, { waitUntil: "domcontentloaded" });
    const perto = publica.getByTestId("perto-categorias");
    await expect(perto).toContainText(LUGARES_OSM[0], { timeout: 30_000 });
    await expect(perto).not.toContainText("Mapbox");
    await contexto.close();
  });

  test("B — Overpass em 504 nos dois servidores, CEP novo: rodízio e falha honesta (só o ponto, nunca uma lista)", async ({ browser }) => {
    writeFileSync(MODO, "falha");
    const antes = falhasOverpass().length;
    const p = await paginaNoServidor(browser);
    const r = await pedir(p, { propertyId: ids.b });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json?.fonte, "o editor segue com o Mapbox ao vivo").toBe("mapbox");
    await p.context().close();

    await expect.poll(async () => (await cacheDoCep(CEP_B))?.fonte ?? "(sem linha)", { timeout: 90_000, message: "a falha guarda só o ponto, marcado como erro" }).toBe("erro");
    const guardada = await cacheDoCep(CEP_B);
    expect(guardada?.itens ?? [], "nenhuma lista guardada como 'nada por perto' do OSM, e nada do Mapbox").toEqual([]);
    expect(Number(guardada?.lat)).toBeCloseTo(PONTO.lat, 4);

    const tentativas = falhasOverpass().slice(antes);
    expect(tentativas.length, "2 rodadas × 2 servidores").toBe(4);
    expect(new Set(tentativas.map((t) => t.host)), "o rodízio passa pelos dois servidores").toEqual(new Set(["overpass-api.de", "overpass.kumi.systems"]));
    await expect.poll(() => /perna_osm[^\n]*overpass:esgotado/.test(logServidor()), { timeout: 20_000, message: "o registro diz overpass:esgotado na perna do OSM" }).toBe(true);

    await salvarNoEditor(browser, ids.b);
    expect((await gravadas(ids.b)).some((n) => n.includes("Mapbox")), "salvar não grava nada do Mapbox").toBe(false);
    expect((await gravadas(ids.b)).some((n) => LUGARES_OSM.includes(n)), "nem lugares do OSM que não foram achados").toBe(false);
    // Abrir o editor do B chama a rota de novo (a lista do CEP B continua por gerar): espera essa perna acabar.
    await aguardarSilencio();
  });

  test("C — Overpass em 504, CEP com lista do OSM já guardada (vencida): a falha não apaga a lista", async ({ browser }) => {
    // A lista do CEP A vence (mais de 30 dias): a perna roda de novo.
    const velha = new Date(Date.now() - 40 * 86_400_000).toISOString();
    await adm().from("proximidades_cep").update({ atualizado_em: velha }).eq("cep", CEP_A);
    writeFileSync(MODO, "falha");
    await aguardarSilencio();
    const antes = falhasOverpass().length;
    const esgotadosAntes = (logServidor().match(/perna_osm[^\n]*overpass:esgotado/g) ?? []).length;
    const p = await paginaNoServidor(browser);
    const r = await pedir(p, { propertyId: ids.a });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    await p.context().close();

    await expect.poll(() => falhasOverpass().length - antes, { timeout: 60_000, message: "a perna tentou o Overpass de novo (2 rodadas × 2 servidores)" }).toBe(4);
    await expect
      .poll(() => (logServidor().match(/perna_osm[^\n]*overpass:esgotado/g) ?? []).length, { timeout: 30_000, message: "a perna terminou com overpass:esgotado" })
      .toBe(esgotadosAntes + 1);
    const guardada = await cacheDoCep(CEP_A);
    expect(guardada?.fonte, "a lista guardada continua a do OSM").toBe("osm");
    expect(nomes(guardada?.itens).sort(), "a falha não apaga a lista guardada").toEqual([...LUGARES_OSM].sort());
    expect(guardada?.atualizado_em && Date.parse(guardada.atualizado_em) < Date.now() - 39 * 86_400_000, "nada foi regravado por cima").toBe(true);
  });
});
