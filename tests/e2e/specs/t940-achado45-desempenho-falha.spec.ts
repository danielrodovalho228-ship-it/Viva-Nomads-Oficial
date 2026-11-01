import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T940 — #2037 (auditoria de erros e estados vazios, achado 45): no painel de desempenho do anúncio, a falha na leitura
 * do imóvel virava "Anúncio não encontrado" e a dos eventos virava zero visualizações. Agora painelDesempenho LANÇA e
 * o painel mostra "Tentar de novo" (dashboard/error.tsx).
 * O que a tela real consegue provar, 390 e 1280:
 *   1. com as quatro leituras que agora lançam TODAS preenchidas (eventos, publicações, medições de internet,
 *      imovel_nivel), o painel abre com os números certos — a guarda nova não dispara à toa;
 *   2. "não encontrado" continua sendo só o que de fato não existe ou não é do dono: UUID que não existe e anúncio de
 *      outro dono mostram "Anúncio não encontrado", NUNCA o painel-erro (não é falha de leitura);
 * A falha da leitura em si fica com o teste de unidade do #2037 (achado45-desempenho.test.ts): o id passa pelo UUID
 * antes de ler e as leituras são do servidor, com a chave de serviço — os dados não conseguem quebrá-las.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t940.${sufixo}@lab.vivanomads.test`, nome: "Dalila Desempenho", role: "owner" as const };
const outro = { email: `outro.t940.${sufixo}@lab.vivanomads.test`, nome: "Otto Outro Dono", role: "owner" as const };
const ids: { dono?: string; outro?: string; imovel?: string; doOutro?: string } = {};
const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const LARGURAS = [390, 1280] as const;
const INEXISTENTE = "00000000-0000-4000-8000-000000000940";

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T940 — #2037 achado 45: desempenho distingue falha de 'não encontrado'", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.outro = await criarConta(outro, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio desempenho t940 ${sufixo}`, { ativo: true, preco: 2700 });
    ids.doOutro = await criarImovelPronto(ids.outro, `Studio de outro dono t940 ${sufixo}`, { ativo: true, preco: 2700 });
    await adm().from("properties").update({ city: `Cidade T940 ${sufixo}` }).eq("id", ids.imovel);
    const ev = (tipo: string, h: number) => ({ tipo, criado_em: horasAtras(h), usuario_id: null, imovel_id: ids.imovel });
    const r = await Promise.all([
      adm().from("eventos").insert([...[2, 3, 4, 5].map((h) => ev("ver_anuncio", h)), ev("favoritar", 3), ev("publicar_anuncio", 24 * 10)]),
      adm().from("internet_medicoes").insert({
        property_id: ids.imovel, user_id: ids.dono, papel: "dono", download_mbps: 150, upload_mbps: 20, latencia_ms: 12, distancia_m: 30,
        validada: true, origem: "edicao", medido_em: horasAtras(24 * 5), valido_ate: new Date(Date.now() + 150 * 86_400_000).toISOString(),
      }),
      adm().from("imovel_nivel").upsert({ property_id: ids.imovel, nivel: "em_adequacao" }),
    ]);
    for (const x of r) if (x.error) throw x.error;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("eventos").delete().in("imovel_id", [ids.imovel ?? "", ids.doOutro ?? ""]);
    await adm().from("internet_medicoes").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("imovel_nivel").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.outro]);
  });

  test("painel cheio abre; inexistente e de outro dono = 'não encontrado', nunca painel-erro (390 e 1280)", async ({ browser }) => {
    test.setTimeout(150_000);
    const page = await entrar(browser, dono.email, senha);
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      // 1. Leituras cheias: o painel abre com os números.
      await page.goto(`/dashboard/imoveis/${ids.imovel}/desempenho`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("desempenho-metricas")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("desempenho-visualizacoes")).toHaveAttribute("data-valor", "4");
      await expect(page.getByTestId("painel-erro")).toHaveCount(0);
      await expect(page.getByTestId("desempenho-indisponivel")).toHaveCount(0);
      await semRolagemLateral(page);

      // 2. "Não encontrado" é só o que não existe ou não é do dono.
      for (const id of [INEXISTENTE, ids.doOutro!]) {
        await page.goto(`/dashboard/imoveis/${id}/desempenho`, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("desempenho-indisponivel")).toHaveText("Anúncio não encontrado.", { timeout: 30_000 });
        await expect(page.getByTestId("painel-erro")).toHaveCount(0);
        await expect(page.getByTestId("desempenho-metricas")).toHaveCount(0);
        await semRolagemLateral(page);
      }
    }
    await page.context().close();
  });

});
