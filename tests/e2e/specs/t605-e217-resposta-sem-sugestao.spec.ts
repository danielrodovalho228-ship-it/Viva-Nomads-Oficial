import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { adm, NO_LABORATORIO } from "../fixtures/laboratorio";

// Portão de #1483 (E217) e #1484 (E190 parte 2) (Pista C, 29/10): roda no lab-crítico deste PR.
/*
  T605 — E217 (L-70, Pista C): no chamado do admin, a resposta manual nunca depende da sugestão automática da Viva.
  Com a sugestão forçada a falhar (as ações do servidor recusadas enquanto a tela abre), aparece o aviso curto
  "Sugestão indisponível no momento — você pode responder normalmente", o atendente digita e envia, e a resposta
  chega ao chamado. Com a sugestão normal, o fluxo é o de hoje: ela vem na caixa, sem aviso, e o botão envia.
*/
const marca = `Lab T605 ${Date.now()}`;
const ids: string[] = [];

async function novoChamado(sufixo: string): Promise<string> {
  const agora = Date.now();
  const { data, error } = await adm()
    .from("chamados")
    .insert({
      visitante_email: "lab-t605@lab.vivanomads.test",
      visitante_nome: "Lara Teste",
      tipo: "suporte",
      categoria: "outro",
      prioridade: "p3",
      status: "aberto",
      canal: "site",
      assunto: `${marca} ${sufixo}`,
      responsavel_tipo: "humano",
      prazo_primeira_resposta: new Date(agora + 3_600_000).toISOString(),
      prazo_resolucao: new Date(agora + 86_400_000).toISOString(),
      simulacao: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  ids.push(data.id as string);
  const { error: eMsg } = await adm().from("chamado_mensagens").insert({ chamado_id: data.id, autor: "usuario", interno: false, corpo: "Olá! Como funciona o Caução?" });
  if (eMsg) throw eMsg;
  return data.id as string;
}

const respostasDaEquipe = async (id: string) =>
  ((await adm().from("chamado_mensagens").select("corpo").eq("chamado_id", id).eq("autor", "admin").eq("interno", false)).data ?? []).map((m) => m.corpo as string);

/** Recusa as ações do servidor (a sugestão incluída) até `liberar()`. */
async function recusarAcoes(page: Page) {
  const filtro = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) return route.abort("failed");
    return route.continue();
  };
  await page.route("**/admin/atendimento/**", filtro);
  return () => page.unroute("**/admin/atendimento/**", filtro);
}

test.describe("T605 — E217: responder o chamado sem depender da sugestão automática", () => {
  test.use({ storageState: authFile("admin") });
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.skip(!NO_LABORATORIO, "Precisa do banco do laboratório.");

  test.afterAll(async () => {
    if (ids.length) await adm().from("chamados").delete().in("id", ids);
  });

  test("sugestão falha: aviso discreto, o atendente digita e envia", async ({ page }) => {
    const id = await novoChamado("falha");
    const liberar = await recusarAcoes(page);
    await page.goto(`/admin/atendimento/${id}`, { waitUntil: "domcontentloaded" });
    const aviso = page.getByTestId("sugestao-indisponivel");
    await expect(aviso).toHaveText("Sugestão indisponível no momento — você pode responder normalmente.", { timeout: 30_000 });
    const enviar = page.getByTestId("enviar-resposta");
    // Caixa vazia: o motivo do botão parado está escrito.
    await expect(enviar).toBeDisabled();
    await expect(page.getByTestId("dica-caixa-vazia")).toBeVisible();
    const caixa = page.locator("textarea").last();
    await expect(caixa).toHaveValue("");
    await caixa.fill("Oi, Lara! O Caução é devolvido no fim da estadia. Qualquer dúvida, estou aqui.");
    await expect(enviar).toBeEnabled();
    await expect(page.getByTestId("dica-caixa-vazia")).toHaveCount(0);
    await page.screenshot({ path: "tests/laboratorio/saida/t605-sugestao-falhou.png" });
    await liberar();
    await enviar.click();
    await expect.poll(() => respostasDaEquipe(id), { timeout: 20_000 }).toEqual(["Oi, Lara! O Caução é devolvido no fim da estadia. Qualquer dúvida, estou aqui."]);
  });

  test("sugestão normal: vem na caixa, sem aviso, e o botão envia como hoje", async ({ page }) => {
    const id = await novoChamado("normal");
    await page.goto(`/admin/atendimento/${id}`, { waitUntil: "domcontentloaded" });
    const caixa = page.locator("textarea").last();
    await expect(caixa).not.toHaveValue("", { timeout: 30_000 });
    await expect(page.getByTestId("sugestao-indisponivel")).toHaveCount(0);
    await expect(page.getByTestId("dica-caixa-vazia")).toHaveCount(0);
    const enviar = page.getByTestId("enviar-resposta");
    await expect(enviar).toBeEnabled();
    const sugerida = await caixa.inputValue();
    await enviar.click();
    await expect.poll(async () => (await respostasDaEquipe(id)).length, { timeout: 20_000 }).toBe(1);
    expect((await respostasDaEquipe(id))[0]).toContain(sugerida.slice(0, 20));
  });
});
