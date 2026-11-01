import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T878 — E328: A PARTIR DA CONFIRMAÇÃO DA VISITA, CADA LADO VÊ O 1º NOME DO OUTRO (Pista C, 01/11; merge #1893, Pista B).
  O merge trouxe só teste de unidade (nome-visita.test.ts); aqui, na tela de verdade (/dashboard/visitas/<id>), a 390 e
  1280 px, sem candidatura aceita nem contrato — só a confirmação libera o nome:
   1) visita CONFIRMADA: o proprietário vê "Quem vem: Tito" (visita-pessoa) e o morador vê "Quem recebe: Lia"
      (visita-pessoa-dono) — só o 1º nome, nunca o sobrenome;
   2) visita só PEDIDA (antes da confirmação): segue protegido — o proprietário vê "Quem vem: Interessado(a)" e o morador
      não vê "Quem recebe".
  Contas, imóveis e visitas do laboratório, criados e apagados aqui (dois imóveis, uma visita em cada).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t878.${sufixo}@lab.vivanomads.test`, nome: "Lia Recebedora", role: "owner" as const };
const morador = { email: `mor.t878.${sufixo}@lab.vivanomads.test`, nome: "Tito Visitante", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovelA?: string; imovelB?: string; confirmada?: string; pedida?: string } = {};
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

test.describe("T878 — E328: o 1º nome na visita a partir da confirmação (#1893)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovelA = await criarImovelPronto(ids.dono, `Studio visita confirmada t878 ${sufixo}`, { ativo: true });
    ids.imovelB = await criarImovelPronto(ids.dono, `Studio visita pedida t878 ${sufixo}`, { ativo: true });
    const horario = emDias(3);
    const { data: c, error: ec } = await adm()
      .from("visitas_video")
      .insert({ property_id: ids.imovelA, owner_id: ids.dono, tenant_id: ids.morador, horarios: [horario], modalidade: "video", status: "confirmado", horario_confirmado: horario, link_chamada: "https://meet.google.com/abc-defg-hij" })
      .select("id")
      .single();
    expect(ec).toBeNull();
    ids.confirmada = c!.id as string;
    const { data: p, error: ep } = await adm()
      .from("visitas_video")
      .insert({ property_id: ids.imovelB, owner_id: ids.dono, tenant_id: ids.morador, horarios: [emDias(4)], modalidade: "video", status: "pedido" })
      .select("id")
      .single();
    expect(ep).toBeNull();
    ids.pedida = p!.id as string;
  });
  test.afterAll(async () => {
    const visitas = [ids.confirmada, ids.pedida].filter(Boolean) as string[];
    if (visitas.length) await adm().from("visitas_video").delete().in("id", visitas);
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const largura of [390, 1280] as const) {
    test(`proprietário @${largura}: confirmada mostra "Quem vem: Tito"; pedida segue "Interessado(a)"`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/visitas/${ids.confirmada}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("visita-pessoa").first()).toHaveText("Quem vem: Tito", { timeout: 30_000 });
      await expect(page.locator("body")).not.toContainText("Visitante");
      await page.goto(`/dashboard/visitas/${ids.pedida}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("visita-pessoa").first()).toHaveText("Quem vem: Interessado(a)", { timeout: 30_000 });
      await expect(page.locator("body")).not.toContainText("Tito");
      await page.context().close();
    });

    test(`morador @${largura}: confirmada mostra "Quem recebe: Lia"; pedida não mostra quem recebe`, async ({ browser }) => {
      const page = await entrar(browser, morador.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/visitas/${ids.confirmada}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("visita-pessoa-dono").first()).toHaveText("Quem recebe: Lia", { timeout: 30_000 });
      await expect(page.locator("body")).not.toContainText("Recebedora");
      await page.goto(`/dashboard/visitas/${ids.pedida}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("cartao-visita").first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("visita-pessoa-dono")).toHaveCount(0);
      await page.context().close();
    });
  }
});
