import { test, expect, type Browser, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirCadastroNovo, irParaAntesDePublicar, noPasso, subirFotosMinimas } from "../fixtures/cadastro";

/*
  T554 — E149-A (#1403), guarda permanente da Pista C, no que a t485 da Pista A não cobre: o "Documento enviado no início"
  fica no RASCUNHO (d97a8727) e o Passo 10 não pede o documento de novo, nem depois de recarregar:
   1. matrícula enviada no Passo 1 → `draft_data.documentoNoInicio` = true no banco;
   2. no Passo 10, "Documento enviado no início · …" e NENHUM pedido do documento (`documento-vinculo`, o
      que a t485 vê sem a matrícula no início) no "Antes de publicar";
   3. recarregar o Passo 10 (página nova, só o rascunho do servidor) mantém os dois.
  A 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t554.${sufixo}@lab.vivanomads.test`, nome: "Lia Persiste", role: "owner" as const };
const ids: Record<string, string> = {};
const ENDERECO_LIDO = { rua: "Rua do Laboratório", numero: "102", bairro: "Centro", cidade: "Uberlândia", uf: "MG", cep: "38400100" };

const matricula = () => Buffer.concat([readFileSync("tests/fixtures/matricula-ficticia-dono.pdf"), Buffer.from(`% ${randomBytes(8).toString("hex")}\n`)]);

async function abrir(browser: Browser, largura: number): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
  await contexto.route("https://viacep.com.br/ws/**", (r) => r.fulfill({ json: { cep: "38400-100", logradouro: "Rua do Laboratório", bairro: "Centro", localidade: "Uberlândia", uf: "MG" } }));
  // Como na t485: a leitura simulada repete o endereço do cadastro (vazio no início); a conferência ganha o endereço lido.
  await contexto.route("**/api/documentos/conferir", async (r) => {
    const res = await r.fetch();
    const json = await res.json();
    if (json?.matricula?.preenchimento) json.matricula.preenchimento.endereco = ENDERECO_LIDO;
    await r.fulfill({ response: res, json });
  });
  const page = await entrarNaPagina(await contexto.newPage(), dono.email, senha);
  await abrirCadastroNovo(page);
  return page;
}

async function documentoNoInicio(id: string): Promise<unknown> {
  const { data } = await adm().from("properties").select("draft_data").eq("id", id).single();
  return (data?.draft_data as Record<string, unknown> | null)?.documentoNoInicio ?? null;
}

test.describe("T554 — E149-A: o documento enviado no início fica no rascunho e o Passo 10 não pede de novo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — matrícula no início: gravada no rascunho, Passo 10 sem novo envio, também depois de recarregar`, async ({ browser }) => {
      const page = await abrir(browser, largura);
      await page.getByTestId("matricula-inicio-abrir").click();
      const folha = page.getByTestId("matricula-inicio");
      await folha.getByTestId("documento-vinculo").locator('input[type="file"]').first().setInputFiles({ name: "matricula.pdf", mimeType: "application/pdf", buffer: matricula() });
      await expect(folha.getByTestId("matricula-inicio-voltar")).toBeVisible({ timeout: 40_000 });
      await folha.getByTestId("matricula-inicio-voltar").click();
      await noPasso(page, "tipo");
      await page.getByTestId("cadastro-continuar").click();
      await noPasso(page, "fotos");
      await subirFotosMinimas(page);
      await page.getByTestId("cadastro-continuar").click();
      await noPasso(page, "endereco");

      const antes = await irParaAntesDePublicar(page);
      const id = new URL(page.url()).searchParams.get("draft")!;
      await expect.poll(() => documentoNoInicio(id), { timeout: 20_000, message: "draft_data.documentoNoInicio" }).toBe(true);

      for (const rodada of ["abrir", "recarregar"]) {
        if (rodada === "recarregar") {
          await page.reload({ waitUntil: "domcontentloaded" });
          await noPasso(page, "revisao", 30_000);
          await expect(page.getByTestId("antes-de-publicar")).toBeVisible({ timeout: 30_000 });
        }
        const bloco = page.getByTestId("antes-de-publicar");
        await expect(bloco.getByTestId("documento-do-inicio"), `linha do início (${rodada})`).toHaveText(/^Documento enviado no início · (em análise|aprovado|precisa de correção)$/, { timeout: 20_000 });
        const envios = await bloco.getByTestId("documento-vinculo").count();
        console.log(`t554 ${largura} ${rodada}: pedidos do documento (documento-vinculo) no Antes de publicar = ${envios}`);
        expect(envios, `o Passo 10 pede o documento de novo (${rodada})`).toBe(0);
      }
      await antes.getByTestId("documento-do-inicio").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/laboratorio/saida/t554-passo10-recarregado-${largura}.png` });
      await page.context().close();
    });
  }
});
