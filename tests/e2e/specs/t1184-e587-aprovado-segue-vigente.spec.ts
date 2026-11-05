import { test, expect } from "@playwright/test";
import { abrirSecoesPasso10 } from "../fixtures/cadastro";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo, pdf } from "../fixtures/laboratorio";

/**
 * T1184 — E587 (#2694, 05/11): com um documento APROVADO vigente, o envio de um documento novo não decide na hora — fica
 * em análise da equipe — e a TELA do cadastro segue mostrando o aprovado, com o novo à parte. Antes o veredito automático
 * do novo tomava o lugar do aprovado na tela. O E587 entrou só com teste de unidade; aqui é a tela, 390 e 1280, com um
 * rascunho do laboratório (documento aprovado pela fixture) e o envio de um PDF novo no "Antes de publicar" da Revisão:
 *   1. antes: o documento aparece aprovado (documento-estado data-estado="aprovado");
 *   2. depois do envio: segue aprovado E aparece o novo à parte (documento-novo data-estado="revisao") com o texto
 *      "Documento novo em análise. O aprovado continua valendo até o novo ser aprovado.";
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1184.${sufixo}@lab.vivanomads.test`, nome: "Rosa Documento", role: "owner" as const };
const TEXTO_NOVO_EM_ANALISE = "Documento novo em análise. O aprovado continua valendo até o novo ser aprovado."; // src/lib/documento/vigente.ts
const ids: { dono?: string } = {};

test.describe("T1184 — E587: o documento aprovado segue vigente na tela enquanto o novo é conferido", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`aprovado segue na tela; o novo fica em análise à parte (${w})`, async ({ browser }) => {
      const imovel = await criarImovelPronto(ids.dono!, `Rascunho do documento ${w} ${sufixo}`);
      // O envio do documento exige CEP, rua e número (documento-vinculo); a fixture grava só o bairro.
      const { data: atual } = await adm().from("properties").select("draft_data").eq("id", imovel).single();
      const { error } = await adm()
        .from("properties")
        .update({ exact_address: "Rua do Laboratório, 102", draft_data: { ...((atual?.draft_data as Record<string, unknown>) ?? {}), cep: "38400-100", street: "Rua do Laboratório", numero: "102" } })
        .eq("id", imovel);
      if (error) throw error;
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
        await p.goto(`/dashboard/imoveis/novo?draft=${imovel}&etapa=revisao`, { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("etapa-revisar")).toBeVisible({ timeout: 30_000 });
        await abrirSecoesPasso10(p, ["documento"]);
        const vinculo = p.getByTestId("documento-vinculo");
        await expect(vinculo.getByTestId("documento-estado")).toHaveAttribute("data-estado", "aprovado", { timeout: 20_000 });

        await expect(vinculo, "o endereço gravado chegou").not.toContainText("Para enviar, o endereço precisa", { timeout: 20_000 });
        await vinculo.getByTestId("documento-arquivo").setInputFiles({ name: "matricula-nova.pdf", mimeType: "application/pdf", buffer: pdf() });
        const novo = vinculo.getByTestId("documento-novo");
        await expect(novo).toBeVisible({ timeout: 60_000 });
        await expect(novo).toHaveAttribute("data-estado", "revisao");
        await expect(novo).toContainText(TEXTO_NOVO_EM_ANALISE);
        await expect(vinculo.getByTestId("documento-estado"), "o aprovado continua na tela").toHaveAttribute("data-estado", "aprovado");
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
