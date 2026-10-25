import { test, expect, type Browser, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirCadastroNovo, irParaAntesDePublicar, noPasso, subirFotosMinimas } from "../fixtures/cadastro";

/*
  T485 — E149-A: "Tem a matrícula à mão? Comece por ela" no Passo 1 do cadastro novo. Abre o MESMO documento do Passo 10
  (envio, leitura e conferência). Ao terminar: "Preenchemos: …", volta ao tipo; o endereço chega ao Passo 3 e área,
  vagas e unidade ao Passo 4, com a etiqueta "veio da matrícula". Titular diferente → "Quem opera este imóvel?" ali
  mesmo. No Passo 10, "Documento enviado no início · …" sem pedir de novo. Nome e CPF do titular nunca na tela/console.
  No laboratório a leitura simulada repete o endereço do cadastro (vazio no início): a resposta da conferência ganha o
  endereço lido, como numa matrícula real — o resto do caminho (envio, conferência, banco) é o de verdade.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t485.${sufixo}@lab.vivanomads.test`, nome: "Lia Matricula", role: "owner" as const };
const ids: Record<string, string> = {};
const ENDERECO_LIDO = { rua: "Rua do Laboratório", numero: "102", bairro: "Centro", cidade: "Uberlândia", uf: "MG", cep: "38400100" };
/** O que nunca pode aparecer: o titular fictício da matrícula "outro dono" (nome e CPF). */
const TITULAR = /Maria Exemplo|00000000191|000\.000\.001-91/i;

function matricula(caso: "dono" | "outro-dono"): Buffer {
  return Buffer.concat([readFileSync(`tests/fixtures/matricula-ficticia-${caso}.pdf`), Buffer.from(`% ${randomBytes(8).toString("hex")}\n`)]);
}

async function abrir(browser: Browser, largura: number, console: string[]): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
  await contexto.route("https://viacep.com.br/ws/**", (r) => r.fulfill({ json: { cep: "38400-100", logradouro: "Rua do Laboratório", bairro: "Centro", localidade: "Uberlândia", uf: "MG" } }));
  await contexto.route("**/api/documentos/conferir", async (r) => {
    const res = await r.fetch();
    const json = await res.json();
    if (json?.matricula?.preenchimento) json.matricula.preenchimento.endereco = ENDERECO_LIDO;
    await r.fulfill({ response: res, json });
  });
  const page = await entrarNaPagina(await contexto.newPage(), dono.email, senha);
  page.on("console", (m) => console.push(m.text()));
  await abrirCadastroNovo(page);
  return page;
}

async function enviarNoInicio(page: Page, arquivo: Buffer) {
  await page.getByTestId("matricula-inicio-abrir").click();
  const folha = page.getByTestId("matricula-inicio");
  await expect(folha).toBeVisible();
  await folha.getByTestId("documento-vinculo").locator('input[type="file"]').first().setInputFiles({ name: "matricula.pdf", mimeType: "application/pdf", buffer: arquivo });
  await expect(folha.getByTestId("matricula-inicio-voltar")).toBeVisible({ timeout: 40_000 });
  return folha;
}

test.describe("T485 — E149-A: comece pela matrícula", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — a matrícula preenche o Passo 3 e o Passo 4 com a etiqueta; o Passo 10 não pede de novo`, async ({ browser }) => {
      const console: string[] = [];
      const page = await abrir(browser, largura, console);
      const linha = page.getByTestId("atalhos-passo1");
      await expect(linha).toContainText("Tem a matrícula à mão? Comece por ela · Já anuncia em outro site? Importar · Prefere ajuda? Fale com a Viva");
      await page.screenshot({ path: `${SAIDA}/t485-linha-passo1-${largura}.png` });

      const folha = await enviarNoInicio(page, matricula("dono"));
      await expect(folha.getByTestId("matricula-inicio-resumo")).toHaveText("Preenchemos: endereço, área, vagas, unidade.");
      await page.screenshot({ path: `${SAIDA}/t485-preenchemos-${largura}.png` });
      await folha.getByTestId("matricula-inicio-voltar").click();
      // De volta ao Passo 1, com o tipo ainda por escolher.
      await noPasso(page, "tipo");
      await expect(page.getByTestId("matricula-inicio")).toHaveCount(0);

      await page.getByTestId("cadastro-continuar").click();
      await noPasso(page, "fotos");
      await subirFotosMinimas(page);
      await page.getByTestId("cadastro-continuar").click();
      await noPasso(page, "endereco");
      await expect(page.getByTestId("cadastro-rua")).toHaveValue("Rua do Laboratório");
      await expect(page.getByTestId("cadastro-numero")).toHaveValue("102");
      await expect(page.getByTestId("cadastro-complemento")).toHaveValue("Apartamento 302");
      await expect(page.getByTestId("veio-da-matricula").first()).toBeVisible();
      // Tudo editável.
      await page.getByTestId("cadastro-numero").fill("104");
      await expect(page.getByTestId("cadastro-numero")).toHaveValue("104");
      await page.screenshot({ path: `${SAIDA}/t485-passo3-${largura}.png` });
      await page.getByTestId("cadastro-continuar").click();
      await noPasso(page, "detalhes");
      await expect(page.getByTestId("cadastro-area")).toHaveValue("68.5");
      await expect(page.getByTestId("cadastro-vagas")).toHaveValue("1");
      await expect(page.getByTestId("veio-da-matricula").first()).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/t485-passo4-${largura}.png` });

      const antes = await irParaAntesDePublicar(page);
      await expect(antes.getByTestId("documento-do-inicio")).toHaveText(/^Documento enviado no início · (em análise|aprovado|precisa de correção)$/);
      await antes.getByTestId("documento-do-inicio").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t485-passo10-${largura}.png` });
      expect(console.join("\n")).not.toMatch(TITULAR);
      await page.context().close();
    });
  }

  test("390 px — titular diferente: pergunta 'Quem opera este imóvel?' ali mesmo, em um toque, sem nome nem CPF", async ({ browser }) => {
    const console: string[] = [];
    const page = await abrir(browser, 390, console);
    const folha = await enviarNoInicio(page, matricula("outro-dono"));
    const pergunta = folha.getByTestId("matricula-inicio-quem-opera");
    await expect(pergunta).toBeVisible();
    await expect(pergunta).toContainText("Quem opera este imóvel?");
    await pergunta.getByTestId("matricula-inicio-opera-managed").click();
    await expect(pergunta.getByTestId("matricula-inicio-opera-managed")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("body")).not.toContainText(TITULAR);
    await page.screenshot({ path: `${SAIDA}/t485-quem-opera-390.png` });
    expect(console.join("\n")).not.toMatch(TITULAR);
    await folha.getByTestId("matricula-inicio-voltar").click();
    await noPasso(page, "tipo");
    // A resposta vai para o rascunho (o mesmo campo do Passo 10).
    await page.getByTestId("cadastro-continuar").click();
    await noPasso(page, "fotos");
    await expect(page).toHaveURL(/draft=/, { timeout: 30_000 });
    const draft = new URL(page.url()).searchParams.get("draft")!;
    await expect
      .poll(async () => JSON.stringify((await adm().from("properties").select("draft_data").eq("id", draft).single()).data?.draft_data ?? {}), { timeout: 30_000 })
      .toMatch(/"ownershipType":"managed"/);
    await page.context().close();
  });

  test("sem matrícula no início: o Passo 10 segue como antes (pede o documento, sem a linha do início)", async ({ browser }) => {
    const page = await abrir(browser, 1280, []);
    await page.getByTestId("cadastro-continuar").click();
    await noPasso(page, "fotos");
    await subirFotosMinimas(page);
    await page.getByTestId("cadastro-continuar").click();
    await noPasso(page, "endereco");
    const antes = await irParaAntesDePublicar(page);
    await expect(antes.getByTestId("documento-vinculo")).toBeVisible();
    await expect(antes.getByTestId("documento-do-inicio")).toHaveCount(0);
    await page.context().close();
  });
});
