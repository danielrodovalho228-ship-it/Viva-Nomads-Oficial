import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T656 — E224: os dois lados do Plano Gestor.
   1. proprietário, Conta › Plano (/dashboard/conta/plano → Pagamentos): "Você tem N; faltam M." e, já liberado
      (conta administradora), "Liberado. Fale com a Viva para ativar." — sem botão de assinar.
   2. admin, /admin/usuarios: "Tipo da conta" individual → administradora com motivo obrigatório (sem motivo, Salvar
      fica desligado); o banco muda e a trilha account_type_audit grava o motivo.
   3. quem não é admin: a mesma chamada de definirAccountType, com a sessão de um proprietário, é recusada (pela rota
      /admin ou pela própria ação) e nada muda.
   (O admin observador da QA é recusado no servidor: guarda em observador-regras.test.ts e plano-gestor-e224.test.ts.)
*/
const sufixo = novoSufixo();
const senha = novaSenha();
const dono = { email: `dono.t656.${sufixo}@lab.vivanomads.test`, nome: `Gil Gestor ${sufixo}`, role: "owner" as const };
const ids: Record<string, string> = {};
let chamada: { url: string; headers: Record<string, string> } | null = null;

const tipoNoBanco = async () => ((await adm().from("profiles").select("account_type").eq("id", ids.dono).single()).data?.account_type as string | null) ?? "individual";

async function chamarAMao(page: Page, tipo: string, motivo: string): Promise<{ status: number; texto: string }> {
  expect(chamada, "a chamada da server action não foi capturada no clique").not.toBeNull();
  return page.evaluate(
    async ({ url, headers, corpo }) => {
      const r = await fetch(url, { method: "POST", headers, body: corpo });
      return { status: r.status, texto: await r.text() };
    },
    { url: chamada!.url, headers: chamada!.headers, corpo: JSON.stringify([ids.dono, tipo, motivo]) },
  );
}

test.describe("T656 — E224: Plano Gestor (Conta › Plano e tipo da conta no admin)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, account_type: "individual" }).eq("id", ids.dono);
    // O papel de proprietário (e a Conta › Plano) aparece com 1 imóvel na conta; o documento fica NA FILA, então
    // nenhum imóvel conta como validado (Você tem 0).
    await criarImovelPronto(ids.dono, `Studio T656 ${sufixo}`, { ativo: false, documentoPendente: dono.nome });
  });
  test.afterAll(async () => {
    if (ids.dono) await adm().from("account_type_audit").delete().eq("profile_id", ids.dono);
    await apagarContas([ids.dono]);
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (uma conta, estado em série)");
  });

  test("1a. proprietário sem imóvel aprovado: 'Você tem 0; faltam 20.' e nenhum botão de assinar", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/conta/plano", { waitUntil: "domcontentloaded" });
    const texto = page.getByTestId("conta-plano-gestor-texto");
    await expect(texto).toHaveText("Plano Gestor: liberado com 20 imóveis com documento aprovado. Você tem 0; faltam 20.", { timeout: 30_000 });
    await expect(texto).toHaveAttribute("data-elegivel", "0");
    await expect(page.getByTestId("conta-plano-gestor").getByRole("button")).toHaveCount(0);
    await expect(page.getByTestId("conta-plano-gestor").getByRole("link")).toHaveCount(0);
    await page.getByTestId("conta-plano-gestor").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "tests/laboratorio/saida/t656-plano-390.png" });
    await page.context().close();
  });

  test("2. admin: tipo da conta com motivo obrigatório → administradora; a trilha guarda o motivo", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on("request", (r) => {
      const acao = r.headers()["next-action"];
      if (!chamada && acao && r.method() === "POST" && (r.postData() ?? "").includes(ids.dono)) chamada = { url: r.url(), headers: r.headers() };
    });
    await page.goto(`/admin/usuarios?teste=sim&q=${encodeURIComponent(dono.nome)}`, { waitUntil: "domcontentloaded" });
    const bloco = page.locator(`[data-testid="tipo-conta"][data-usuario-id="${ids.dono}"]`).filter({ visible: true }).first();
    await expect(bloco).toHaveAttribute("data-tipo", "individual", { timeout: 30_000 });
    await bloco.getByTestId("tipo-conta-select").selectOption("gestor");
    await expect(bloco.getByTestId("tipo-conta-salvar")).toBeDisabled();
    await bloco.getByTestId("tipo-conta-motivo").fill("abc");
    await expect(bloco.getByTestId("tipo-conta-salvar")).toBeDisabled();
    await bloco.getByTestId("tipo-conta-motivo").fill("Administradora com contrato assinado (lab t656)");
    await bloco.getByTestId("tipo-conta-salvar").click();
    await expect(bloco.getByTestId("tipo-conta-msg")).toHaveText("Tipo da conta: administradora.", { timeout: 20_000 });
    await expect.poll(tipoNoBanco).toBe("gestor");
    const { data: trilha } = await adm().from("account_type_audit").select("old_type, new_type, reason").eq("profile_id", ids.dono);
    expect(trilha).toEqual([{ old_type: "individual", new_type: "gestor", reason: "Administradora com contrato assinado (lab t656)" }]);
    // Sem motivo, nem o servidor aceita (a mesma chamada, motivo vazio).
    const semMotivo = await chamarAMao(page, "individual", "  ");
    expect(semMotivo.texto).toContain("Escreva o motivo da troca.");
    expect(await tipoNoBanco()).toBe("gestor");
    await ctx.close();
  });

  test("1b. já liberado (administradora): 'Liberado. Fale com a Viva para ativar.'", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/conta/plano", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("conta-plano-gestor-texto")).toHaveText("Liberado. Fale com a Viva para ativar.", { timeout: 30_000 });
    await expect(page.getByTestId("conta-plano-gestor-texto")).toHaveAttribute("data-elegivel", "1");
    await expect(page.getByTestId("conta-plano-gestor").getByRole("button")).toHaveCount(0);
    await page.context().close();
  });

  test("3. quem não é admin chama definirAccountType: recusado, nada muda", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/conta/plano", { waitUntil: "domcontentloaded" });
    const r = await chamarAMao(page, "individual", "Tentando trocar o próprio tipo");
    // Recusado de um jeito ou de outro: a rota /admin já barra quem não é admin antes da ação ("Server Action
    // unavailable"); se a chamada chegar à ação, ela recusa ("Apenas administradores." — ordem conferida no unit).
    expect(r.texto).toMatch(/Apenas administradores\.|Server Action unavailable/);
    expect(r.texto).not.toContain('"ok":true');
    expect(await tipoNoBanco()).toBe("gestor");
    const { count } = await adm().from("account_type_audit").select("id", { count: "exact", head: true }).eq("profile_id", ids.dono);
    expect(count).toBe(1);
    await page.context().close();
  });
});
