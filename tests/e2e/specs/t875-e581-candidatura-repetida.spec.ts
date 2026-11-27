import { test, expect, type Browser } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T875 — E581 (prova do QA, 04/11): a moradora envia a candidatura com 120 dias e depois manda de novo com 43 dias. O lead é
  único por (imóvel, morador): antes o 2º envio não mudava nada e os e-mails saíam com os 120 dias. Agora:
   1. o lead fica com os 43 dias (entrada e saída da 2ª escolha);
   2. a conversa recebe a mensagem com o período novo;
   3. a confirmação mais recente à moradora traz a saída nova e "(43 dias)".
   4. Depois que o dono responde (aceita), um novo envio NÃO muda o lead e avisa que o caminho é o chat.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t875.${sufixo}@lab.vivanomads.test`, nome: "Paulo Repetida", role: "owner" as const };
const inq = { email: `inq.t875.${sufixo}@lab.vivanomads.test`, nome: "Ana Repetida", role: "tenant" as const };
const titulo = `Casa da candidatura repetida ${sufixo}`;
const ids: { dono?: string; inq?: string; imovel?: string } = {};

const hoje = new Date();
const iso = (n: number) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + n)).toISOString().slice(0, 10);
const br = (s: string) => s.split("-").reverse().join("/");
const ENTRADA = iso(40);
const SAIDA_120 = iso(160);
const SAIDA_43 = iso(83);

async function enviar(browser: Browser, saida: string) {
  const page = await entrar(browser, inq.email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
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
  return page;
}

async function lead() {
  const { data } = await adm().from("leads").select("id, status, inicio_desejado, fim_desejado").eq("property_id", ids.imovel!).eq("tenant_id", ids.inq!).single();
  return data as { id: string; status: string; inicio_desejado: string; fim_desejado: string };
}

test.describe("T875 — E581: candidatura repetida atualiza o período", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, titulo, { ativo: true, preco: 2800 });
  });

  test.afterAll(async () => {
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await adm().from("emails_teste").delete().in("usuario_id", [ids.dono, ids.inq].filter(Boolean) as string[]);
    await apagarContas([ids.inq, ids.dono]);
  });

  test("120 dias, depois 43 dias: o lead, a conversa e a confirmação ficam com os 43", async ({ browser }) => {
    test.setTimeout(180_000);
    const p1 = await enviar(browser, SAIDA_120);
    await expect(p1.getByText("Candidatura enviada").first()).toBeVisible({ timeout: 20_000 });
    await p1.context().close();
    expect(String((await lead()).fim_desejado).slice(0, 10)).toBe(SAIDA_120);

    const p2 = await enviar(browser, SAIDA_43);
    await expect(p2.getByText("Candidatura enviada").first()).toBeVisible({ timeout: 20_000 });
    await p2.context().close();
    const l = await lead();
    expect(String(l.inicio_desejado).slice(0, 10)).toBe(ENTRADA);
    expect(String(l.fim_desejado).slice(0, 10), "o 2º envio atualiza a saída").toBe(SAIDA_43);

    const { data: msgs } = await adm().from("messages").select("body").eq("property_id", ids.imovel!).order("created_at", { ascending: false }).limit(1);
    expect(String(msgs?.[0]?.body ?? "")).toContain("(43 dias)");

    await expect(async () => {
      const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", ids.inq!).eq("evento", "application_received").order("criado_em", { ascending: false }).limit(1);
      const c = String(data?.[0]?.corpo ?? "");
      expect(c).toContain(`Saída: ${br(SAIDA_43)} (43 dias)`);
      expect(c).not.toContain(br(SAIDA_120));
    }).toPass({ timeout: 30_000 });
  });

  test("depois da resposta do dono, um novo envio não muda o lead e aponta o chat", async ({ browser }) => {
    test.setTimeout(120_000);
    const l = await lead();
    await adm().from("leads").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", l.id);
    const p = await enviar(browser, SAIDA_120);
    await expect(p.getByText(/já respondeu à sua candidatura/).first()).toBeVisible({ timeout: 20_000 });
    await p.context().close();
    expect(String((await lead()).fim_desejado).slice(0, 10)).toBe(SAIDA_43);
  });
});
