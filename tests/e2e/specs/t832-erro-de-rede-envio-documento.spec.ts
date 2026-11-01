import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T832 — #1796 (erros de envio sem o texto cru do navegador), Pista C, bloco 142. Quando a conexão cai no envio, a tela
  diz "A conexão caiu. Confira a internet e tente de novo." — nunca "Failed to fetch" (Chrome), "Load failed" (Safari)
  nem "NetworkError…" (Firefox). Pela tela de verdade, a 390 e a 1280 px: o documento do imóvel no Passo 10 (seção
  "Documento do imóvel" do "Antes de publicar", E271), com o envio (/api/upload/documento) derrubado pelo próprio teste
  como uma queda de rede. As outras telas do merge (vídeo, foto de perfil, matrícula) usam a mesma função
  (textoDoErro, com teste de unidade no merge).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t832.${sufixo}@lab.vivanomads.test`, nome: "Rui Rede", role: "owner" as const };
const ids: { dono?: string; rascunho: Record<number, string> } = { rascunho: {} };
const pdf = () => Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

test.describe("T832 — envio sem conexão diz em português que a conexão caiu, sem o texto cru do navegador (#1796)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    for (const l of [1280, 390]) {
      ids.rascunho[l] = await prepararRascunho(ids.dono, `Studio t832 ${l} ${sufixo}`, { street: "Avenida João Naves de Ávila", numero: "100", cep: "38408-000", neighborhood: "Santa Mônica", city: "Uberlândia" });
      // Sem o documento do imóvel (o laboratório cria um aprovado): a seção do documento fica pendente, com o envio.
      await adm().from("qualification_checklists").delete().eq("property_id", ids.rascunho[l]);
    }
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: o envio do documento sem conexão mostra "A conexão caiu…"`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho[largura], "revisao", largura);
      const secao = p.getByTestId("antes-secao-documento");
      await expect(secao).toBeVisible({ timeout: 30_000 });
      if ((await secao.getAttribute("data-aberta")) !== "1") await p.getByTestId("antes-secao-documento-abrir").click();
      const doc = p.getByTestId("documento-vinculo");
      await expect(doc).toBeVisible({ timeout: 30_000 });
      // A rede cai no envio: o navegador rejeita o fetch como numa queda de conexão.
      await p.route("**/api/upload/documento", (r) => r.abort("internetdisconnected"));
      await doc.locator('input[type="file"]').setInputFiles({ name: "matricula.pdf", mimeType: "application/pdf", buffer: pdf() });
      await expect(p.getByText("A conexão caiu. Confira a internet e tente de novo.").first()).toBeVisible({ timeout: 30_000 });
      for (const cru of ["Failed to fetch", "Load failed", "NetworkError", "net::ERR"]) await expect(p.getByText(cru)).toHaveCount(0);
      await p.context().close();
    });
  }
});
