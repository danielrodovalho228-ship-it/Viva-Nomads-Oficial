import { test, expect } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T969 — E425 (#2110): o parceiro aprovado ativa a conta pelo PRÓPRIO painel, sem depender do link do e-mail (antes o
 * painel só mandava abrir o e-mail). Mesmo núcleo do /parceiros/ativar: uso único, cria a página em rascunho e abre o
 * painel completo. Pela tela real (/dashboard/parceiro), 390 e 1280 (uma conta por largura):
 *   1. com o pedido APROVADO da mesma conta: "Sua parceria foi aprovada." com "Ativar minha página";
 *   2. o botão ativa: vai a /dashboard/parceiro?ativada=1 com "Parceria ativada. Complete a página e publique quando
 *      estiver pronta."; o pedido vira "ativada" e a página do parceiro nasce em rascunho (fora do ar);
 *   3. uso único: de volta ao painel, o botão não aparece mais e a ativação não cria uma segunda página;
 *   4. (resíduo, #2168) em /parceiros, o formulário "Seja parceiro" do aprovado diz "Ative a sua página aqui ou pelo
 *      link do e-mail." (nunca só "veja o e-mail") com o mesmo "Ativar minha página", que ativa e leva ao painel.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];

async function pedidoAprovado(uid: string, conta: { email: string; nome: string }) {
  const { error } = await adm().from("parceiro_solicitacoes").insert({
    user_id: uid,
    email: conta.email,
    nome: conta.nome,
    tipo_pessoa: "pf",
    documento: cpfAleatorio(),
    categorias: ["fotografia"],
    cidades: ["Uberlândia"],
    status: "aprovada",
    origem: "site",
    // Pedido aprovado sempre tem o token do link do e-mail (parceiro_solicitacoes_aprovada_token); o painel ativa sem ele.
    token_ativacao_hash: createHash("sha256").update(randomBytes(32).toString("base64url")).digest("hex"),
    token_expira_em: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  });
  if (error) throw error;
}

function cpfAleatorio(): string {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (base: number[]) => {
    const s = base.reduce((acc, d, i) => acc + d * (base.length + 1 - i), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(n);
  const d2 = dv([...n, d1]);
  return [...n, d1, d2].join("");
}

test.describe("T969 — E425: o parceiro aprovado ativa a página pelo painel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 150_000 });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("parceiros").delete().in("user_id", ids);
    await adm().from("parceiro_solicitacoes").delete().in("user_id", ids);
    await apagarContas(ids);
  });

  for (const largura of [390, 1280] as const) {
    test(`aprovado → "Ativar minha página" → ativada, uma vez só (${largura})`, async ({ browser }) => {
      const conta = { email: `parc.t969.${largura}.${sufixo}@lab.vivanomads.test`, nome: `Paula Parceira ${largura}`, role: "tenant" as const };
      const uid = await criarConta(conta, senha);
      ids.push(uid);
      const { error } = await adm().from("parceiro_solicitacoes").insert({
        user_id: uid,
        email: conta.email,
        nome: conta.nome,
        tipo_pessoa: "pf",
        documento: cpfAleatorio(),
        categorias: ["fotografia"],
        cidades: ["Uberlândia"],
        status: "aprovada",
        origem: "site",
        // Pedido aprovado sempre tem o token do link do e-mail (parceiro_solicitacoes_aprovada_token); o painel ativa sem ele.
        token_ativacao_hash: createHash("sha256").update(randomBytes(32).toString("base64url")).digest("hex"),
        token_expira_em: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      });
      if (error) throw error;

      const page = await entrar(browser, conta.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      const aprovado = page.getByTestId("parceiro-aprovado");
      await expect(aprovado).toContainText("Sua parceria foi aprovada.", { timeout: 30_000 });
      const ativar = page.getByTestId("parceiro-ativar-painel");
      await expect(ativar).toHaveText(/Ativar minha página/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      await ativar.click();
      await expect(page).toHaveURL(/\/dashboard\/parceiro\?ativada=1$/, { timeout: 30_000 });
      await expect(page.getByTestId("parceiro-ativada")).toHaveText("Parceria ativada. Complete a página e publique quando estiver pronta.");
      await expect(page.getByTestId("parceiro-ativar-painel-erro")).toHaveCount(0);

      const { data: sol } = await adm().from("parceiro_solicitacoes").select("status").eq("user_id", uid).single();
      expect((sol as { status: string }).status).toBe("ativada");
      const { data: parc } = await adm().from("parceiros").select("id, status").eq("user_id", uid);
      expect(parc ?? [], "uma página de parceiro").toHaveLength(1);
      expect((parc as { status: string }[])[0].status, "a página nasce fora do ar").not.toBe("publicado");

      // Uso único: o botão some; nenhuma segunda página.
      await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(page.getByTestId("parceiro-ativar-painel")).toHaveCount(0);
      const { count } = await adm().from("parceiros").select("id", { count: "exact", head: true }).eq("user_id", uid);
      expect(count).toBe(1);
      await page.context().close();
    });

    test(`/parceiros: o aprovado ativa pelo formulário "Seja parceiro" (${largura})`, async ({ browser }) => {
      const conta = { email: `parc2.t969.${largura}.${sufixo}@lab.vivanomads.test`, nome: `Pietra Parceira ${largura}`, role: "tenant" as const };
      const uid = await criarConta(conta, senha);
      ids.push(uid);
      await pedidoAprovado(uid, conta);

      const page = await entrar(browser, conta.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
      const recebido = page.getByTestId("seja-parceiro-recebido");
      await expect(recebido).toContainText("Sua parceria foi aprovada. Ative a sua página aqui ou pelo link do e-mail.", { timeout: 30_000 });
      await expect(recebido).not.toContainText("Veja o e-mail com o link para ativar");
      const ativar = recebido.getByTestId("parceiro-ativar-painel");
      await ativar.scrollIntoViewIfNeeded();
      await expect(ativar).toHaveText(/Ativar minha página/);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      // Diagnóstico: quais elementos passam da borda direita (o que causa a rolagem lateral).
      const largos = await page.evaluate(() => {
        const W = window.innerWidth;
        const fora: string[] = [];
        for (const el of Array.from(document.querySelectorAll("body *"))) {
          const r = (el as HTMLElement).getBoundingClientRect();
          if (r.width === 0 || r.right <= W + 1) continue;
          const pai = el.parentElement?.getBoundingClientRect();
          if (pai && pai.right > W + 1) continue; // só o mais externo de cada ramo
          const id = (el as HTMLElement).dataset.testid ? `[data-testid=${(el as HTMLElement).dataset.testid}]` : "";
          const cls = typeof (el as HTMLElement).className === "string" ? `.${(el as HTMLElement).className.split(/\s+/).slice(0, 4).join(".")}` : "";
          fora.push(`${el.tagName.toLowerCase()}${id}${cls} → ${Math.round(r.right - W)}px "${(el.textContent ?? "").trim().slice(0, 40)}"`);
        }
        return { sobra: document.documentElement.scrollWidth - W, fora: fora.slice(0, 6) };
      });
      expect(largos.sobra, `rolagem lateral em /parceiros (aprovado): ${largos.fora.join(" | ")}`).toBeLessThanOrEqual(1);

      await ativar.click();
      await expect(page).toHaveURL(/\/dashboard\/parceiro\?ativada=1$/, { timeout: 30_000 });
      await expect(page.getByTestId("parceiro-ativada")).toHaveText("Parceria ativada. Complete a página e publique quando estiver pronta.");
      const { data: sol } = await adm().from("parceiro_solicitacoes").select("status").eq("user_id", uid).single();
      expect((sol as { status: string }).status).toBe("ativada");
      const { count } = await adm().from("parceiros").select("id", { count: "exact", head: true }).eq("user_id", uid);
      expect(count, "uma página de parceiro").toBe(1);
      await page.context().close();
    });
  }
});
