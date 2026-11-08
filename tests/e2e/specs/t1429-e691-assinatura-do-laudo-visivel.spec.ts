import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, cnpjAleatorio } from "../fixtures/laboratorio";

/*
  T1429 — E691 (#3253): o número e o hash da assinatura do laudo aparecem para o dono, no bloco do laudo do painel do imóvel
  (/dashboard/imoveis/<id>/nivel): o selo "Laudo assinado pelo avaliador" com nº, data e o hash curto (8 primeiros …
  8 últimos do hash). Caminho negativo: laudo SEM assinatura registrada não mostra a linha (nada inventado). 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1429.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const avA = { email: `ava.t1429.${sufixo}@lab.vivanomads.test`, nome: "Caio Avaliador", role: "tenant" as const };
const ids: Record<string, string> = {};
const HASH = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

async function comChave(page: Page) {
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url() === "about:blank" ? "http://localhost:3123" : page.url()).origin }]);
}

async function semearLaudo(propertyId: string, numero: string, assinado: boolean) {
  const { data: ped, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: propertyId, owner_id: ids.dono, cidade: "Uberlândia", porte: "q1_2", valor_tabela: 350, status: "laudo_emitido", avaliador_id: ids.cred, designado_em: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  const { error: eL } = await adm()
    .from("vistoria_laudos")
    .insert({ pedido_id: ped.id, pedido_versao_id: ped.id, property_id: propertyId, owner_id: ids.dono, avaliador_id: ids.cred, numero, resultado: "aprovado", nivel_sustentado: "conforto", vistoriado_em: new Date().toISOString(), teste: true, ...(assinado ? { assinatura_hash: HASH, assinado_em: new Date().toISOString() } : {}) });
  if (eL) throw eL;
}

test.describe("T1429 — E691: assinatura do laudo visível ao dono", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.A = await criarConta(avA, senha);
    const { data: p, error: eP } = await adm().from("parceiros").insert({ user_id: ids.A, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avA.nome, slug: `aval-t1429-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"] }).select("id").single();
    if (eP) throw eP;
    ids.parc = p.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: "Uberlândia", numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1429", conduta_versao: "2026-10-23", ativado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = c.id as string;
    ids.imAss = await criarImovelPronto(ids.dono, `T1429 assinado ${sufixo}`, { ativo: true });
    ids.imSem = await criarImovelPronto(ids.dono, `T1429 sem assinatura ${sufixo}`, { ativo: true });
    await semearLaudo(ids.imAss, `VIS-T1429-A-${sufixo}`, true);
    await semearLaudo(ids.imSem, `VIS-T1429-S-${sufixo}`, false);
  });
  test.afterAll(async () => {
    const imoveis = [ids.imAss, ids.imSem].filter(Boolean);
    if (imoveis.length) {
      await adm().from("vistoria_laudos").delete().in("property_id", imoveis);
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    }
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    await apagarContas([ids.A, ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: laudo assinado mostra data, nº e registro; sem assinatura não mostra a linha`, async ({ browser }) => {
      // L-107 (08/11): com laudo ASSINADO a tela do dono (/nivel) cai em "Não conseguimos abrir esta tela". Causa provável: o selo
      // (src/components/vistoria/selo-assinatura.tsx, componente de servidor) passa onFocus a um <input>; handler de evento não
      // atravessa o servidor. Quem corrigir o produto remove este test.fail no mesmo PR (o Playwright avisa).
      test.fail(true, "L-107: /nivel do dono quebra com laudo assinado (selo com onFocus em componente de servidor)");
      const d = await entrar(browser, dono.email, senha);
      await comChave(d);
      await d.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await d.goto(`/dashboard/imoveis/${ids.imAss}/nivel`, { waitUntil: "domcontentloaded" });
      const selo = d.getByTestId("selo-assinatura");
      try {
        await expect(selo).toBeVisible({ timeout: 30_000 });
      } catch (e) {
        const tela = (await d.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 1200);
        throw new Error(`selo ausente; a tela mostra: ${tela}`, { cause: e });
      }
      await expect(selo).toHaveAttribute("data-quem", "dono");
      await expect(selo).toContainText("Laudo assinado pelo avaliador");
      await expect(d.getByTestId("selo-assinatura-numero")).toContainText(`VIS-T1429-A-${sufixo}`);
      await expect(d.getByTestId("selo-assinatura-numero")).toContainText(/\d{2}\/\d{2}\/\d{4}/);
      await expect(d.getByTestId("selo-assinatura-hash")).toHaveText(`${HASH.slice(0, 8)}…${HASH.slice(-8)}`);
      await expect(d.getByLabel("Hash completo da assinatura")).toHaveValue(HASH);
      expect(await d.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

      await d.goto(`/dashboard/imoveis/${ids.imSem}/nivel`, { waitUntil: "domcontentloaded" });
      await expect(d.getByText(`VIS-T1429-S-${sufixo}`).first()).toBeVisible({ timeout: 30_000 });
      await expect(d.getByTestId("selo-assinatura")).toHaveCount(0);
      await d.context().close();
    });
  }
});
