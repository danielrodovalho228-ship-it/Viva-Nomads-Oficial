import { test, expect, type Browser } from "@playwright/test";
import { adm, apagarContas, criarConta, entrar, NO_LABORATORIO, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1066 — E434 (#2336, 02/11): a URL crua da foto do cartão ("Foto do cartão: …/_next/image…") nunca fica no corpo dos
 * e-mails da caixa de teste — a foto aparece embutida como imagem, ou nada. Pela tela real, 390 (cartões) e 1280 (tabela),
 * com um e-mail guardado ANTES do E434 (corpo com a linha "Foto do cartão: <URL>"):
 *   1. leitor de QA, /dashboard/qa/emails: "Ler o e-mail" mostra a foto embutida (<img> com a URL, alt "Foto do cartão do
 *      imóvel") e o texto do corpo SEM "Foto do cartão" nem a URL; o resto do corpo continua lá;
 *   2. a própria conta de teste, /api/conta/caixa-teste: o corpo devolvido não traz a linha "Foto do cartão" (o resto sim).
 * A gravação sem a linha (corpoComCabecalho) e o corpoSemUrlDeFoto ficam com o caixa-teste.test.ts.
 */
const sufixo = novoSufixo();
const senha = novaSenha();
const leitor = { email: `qa1066-leitor-${sufixo}@lab.vivanomads.test`, nome: "Leitor T1066", role: "owner" as const };
const alvo = { email: `qa1066-alvo-${sufixo}@lab.vivanomads.test`, nome: "Alvo T1066", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const EVENTO = `lab1066_foto_${sufixo}`;
const ASSUNTO = `T1066 foto ${sufixo}`;
const FOTO =
  "https://lab.vivanomads.test/_next/image?url=https%3A%2F%2Flabt1066.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fimoveis%2Fcapa-t1066.webp&w=640&q=75";
const CORPO = `Remetente: Viva Nomads\n\nFoto do cartão: ${FOTO}\nOlá!\nCorpo do aviso t1066.`;

async function abrir(browser: Browser, email: string, largura: number) {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  return p;
}

test.describe("T1066 — E434: a foto do cartão vai embutida, nunca como URL crua no corpo da caixa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.leitor = await criarConta(leitor, senha);
    ids.alvo = await criarConta(alvo, senha);
    await adm().from("profiles").update({ is_teste: true, qa_leitor: true }).eq("id", ids.leitor!);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.alvo!);
    const { error } = await adm().from("emails_teste").insert({
      evento: EVENTO,
      assunto: ASSUNTO,
      corpo: CORPO,
      destinatario_mascarado: "q•••@lab.vivanomads.test",
      usuario_id: ids.alvo,
    });
    if (error) throw error;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("emails_teste").delete().eq("evento", EVENTO);
    await apagarContas([ids.leitor, ids.alvo]);
  });

  for (const largura of [390, 1280] as const) {
    test(`1. leitor de QA: foto embutida, sem a URL crua no texto (${largura})`, async ({ browser }) => {
      const p = await abrir(browser, leitor.email, largura);
      const r = await p.goto(`/dashboard/qa/emails?evento=${EVENTO}`, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
      const lista = p.getByTestId(largura < 768 ? "emails-teste-cartoes" : "emails-teste-tabela");
      await expect(lista).toContainText(ASSUNTO, { timeout: 20_000 });
      if (largura < 768) await lista.getByText("Ler o e-mail").click();
      else await lista.locator("summary", { hasText: ASSUNTO }).click();

      const fotos = lista.getByTestId("emails-teste-fotos");
      await expect(fotos).toBeAttached();
      const img = fotos.getByRole("img", { name: "Foto do cartão do imóvel" });
      await expect(img).toHaveCount(1);
      await expect(img).toHaveAttribute("src", FOTO);

      const corpo = lista.locator("pre");
      await expect(corpo).toContainText("Corpo do aviso t1066.");
      await expect(corpo, "sem a linha da URL crua").not.toContainText("Foto do cartão");
      await expect(corpo).not.toContainText("_next/image");
      await expect(lista, "a URL não aparece em texto em lugar nenhum da lista").not.toContainText("labt1066.supabase.co");

      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra, "sem estouro horizontal").toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }

  test("2. a própria conta de teste: /api/conta/caixa-teste devolve o corpo sem a linha da foto", async ({ browser }) => {
    const p = await abrir(browser, alvo.email, 390);
    const r = await p.request.get("/api/conta/caixa-teste");
    expect(r.status()).toBe(200);
    const { emails } = (await r.json()) as { emails: { assunto: string; corpo: string }[] | null };
    const e = (emails ?? []).find((x) => x.assunto === ASSUNTO);
    expect(e, "o e-mail semeado volta na caixa").toBeTruthy();
    expect(e!.corpo).toContain("Corpo do aviso t1066.");
    expect(e!.corpo).toContain("Remetente: Viva Nomads");
    expect(e!.corpo).not.toContain("Foto do cartão");
    expect(e!.corpo).not.toContain("_next/image");
    await p.context().close();
  });
});
