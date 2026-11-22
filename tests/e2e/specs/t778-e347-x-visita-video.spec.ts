import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T778 — E347 (01/11): o diálogo "Visita por vídeo" tem o X de fechar, como o lightbox da galeria (IconButton "Fechar");
  "Voltar" e o clique fora continuam fechando. 390 e 1280.
  E744 (tabela da Fable #3832): como o E694 fez com o t357 e o t855, a prova sai do anúncio de exemplo ube-001 (que não
  oferece mais o fluxo) para um anúncio REAL do laboratório, aberto por uma conta de morador; fora do laboratório, pula.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t778.${sufixo}@lab.vivanomads.test`, nome: "Vera Vídeo", role: "owner" as const };
const mor = { email: `mor.t778.${sufixo}@lab.vivanomads.test`, nome: "Xavier Fechar", role: "tenant" as const };
const ids: { dono?: string; mor?: string; imovel?: string } = {};

test.beforeAll(async () => {
  if (!NO_LABORATORIO) return;
  ids.dono = await criarConta(dono, senha);
  ids.mor = await criarConta(mor, senha);
  await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.mor]);
  ids.imovel = await criarImovelPronto(ids.dono, `Studio visita t778 ${sufixo}`, { ativo: true, preco: 3100 });
});
test.afterAll(async () => {
  if (NO_LABORATORIO) await apagarContas([ids.dono, ids.mor]);
});

async function abrir(page: Page) {
  const botao = page.getByTestId("visita-video-abrir").first();
  await botao.scrollIntoViewIfNeeded();
  await expect(async () => {
    if (!(await page.getByTestId("visita-video-passo").isVisible())) await botao.click({ timeout: 3_000 });
    await expect(page.getByTestId("visita-video-passo")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

for (const largura of [390, 1280] as const) {
  test(`T778 — E347: X de fechar na visita por vídeo, mantendo Voltar e clique fora (${largura} px)`, async ({ browser }) => {
    test.skip(!NO_LABORATORIO, "Só no laboratório (anúncio real e conta de morador criados aqui).");
    test.setTimeout(120_000);
    const page = await entrar(browser, mor.email, senha);
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    const r = await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    expect(r?.status() ?? 0).toBeLessThan(400);
    const folha = page.getByTestId("visita-video-passo");

    await abrir(page);
    const x = folha.getByRole("button", { name: "Fechar" });
    await expect(x).toBeVisible();
    await expect(x).toHaveAttribute("data-testid", "visita-video-fechar");
    const caixa = await x.boundingBox();
    expect(caixa!.width).toBeGreaterThanOrEqual(40);
    await page.screenshot({ path: `${SAIDA}/t778-x-${largura}.png` });
    await x.click();
    await expect(folha).toHaveCount(0);

    await abrir(page);
    await folha.getByRole("button", { name: "Voltar" }).click();
    await expect(folha).toHaveCount(0);

    await abrir(page);
    await page.mouse.click(5, 5);
    await expect(folha).toHaveCount(0);
    await page.context().close();
  });
}
