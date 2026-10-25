import { test, expect, type Browser } from "@playwright/test";
import { adm, apagarContas, criarConta, entrar, NO_LABORATORIO, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T480 — QA-CAIXA-B (#1338), guarda permanente da Pista C: a t470 cobre 404, RLS e máscara; aqui, o corpo dos e-mails.
  Uma linha gravada CRUA em emails_teste (sem passar pelo gravador, como uma linha antiga ou um gravador novo que
  esqueça a limpeza) com os links de token que o produto manda hoje:
    - /auth/v1/verify?token=…  (Supabase)        - /auth/confirm?token_hash=…  (templates-supabase.ts, #182)
    - /prova/celular?token=…   (prova pelo celular) - /api/conta/excluir?code=…
  1. Conta de teste COM qa_leitor: vê a linha, destinatário mascarado, e nenhum token=/code= no HTML (nem em texto nem
     em href); nenhum <a> no corpo.
  1b. O mesmo para o token_hash= do /auth/confirm — VERMELHO (test.fail QA-CAIXA-B): `semLinksComToken` só casa
      token|code|codigo|access_token|t, e "token_hash=" passa (run 40204172450).
  2. Conta de teste SEM a marca: 404 na mesma URL.
  A 390 e 1280 px.
*/
const sufixo = novoSufixo();
const senha = novaSenha();
const semFlag = { email: `qa480-teste-${sufixo}@lab.vivanomads.test`, nome: "Teste T480", role: "tenant" as const };
const leitor = { email: `qa480-leitor-${sufixo}@lab.vivanomads.test`, nome: "Leitor T480", role: "owner" as const };
const ids: Record<string, string | undefined> = {};
const EVENTO = `lab480_${sufixo}`;
const SEGREDOS = {
  verify: `tk480verify${sufixo}`,
  tokenHash: `tk480hash${sufixo}`,
  celular: `tk480celular${sufixo}`,
  code: `tk480code${sufixo}`,
};
const CORPO = [
  `Confirme: http://127.0.0.1:54321/auth/v1/verify?token=${SEGREDOS.verify}&type=magiclink&redirect_to=http://localhost:3123`,
  `Redefinir: http://localhost:3123/auth/confirm?token_hash=${SEGREDOS.tokenHash}&type=recovery&next=/auth/reset`,
  `Prova: http://localhost:3123/prova/celular?token=${SEGREDOS.celular}`,
  `Excluir: https://vivanomads.com.br/api/conta/excluir?code=${SEGREDOS.code}`,
  `Destinatário: ${semFlag.email}`,
].join("\n");

async function abrir(browser: Browser, email: string, largura: number) {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: 900 });
  return p;
}

test.describe("T480 — QA-CAIXA-B: corpo sem link com token", () => {
  test.skip(!NO_LABORATORIO, "Precisa do banco do laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.semFlag = await criarConta(semFlag, senha);
    ids.leitor = await criarConta(leitor, senha);
    await adm().from("profiles").update({ is_teste: true, qa_leitor: false }).eq("id", ids.semFlag!);
    await adm().from("profiles").update({ is_teste: true, qa_leitor: true }).eq("id", ids.leitor!);
    const { error } = await adm()
      .from("emails_teste")
      .insert({ evento: EVENTO, assunto: `T480 ${sufixo}`, corpo: CORPO, destinatario_mascarado: semFlag.email, usuario_id: ids.semFlag });
    if (error) throw error;
  });
  test.afterAll(async () => {
    await adm().from("emails_teste").delete().eq("evento", EVENTO);
    await apagarContas([ids.semFlag, ids.leitor]);
  });

  for (const largura of [390, 1280]) {
    test(`1. qa_leitor: mascarado e nenhum token no corpo (${largura}px)`, async ({ browser }) => {
      const p = await abrir(browser, leitor.email, largura);
      const r = await p.goto(`/dashboard/qa/emails?evento=${EVENTO}`, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
      const lista = p.getByTestId(largura < 768 ? "emails-teste-cartoes" : "emails-teste-tabela");
      await expect(lista).toContainText(`T480 ${sufixo}`, { timeout: 20_000 });
      const html = await p.content();
      expect(html, "destinatário completo").not.toContain(semFlag.email);
      expect(html).toContain("q•••@lab.vivanomads.test");
      const vazados = Object.entries(SEGREDOS).filter(([k, s]) => k !== "tokenHash" && html.includes(s)).map(([k]) => k);
      expect(vazados, "tokens que chegaram à tela").toEqual([]);
      await expect(lista.locator("pre a")).toHaveCount(0);
      await expect(lista).toContainText("[link com token removido]");
      await p.screenshot({ path: `tests/laboratorio/saida/t480-corpo-${largura}.png`, fullPage: true });
      await p.context().close();
    });
  }

  test("1b. o token_hash= do /auth/confirm também não chega à tela", async ({ browser }) => {
    // QA-CAIXA-B (Pista A): a 390 e a 1280 o HTML da tela traz o token_hash inteiro (run 40204172450: vazados =
    // ["tokenHash"]). `semLinksComToken` (src/lib/notifications/caixa-teste.ts) não casa "token_hash=". Quem corrigir tira
    // este test.fail.
    test.fail(true, "QA-CAIXA-B: o link /auth/confirm?token_hash=… passa pela limpeza da caixa de teste");
    const p = await abrir(browser, leitor.email, 1280);
    await p.goto(`/dashboard/qa/emails?evento=${EVENTO}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("emails-teste-tabela")).toContainText(`T480 ${sufixo}`, { timeout: 20_000 });
    expect(await p.content(), "token_hash na tela").not.toContain(SEGREDOS.tokenHash);
    await p.context().close();
  });

  test("2. conta de teste sem a marca: 404", async ({ browser }) => {
    const p = await abrir(browser, semFlag.email, 1280);
    const r = await p.goto(`/dashboard/qa/emails?evento=${EVENTO}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(404);
    await expect(p.getByTestId("qa-emails")).toHaveCount(0);
    expect(await p.content()).not.toContain(SEGREDOS.verify);
    await p.context().close();
  });
});
