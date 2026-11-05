import { test, expect, type Browser } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1153 — E581 (#2611, 05/11): candidatura repetida atualiza o período, "nunca e-mail com dias antigos". A t875 (Pista B)
 * cobre, a 1280, o lead, a conversa e a confirmação à MORADORA. Aqui o outro lado e o celular: a moradora envia a 390 px
 * com 120 dias e de novo com 43, e
 *   1. o lead fica com a saída dos 43 dias;
 *   2. o e-mail mais recente ao DONO ("candidatura_nova") traz a saída nova e "(43 dias)", sem a saída dos 120;
 *   3. a tela da candidatura não estoura a 390.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1153.${sufixo}@lab.vivanomads.test`, nome: "Otto Repetida", role: "owner" as const };
const inq = { email: `inq.t1153.${sufixo}@lab.vivanomads.test`, nome: "Bia Repetida", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string } = {};

const hoje = new Date();
const iso = (n: number) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + n)).toISOString().slice(0, 10);
const br = (s: string) => s.split("-").reverse().join("/");
const ENTRADA = iso(40);
const SAIDA_120 = iso(160);
const SAIDA_43 = iso(83);

async function enviar(browser: Browser, saida: string) {
  const page = await entrar(browser, inq.email, senha);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
  const card = page.locator("#cartao-preco");
  await card.getByTestId("candidatura-inicio").fill(ENTRADA);
  await card.getByTestId("candidatura-saida").fill(saida);
  const passo = page.getByTestId("solicitacao-passo");
  await expect(async () => {
    await card.getByRole("button", { name: "Pedir para morar", exact: true }).click();
    await expect(passo).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await passo.getByRole("button", { name: "Continuar" }).click();
  await passo.getByRole("button", { name: "Continuar" }).click();
  await passo.getByRole("button", { name: "Enviar candidatura" }).click();
  await expect(page.getByText("Candidatura enviada").first()).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.context().close();
}

const emailsDoDono = async () =>
  ((await adm().from("emails_teste").select("corpo, criado_em").eq("usuario_id", ids.dono!).eq("evento", "candidatura_nova").order("criado_em", { ascending: false })).data ?? []) as {
    corpo: string;
  }[];

test.describe("T1153 — E581: candidatura repetida a 390 — o e-mail ao dono sai com o período novo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `Casa repetida 390 ${sufixo}`, { ativo: true, preco: 2800 });
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await adm().from("emails_teste").delete().in("usuario_id", [ids.dono, ids.inq].filter(Boolean) as string[]);
    await apagarContas([ids.inq, ids.dono]);
  });

  test("120 dias, depois 43 dias a 390: lead e e-mail ao dono com os 43", async ({ browser }) => {
    test.setTimeout(180_000);
    await enviar(browser, SAIDA_120);
    await expect.poll(async () => (await emailsDoDono()).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);

    await enviar(browser, SAIDA_43);
    const { data: lead } = await adm().from("leads").select("inicio_desejado, fim_desejado").eq("property_id", ids.imovel!).eq("tenant_id", ids.inq!).single();
    expect(String(lead?.inicio_desejado).slice(0, 10)).toBe(ENTRADA);
    expect(String(lead?.fim_desejado).slice(0, 10), "o 2º envio atualiza a saída").toBe(SAIDA_43);

    await expect(async () => {
      const emails = await emailsDoDono();
      expect(emails.length, "um e-mail ao dono por envio").toBeGreaterThanOrEqual(2);
      const ultimo = String(emails[0].corpo);
      expect(ultimo).toContain(br(SAIDA_43));
      expect(ultimo).toContain("(43 dias)");
      expect(ultimo).not.toContain(br(SAIDA_120));
    }).toPass({ timeout: 30_000 });
  });
});
