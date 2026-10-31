import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T771 — E274 (#1682, Pista B): a caixa de QA mostra a foto de capa de cada cartão de imóvel do e-mail. Pista C, bloco
  102. O envio grava "Foto do cartão: <url>" no topo do corpo e as listas de QA (/admin/emails-teste e
  /dashboard/qa/emails, o mesmo componente) mostram essas fotos como imagem dentro de "Ler o e-mail". No laboratório o
  Supabase é local (não *.supabase.co), então o envio nunca grava uma foto válida: a spec semeia o corpo como o envio
  gravaria e confere a tela, a 390 (cartões) e a 1280 px (tabela):
   - só a URL do otimizador do site com a capa do Storage público vira imagem (uma de outro host fica só no texto);
   - no máximo 3 fotos por e-mail (o corpo traz 4 válidas: aparecem as 3 primeiras, na ordem);
   - um e-mail sem foto de cartão não ganha o bloco de fotos.
*/
const sufixo = novoSufixo();
const senha = novaSenha();
const foto = (n: number) => `https://vivanomads.com.br/_next/image?url=https%3A%2F%2Fabcdlab.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fimoveis%2Ft771-${sufixo}-capa-${n}.jpg&w=640&q=75`;
const FORA = `https://outro-site.example/t771-${sufixo}.jpg`;
const COM_FOTO = `Lab T771 ${sufixo} — três imóveis para você`;
const SEM_FOTO = `Lab T771 ${sufixo} — código de acesso`;
const corpoComFotos = [
  "Remetente: Viva Nomads <ola@vivanomads.com.br>",
  "Imagem: transacional.jpg",
  ...[1, 2, 3, 4].map((n) => `Foto do cartão: ${foto(n)}`),
  `Foto do cartão: ${FORA}`,
  "",
  "Olá, separamos três imóveis para você.",
].join("\n");
const qa = { email: `qa.t771.${sufixo}@lab.vivanomads.test`, nome: "Quésia Fotos", role: "tenant" as const };
let qaId = "";

async function conferir(p: Page, largura: number) {
  await expect(p.getByTestId("emails-teste")).toBeVisible({ timeout: 20_000 });
  const lista = p.getByTestId(largura < 768 ? "emails-teste-cartoes" : "emails-teste-tabela");
  const linha = lista.locator(largura < 768 ? "li" : "tr").filter({ hasText: COM_FOTO });
  await expect(linha).toHaveCount(1, { timeout: 20_000 });
  await linha.locator("summary").first().click();
  const fotos = linha.getByTestId("emails-teste-fotos").locator("img");
  await expect(fotos).toHaveCount(3);
  for (const [i, n] of [1, 2, 3].entries()) {
    await expect(fotos.nth(i)).toHaveAttribute("src", foto(n));
    await expect(fotos.nth(i)).toHaveAttribute("alt", "Foto do cartão do imóvel");
  }
  // A URL de outro host não vira imagem (segue só como texto do corpo).
  await expect(linha.locator(`img[src="${FORA}"]`)).toHaveCount(0);
  await expect(linha.locator("pre")).toContainText(FORA);
  // E-mail sem foto de cartão: sem o bloco de fotos.
  const semFoto = lista.locator(largura < 768 ? "li" : "tr").filter({ hasText: SEM_FOTO });
  await expect(semFoto).toHaveCount(1);
  await semFoto.locator("summary").first().click();
  await expect(semFoto.getByTestId("emails-teste-fotos")).toHaveCount(0);
  const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sobra, "sem rolagem lateral").toBeLessThanOrEqual(1);
}

test.describe("T771 — E274: a caixa de QA mostra a foto de capa de cada cartão do e-mail", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    qaId = await criarConta(qa, senha);
    await adm().from("profiles").update({ is_teste: true, qa_leitor: true }).eq("id", qaId);
    const { error } = await adm().from("emails_teste").insert([
      { evento: "lab_t771", assunto: COM_FOTO, corpo: corpoComFotos, destinatario_mascarado: "l•••@lab.vivanomads.test" },
      { evento: "lab_t771", assunto: SEM_FOTO, corpo: "Remetente: Viva Nomads <ola@vivanomads.com.br>\nImagem: transacional.jpg\n\nSeu código é 123456.", destinatario_mascarado: "l•••@lab.vivanomads.test" },
    ]);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await adm().from("emails_teste").delete().in("assunto", [COM_FOTO, SEM_FOTO]);
    if (qaId) await apagarContas([qaId]);
  });

  for (const largura of [1280, 390] as const) {
    test(`admin, /admin/emails-teste a ${largura} px: 3 fotos válidas, nada do outro host, nada no e-mail sem foto`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      // /admin/emails-teste leva à aba "E-mails" de Dados de teste (ADMIN-2); os dois e-mails semeados são os mais recentes.
      await p.goto("/admin/emails-teste", { waitUntil: "domcontentloaded" });
      await conferir(p, largura);
      await ctx.close();
    });

    test(`leitora da QA, /dashboard/qa/emails a ${largura} px: a mesma lista com as fotos`, async ({ browser }) => {
      const p = await entrar(browser, qa.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/qa/emails?evento=lab_t771", { waitUntil: "domcontentloaded" });
      await conferir(p, largura);
      await p.context().close();
    });
  }
});
