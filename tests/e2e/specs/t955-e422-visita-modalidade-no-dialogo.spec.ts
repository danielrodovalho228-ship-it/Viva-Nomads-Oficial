import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T955 — E422 + E423 + E424 (#2058): o diálogo de visita escolhe a modalidade. O caso da conta de QA em produção:
 * visita por VÍDEO já confirmada; o anúncio desenhava "Visita por vídeo" e trocava por "Visita agendada" quando a
 * consulta chegava, e o diálogo presencial gravava presencial sem dizer nada do vídeo. Pela tela real, 390 e 1280:
 *   1. (E423) o botão da visita por vídeo não troca de rótulo: o primeiro estado desenhado já é "Visita agendada";
 *   2. (E422) "Agendar visita" abre o diálogo com as duas opções (Presencial · Por vídeo); "Por vídeo" está ocupada
 *      (data-livre=nao) e, escolhida, diz por quê ("Sua visita por vídeo já está marcada…") e leva a Visitas, sem
 *      campo de horário nem botão de enviar;
 *   3. de volta a "Presencial", o envio vai como PRESENCIAL ("Pedir visita presencial") — o banco ganha 1 presencial e
 *      o vídeo segue 1;
 *   4. (E424) a confirmação diz a modalidade, os horários e o próximo passo, com "Ver em Visitas"; a moradora recebe o
 *      e-mail do resumo (visita_pedida_morador); ao fechar, o anúncio mostra "Visita pedida" com a explicação.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];
const OCUPADA_VIDEO = "Sua visita por vídeo já está marcada. Para mudar o horário, cancele em Visitas e peça de novo.";

async function conta(papel: "owner" | "tenant", nome: string, largura: number) {
  const email = `${papel}.t955.${largura}.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email, nome, role: papel }, senha);
  ids.push(id);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return { id, email };
}
const daquiDias = (n: number, h = 17) => {
  const d = new Date(Date.now() + n * 86_400_000);
  d.setUTCHours(h, 0, 0, 0);
  return d;
};
const campoBrasilia = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 16);
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T955 — E422/E423/E424: a modalidade da visita no próprio diálogo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280] as const) {
    test(`vídeo confirmado: o diálogo mostra a ocupada e pede a presencial certa (${largura})`, async ({ browser }) => {
      test.setTimeout(180_000);
      const dono = await conta("owner", `Dona Modal${largura} Visita`, largura);
      const inq = await conta("tenant", `Inês Modal${largura} Visita`, largura);
      const imovel = await criarImovelPronto(dono.id, `Studio Modalidade ${largura} ${sufixo}`, { ativo: true, preco: 3200 });
      const quando = daquiDias(2).toISOString();
      const { error } = await adm().from("visitas_video").insert({
        property_id: imovel, owner_id: dono.id, tenant_id: inq.id, horarios: [quando], modalidade: "video",
        status: "confirmado", horario_confirmado: quando, link_chamada: "https://meet.google.com/abc-defg-hij",
      });
      if (error) throw error;

      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      // 1. E423: registra todo rótulo que o botão da visita por vídeo chega a mostrar.
      await page.addInitScript(() => {
        const w = window as unknown as { __rotulosVideo: string[] };
        w.__rotulosVideo = [];
        new MutationObserver(() => {
          for (const el of Array.from(document.querySelectorAll('[data-testid^="visita-video-"]'))) {
            const id = el.getAttribute("data-testid") ?? "";
            if (/^visita-video-(abrir|agendada|pedida|ver)$/.test(id) && w.__rotulosVideo[w.__rotulosVideo.length - 1] !== id) w.__rotulosVideo.push(id);
          }
        }).observe(document, { childList: true, subtree: true });
      });
      await page.goto(`/imoveis/${imovel}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("visita-video-agendada").first()).toBeAttached({ timeout: 30_000 });
      const rotulos = await page.evaluate(() => (window as unknown as { __rotulosVideo: string[] }).__rotulosVideo);
      expect(rotulos, `rótulos do botão de vídeo vistos: ${rotulos.join(" → ")}`).not.toContain("visita-video-abrir");

      // 2. E422: o diálogo com as duas opções; a de vídeo ocupada.
      const horario = page.getByTestId("visita-presencial-horario-0");
      await expect(async () => {
        if (!(await horario.isVisible())) {
          const botao = page.getByTestId("agendar-visita").first();
          await botao.scrollIntoViewIfNeeded({ timeout: 3_000 });
          await botao.click({ timeout: 4_000 }).catch(() => botao.dispatchEvent("click"));
        }
        await expect(horario).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 40_000 });
      const grupo = page.getByTestId("visita-modalidade");
      await expect(grupo).toHaveAttribute("role", "radiogroup");
      await expect(page.getByTestId("visita-modalidade-presencial")).toHaveAttribute("aria-checked", "true");
      await expect(page.getByTestId("visita-modalidade-presencial")).toHaveAttribute("data-livre", "sim");
      await expect(page.getByTestId("visita-modalidade-video")).toHaveAttribute("data-livre", "nao");
      await page.getByTestId("visita-modalidade-video").click();
      const ocupada = page.getByTestId("visita-modalidade-ocupada-video");
      await expect(ocupada).toContainText(OCUPADA_VIDEO);
      await expect(ocupada.getByRole("link", { name: "Ver em Visitas" })).toHaveAttribute("href", "/dashboard/visitas");
      await expect(page.getByTestId("visita-video-horario-0")).toHaveCount(0);
      await expect(page.getByTestId("visita-video-enviar")).toHaveCount(0);
      await semRolagemLateral(page);

      // 3. Presencial: o envio vai como presencial.
      await page.getByTestId("visita-modalidade-presencial").click();
      await expect(horario).toBeVisible();
      await horario.fill(campoBrasilia(daquiDias(4)));
      const desde = new Date(Date.now() - 2_000).toISOString();
      const enviar = page.getByTestId("visita-presencial-enviar");
      await expect(enviar).toHaveText("Pedir visita presencial");
      await enviar.scrollIntoViewIfNeeded({ timeout: 5_000 });
      await enviar.click({ timeout: 6_000 }).catch(() => enviar.dispatchEvent("click"));

      // 4. E424: a confirmação com a modalidade, os horários e o próximo passo.
      const ok = page.getByTestId("visita-presencial-ok");
      await expect(ok).toContainText("Pedido de visita presencial enviado. Horários propostos:", { timeout: 25_000 });
      await expect(ok).toContainText("(horário de Brasília)");
      await expect(ok).toContainText("o endereço exato aparece depois da confirmação");
      await expect(ok).toContainText("acompanha tudo em Visitas");
      await expect(page.getByTestId("visita-presencial-ver-visitas")).toHaveAttribute("href", "/dashboard/visitas");
      const { data: noBanco } = await adm().from("visitas_video").select("modalidade, status").eq("tenant_id", inq.id).eq("property_id", imovel);
      const por = (m: string) => (noBanco ?? []).filter((v) => (v as { modalidade: string }).modalidade === m).length;
      expect(por("presencial"), "1 presencial gravada").toBe(1);
      expect(por("video"), "o vídeo segue 1").toBe(1);
      await expect
        .poll(async () => (await adm().from("emails_teste").select("id", { count: "exact", head: true }).eq("usuario_id", inq.id).eq("evento", "visita_pedida_morador").gte("criado_em", desde)).count ?? 0, { timeout: 30_000 })
        .toBeGreaterThan(0);

      // Ao fechar, o anúncio mostra "Visita pedida" com a explicação.
      // O diálogo redesenha depois da confirmação (o botão "Fechar" pode sair do DOM no meio do clique): tenta até fechar.
      await expect(async () => {
        const fechar = page.getByTestId("visita-presencial-fechar");
        if (await fechar.count()) await fechar.first().click({ timeout: 3_000 });
        await expect(page.getByTestId("visita-presencial-pedida").first()).toBeAttached({ timeout: 3_000 });
      }).toPass({ timeout: 30_000 });
      await expect(page.getByTestId("visita-presencial-pedida-explica").first()).toContainText("cancele o pedido em Visitas e peça de novo");
      await semRolagemLateral(page);
      await page.context().close();
    });
  }
});
