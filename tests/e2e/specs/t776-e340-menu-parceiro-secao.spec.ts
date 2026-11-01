import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T776 — E340 (01/11): no painel do parceiro (página única com #pedidos, #agenda, #ganhos), a aba acesa acompanha a
  seção visível — uma só por vez — no topo do computador (1280) e na barra de baixo do celular (390); abrir com #ganhos
  já acende Ganhos (e a página chega lá mesmo com o conteúdo carregando depois); no celular (uma coluna) rolar troca; no
  computador (Pedidos ao lado de Agenda/Ganhos) e no celular, clicar numa aba acende ela.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];
const slug = `menu-e340-${sufixo}`.toLowerCase().replace(/[^a-z0-9-]/g, "");

/** As abas-âncora acesas (aria-current) visíveis na tela. */
const acesas = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('a[aria-current="page"][href^="/dashboard/parceiro#"]')]
      .filter((a) => (a as HTMLElement).offsetParent !== null)
      .map((a) => a.getAttribute("href")),
  );

test.describe("T776 — E340: a aba acompanha a seção do painel do parceiro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  let email = "";

  test.beforeAll(async () => {
    email = `owner.${randomBytes(3).toString("hex")}.${sufixo}@lab.vivanomads.test`;
    const id = await criarConta({ email, nome: `Paula Parceira E340 ${sufixo}`, role: "owner" }, senha);
    ids.push(id);
    await adm().from("profiles").update({ is_teste: true }).eq("id", id);
    const { error } = await adm()
      .from("parceiros")
      .insert({ user_id: id, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Faxina E340 ${sufixo}`, slug, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() });
    if (error) throw error;
  });
  test.afterAll(async () => {
    await adm().from("parceiros").delete().eq("slug", slug);
    await apagarContas(ids);
  });

  for (const largura of [1280, 390]) {
    test(`uma aba acesa, a da seção visível (${largura})`, async ({ browser }) => {
      const page = await entrar(browser, email, senha);
      await page.setViewportSize({ width: largura, height: 800 });
      await page.goto("/dashboard/parceiro#ganhos", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("parceiro-ganhos")).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => acesas(page), { timeout: 15_000 }).toEqual(["/dashboard/parceiro#ganhos"]);
      const aba = (secao: string) => page.locator(`a[href="/dashboard/parceiro#${secao}"]`).filter({ visible: true }).first();
      if (largura === 390) {
        // Uma coluna: a pessoa rola (roda do mouse) e a seção visível manda.
        await page.mouse.move(200, 400);
        for (const secao of ["agenda", "pedidos"]) {
          await page.mouse.wheel(0, 1);
          await page.evaluate((s) => document.getElementById(s)?.scrollIntoView({ block: "start" }), secao);
          await expect.poll(() => acesas(page), { timeout: 10_000, message: `seção ${secao}` }).toEqual([`/dashboard/parceiro#${secao}`]);
        }
      } else {
        // Computador: Pedidos à esquerda e Agenda/Ganhos à direita, na mesma altura — quem escolhe é o clique na aba.
        for (const secao of ["agenda", "pedidos"]) {
          await aba(secao).click();
          await expect.poll(() => acesas(page), { timeout: 10_000, message: `clique em ${secao}` }).toEqual([`/dashboard/parceiro#${secao}`]);
        }
      }
      // Clicar numa aba acende ela (mesmo que a seção seja curta e não chegue ao topo da tela).
      await aba("ganhos").click();
      await expect.poll(() => acesas(page), { timeout: 10_000, message: "clique em Ganhos" }).toEqual(["/dashboard/parceiro#ganhos"]);
      await page.screenshot({ path: `tests/laboratorio/saida/t776-ganhos-${largura}.png` });
      await page.context().close();
    });
  }
});
