import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirNoEndereco, irParaAntesDePublicar } from "../fixtures/cadastro";
import { TEXTO_PRAZO_DOCUMENTO } from "../../../src/config/prazos-canais";
import { textoRespostaAte } from "../../../src/lib/documento/prazo-analise";

/*
  T1648 — E948 (O-68; decisão do Daniel, 15/11) e E947, T5 no laboratório, a 390 e 1280 px:
   1. /para-proprietarios mostra o prazo da análise do documento (TEXTO_PRAZO_DOCUMENTO);
   2. a busca "documento" na Ajuda mostra a resposta "publicar" com o prazo; a busca "empresa" mostra a pergunta de
      empresas (E947) com o link /empresas;
   3. o proprietário envia o documento de um anúncio de teste → Meus imóveis mostra "Em análise · resposta até {data}"
      (a data de T1, pelo calendário único) e a caixa simulada do lab tem o e-mail documento_em_analise com o prazo.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];

const docEditado = () => Buffer.concat([Buffer.from(`%PDF-1.4\n% documento ficticio do laboratorio VIVA-LAB-DOC:editado ${randomBytes(8).toString("hex")}\n`), Buffer.alloc(12 * 1024, 0x20), Buffer.from("\n%%EOF\n")]);

test.describe("T1648 — E948: prazo público da análise do documento", () => {
  for (const largura of [390, 1280] as const) {
    test(`${largura} px — /para-proprietarios e a Ajuda dizem o prazo; a Ajuda acha a pergunta de empresas`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/para-proprietarios", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("pp-prazo-documento")).toHaveText(TEXTO_PRAZO_DOCUMENTO);
      await page.goto("/ajuda/proprietarios", { waitUntil: "domcontentloaded" });
      const perguntas = page.getByTestId("ajuda-perguntas");
      await perguntas.getByRole("searchbox", { name: "Buscar nas perguntas frequentes" }).fill("documento");
      await perguntas.getByRole("button", { name: "Por que meu anúncio não publica?" }).click();
      await expect(perguntas).toContainText(TEXTO_PRAZO_DOCUMENTO);
      await page.goto("/ajuda/morador", { waitUntil: "domcontentloaded" });
      await perguntas.getByRole("searchbox", { name: "Buscar nas perguntas frequentes" }).fill("empresa");
      await perguntas.getByRole("button", { name: "Minha empresa pode alugar moradia para funcionários?" }).click();
      await expect(perguntas.getByRole("link", { name: /Moradia para empresas/ })).toHaveAttribute("href", "/empresas");
    });
  }

  test.describe("proprietário envia o documento", () => {
    test.skip(!NO_LABORATORIO, "Só no laboratório (leitura simulada e caixa simulada).");
    test.describe.configure({ timeout: 180_000 });
    test.afterAll(async () => {
      await apagarContas(ids);
    });

    test("Meus imóveis: 'em análise · resposta até {data}'; o e-mail documento_em_analise chega com o prazo", async ({ browser }) => {
      const email = `dono.t1648.${randomBytes(3).toString("hex")}.${sufixo}@lab.vivanomads.test`;
      ids.push(await criarConta({ email, nome: `Dora${sufixo} Documento`, role: "owner" }, senha));
      const page = await entrar(browser, email, senha);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.route("https://viacep.com.br/ws/**", (r) => r.fulfill({ json: { cep: "38400-100", logradouro: "Rua do Laboratório", bairro: "Centro", localidade: "Uberlândia", uf: "MG" } }));
      await abrirNoEndereco(page);
      await page.getByTestId("cadastro-cep").fill("38400100");
      await expect(page.getByTestId("cadastro-rua")).toHaveValue("Rua do Laboratório", { timeout: 10_000 });
      await page.getByTestId("cadastro-numero").fill("102");
      await page.waitForTimeout(2_500);
      await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 15_000 });
      await irParaAntesDePublicar(page);
      await page.getByTestId("documento-vinculo").locator('input[type="file"]').first().setInputFiles({ name: "documento-ficticio.pdf", mimeType: "application/pdf", buffer: docEditado() });
      await expect(page.getByTestId("documento-estado")).toHaveAttribute("data-estado", "revisao", { timeout: 30_000 });

      const { data } = await adm().from("qualification_checklists").select("created_at, document_uploaded_at").eq("owner_id", ids[ids.length - 1]).eq("document_status", "pending").order("created_at", { ascending: false }).limit(1).single();
      const esperado = `em análise · ${textoRespostaAte((data as { created_at: string }).created_at)}`;

      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("pendencia-documento").first()).toContainText(esperado, { timeout: 30_000 });
      await page.screenshot({ path: "tests/laboratorio/saida/t1648-meus-imoveis-1280.png", fullPage: false });

      await expect
        .poll(async () => (await lerSaida()).filter((e) => e.para === email && String(e.assunto ?? "").startsWith("Recebemos o documento do seu imóvel")).length, { timeout: 30_000 })
        .toBeGreaterThan(0);
      const msg = (await lerSaida()).filter((e) => e.para === email && String(e.assunto ?? "").startsWith("Recebemos o documento do seu imóvel")).pop()!;
      expect(String(msg.corpo)).toContain(TEXTO_PRAZO_DOCUMENTO);
      await page.context().close();
    });
  });
});
