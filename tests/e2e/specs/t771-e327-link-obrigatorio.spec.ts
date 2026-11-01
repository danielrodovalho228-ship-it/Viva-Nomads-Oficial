import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T771 — E327 (01/11): na confirmação da visita por vídeo (lado do dono), o campo "Link da chamada" diz que é
  obrigatório e traz a orientação curta; confirmar com o campo vazio pede o link (a visita continua pedida); com o
  link, confirma. Em 390 e 1280.
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

test.describe("T771 — E327: link da chamada obrigatório na confirmação", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.setTimeout(150_000);
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280]) {
    test(`vazio pede o link; com o link confirma (${largura})`, async ({ browser }) => {
      const dono = await conta("owner", `Dona Link${largura} Sobrenome`);
      const inq = await conta("tenant", `Inês Link${largura} Sobrenome`);
      const imovel = await criarImovelPronto(dono.id, `Studio E327 ${largura} ${sufixo}`, { ativo: true, preco: 3200 });
      const horario = new Date(Date.now() + 3 * 86_400_000);
      horario.setUTCHours(17, 0, 0, 0);
      const { data: v, error } = await adm()
        .from("visitas_video")
        .insert({ property_id: imovel, owner_id: dono.id, tenant_id: inq.id, horarios: [horario.toISOString()], modalidade: "video" })
        .select("id")
        .single();
      if (error) throw error;

      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/dashboard/visitas?de=dono", { waitUntil: "domcontentloaded" });
      const cartao = page.locator(`#visita-${v.id}`);
      await expect(cartao).toBeVisible({ timeout: 25_000 });
      await expect(cartao.getByTestId("visita-link-obrigatorio")).toHaveText("(obrigatório)");
      await expect(cartao.getByTestId("visita-link-ajuda")).toHaveText(
        "Use um link novo para cada visita; ele fica visível só para você e o morador e some depois do uso.",
      );
      await expect(cartao.getByTestId("visita-link")).toHaveAttribute("aria-required", "true");

      // Vazio: a tela pede o link e nada é enviado.
      await cartao.getByTestId("visita-confirmar").first().click();
      await expect(cartao.getByTestId("visita-link-erro")).toHaveText("Informe o link da chamada para confirmar a visita por vídeo.");
      await expect(cartao.getByTestId("visita-link")).toBeFocused();
      await page.waitForTimeout(1500);
      expect((await adm().from("visitas_video").select("status").eq("id", v.id).single()).data?.status).toBe("pedido");
      await page.screenshot({ path: `test-results/t771-e327-vazio-${largura}.png`, fullPage: false });

      // Com o link: confirma.
      await cartao.getByTestId("visita-link").fill("https://meet.google.com/abc-defg-hij");
      await expect(cartao.getByTestId("visita-link-erro")).toHaveCount(0);
      await cartao.getByTestId("visita-confirmar").first().click();
      await expect
        .poll(async () => (await adm().from("visitas_video").select("status").eq("id", v.id).single()).data?.status, { timeout: 25_000 })
        .toBe("confirmado");
      await page.context().close();
    });
  }
});
