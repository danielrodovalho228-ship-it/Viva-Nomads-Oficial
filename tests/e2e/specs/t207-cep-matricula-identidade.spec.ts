import { test, expect, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirNoEndereco, noPasso, abrirSecoesPasso10 } from "../fixtures/cadastro";

/*
  T207 — Prompt 25 (reteste do Muse do #838). 390 e 1280 px.
   1. CEP fantasma: 99999-999 com o ViaCEP dizendo "não existe" mostra "Não encontramos esse CEP" + "buscar pelo
      endereço", a BrasilAPI NEM É CHAMADA e "Sarandi" não aparece; 38400-100 preenche Uberlândia.
   2. Identidade: laudo válido mostra a data de 12 meses; trocar o CPF invalida e a etapa oferece "Confirmar de novo".
   3. Admin: o último erro da IA mostra a MENSAGEM da API (erro_resumo) e o "Testar leitura" lê a matrícula fictícia.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const FANTASMA = { street: "Avenida das Torres", neighborhood: "Jardim Centro Cívico", city: "Sarandi", state: "PR", service: "open-cep" };
const ids: Record<string, string> = {};

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

async function abrirPasso1(browser: Browser, email: string, largura: number, brasil: string[]): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: 900 });
  await page.route("https://viacep.com.br/ws/**", (r) => {
    const url = r.request().url();
    if (url.includes("/38400100/")) return r.fulfill({ json: { cep: "38400-100", logradouro: "Avenida Afonso Pena", bairro: "Centro", localidade: "Uberlândia", uf: "MG" } });
    return r.fulfill({ json: { erro: "true" } });
  });
  await page.route("https://brasilapi.com.br/api/cep/**", (r) => {
    brasil.push(r.request().url());
    return r.fulfill({ json: FANTASMA });
  });
  // Assistente em 10 passos: o endereço é o 3º passo; abre direto nele.
  await abrirNoEndereco(page);
  return page;
}

test.describe("T207 — CEP fantasma, matrícula 400 e validade da identidade (prompt 25)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    for (const l of [390, 1280]) {
      ids[`d${l}`] = await criarConta({ email: `dono.t207.${l}.${sufixo}@lab.vivanomads.test`, nome: "Clara Cep Sobrenome", role: "owner" }, senha);
    }
  });
  test.afterAll(async () => {
    await adm().from("tenant_verifications").delete().in("tenant_id", Object.values(ids));
    await apagarContas(Object.values(ids));
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px — 99999-999: 'Não encontramos' + buscar pelo endereço, sem BrasilAPI; 38400-100 preenche Uberlândia`, async ({ browser }) => {
      test.setTimeout(90_000);
      const brasil: string[] = [];
      const page = await abrirPasso1(browser, `dono.t207.${largura}.${sufixo}@lab.vivanomads.test`, largura, brasil);
      await page.getByTestId("cadastro-cep").fill("99999999");
      await expect(page.getByText("Não encontramos esse CEP").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/buscar pelo endereço/i).first()).toBeVisible();
      await expect(page.getByTestId("cadastro-rua")).not.toHaveValue("Avenida das Torres");
      expect(await page.locator("main").innerText()).not.toContain("Sarandi");
      expect(brasil, "a BrasilAPI não é chamada quando o ViaCEP diz que o CEP não existe").toEqual([]);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t207-cep-99999-${largura}.png`, fullPage: false });

      await page.getByTestId("cadastro-cep").fill("38400100");
      await expect(page.getByTestId("cadastro-rua")).toHaveValue("Avenida Afonso Pena", { timeout: 15_000 });
      await expect(page.getByText("Endereço encontrado").first()).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/t207-cep-38400100-${largura}.png`, fullPage: false });
      await page.context().close();
    });
  }

  for (const largura of [390, 1280]) {
    test(`${largura}px — identidade: laudo de 12 meses; trocar o CPF pede 'Confirmar de novo'`, async ({ browser }) => {
      test.setTimeout(90_000);
      const id = ids[`d${largura}`];
      const criado = new Date();
      const ate = new Date(criado.getTime());
      ate.setFullYear(ate.getFullYear() + 1);
      // A tela mostra a data no fuso de Brasília (dataIdentidade); o lab roda em UTC, então a 1h da manhã UTC já é "ontem" aqui.
      await adm().from("tenant_verifications").delete().eq("tenant_id", id);
      await adm()
        .from("tenant_verifications")
        .insert({ tenant_id: id, caf_result: { identity: true, document: true, liveness: true, light: "green", simulado: true }, traffic_light: "green", created_at: criado.toISOString(), valid_until: ate.toISOString() });
      const page = await abrirPasso1(browser, `dono.t207.${largura}.${sufixo}@lab.vivanomads.test`, largura, []);
      // E104: a identidade mora no "Antes de publicar" da Revisão (o Passo 3 é só endereço).
      await page.goto("/dashboard/imoveis/novo?etapa=revisao", { waitUntil: "domcontentloaded" });
      await noPasso(page, "revisao");
      await expect(page.getByTestId("identidade-confirmada")).toContainText(ate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }), { timeout: 20_000 });

      // Troca do CPF no cadastro → o gatilho 0164 invalida o laudo → a etapa pede para confirmar de novo.
      // CPF novo e único (o índice profiles_cpf_unico recusava um número fixo que outra conta do lab já tinha).
      const troca = await adm().from("profiles").update({ cpf: cpfAleatorio() }).eq("id", id);
      expect(troca.error).toBeNull();
      // Recarrega na Revisão pelo nome (E104: a identidade fica no "Antes de publicar").
      const url = new URL(page.url());
      url.searchParams.set("etapa", "revisao");
      await page.goto(url.pathname + url.search, { waitUntil: "domcontentloaded" });
      await abrirSecoesPasso10(page, ["identidade"]); // E251: as seções são um acordeão
      await expect(page.getByTestId("identidade-refazer")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("identidade-confirmar")).toHaveText(/Confirmar de novo/);
      await page.getByTestId("etapa-identidade").scrollIntoViewIfNeeded();
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t207-identidade-refazer-${largura}.png`, fullPage: false });
      await page.context().close();
    });
  }

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });
    test("1280px — último erro com a mensagem da API; 'Testar leitura' lê a matrícula fictícia", async ({ page }) => {
      test.setTimeout(90_000);
      await adm().from("ia_chamadas").insert({
        rota: "documento",
        ok: false,
        status: 400,
        tipo_erro: "invalid_request_error",
        motivo: "indisponivel",
        modelo: "lab-t207",
        arquivo_mime: "image/jpeg",
        arquivo_bytes: 53_000,
        erro_resumo: "output_config.format.schema: mensagem de teste do laboratório",
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      // ADMIN-3/4 (#1354): o painel da IA do cadastro mora em /admin/sistema.
      await page.goto("/admin/sistema", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("painel-ia-erro-resumo")).toContainText("mensagem de teste do laboratório", { timeout: 30_000 });
      await page.getByTestId("testar-leitura-arquivo").setInputFiles({
        name: "matricula-ficticia.pdf",
        mimeType: "application/pdf",
        buffer: readFileSync("tests/fixtures/matricula-ficticia-dono.pdf"),
      });
      await page.getByTestId("testar-leitura-enviar").click();
      const res = page.getByTestId("testar-leitura-resultado");
      await expect(res).toContainText('"ok": true', { timeout: 30_000 });
      await expect(res).not.toContainText(/cpf|proprietari/i);
      await page.getByTestId("painel-ia-cadastro").screenshot({ path: `${SAIDA}/t207-admin-ia-1280.png` });
      await adm().from("ia_chamadas").delete().eq("modelo", "lab-t207");
    });
  });
});
