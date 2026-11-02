import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1019 — #2254 (resíduo da varredura): na Central de ajuda (/ajuda/fale-com-a-viva?chamado=<número>), a falha ao
 * ler o chamado do cliente NÃO vira "Chamado não encontrado" (a pessoa abriria outro igual): o detalhe mostra "Não foi
 * possível carregar o chamado agora. Recarregue a página em instantes." (chamado-sem-leitura). 390 e 1280:
 *   1. controle: sem falha, o detalhe abre com o assunto do chamado da conta (a massa é real);
 *   2. com a resposta de meuChamado() trocada por 500 (só ela: a resposta que traz "mensagens"), o aviso aparece e
 *      nada diz que o chamado não existe.
 * As demais leituras do #2254 (responder, pedir pessoa, marcar resolvido) e os #2255 e #2256 são falhas dentro do
 * servidor: ficam com os testes de unidade.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `cli.t1019.${sufixo}@lab.vivanomads.test`, nome: "Célia Chamado Souza", role: "tenant" as const };
const ASSUNTO = `Dúvida sobre a caução (t1019 ${sufixo})`;
const ids: { conta?: string; chamado?: string; numero?: string } = {};
const AVISO = "Não foi possível carregar o chamado agora. Recarregue a página em instantes.";

async function abrir(browser: Browser, largura: number): Promise<Page> {
  const page = await entrar(browser, conta.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return page;
}

/** Troca por 500 só a resposta da ação do servidor com o detalhe do chamado; as outras passam. */
async function falharLeitura(page: Page, vistas: string[]) {
  await page.route("**/ajuda/fale-com-a-viva**", async (r) => {
    if (r.request().method() !== "POST" || !r.request().headers()["next-action"]) return r.continue().catch(() => {});
    try {
      const resp = await r.fetch();
      const corpo = await resp.text();
      if (corpo.includes('"mensagens"')) {
        vistas.push("falhou");
        return await r.fulfill({ status: 500, body: "falha simulada (t1019)" });
      }
      return await r.fulfill({ response: resp, body: corpo });
    } catch {
      /* a página navegou ou a rota já foi resolvida */
    }
  });
}

test.describe("T1019 — #2254: a falha ao ler o chamado não vira 'Chamado não encontrado'", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    const agora = Date.now();
    const { data, error } = await adm()
      .from("chamados")
      .insert({
        usuario_id: ids.conta, tipo: "suporte", categoria: "outro", prioridade: "p3", status: "aberto", canal: "site", assunto: ASSUNTO,
        responsavel_tipo: "humano", prazo_primeira_resposta: new Date(agora + 3_600_000).toISOString(), prazo_resolucao: new Date(agora + 86_400_000).toISOString(), simulacao: true,
      })
      .select("id, numero_publico")
      .single();
    if (error) throw error;
    ids.chamado = (data as { id: string }).id;
    ids.numero = (data as { numero_publico: string }).numero_publico;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.chamado) await adm().from("chamados").delete().eq("id", ids.chamado);
    await apagarContas([ids.conta]);
  });

  for (const w of [390, 1280] as const) {
    test(`controle: o detalhe abre com o assunto do chamado (${w})`, async ({ browser }) => {
      const page = await abrir(browser, w);
      await page.goto(`/ajuda/fale-com-a-viva?chamado=${ids.numero}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(ASSUNTO).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("chamado-sem-leitura")).toHaveCount(0);
      await page.context().close();
    });

    test(`leitura que falha: o aviso, nunca "Chamado não encontrado" (${w})`, async ({ browser }) => {
      const page = await abrir(browser, w);
      const vistas: string[] = [];
      await falharLeitura(page, vistas);
      await page.goto(`/ajuda/fale-com-a-viva?chamado=${ids.numero}`, { waitUntil: "domcontentloaded" });
      await expect.poll(() => vistas.length, { timeout: 30_000, message: "a leitura do chamado precisa ter sido interceptada" }).toBeGreaterThan(0);
      await expect(page.getByTestId("chamado-sem-leitura")).toHaveText(AVISO, { timeout: 15_000 });
      await expect(page.getByText(/Chamado não encontrado/i)).toHaveCount(0);
      await expect(page.getByText(ASSUNTO)).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.unrouteAll({ behavior: "wait" });
      await page.context().close();
    });
  }
});
