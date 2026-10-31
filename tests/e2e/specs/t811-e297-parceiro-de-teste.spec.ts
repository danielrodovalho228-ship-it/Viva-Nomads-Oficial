import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T811 — #1769 (E297), Pista C, bloco 127. O parceiro de teste segue a regra do anúncio de teste (E93): aberto pelo link,
  a página dele mostra a faixa e, para quem não é da equipe, o pedido de orçamento fica desativado. Pela tela de verdade,
  a 390 e a 1280 px, com um parceiro novo publicado cuja conta é de teste (`profiles.is_teste`, que a view
  `parceiros_publicos` lê como `teste`), apagado no fim:
   1. visitante: faixa "Parceiro de teste da equipe Viva — não é um prestador disponível" (modo visitante) e, no lugar
      do formulário, o aviso de que o perfil não recebe pedidos;
   2. admin (equipe): faixa "Parceiro de teste: fora da busca e das listagens" (modo equipe) e o formulário de pedido.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const parceiroConta = { email: `parc.t811.${sufixo}@lab.vivanomads.test`, nome: "Paulo Parceiro Teste", role: "tenant" as const };
const ids: { conta?: string; parceiro?: string; slug?: string } = {};
const altura = (l: number) => (l === 390 ? 844 : 900);

async function abrir(browser: Browser, largura: number, comoAdmin: boolean): Promise<Page> {
  const ctx = await browser.newContext({ storageState: comoAdmin ? authFile("admin") : { cookies: [], origins: [] }, viewport: { width: largura, height: altura(largura) } });
  const p = await ctx.newPage();
  await p.goto(`/parceiros/${ids.slug}`, { waitUntil: "domcontentloaded" });
  return p;
}

test.describe("T811 — E297: parceiro de teste com faixa e sem pedido para quem não é da equipe (#1769)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(parceiroConta, senha);
    ids.slug = `parc-teste-t811-${sufixo}`;
    // "Parceiro de teste" = conta de teste (profiles.is_teste), como na view parceiros_publicos (coalesce(pf.is_teste)).
    const { error: eT } = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.conta);
    if (eT) throw eT;
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.conta, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: parceiroConta.nome, slug: ids.slug, categorias: ["fotografia"], cidades: ["Uberlândia"], status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = data.id as string;
  });
  test.afterAll(async () => {
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.conta]);
  });

  for (const largura of [1280, 390] as const) {
    test(`1. ${largura} px: visitante vê a faixa e não consegue pedir orçamento`, async ({ browser }) => {
      const p = await abrir(browser, largura, false);
      const faixa = p.getByTestId("faixa-parceiro-teste");
      await expect(faixa).toBeVisible({ timeout: 30_000 });
      await expect(faixa).toHaveAttribute("data-modo", "visitante");
      await expect(faixa).toHaveText("Parceiro de teste da equipe Viva — não é um prestador disponível");
      const pedido = p.getByTestId("parceiro-pedido-teste");
      await expect(pedido).toContainText("Este perfil não recebe pedidos.");
      await p.context().close();
    });

    test(`2. ${largura} px: a equipe (admin) vê a faixa da equipe e o pedido de orçamento`, async ({ browser }) => {
      const p = await abrir(browser, largura, true);
      const faixa = p.getByTestId("faixa-parceiro-teste");
      await expect(faixa).toBeVisible({ timeout: 30_000 });
      await expect(faixa).not.toHaveAttribute("data-modo", "visitante");
      await expect(faixa).toHaveText("Parceiro de teste: fora da busca e das listagens");
      await expect(p.getByTestId("parceiro-pedido-teste")).toHaveCount(0);
      await p.context().close();
    });
  }
});
