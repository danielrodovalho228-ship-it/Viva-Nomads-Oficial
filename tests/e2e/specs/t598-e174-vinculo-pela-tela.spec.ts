import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T598 — E174: o vínculo profissional PELA TELA, de ponta a ponta (a t486 grava o selo direto no banco). Em Conta ›
  Segurança e verificações, o proprietário:
   1. tenta um e-mail de provedor gratuito → recusado com a mensagem da regra, nenhum código sai;
   2. pede o vínculo com o e-mail corporativo → o código de 6 dígitos chega na caixa de teste (emails_teste,
      evento vinculo_codigo; a caixa é por usuario_id, então serve para o endereço corporativo de uma conta is_teste);
   3. digita um código ERRADO → "Código incorreto…", conta 1 das 5 tentativas;
   4. digita o código certo → "Vínculo profissional confirmado · <domínio>" na própria linha, gravado com confirmado_em;
   5. o selo aparece no perfil público do proprietário com SÓ o domínio, nunca o e-mail.
  O endereço: lab.vivanomads.com.br (domínio nosso, aceito pela regra — ela recusa só provedores gratuitos); no
  laboratório nada sai para a rede (integrações simuladas, Resend falso). Código de 15 min, até 5 tentativas.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t598.${sufixo}@lab.vivanomads.test`, nome: "Vera Vinculo", role: "owner" as const };
const DOMINIO = "lab.vivanomads.com.br";
const CORPORATIVO = `vera.t598.${sufixo}@${DOMINIO}`;
// Dois textos por desenho (E174-B): na tela da própria pessoa, "confirmado"; nos lugares públicos, o selo curto.
const DETALHE = `Vínculo profissional confirmado · ${DOMINIO}`;
const SELO = `Vínculo profissional · ${DOMINIO}`;
const RECUSADO = "Use o e-mail da sua empresa, hospital ou universidade. E-mails como Gmail e Hotmail não servem para este selo.";
const ERRADO = "Código incorreto. Confira o e-mail e tente de novo.";
const ids: Record<string, string> = {};

async function codigosNaCaixa(): Promise<string[]> {
  const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", ids.dono).eq("evento", "vinculo_codigo").order("criado_em");
  return (data ?? []).map((d) => /e-mail profissional: (\d{6})/.exec(String(d.corpo ?? ""))?.[1] ?? "").filter(Boolean);
}

/** Abre o formulário do e-mail (o clique antes da hidratação não abre nada: repete até abrir). */
async function abrirFormulario(p: Page) {
  const linha = p.getByTestId("confianca-vinculo");
  await expect(linha).not.toHaveAttribute("data-situacao", "carregando", { timeout: 30_000 });
  await expect(async () => {
    if (!(await p.getByTestId("vinculo-form-email").isVisible())) await linha.getByTestId("vinculo-abrir").click({ timeout: 5_000 });
    await expect(p.getByTestId("vinculo-form-email")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

test.describe("T598 — E174: vínculo profissional pela tela (pedir → código → confirmar → selo)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    // A caixa de teste só guarda e-mail de conta de teste.
    const { error } = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    if (error) throw error;
    ids.imovel = await criarImovelPronto(ids.dono, `Vínculo pela tela t598 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await adm().from("vinculo_profissional").delete().eq("user_id", ids.dono ?? "");
    await adm().from("emails_teste").delete().eq("usuario_id", ids.dono ?? "");
    await apagarContas([ids.dono]);
  });

  test("1. 390 — provedor gratuito recusado; corporativo recebe o código; código errado recusado; o certo confirma", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/conta/seguranca", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("confianca-vinculo")).toHaveAttribute("data-situacao", "falta", { timeout: 30_000 });
    await abrirFormulario(p);
    const form = p.getByTestId("vinculo-form-email");

    // Provedor gratuito: a regra recusa e nenhum código sai.
    await form.locator("#vinculo-email").fill(`vera.t598.${sufixo}@gmail.com`);
    await form.getByRole("button", { name: "Enviar código" }).click();
    await expect(p.getByTestId("vinculo-erro")).toHaveText(RECUSADO, { timeout: 20_000 });
    await expect(p.getByTestId("vinculo-form-codigo")).toHaveCount(0);
    expect(await codigosNaCaixa(), "nenhum código para o gmail").toHaveLength(0);

    // Corporativo: o código chega na caixa de teste.
    await form.locator("#vinculo-email").fill(CORPORATIVO);
    await form.getByRole("button", { name: "Enviar código" }).click();
    await expect(p.getByTestId("vinculo-form-codigo")).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await codigosNaCaixa()).length, { timeout: 20_000, message: "código na caixa de teste" }).toBe(1);
    const [codigo] = await codigosNaCaixa();
    expect(codigo).toMatch(/^\d{6}$/);
    const { data: pedido } = await adm().from("vinculo_profissional").select("*").eq("user_id", ids.dono).single();
    expect(pedido.dominio, "no banco, só o domínio").toBe(DOMINIO);
    expect(JSON.stringify(pedido), "o e-mail digitado não é guardado").not.toContain(CORPORATIVO);
    expect(pedido.confirmado_em).toBeNull();
    const minutos = (Date.parse(pedido.expira_em) - Date.now()) / 60_000;
    expect(minutos, "código de 15 min").toBeGreaterThan(13);
    expect(minutos).toBeLessThanOrEqual(15);

    // Código errado: recusado, conta 1 das 5 tentativas.
    const errado = String((Number(codigo) + 1) % 1_000_000).padStart(6, "0");
    const campo = p.getByTestId("vinculo-form-codigo").locator("#vinculo-codigo");
    await campo.fill(errado);
    await p.getByRole("button", { name: "Confirmar código" }).click();
    await expect(p.getByTestId("vinculo-erro")).toHaveText(ERRADO, { timeout: 20_000 });
    const { data: depois } = await adm().from("vinculo_profissional").select("tentativas, confirmado_em").eq("user_id", ids.dono).single();
    expect(depois).toEqual({ tentativas: 1, confirmado_em: null });

    // Código certo: confirma e a linha mostra o selo com o domínio.
    await campo.fill(codigo);
    await p.getByRole("button", { name: "Confirmar código" }).click();
    await expect(p.getByTestId("confianca-vinculo")).toHaveAttribute("data-situacao", "ok", { timeout: 20_000 });
    await expect(p.getByTestId("vinculo-detalhe")).toHaveText(DETALHE);
    await expect(p.getByTestId("vinculo-erro")).toHaveCount(0);
    const { data: fim } = await adm().from("vinculo_profissional").select("dominio, confirmado_em").eq("user_id", ids.dono).single();
    expect(fim?.dominio).toBe(DOMINIO);
    expect(fim?.confirmado_em, "confirmado_em gravado").toBeTruthy();
    await p.getByTestId("confianca-vinculo").scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SAIDA}/t598-confirmado-390.png` });
    await p.context().close();
  });

  test("2. 1280 — o selo no perfil público do proprietário mostra só o domínio, nunca o e-mail", async ({ browser }) => {
    const { data: v } = await adm().from("vinculo_profissional").select("confirmado_em").eq("user_id", ids.dono ?? "").maybeSingle();
    test.skip(!v?.confirmado_em, "depende do caso 1");
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
    const selo = p.getByTestId("selo-vinculo").first();
    await expect(selo).toHaveText(SELO, { timeout: 30_000 });
    await expect(p.locator("body")).not.toContainText(CORPORATIVO);
    await expect(p.locator("body")).not.toContainText(`@${DOMINIO}`);
    await selo.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SAIDA}/t598-perfil-publico-1280.png` });
    await ctx.close();

    // E na própria Conta, depois de recarregar, a linha segue confirmada.
    const dono1280 = await entrar(browser, dono.email, senha);
    await dono1280.setViewportSize({ width: 1280, height: 900 });
    await dono1280.goto("/dashboard/conta/seguranca", { waitUntil: "domcontentloaded" });
    await expect(dono1280.getByTestId("vinculo-detalhe")).toHaveText(DETALHE, { timeout: 30_000 });
    await dono1280.context().close();
  });
});
