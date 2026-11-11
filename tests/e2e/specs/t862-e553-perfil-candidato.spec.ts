import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T862 — E553 (parte B): o perfil completo do candidato em /dashboard/leads/<id>.
 * 1) o dono abre o perfil: "Candidato(a)" antes do aceite (sem o nome), resumo e o "Voltar" para o cartão;
 * 2) outra conta (não é o dono) recebe a tela de não encontrada (404, ou 200 com a 404 em streaming) para o mesmo id.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.e553.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const outro = { email: `outro.e553.${sufixo}@lab.vivanomads.test`, nome: "Otto Outro", role: "owner" as const };
const inq = { email: `inq.e553.${sufixo}@lab.vivanomads.test`, nome: "Ivo Sobrenomeoculto", role: "tenant" as const };
const ids: { dono?: string; outro?: string; inq?: string; imovel?: string; lead?: string } = {};

test.describe("T862 — Perfil do candidato", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.outro = await criarConta(outro, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio E553 ${sufixo}`, { ativo: true });
    const { data, error } = await adm().from("leads").insert({ property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, status: "new" }).select("id").single();
    expect(error).toBeNull();
    ids.lead = data!.id as string;
  });
  test.afterAll(async () => {
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.outro, ids.inq]);
  });

  test("1. o dono abre o perfil, com a máscara do cartão", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    const r = await page.goto(`/dashboard/leads/${ids.lead}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    const perfil = page.getByTestId("perfil-candidato");
    await expect(perfil).toBeVisible({ timeout: 20_000 });
    await expect(perfil).toContainText("Candidato(a)");
    await expect(perfil).not.toContainText("Sobrenomeoculto");
    await expect(page.getByTestId("perfil-candidato-voltar")).toHaveAttribute("href", `/dashboard/leads#candidato-${ids.lead}`);
    await page.context().close();
  });

  test("2. outra conta não vê o perfil (404)", async ({ browser }) => {
    const page = await entrar(browser, outro.email, senha);
    const r = await page.goto(`/dashboard/leads/${ids.lead}`, { waitUntil: "domcontentloaded" });
    // O painel faz streaming (loading.tsx): o notFound() chega como a tela "Página não encontrada", com 200 ou 404.
    expect([200, 404]).toContain(r?.status());
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("perfil-candidato")).toHaveCount(0);
    await page.context().close();
  });
});
