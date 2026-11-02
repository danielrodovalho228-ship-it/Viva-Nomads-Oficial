import { test, expect, type Browser } from "@playwright/test";
import { adm, apagarContas, criarConta, entrar, NO_LABORATORIO, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1043 — E435 (#2339, caixa de teste do QA, 02/11): o leitor de QA (/dashboard/qa/emails) passa a ver, de cada e-mail
 * de conta de teste, a versão HTML (num iframe isolado, sandbox sem scripts), o destinatário por extenso, o link de
 * descadastro e o imóvel por extenso; e a lista ganha páginas de 100 (antes só os 100 mais recentes apareciam). Pela tela
 * real, 390 (cartões) e 1280 (tabela):
 *   1. um e-mail com html, destinatario e descadastro_url (colunas da 0284): "Ler o e-mail" mostra o destinatário por
 *      extenso, o link de descadastro e "Ver a versão HTML", cujo iframe tem sandbox="" e mostra o HTML guardado; a
 *      linha "Imóvel: …" aparece por extenso;
 *   2. 101 e-mails num evento: "Página 1 de 2 · 101 e-mails"; "Mais antigos" leva à página 2 (filtro mantido) com 1 e-mail
 *      e o "Mais recentes" de volta.
 * A gravação (montarRegistroEmailTeste, htmlParaCaixa sem token de acesso, descadastroDoEmail) e as contas fora do QA
 * ficam com o e435-caixa-teste.test.ts e a t470.
 */
const sufixo = novoSufixo();
const senha = novaSenha();
const leitor = { email: `qa1043-leitor-${sufixo}@lab.vivanomads.test`, nome: "Leitor T1043", role: "owner" as const };
const alvo = { email: `qa1043-alvo-${sufixo}@lab.vivanomads.test`, nome: "Alvo T1043", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const EVENTO = `lab1043_html_${sufixo}`;
const EVENTO_PAG = `lab1043_pag_${sufixo}`;
const MARCA_HTML = `Marca HTML T1043 ${sufixo}`;
const IMOVEL = `Casa comprida da serra com varanda e vista para o vale t1043 ${sufixo}`;
const UUID = "00000000-0000-4000-8000-000000001043";
const DESCADASTRO = `https://lab.vivanomads.test/avisos/desligar?u=${UUID}&t=tok1043${sufixo.replace(/[^A-Za-z0-9]/g, "")}`;

async function abrir(browser: Browser, largura: number) {
  const p = await entrar(browser, leitor.email, senha);
  await p.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  return p;
}

test.describe("T1043 — E435: a caixa do QA com versão HTML, destinatário, descadastro e páginas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.leitor = await criarConta(leitor, senha);
    ids.alvo = await criarConta(alvo, senha);
    await adm().from("profiles").update({ is_teste: true, qa_leitor: true }).eq("id", ids.leitor!);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.alvo!);
    const { error } = await adm().from("emails_teste").insert({
      evento: EVENTO,
      assunto: `T1043 html ${sufixo}`,
      corpo: `Olá!\nImóvel: ${IMOVEL}\nVeja no painel.`,
      destinatario_mascarado: "q•••@lab.vivanomads.test",
      usuario_id: ids.alvo,
      html: `<html><body><h1>${MARCA_HTML}</h1><p>Corpo em HTML.</p></body></html>`,
      destinatario: alvo.email,
      descadastro_url: DESCADASTRO,
    });
    if (error) throw error;
    const muitos = Array.from({ length: 101 }, (_, i) => ({
      evento: EVENTO_PAG,
      assunto: `T1043 pag ${String(i).padStart(3, "0")} ${sufixo}`,
      corpo: "Página.",
      destinatario_mascarado: "q•••@lab.vivanomads.test",
      usuario_id: ids.alvo,
    }));
    const r = await adm().from("emails_teste").insert(muitos);
    if (r.error) throw r.error;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("emails_teste").delete().in("evento", [EVENTO, EVENTO_PAG]);
    await apagarContas([ids.leitor, ids.alvo]);
  });

  for (const largura of [390, 1280] as const) {
    test(`1. versão HTML isolada, destinatário por extenso, descadastro e imóvel por extenso (${largura})`, async ({ browser }) => {
      const p = await abrir(browser, largura);
      const r = await p.goto(`/dashboard/qa/emails?evento=${EVENTO}`, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
      const lista = p.getByTestId(largura < 768 ? "emails-teste-cartoes" : "emails-teste-tabela");
      await expect(lista).toContainText(`T1043 html ${sufixo}`, { timeout: 20_000 });
      await expect(lista, "destinatário por extenso para o QA").toContainText(alvo.email);

      // Abre o e-mail: no celular "Ler o e-mail"; no computador, o assunto é o resumo do <details>.
      if (largura < 768) await lista.getByText("Ler o e-mail").click();
      else await lista.locator("summary", { hasText: `T1043 html ${sufixo}` }).click();
      // No computador a linha do imóvel fica dentro do <details>; no celular, sob o assunto.
      await expect(lista.getByTestId("emails-teste-imovel")).toHaveText(`Imóvel: ${IMOVEL}`);
      const desc = lista.getByTestId("emails-teste-descadastro");
      await expect(desc).toBeVisible();
      await expect(desc.getByRole("link")).toHaveAttribute("href", DESCADASTRO);

      const html = lista.getByTestId("emails-teste-html");
      await html.getByText("Ver a versão HTML").click();
      const quadro = html.locator("iframe");
      await expect(quadro).toBeVisible();
      await expect(quadro, "sandbox sem allow-scripts").toHaveAttribute("sandbox", "");
      // O quadro da própria lista (cartões e tabela estão os dois no DOM; um frameLocator da página pegaria o escondido).
      await expect(quadro.contentFrame().getByRole("heading", { name: MARCA_HTML })).toBeVisible();

      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra, "sem estouro horizontal").toBeLessThanOrEqual(0);
      await p.context().close();
    });

    test(`2. páginas de 100: 101 e-mails no evento → página 2 com 1, filtro mantido (${largura})`, async ({ browser }) => {
      const p = await abrir(browser, largura);
      await p.goto(`/dashboard/qa/emails?evento=${EVENTO_PAG}`, { waitUntil: "domcontentloaded" });
      const nav = p.getByTestId("qa-emails-paginas");
      await expect(nav).toContainText("Página 1 de 2 · 101 e-mails", { timeout: 20_000 });
      const itens = () =>
        largura < 768 ? p.getByTestId("emails-teste-cartoes").locator(":scope > li") : p.getByTestId("emails-teste-tabela").locator("tbody tr");
      await expect(itens()).toHaveCount(100);
      await expect(nav.getByRole("link", { name: "Mais recentes" })).toHaveCount(0);

      await p.getByTestId("qa-emails-proxima").click();
      await expect(p).toHaveURL(new RegExp(`evento=${EVENTO_PAG}&pagina=2$`));
      await expect(nav).toContainText("Página 2 de 2 · 101 e-mails");
      await expect(itens()).toHaveCount(1);
      await expect(p.getByTestId("qa-emails-proxima")).toHaveCount(0);
      await nav.getByRole("link", { name: "Mais recentes" }).click();
      await expect(p).toHaveURL(new RegExp(`evento=${EVENTO_PAG}$`));
      await expect(itens()).toHaveCount(100);
      await p.context().close();
    });
  }
});
