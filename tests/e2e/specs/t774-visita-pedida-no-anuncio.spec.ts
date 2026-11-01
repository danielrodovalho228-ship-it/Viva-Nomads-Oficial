import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T774 — varredura 01/11 (achado 3, complemento do E329): com a visita por vídeo PEDIDA e sem resposta, o anúncio não
  oferece pedir outra (o banco recusava: "Você já tem um pedido de visita em aberto") — mostra "Visita por vídeo pedida"
  levando a Visitas; a presencial, sem pedido, segue com "Agendar visita". Confirmada e já passada → "Ver minha visita".
  390 e 1280.
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

test.describe("T774 — visita pedida no anúncio", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.setTimeout(150_000);
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280]) {
    test(`pedida → "Visita por vídeo pedida"; confirmada passada → "Ver minha visita" (${largura})`, async ({ browser }) => {
      const dono = await conta("owner", `Dona Pedida${largura} Sobrenome`);
      const inq = await conta("tenant", `Inês Pedida${largura} Sobrenome`);
      const imovel = await criarImovelPronto(dono.id, `Studio Pedida ${largura} ${sufixo}`, { ativo: true, preco: 3200 });
      const daqui3 = new Date(Date.now() + 3 * 86_400_000);
      daqui3.setUTCHours(17, 0, 0, 0);
      const { data: v, error } = await adm()
        .from("visitas_video")
        .insert({ property_id: imovel, owner_id: dono.id, tenant_id: inq.id, horarios: [daqui3.toISOString()], modalidade: "video" })
        .select("id")
        .single();
      if (error) throw error;

      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto(`/imoveis/${imovel}`, { waitUntil: "domcontentloaded" });
      const pedida = page.getByTestId("visita-video-pedida").first();
      await expect(pedida).toBeAttached({ timeout: 25_000 });
      await expect(pedida).toHaveText(/Visita por vídeo pedida/);
      // E411: diz por que não dá para pedir outra e como mudar os horários.
      await expect(page.getByTestId("visita-video-pedida-explica").first()).toHaveText(/cancele o pedido em Visitas e peça de novo/);
      await expect(pedida).toHaveAttribute("href", "/dashboard/visitas");
      await expect(page.getByTestId("visita-video-abrir")).toHaveCount(0);
      await expect(page.getByTestId("agendar-visita").first()).toBeAttached();
      await pedida.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/t774-pedida-${largura}.png` });

      // Confirmada e já passada (ainda "confirmado" no banco): não pede outra — "Ver minha visita".
      const ontem = new Date(Date.now() - 86_400_000).toISOString();
      await adm().from("visitas_video").update({ status: "confirmado", horario_confirmado: ontem, link_chamada: "https://meet.google.com/abc-defg-hij" }).eq("id", v.id);
      await page.reload({ waitUntil: "domcontentloaded" });
      const ver = page.getByTestId("visita-video-ver").first();
      await expect(ver).toBeAttached({ timeout: 25_000 });
      await expect(ver).toHaveText(/Ver minha visita/);
      await expect(ver).toHaveAttribute("href", "/dashboard/visitas");
      await page.context().close();
    });
  }
});
