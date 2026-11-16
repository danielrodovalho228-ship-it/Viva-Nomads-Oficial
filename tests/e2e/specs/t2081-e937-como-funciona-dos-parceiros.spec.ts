import { test, expect } from "@playwright/test";

/*
  T2081 — E937 (Pista 3; auditoria das travas da Família 4, ronda 04:55Z) @E937 @ao-vivo-seguro
  Regra decidida (Família 4; correção no draft #3883): no "Como funciona" de /parceiros,
    - passo 2 ("A Viva confere"): o link de ativação da página "vale 7 dias, uma vez";
    - passo 3 ("Receba pedidos"): as duas regras do O-27 — "O endereço do imóvel só chega ao parceiro depois que ele
      aceita o pedido." e "Enquanto o pagamento pela plataforma não estiver ativo, o valor do serviço é combinado e
      pago direto entre parceiro e proprietário.";
  e a Ajuda diz as MESMAS frases (artigos "Como posso virar parceiro da Viva?" e "Taxa de serviço dos parceiros").
  Vermelha na main até a correção entrar. Visitante, só leitura.
*/
test.use({ storageState: { cookies: [], origins: [] } });

const VALIDADE = "vale 7 dias, uma vez";
const ENDERECO = "O endereço do imóvel só chega ao parceiro depois que ele aceita o pedido.";
const PAGAMENTO = "Enquanto o pagamento pela plataforma não estiver ativo, o valor do serviço é combinado e pago direto entre parceiro e proprietário.";
const limpo = (s: string) => s.replace(/\s+/g, " ");

test("T2081 — E937: o Como funciona de /parceiros diz a validade do link (passo 2) e as duas regras do O-27 (passo 3) @E937 @ao-vivo-seguro", async ({ page }) => {
  const r = await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  const fluxo = page.getByTestId("parceiros-fluxo");
  await expect(fluxo).toBeVisible({ timeout: 30_000 });
  const passo = (titulo: string) => fluxo.locator("li").filter({ hasText: titulo }).first();
  const p2 = limpo(await passo("A Viva confere").innerText());
  expect(p2, "passo 2: a validade do link de ativação").toContain(VALIDADE);
  const p3 = limpo(await passo("Receba pedidos").innerText());
  expect(p3, "passo 3: o endereço só depois do aceite").toContain(ENDERECO);
  expect(p3, "passo 3: o pagamento direto enquanto a plataforma não estiver ativa").toContain(PAGAMENTO);
});

test("T2081 — E937: a Ajuda diz as mesmas frases (fonte única com /parceiros) @E937 @ao-vivo-seguro", async ({ page }) => {
  const r = await page.goto("/ajuda/proprietarios", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  const lista = page.getByTestId("ajuda-perguntas");
  await expect(lista).toBeVisible({ timeout: 30_000 });
  const abrir = async (pergunta: string) => {
    const botao = lista.getByRole("button", { name: pergunta });
    await expect(async () => {
      if ((await botao.getAttribute("aria-expanded")) !== "true") await botao.click();
      await expect(botao).toHaveAttribute("aria-expanded", "true", { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    return limpo(await botao.locator("xpath=following-sibling::div[1]").locator("p").first().innerText());
  };
  expect(await abrir("Como posso virar parceiro da Viva?")).toContain(VALIDADE);
  const taxa = await abrir("Taxa de serviço dos parceiros");
  expect(taxa).toContain(ENDERECO);
  expect(taxa).toContain(PAGAMENTO);
});
