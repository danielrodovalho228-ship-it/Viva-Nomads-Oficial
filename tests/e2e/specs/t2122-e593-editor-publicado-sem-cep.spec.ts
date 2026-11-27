import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2122 — E593 @E593: o editor do anúncio PUBLICADO que perdeu o CEP carrega "O que tem por perto" (sem 400).
  Regra decidida (E593; unitário e593-editor-sem-cep.test.ts): ao publicar, o draft_data é zerado. O anúncio publicado
  sem cep_proximidades, mas com ponto gravado (lat_exata/lng_exata, senão lat/lng), usa o ponto como origem das
  proximidades. A rota responde 200 com a lista, nunca 400 "CEP inválido". O 400 fica para quando não há CEP nem ponto
  (e, para o próprio dono sem endereço, o E742 responde 200 "sem_endereco" — esse caso é o t2094).
  Anúncio publicado do dono, sem CEP (nem no rascunho, nem o das proximidades) e com ponto em Uberlândia:
    1. POST /api/proximidades { propertyId } com a sessão do dono → 200, fonte "lab" (o laboratório responde a lista
       fixa a partir do ponto), com itens, e nunca "sem_cep" nem "sem_endereco";
    2. o editor do anúncio abre sem nenhuma resposta 400 de /api/proximidades. 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2122.${sufixo}@lab.vivanomads.test`, nome: "Pedro Ponto", role: "owner" as const };
const ids: Record<string, string> = {};
// Centro de Uberlândia (ponto exato do anúncio; o gatilho da 0066 grava o público aproximado a partir dele).
const PONTO = { lat: -18.9186, lng: -48.2772 };

const pedir = (p: Page, corpo: Record<string, unknown>) =>
  p.evaluate(async (c) => {
    const r = await fetch("/api/proximidades", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c) });
    return { status: r.status, json: (await r.json().catch(() => null)) as { itens?: unknown[]; fonte?: string; error?: string } | null };
  }, corpo);

test.describe("T2122 — E593: anúncio publicado sem CEP usa o ponto gravado; o editor não leva 400 em proximidades @E593", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio publicado sem CEP ${sufixo}`, { ativo: true });
    const { error } = await adm()
      .from("properties")
      .update({ draft_data: null, cep_proximidades: null, lat_exata: PONTO.lat, lng_exata: PONTO.lng, lat: PONTO.lat, lng: PONTO.lng })
      .eq("id", ids.imovel);
    if (error) throw error;
    const { data: lido, error: e2 } = await adm().from("properties").select("status, draft_data, cep_proximidades, lat, lng").eq("id", ids.imovel).single();
    if (e2) throw e2;
    expect(lido?.status, "o anúncio está publicado").toBe("active");
    expect(lido?.draft_data, "sem rascunho (zerado ao publicar)").toBeNull();
    expect(lido?.cep_proximidades, "sem o CEP das proximidades").toBeNull();
    expect(lido?.lat != null && lido?.lng != null, "com ponto gravado").toBe(true);
  });
  test.afterAll(async () => {
    if (ids.imovel) await adm().from("properties").delete().eq("id", ids.imovel);
    await apagarContas([ids.dono]);
  });

  test("a rota: o dono recebe 200 com a lista a partir do ponto (nunca 400 CEP inválido)", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const r = await pedir(p, { propertyId: ids.imovel });
    expect(r.status, `resposta: ${JSON.stringify(r.json)}`).toBe(200);
    expect(r.json?.fonte, "a origem é o ponto gravado, não 'sem CEP' nem 'sem endereço'").toBe("lab");
    expect(Array.isArray(r.json?.itens) && (r.json?.itens?.length ?? 0) > 0, "com a lista de lugares").toBe(true);
    await p.context().close();
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — o editor do anúncio publicado abre sem 400 em /api/proximidades`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const respostas: number[] = [];
      p.on("response", (r) => {
        if (new URL(r.url()).pathname === "/api/proximidades") respostas.push(r.status());
      });
      await p.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
      await p.waitForTimeout(1500);
      expect(respostas.filter((s) => s === 400), `respostas de /api/proximidades no editor: ${respostas.join(", ") || "(nenhuma)"}`).toEqual([]);
      await p.context().close();
    });
  }
});
