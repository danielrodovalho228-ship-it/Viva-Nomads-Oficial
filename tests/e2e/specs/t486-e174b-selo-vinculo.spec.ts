import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T486 — E174-B: o selo "Vínculo profissional · <domínio>" (nunca o e-mail) nos contextos de confiança, para contas
  com o vínculo CONFIRMADO: perfil público do proprietário (e o bloco do dono no imóvel), candidatura, cabeçalho da
  conversa e avaliação publicada. Vínculo pedido e não confirmado: nada aparece.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ana = { email: `ana.t486.${sufixo}@lab.vivanomads.test`, nome: "Ana Vinculo", role: "tenant" as const };
const dono = { email: `dono.t486.${sufixo}@lab.vivanomads.test`, nome: "Davi Vinculo", role: "owner" as const };
const ids: Record<string, string> = {};
const DOMINIO_ANA = "hospital-lab.org.br";
const DOMINIO_DONO = "universidade-lab.edu.br";

async function vinculo(userId: string, dominio: string, confirmado: boolean) {
  const { error } = await adm()
    .from("vinculo_profissional")
    .upsert({ user_id: userId, dominio, codigo_hash: "0".repeat(64), expira_em: new Date(Date.now() + 600_000).toISOString(), confirmado_em: confirmado ? new Date().toISOString() : null });
  if (error) throw error;
}

test.describe("T486 — E174-B: selo do vínculo profissional nos contextos de confiança", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.ana = await criarConta(ana, senha);
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Vínculo t486 ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.ana, ids.imovel);
    await gravarMensagem(ids.ana, ids.dono, ids.imovel, "Olá! Tenho interesse no imóvel.", conversationId(ids.ana, ids.dono, ids.imovel));
    await vinculo(ids.ana, DOMINIO_ANA, true);
    await vinculo(ids.dono, DOMINIO_DONO, true);
  });

  test.afterAll(async () => {
    await adm().from("avaliacoes").delete().eq("contrato_id", ids.contrato ?? "00000000-0000-0000-0000-000000000000");
    await adm().from("contratos").delete().eq("id", ids.contrato ?? "00000000-0000-0000-0000-000000000000");
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.ana, ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — perfil público do proprietário e o bloco do dono no imóvel`, async ({ browser }) => {
      const p = await browser.newPage({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      await p.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
      const selo = p.getByTestId("selo-vinculo").first();
      await expect(selo).toHaveText(`Vínculo profissional · ${DOMINIO_DONO}`, { timeout: 20_000 });
      await expect(p.locator("body")).not.toContainText(`@${DOMINIO_DONO}`);
      await p.screenshot({ path: `${SAIDA}/t486-perfil-publico-${largura}.png` });
      await p.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("selo-vinculo").first()).toContainText(DOMINIO_DONO, { timeout: 20_000 });
      await p.getByTestId("selo-vinculo").first().scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t486-imovel-dono-${largura}.png` });
      await p.close();
    });
  }

  test("390 px — o dono vê o selo da candidata na candidatura, na conversa e na avaliação", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
    const sinais = p.getByTestId("candidato-sinais").first();
    await expect(sinais.getByTestId("selo-vinculo")).toHaveText(`Vínculo profissional · ${DOMINIO_ANA}`, { timeout: 20_000 });
    await expect(sinais).not.toContainText(`@${DOMINIO_ANA}`);
    await p.screenshot({ path: `${SAIDA}/t486-candidatura-390.png`, fullPage: true });

    await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: /Vínculo t486/ }).first().click();
    await expect(p.getByTestId("selo-vinculo").first()).toHaveText(`Vínculo profissional · ${DOMINIO_ANA}`, { timeout: 20_000 });
    await p.screenshot({ path: `${SAIDA}/t486-conversa-390.png` });
    await p.context().close();

    // A avaliação publicada da Ana: o selo aparece com o autor, na página do imóvel.
    const base = { property_id: ids.imovel, tenant_id: ids.ana, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 240, qtd_ocupantes: 1, status: "concluido", garantia: "caucao" };
    const { data: ct, error } = await adm().from("contratos").insert({ ...base, encerrado_em: new Date(Date.now() - 24 * 3600_000).toISOString() }).select("id").single();
    if (error) throw error;
    ids.contrato = ct!.id as string;
    // Avaliação já publicada (a mesma regra do servidor: estadia encerrada há menos de 14 dias).
    const { error: eAv } = await adm()
      .from("avaliacoes")
      .insert({ contrato_id: ids.contrato, autor_id: ids.ana, alvo_id: ids.dono, papel_autor: "inquilino", nota_geral: 5, comentario_publico: `Imóvel muito bem cuidado ${sufixo}.`, status: "publicada", publicada_em: new Date().toISOString() });
    if (eAv) throw eAv;
    const visitante = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await expect
      .poll(async () => {
        await visitante.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
        return visitante.getByTestId("avaliacao-real").getByTestId("selo-vinculo").count();
      }, { timeout: 45_000 })
      .toBeGreaterThan(0);
    await expect(visitante.getByTestId("avaliacao-real").getByTestId("selo-vinculo").first()).toHaveText(`Vínculo profissional · ${DOMINIO_ANA}`);
    await visitante.getByTestId("avaliacao-real").first().scrollIntoViewIfNeeded();
    await visitante.screenshot({ path: `${SAIDA}/t486-avaliacao-390.png` });
    await visitante.close();
  });

  test("vínculo pedido e não confirmado: o selo não aparece em lugar nenhum", async ({ browser }) => {
    await vinculo(ids.ana, DOMINIO_ANA, false);
    await vinculo(ids.dono, DOMINIO_DONO, false);
    const v = await browser.newPage();
    await v.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
    await expect(v.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
    await expect(v.getByTestId("selo-vinculo")).toHaveCount(0);
    await v.close();
    const p = await entrar(browser, dono.email, senha);
    await p.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("candidato-sinais").first()).toBeVisible({ timeout: 20_000 });
    await expect(p.getByTestId("selo-vinculo")).toHaveCount(0);
    await p.context().close();
  });
});
