import { test, expect, type Browser, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T187 — Conferência automática do documento do imóvel na etapa 1 do cadastro (prompt 11), com documentos de teste
  FICTÍCIOS gerados aqui (sem dado real de ninguém) e a leitura da IA SIMULADA no laboratório:
  1. endereço errado → "Corrija" com o motivo detalhado; reenviar o certo → "Documentação conferida" (390 e 1280);
  2. documento editado (print de tela) → "Em revisão" e entra na fila do admin com o motivo, o checklist pré-marcado
     e o prazo de 48 h; só esses casos entram na fila;
  3. o mesmo arquivo em outra conta → recusado como duplicado;
  4. aba "Conferidos automaticamente": o aprovado aparece, com o JSON da leitura, e pode ser reaberto.
  O caminho "aprovado → publica com Documentação conferida" está no t186.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: (string | undefined)[] = [];

/** Matrícula FICTÍCIA (tests/fixtures) com bytes extras: hash próprio a cada envio. */
function matriculaLab(): Buffer {
  return Buffer.concat([readFileSync("tests/fixtures/matricula-ficticia-dono.pdf"), Buffer.from(`% ${randomBytes(8).toString("hex")}\n`)]);
}

function docLab(caso: "ok" | "endereco_errado" | "editado", extra = randomBytes(8).toString("hex")): Buffer {
  return Buffer.concat([Buffer.from(`%PDF-1.4\n% documento ficticio do laboratorio VIVA-LAB-DOC:${caso} ${extra}\n`), Buffer.alloc(12 * 1024, 0x20), Buffer.from("\n%%EOF\n")]);
}

/** Dono novo na etapa 1, com CEP + número (ViaCEP simulado) e o rascunho já salvo. */
async function donoNaEtapa1(browser: Browser, largura: number, nome: string): Promise<Page> {
  const email = `dono.doc.${randomBytes(3).toString("hex")}.${sufixo}@lab.vivanomads.test`;
  ids.push(await criarConta({ email, nome, role: "owner" }, senha));
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: 900 });
  await page.route("https://viacep.com.br/ws/**", (r) =>
    r.fulfill({ json: { cep: "38400-100", logradouro: "Rua do Laboratório", bairro: "Centro", localidade: "Uberlândia", uf: "MG" } }),
  );
  await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Onde fica" })).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("cadastro-cep").fill("38400100");
  await expect(page.getByTestId("cadastro-rua")).toHaveValue("Rua do Laboratório", { timeout: 10_000 });
  await page.getByTestId("cadastro-numero").fill("102");
  await page.waitForTimeout(2_500);
  await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 15_000 });
  return page;
}

async function enviar(page: Page, arquivo: Buffer, nome = "documento-ficticio.pdf") {
  await page.getByTestId("documento-vinculo").locator('input[type="file"]').first().setInputFiles({ name: nome, mimeType: "application/pdf", buffer: arquivo });
}

test.describe("T187 — conferência automática do documento", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (leitura simulada).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px — endereço errado mostra "Corrija" com o motivo; o reenvio corrige`, async ({ browser }) => {
      const page = await donoNaEtapa1(browser, largura, `Carla Corrija${largura} Sobrenome`);
      await enviar(page, docLab("endereco_errado"));
      const estado = page.getByTestId("documento-estado");
      await expect(estado).toHaveAttribute("data-estado", "corrija", { timeout: 30_000 });
      await expect(page.getByTestId("documento-motivos")).toContainText("O número do documento (120) não bate com o do anúncio (102).");
      await page.getByTestId("documento-vinculo").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t187-corrija-${largura}.png`, fullPage: false });
      // Nada de CPF inteiro na tela.
      await expect(page.locator("main")).not.toContainText(/\d{3}\.\d{3}\.\d{3}-\d{2}/);

      // Reenvio com a MATRÍCULA (identidade já confirmada): sem matrícula o documento iria para a equipe (decisão 18/10).
      expect((await page.request.post("/api/caf/verify")).ok()).toBe(true);
      await enviar(page, matriculaLab(), "matricula-ficticia.pdf");
      await expect(estado).toHaveAttribute("data-estado", "aprovado", { timeout: 30_000 });
      await expect(estado).toContainText("Documentação conferida");
      await page.screenshot({ path: `${SAIDA}/t187-conferida-${largura}.png`, fullPage: false });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }

  test("390px — o mesmo arquivo em outra conta é recusado como duplicado", async ({ browser }) => {
    const arquivo = docLab("ok", `dup-${sufixo}`);
    const a = await donoNaEtapa1(browser, 390, "Dalva Duplica Sobrenome");
    await enviar(a, arquivo);
    // Conta de luz certinha, mas sem matrícula: aceita e vai para a equipe (48 h), com o motivo explicado.
    await expect(a.getByTestId("documento-estado")).toHaveAttribute("data-estado", "revisao", { timeout: 30_000 });
    await expect(a.getByTestId("documento-motivos")).toContainText("Sem a matrícula, a equipe confere o IPTU e o contrato de compra e venda");
    await a.screenshot({ path: `${SAIDA}/t187-sem-matricula-revisao-390.png`, fullPage: false });
    await a.context().close();

    const b = await donoNaEtapa1(browser, 390, "Davi Duplica Sobrenome");
    await enviar(b, arquivo);
    await expect(b.getByTestId("documento-estado")).toHaveAttribute("data-estado", "corrija", { timeout: 30_000 });
    await expect(b.getByTestId("documento-motivos")).toContainText("Arquivo já utilizado em outro cadastro");
    await b.screenshot({ path: `${SAIDA}/t187-duplicado-390.png`, fullPage: false });
    await b.context().close();
  });

  const primeiro = `Edgar${sufixo}`;
  test("1280px — documento editado fica \"Em revisão\" (prazo de 48 h)", async ({ browser }) => {
    const page = await donoNaEtapa1(browser, 1280, `${primeiro} Editado Sobrenome`);
    await enviar(page, docLab("editado"));
    await expect(page.getByTestId("documento-estado")).toHaveAttribute("data-estado", "revisao", { timeout: 30_000 });
    await expect(page.getByTestId("documento-estado")).toContainText("48 horas");
    await page.screenshot({ path: `${SAIDA}/t187-em-revisao-1280.png`, fullPage: false });
    await page.context().close();
    // Na fila: status pending, prazo gravado, conferência com o motivo.
    const { data } = await adm()
      .from("qualification_checklists")
      .select("document_status, revisao_ate, conferido_por, conferencia")
      .eq("owner_id", ids[ids.length - 1]!)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(data!.document_status).toBe("pending");
    expect(data!.conferido_por).toBeNull();
    const horas = (Date.parse(data!.revisao_ate as string) - Date.now()) / 3_600_000;
    expect(horas).toBeGreaterThan(47);
    expect(horas).toBeLessThanOrEqual(48);
    expect((data!.conferencia as { estado: string }).estado).toBe("revisao");
  });

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });

    test("1280px — a fila mostra só os casos em revisão, com o motivo da IA e o checklist pré-marcado; aba de conferidos automaticamente", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("conferencia-contadores")).toBeVisible({ timeout: 20_000 });
      const card = page.getByTestId("doc-card").filter({ hasText: primeiro });
      await expect(card).toHaveCount(1);
      await expect(card.getByTestId("conferencia-ia")).toContainText("Possível edição no documento: print de tela");
      await expect(card.getByTestId("conferencia-prazo")).toContainText("Prazo: até");
      for (const cb of await card.getByRole("checkbox").all()) await expect(cb).toBeChecked();
      // Os documentos que passaram ou foram devolvidos NÃO entram na fila.
      await expect(page.getByTestId("doc-card").filter({ hasText: "Carla" })).toHaveCount(0);
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t187-admin-fila-1280.png`, fullPage: false });

      await page.getByRole("tab", { name: /Conferidos automaticamente/ }).click();
      // Os dois aprovados da Carla (390 e 1280) aparecem; reabre um e fica só o outro.
      await expect(page.getByTestId("auto-card").filter({ hasText: "Carla" })).toHaveCount(2);
      // A trilha da matrícula não guarda nome (sem dado pessoal): reabre um dos dois da Carla.
      const auto = page.getByTestId("auto-card").filter({ hasText: "Carla" }).first();
      await expect(auto).toBeVisible();
      await auto.getByText("Ver o que a conferência leu").click();
      await expect(auto.getByTestId("auto-card-json")).toContainText('"estado": "aprovado"');
      await expect(auto.getByTestId("auto-card-json")).not.toContainText(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      await page.screenshot({ path: `${SAIDA}/t187-admin-automaticos-1280.png`, fullPage: false });
      await auto.getByRole("button", { name: "Reabrir para revisão" }).click();
      await expect(page.getByTestId("auto-card").filter({ hasText: "Carla" })).toHaveCount(1, { timeout: 10_000 });
    });
  });
});
