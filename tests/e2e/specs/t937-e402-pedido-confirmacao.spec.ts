import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T937 — E402 (#2028, Pista B): publicar o pedido de moradia e editá-lo passam a mandar a CONFIRMAÇÃO ao próprio morador
  (evento pedido_confirmado). Antes, publicar ou mudar o orçamento não mandava nada a ele. Pela tela de verdade, com uma
  moradora nova do laboratório (conta de teste: o e-mail cai em emails_teste):
   1. publica o pedido em Uberlândia (R$ 3.500) → chega "Pedido de moradia publicado em Uberlândia" com "seu pedido de
      moradia em … está publicado";
   2. edita o orçamento para R$ 4.000 → chega "Pedido de moradia atualizado em Uberlândia" com "salvamos as mudanças" e
      o que mudou (o orçamento).
  Como a t232, a chave SMS_ATIVO fica desligada durante a spec (o pedido não pede telefone); o valor anterior volta no fim.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const email = `pedido.t937.${sufixo}@lab.vivanomads.test`;
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const ENTRADA = dia(20);
let id = "";
let smsAntes: boolean | null = null;
let page: Page;

async function caixa(): Promise<{ assunto: string; corpo: string }[]> {
  const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", id).eq("evento", "pedido_confirmado").order("criado_em");
  return (data ?? []).map((d) => ({ assunto: String(d.assunto ?? ""), corpo: String(d.corpo ?? "") }));
}

test.describe("T937 — E402 (#2028): confirmação ao morador ao publicar e ao editar o pedido", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async ({ browser }) => {
    const { data } = await adm().from("chaves_plataforma").select("ligada").eq("chave", "SMS_ATIVO").maybeSingle();
    smsAntes = data ? Boolean(data.ligada) : null;
    await adm().from("chaves_plataforma").upsert({ chave: "SMS_ATIVO", ligada: false, ligada_em: null });
    id = await criarConta({ email, nome: "Paula Pedido", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", id);
    page = await entrar(browser, email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
  });
  test.afterAll(async () => {
    await page?.context().close();
    if (smsAntes !== null) await adm().from("chaves_plataforma").upsert({ chave: "SMS_ATIVO", ligada: smsAntes, ligada_em: smsAntes ? new Date().toISOString() : null });
    if (id) {
      await adm().from("pedidos_moradia").delete().eq("inquilino_id", id);
      await adm().from("emails_teste").delete().eq("usuario_id", id);
    }
    await apagarContas([id]);
  });

  test("1. publicar manda 'Pedido de moradia publicado em Uberlândia'", async () => {
    await page.goto(`/pedidos/novo?cidade=Uberl%C3%A2ndia&uf=MG&inicio=${ENTRADA}&meses=3&orcamento=3500`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("pedido-cidade")).toHaveAttribute("data-cidade-escolhida", "1", { timeout: 30_000 });
    await page.getByTestId("pedido-motivo").selectOption("trabalho_remoto");
    await page.getByRole("button", { name: "Publicar pedido" }).click();
    await expect(page.getByRole("heading", { name: "Pedido publicado" })).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => (await caixa()).length, { timeout: 30_000, message: "confirmação da publicação" }).toBeGreaterThanOrEqual(1);
    const e = (await caixa())[0];
    console.log(`t937|publicado|${e.assunto}|${e.corpo.replace(/\n/g, " ⏎ ").slice(0, 400)}`);
    expect(e.assunto).toBe("Pedido de moradia publicado em Uberlândia · Viva Nomads");
    expect(e.corpo).toMatch(/seu pedido de moradia em .*Uberlândia.* está publicado/);
  });

  test("2. editar o orçamento manda 'Pedido de moradia atualizado em Uberlândia' com o que mudou", async () => {
    await page.goto("/dashboard/pedidos", { waitUntil: "domcontentloaded" });
    const meu = page.getByTestId("meu-pedido").first();
    await expect(meu).toContainText("3.500", { timeout: 30_000 });
    await meu.getByTestId("pedido-editar").click();
    await expect(page.getByRole("heading", { name: "Editar seu pedido" })).toBeVisible();
    await expect(page.getByText("Carregando o pedido…")).toHaveCount(0, { timeout: 45_000 });
    await expect(page.getByTestId("pedido-orcamento")).toHaveValue("3.500", { timeout: 20_000 });
    await page.getByTestId("pedido-orcamento").fill("4000");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await page.waitForURL(/\/dashboard\/pedidos\?editado=1/, { timeout: 30_000 });
    await expect.poll(async () => (await caixa()).length, { timeout: 30_000, message: "confirmação da edição" }).toBeGreaterThanOrEqual(2);
    const e = (await caixa()).at(-1)!;
    console.log(`t937|editado|${e.assunto}|${e.corpo.replace(/\n/g, " ⏎ ").slice(0, 400)}`);
    expect(e.assunto).toBe("Pedido de moradia atualizado em Uberlândia · Viva Nomads");
    expect(e.corpo).toMatch(/salvamos as mudanças no seu pedido de moradia em .*Uberlândia/);
    expect(e.corpo, "diz o que mudou").toMatch(/Mudou: .*or[çc]amento/i);
  });
});
