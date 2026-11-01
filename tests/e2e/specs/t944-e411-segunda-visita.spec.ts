import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T944 — E411 (#2048): segundo pedido de visita com um já em aberto (o banco aceita UM por morador, imóvel e
 * modalidade). Antes a recusa era "Você já tem um pedido de visita em aberto para este imóvel." e o anúncio não dizia
 * por que nem como mudar. Pela tela real, 390 e 1280 (a t774 já confere o "pedida" da visita por VÍDEO):
 *   1. a página foi aberta ANTES do pedido existir (aba velha): o morador preenche o horário da visita presencial, o
 *      pedido nasce em outra aba, e o envio é recusado com a explicação nova, que diz o tipo e o caminho;
 *   2. recarregada: "Visita pedida" com "Você já pediu uma visita presencial e o proprietário ainda vai responder. …";
 *   3. confirmada e por vir: "Visita agendada" com "Sua visita presencial já está marcada. Para mudar o horário, …";
 *   4. a mesma regra na visita por vídeo agendada.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const LARGURAS = [390, 1280] as const;
const ids: string[] = [];
const ERRO = "Você já tem um pedido de visita presencial em aberto para este imóvel. Para mudar os horários, cancele esse pedido em Visitas e peça de novo.";
const PEDIDA = "Você já pediu uma visita presencial e o proprietário ainda vai responder. Para mudar os horários, cancele o pedido em Visitas e peça de novo.";
const AGENDADA = (tipo: string) => `Sua visita ${tipo} já está marcada. Para mudar o horário, cancele em Visitas e peça de novo.`;

async function conta(papel: "owner" | "tenant", nome: string, largura: number) {
  const email = `${papel}.t944.${largura}.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email, nome, role: papel }, senha);
  ids.push(id);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return { id, email };
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
const daquiDias = (n: number, h = 17) => {
  const d = new Date(Date.now() + n * 86_400_000);
  d.setUTCHours(h, 0, 0, 0);
  return d;
};
const campoBrasilia = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 16);

test.describe("T944 — E411: segundo pedido de visita explica a regra e o caminho", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of LARGURAS) {
    test(`aba velha recusa com a explicação; pedida e agendada explicam (${largura})`, async ({ browser }) => {
      test.setTimeout(180_000);
      const dono = await conta("owner", `Dona Segunda${largura} Visita`, largura);
      const inq = await conta("tenant", `Inês Segunda${largura} Visita`, largura);
      const imovel = await criarImovelPronto(dono.id, `Studio Segunda Visita ${largura} ${sufixo}`, { ativo: true, preco: 3200 });

      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/imoveis/${imovel}`, { waitUntil: "domcontentloaded" });

      // 1. Abre o pedido presencial nesta aba (ainda sem pedido) e preenche o horário.
      const horario = page.getByTestId("visita-presencial-horario-0");
      await expect(async () => {
        if (!(await horario.isVisible())) {
          const botao = page.getByTestId("agendar-visita").first();
          await botao.scrollIntoViewIfNeeded({ timeout: 3_000 });
          await botao.click({ timeout: 4_000 }).catch(() => botao.dispatchEvent("click"));
        }
        await expect(horario).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 40_000 });
      await horario.fill(campoBrasilia(daquiDias(4)));
      // O pedido nasce em "outra aba" (o mesmo morador, mesmo imóvel, mesma modalidade).
      const { data: v, error } = await adm()
        .from("visitas_video")
        .insert({ property_id: imovel, owner_id: dono.id, tenant_id: inq.id, horarios: [daquiDias(3).toISOString()], modalidade: "presencial" })
        .select("id")
        .single();
      if (error) throw error;
      const enviar = page.getByTestId("visita-presencial-enviar");
      await enviar.scrollIntoViewIfNeeded({ timeout: 5_000 });
      await enviar.click({ timeout: 6_000 }).catch(() => enviar.dispatchEvent("click"));
      // Diagnóstico (vigia): se a recusa não aparecer, o erro traz o que a tela mostrou depois do envio.
      try {
        await expect(page.getByTestId("visita-presencial-erro")).toHaveText(ERRO, { timeout: 25_000 });
      } catch (e) {
        const texto = async (id: string) => ((await page.getByTestId(id).count()) ? await page.getByTestId(id).first().innerText().catch(() => "?") : "(ausente)");
        const diag = {
          url: page.url(),
          erro: await texto("visita-presencial-erro"),
          ok: await texto("visita-presencial-ok"),
          passo: await page.getByTestId("visita-presencial-passo").count(),
          pedida: await texto("visita-presencial-pedida"),
          agendar: await page.getByTestId("agendar-visita").count(),
          alertas: await page.getByRole("alert").allInnerTexts().catch(() => []),
          noBanco: (await adm().from("visitas_video").select("status, modalidade").eq("tenant_id", inq.id).eq("property_id", imovel)).data,
        };
        throw new Error(`t944 diag: ${JSON.stringify(diag)}\n${(e as Error).message}`);
      }
      await expect(page.getByTestId("visita-presencial-ok")).toHaveCount(0);
      const { count } = await adm().from("visitas_video").select("id", { count: "exact", head: true }).eq("tenant_id", inq.id).eq("property_id", imovel);
      expect(count, "nenhum segundo pedido gravado").toBe(1);

      // 2. Recarregada: "Visita pedida" com a explicação.
      await page.goto(`/imoveis/${imovel}`, { waitUntil: "domcontentloaded" });
      const pedida = page.getByTestId("visita-presencial-pedida").first();
      await expect(pedida).toBeAttached({ timeout: 25_000 });
      await expect(pedida).toHaveText(/Visita pedida/);
      await expect(pedida).toHaveAttribute("href", "/dashboard/visitas");
      await expect(page.getByTestId("visita-presencial-pedida-explica").first()).toHaveText(PEDIDA);
      await semRolagemLateral(page);

      // 3. Confirmada e por vir: "Visita agendada" com a explicação de horário marcado.
      await adm().from("visitas_video").update({ status: "confirmado", horario_confirmado: daquiDias(3).toISOString() }).eq("id", v.id);
      // 4. A visita por vídeo agendada segue a mesma regra.
      const { error: e2 } = await adm()
        .from("visitas_video")
        .insert({
          property_id: imovel, owner_id: dono.id, tenant_id: inq.id, horarios: [daquiDias(5).toISOString()], modalidade: "video",
          status: "confirmado", horario_confirmado: daquiDias(5).toISOString(), link_chamada: "https://meet.google.com/abc-defg-hij",
        });
      if (e2) throw e2;
      await page.reload({ waitUntil: "domcontentloaded" });
      const agendada = page.getByTestId("visita-presencial-agendada").first();
      await expect(agendada).toBeAttached({ timeout: 25_000 });
      await expect(agendada).toHaveText(/Visita agendada/);
      await expect(page.getByTestId("visita-presencial-agendada-explica").first()).toHaveText(AGENDADA("presencial"));
      await expect(page.getByTestId("visita-video-agendada-explica").first()).toHaveText(AGENDADA("por vídeo"));
      await expect(page.getByTestId("agendar-visita")).toHaveCount(0);
      await expect(page.getByTestId("visita-video-abrir")).toHaveCount(0);
      await semRolagemLateral(page);
      await page.context().close();
    });
  }
});
