import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T772 — E329 (01/11): (a) o dono confirma a visita por vídeo e vê "Visita confirmada — o morador foi avisado por
  e-mail"; (b) depois disso, no anúncio, o morador vê "Visita agendada" levando a Visitas, e não mais "Visita por
  vídeo". Em 390 e 1280.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];

async function conta(papel: "owner" | "tenant", nome: string) {
  const email = `${papel}.${randomBytes(3).toString("hex")}.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email, nome, role: papel }, senha);
  ids.push(id);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return { id, email };
}

test.describe("T772 — E329: visita confirmada", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.setTimeout(180_000);
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280]) {
    test(`aviso ao dono e "Visita agendada" ao morador (${largura})`, async ({ browser }) => {
      const dono = await conta("owner", `Dona Agenda${largura} Sobrenome`);
      const inq = await conta("tenant", `Inês Agenda${largura} Sobrenome`);
      const imovel = await criarImovelPronto(dono.id, `Studio E329 ${largura} ${sufixo}`, { ativo: true, preco: 3200 });
      const horario = new Date(Date.now() + 3 * 86_400_000);
      horario.setUTCHours(17, 0, 0, 0);
      const { data: v, error } = await adm()
        .from("visitas_video")
        .insert({ property_id: imovel, owner_id: dono.id, tenant_id: inq.id, horarios: [horario.toISOString()], modalidade: "video" })
        .select("id")
        .single();
      if (error) throw error;

      // Antes da confirmação: o morador ainda vê "Visita por vídeo".
      const morador = await entrar(browser, inq.email, senha);
      await morador.setViewportSize({ width: largura, height: 900 });
      await morador.goto(`/imoveis/${imovel}`, { waitUntil: "domcontentloaded" });
      await expect(morador.getByTestId("visita-video-abrir").first()).toBeAttached({ timeout: 25_000 });
      await expect(morador.getByTestId("visita-video-agendada")).toHaveCount(0);

      // (a) o dono confirma e vê o aviso.
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/dashboard/visitas?de=dono", { waitUntil: "domcontentloaded" });
      const cartao = page.locator(`#visita-${v.id}`);
      await expect(cartao).toBeVisible({ timeout: 25_000 });
      await cartao.getByTestId("visita-link").fill("https://meet.google.com/abc-defg-hij");
      await cartao.getByTestId("visita-confirmar").first().click();
      const aviso = cartao.getByTestId("visita-confirmada-aviso");
      await expect(aviso).toHaveText("Visita confirmada — o morador foi avisado por e-mail", { timeout: 25_000 });
      await expect(cartao.getByTestId("visita-status")).toHaveText(/Confirmada/, { timeout: 25_000 });
      // O aviso continua depois que a lista recarrega.
      await page.waitForTimeout(2000);
      await expect(aviso).toBeVisible();
      await page.screenshot({ path: `test-results/t772-e329-dono-${largura}.png` });
      expect((await adm().from("visitas_video").select("status").eq("id", v.id).single()).data?.status).toBe("confirmado");

      // (b) o anúncio reflete a visita existente.
      await morador.reload({ waitUntil: "domcontentloaded" });
      const agendada = morador.getByTestId("visita-video-agendada").first();
      await expect(agendada).toBeAttached({ timeout: 25_000 });
      await expect(agendada).toHaveText(/Visita agendada/);
      await expect(agendada).toHaveAttribute("href", "/dashboard/visitas");
      await expect(morador.getByTestId("visita-video-abrir")).toHaveCount(0);
      await agendada.scrollIntoViewIfNeeded();
      await morador.screenshot({ path: `test-results/t772-e329-anuncio-${largura}.png` });
      await agendada.click({ timeout: 5_000 }).catch(() => agendada.dispatchEvent("click"));
      await expect(morador).toHaveURL(/\/dashboard\/visitas/, { timeout: 25_000 });
      await page.context().close();
      await morador.context().close();
    });
  }
});
