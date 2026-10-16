import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, TELEFONE_LAB } from "../fixtures/laboratorio";

/**
 * T133 — Motivo da estadia na candidatura (ordens a8bb8cfa, 9a723929 e ea0f62c6, itens 1 a 3).
 * 1) imóvel real, inquilino logado: o motivo do perfil vem pré-preenchido e trocar a escolha não é sobrescrito;
 * 2) enviar grava leads.motivo_estadia (a escolha; sem escolha, o do perfil);
 * 3) o proprietário vê "Saúde" para tratamento_medico, sem sobrenome nem telefone antes do aceite.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.mot133.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const inqA = { email: `inq.mot133a.${sufixo}@lab.vivanomads.test`, nome: "Alice Sobrenomeoculto", role: "tenant" as const };
const inqB = { email: `inq.mot133b.${sufixo}@lab.vivanomads.test`, nome: "Bruno Sobrenomeoculto", role: "tenant" as const };
const ids: { dono?: string; a?: string; b?: string; imovel?: string } = {};

async function candidatar(page: import("@playwright/test").Page, imovel: string, recarregar = true): Promise<void> {
  // Recarregar apaga a escolha feita na tela (volta ao motivo do perfil): quem já escolheu passa recarregar=false.
  if (recarregar) await page.goto(`/imoveis/${imovel}`, { waitUntil: "networkidle" });
  await page.getByTestId("barra-fixa-imovel").getByRole("button", { name: "Solicitar reserva" }).click();
  const passo = page.getByTestId("solicitacao-passo");
  await expect(passo).toBeVisible();
  await passo.getByRole("button", { name: "Enviar solicitação" }).click();
  await expect(page.getByText("Candidatura enviada").first()).toBeVisible({ timeout: 20_000 });
}

async function motivoGravado(tenantId: string): Promise<string | null> {
  const { data, error } = await adm().from("leads").select("motivo_estadia").eq("tenant_id", tenantId).eq("property_id", ids.imovel!).maybeSingle();
  expect(error).toBeNull();
  return (data?.motivo_estadia as string | null) ?? null;
}

test.describe("T133 — Motivo na candidatura", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.a = await criarConta(inqA, senha);
    ids.b = await criarConta(inqB, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Motivo ${sufixo}`, { ativo: true });
    for (const id of [ids.a, ids.b]) {
      const { error } = await adm().from("profiles").update({ motivo_estadia: "tratamento_medico" }).eq("id", id);
      expect(error).toBeNull();
    }
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.a, ids.b]);
  });

  test("1. vem pré-preenchido do perfil; trocar a escolha não é sobrescrito; envia a escolha", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, inqA.email, senha);
    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
    const seletor = page.locator("#cartao-preco").getByTestId("candidatura-motivo");
    await expect(seletor).toHaveValue("tratamento_medico", { timeout: 20_000 });
    await seletor.selectOption("trabalho_remoto");
    await page.waitForTimeout(1500);
    await expect(seletor).toHaveValue("trabalho_remoto");
    await candidatar(page, ids.imovel!, false);
    expect(await motivoGravado(ids.a!)).toBe("trabalho_remoto");
    await page.context().close();
  });

  test("2. sem escolher, vai o motivo do perfil; o dono vê 'Saúde', sem sobrenome nem telefone", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, inqB.email, senha);
    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
    await expect(page.locator("#cartao-preco").getByTestId("candidatura-motivo")).toHaveValue("tratamento_medico", { timeout: 20_000 });
    await candidatar(page, ids.imovel!, false);
    expect(await motivoGravado(ids.b!)).toBe("tratamento_medico");
    await page.context().close();

    const d = await entrar(browser, dono.email, senha);
    await d.goto("/dashboard/leads", { waitUntil: "networkidle" });
    const corpo = d.locator("body");
    await expect(corpo).toContainText("motivo: Saúde", { timeout: 20_000 });
    await expect(corpo).toContainText("motivo: Trabalho remoto");
    await expect(corpo).not.toContainText(/tratamento m[eé]dico/i);
    await expect(corpo).not.toContainText("Sobrenomeoculto");
    await expect(corpo).not.toContainText(TELEFONE_LAB.replace(/\D/g, "").slice(-8));
    await expect(corpo).not.toContainText(TELEFONE_LAB);
    await d.context().close();
  });
});
