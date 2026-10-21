import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
 * T252 — "Solicitar orçamento" vivo na página pública do parceiro (QA do Muse no 31b, 21/10).
 * Em produção o botão aparecia desabilitado, com o texto antigo "Em breve: o pedido de orçamento…": o deploy do merge
 * do #967 não tinha chegado. Este spec falha nesse caso, nos dois alvos:
 *  - no laboratório: cria um parceiro publicado e abre a página dele;
 *  - no deploy (preview ou produção, workflow E2E): abre o parceiro de QA (TESTES_PARCEIRO_SLUG, padrão o do Muse).
 * Sem login, o botão leva à entrada e volta para a mesma página; nunca fica desabilitado.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const TEXTO_ANTIGO = /Em breve: o pedido de orçamento/i;
const sufixo = novoSufixo();
const senha = novaSenha();
const ids: { conta?: string; parceiro?: string } = {};
let slug = process.env.TESTES_PARCEIRO_SLUG || "paulo-fotos-teste-qa";

test.describe("T252 — Solicitar orçamento na página pública do parceiro", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    if (!NO_LABORATORIO) return;
    slug = `fotos-t252-${sufixo}`;
    ids.conta = await criarConta({ email: `foto.t252.${sufixo}@lab.vivanomads.test`, nome: "Fábio Fotos", role: "owner" }, senha);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.conta, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Fábio Fotos ${sufixo}`, slug, categorias: ["fotografia"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = data.id as string;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.conta]);
  });

  for (const largura of [390, 1280]) {
    test(`botão ativo, sem o texto antigo, leva à entrada (${largura} px)`, async ({ page }, info) => {
      test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const r = await page.goto(`/parceiros/${slug}`, { waitUntil: "domcontentloaded" });
      test.skip(!NO_LABORATORIO && r?.status() === 404, `parceiro de QA ${slug} não publicado neste ambiente`);
      await expect(page.getByTestId("pagina-parceiro")).toBeVisible();

      const botao = page.getByTestId("solicitar-orcamento");
      await expect(botao).toBeVisible();
      await expect(botao).toBeEnabled();
      await expect(botao).not.toHaveAttribute("aria-disabled", "true");
      await expect(botao).toHaveText(/Solicitar orçamento/);
      await expect(page.locator("body")).not.toContainText(TEXTO_ANTIGO);

      await botao.click();
      await expect(page).toHaveURL(new RegExp(`/auth\\?redirect=${encodeURIComponent(`/parceiros/${slug}`).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    });
  }
});
