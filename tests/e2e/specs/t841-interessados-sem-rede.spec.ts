import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T841 — INTERESSADOS SEM REDE (Pista C, 01/11; merge #1806, "Erros, achado nº 3"). Antes, Aprovar e Recusar rodavam
  a ação do servidor numa transição sem try: com a conexão caída a promessa rejeitava, a tela caía no limite de erro e o
  cartão ficava no estado otimista; a recusa não dizia nada. Agora:
   1) Aprovar sem rede → o cartão volta (os botões Recusar / Aprovar de novo), o aviso diz "A conexão caiu. Confira a
      internet e tente de novo." e nada muda no banco (lead continua "new");
   2) Confirmar recusa sem rede → o cartão fica no formulário do motivo, mesmo aviso, lead continua "new";
   3) a rede volta → Aprovar grava "accepted" e o aviso some.
  A queda é simulada abortando só o POST da ação do servidor (cabeçalho next-action) com "internetdisconnected".
  Contas e imóvel do laboratório, criados e apagados aqui.
*/
const SEM_CONEXAO = "A conexão caiu. Confira a internet e tente de novo.";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t841.${sufixo}@lab.vivanomads.test`, nome: "Dalva Dona", role: "owner" as const };
const inqA = { email: `inq.t841a.${sufixo}@lab.vivanomads.test`, nome: "Aurora Rede", role: "tenant" as const };
const inqB = { email: `inq.t841b.${sufixo}@lab.vivanomads.test`, nome: "Bento Rede", role: "tenant" as const };
const ids: { dono?: string; a?: string; b?: string; imovel?: string; leadA?: string; leadB?: string } = {};

async function statusDoLead(id: string): Promise<string> {
  const { data, error } = await adm().from("leads").select("status").eq("id", id).single();
  expect(error).toBeNull();
  return data!.status as string;
}

async function derrubarAcoes(page: Page): Promise<() => Promise<void>> {
  const handler = async (route: import("@playwright/test").Route) => {
    const r = route.request();
    if (r.method() === "POST" && r.headers()["next-action"]) return route.abort("internetdisconnected");
    return route.continue();
  };
  await page.route("**/dashboard/leads**", handler);
  return () => page.unroute("**/dashboard/leads**", handler);
}

test.describe("T841 — Interessados: Aprovar e Recusar sem rede (#1806)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.a = await criarConta(inqA, senha);
    ids.b = await criarConta(inqB, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Rede ${sufixo}`, { ativo: true });
    for (const [tenant, chave] of [[ids.a, "leadA"], [ids.b, "leadB"]] as const) {
      const { data, error } = await adm()
        .from("leads")
        .insert({ owner_id: ids.dono, tenant_id: tenant, property_id: ids.imovel, status: "new" })
        .select("id")
        .single();
      expect(error).toBeNull();
      ids[chave] = data!.id as string;
    }
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.a, ids.b]);
  });

  test("Aprovar e Recusar sem rede voltam o cartão e dizem 'A conexão caiu'; com a rede, Aprovar grava", async ({ browser }) => {
    test.setTimeout(150_000);
    const page = await entrar(browser, dono.email, senha);
    const errosDePagina: string[] = [];
    page.on("pageerror", (e) => errosDePagina.push(e.message));
    await page.goto("/dashboard/leads", { waitUntil: "networkidle" });
    const cartaoA = page.locator(`#candidato-${ids.leadA}`);
    const cartaoB = page.locator(`#candidato-${ids.leadB}`);
    await expect(cartaoA).toBeVisible({ timeout: 20_000 });
    await expect(cartaoB).toBeVisible();
    const aviso = page.getByTestId("aceite-erro");
    const religar = await derrubarAcoes(page);

    await test.step("1. Aprovar sem rede", async () => {
      const caiu = page.waitForEvent("requestfailed", (r) => r.method() === "POST" && !!r.headers()["next-action"]);
      await cartaoA.getByRole("button", { name: "Aprovar e responder" }).click();
      await caiu;
      await expect(aviso).toHaveText(SEM_CONEXAO, { timeout: 20_000 });
      await expect(cartaoA.getByRole("button", { name: "Aprovar e responder" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Interessados" })).toBeVisible();
      expect(await statusDoLead(ids.leadA!)).toBe("new");
    });

    await test.step("2. Confirmar recusa sem rede", async () => {
      await cartaoB.getByRole("button", { name: "Recusar", exact: true }).click();
      await cartaoB.getByPlaceholder("Ou escreva um motivo personalizado…").fill("Teste do laboratório sem rede");
      // O aviso do passo 1 ainda está na tela: a prova deste passo é a ação abortada e o cartão parado no formulário.
      const caiu = page.waitForEvent("requestfailed", (r) => r.method() === "POST" && !!r.headers()["next-action"]);
      await cartaoB.getByRole("button", { name: "Confirmar recusa" }).click();
      await caiu;
      await expect(cartaoB.getByText("Recusado")).toHaveCount(0);
      await expect(aviso).toHaveText(SEM_CONEXAO, { timeout: 20_000 });
      await expect(cartaoB.getByRole("button", { name: "Confirmar recusa" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Interessados" })).toBeVisible();
      expect(await statusDoLead(ids.leadB!)).toBe("new");
    });

    await test.step("3. A rede volta: Aprovar grava e o aviso some", async () => {
      await religar();
      await cartaoA.getByRole("button", { name: "Aprovar e responder" }).click();
      await expect(aviso).toBeHidden({ timeout: 20_000 });
      await expect.poll(() => statusDoLead(ids.leadA!), { timeout: 20_000 }).toBe("accepted");
    });

    expect(errosDePagina, "a tela não pode lançar erro de página").toEqual([]);
    await page.context().close();
  });
});
