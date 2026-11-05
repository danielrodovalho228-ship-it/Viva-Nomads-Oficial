import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1200 — E599 (05/11, reprova final do E562): o e-mail da proposta dizia a saída um dia ANTES da saída gravada na
 * candidatura, no formulário e na proposta (usava o fim inclusivo do período, a última noite). Agora a saída do e-mail é
 * entrada + dias. O E599 entrou só com teste de unidade; aqui o dono ENVIA pela tela uma proposta de 43 dias (como na
 * t863) e o e-mail que chega à moradora na Caixa de e-mails de teste traz a saída = entrada + 43, nunca o dia anterior.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1200.${sufixo}@lab.vivanomads.test`, nome: "Dalva Saída Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1200.${sufixo}@lab.vivanomads.test`, nome: "Sara Saída Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const br = (iso: string) => iso.split("-").reverse().join("/");
const ENTRADA = emDias(30);
const SAIDA = emDias(73); // 43 dias
const VESPERA = emDias(72); // o fim inclusivo (a última noite) — o que o e-mail dizia antes

test.describe("T1200 — E599: o e-mail da proposta diz a saída real (entrada + dias)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    // Contas de teste: o e-mail vai para a Caixa de e-mails de teste (emails_teste).
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio saída t1200 ${sufixo}`, { ativo: true, preco: 2800 });
    await adm().from("properties").update({ min_period_days: 30, max_period_days: 180 }).eq("id", ids.imovel);
    const { data, error } = await adm()
      .from("leads")
      .insert({ owner_id: ids.dono, tenant_id: ids.inq, property_id: ids.imovel, status: "new", inicio_desejado: ENTRADA, fim_desejado: SAIDA })
      .select("id")
      .single();
    if (error) throw error;
    ids.lead = data.id as string;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.lead) await adm().from("propostas").delete().eq("lead_id", ids.lead);
    await adm().from("emails_teste").delete().in("usuario_id", [ids.dono!, ids.inq!].filter(Boolean));
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("proposta de 43 dias enviada pela tela → o e-mail da moradora diz a saída de entrada + 43", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/orcamentos/nova?interessado=${ids.lead}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("montagem-proposta")).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(page.getByTestId("proposta-dias")).toContainText("43 dias");
    await page.getByTestId("proposta-validade").selectOption("7");
    await page.getByTestId("enviar-proposta").click();
    await page.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await page.context().close();

    let corpo = "";
    await expect
      .poll(async () => {
        const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", ids.inq!).ilike("corpo", `%${br(ENTRADA)}%`).order("criado_em", { ascending: false }).limit(1);
        corpo = String(data?.[0]?.corpo ?? "");
        return corpo.length > 0;
      }, { timeout: 30_000, message: "o e-mail da proposta chega à Caixa de e-mails de teste da moradora" })
      .toBe(true);
    expect(corpo, `saída = entrada + 43 (${br(SAIDA)})`).toContain(br(SAIDA));
    expect(corpo, `nunca o dia anterior (${br(VESPERA)})`).not.toContain(br(VESPERA));
  });
});
