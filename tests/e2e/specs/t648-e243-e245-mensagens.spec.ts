import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, fotosReais, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T648 — cluster Mensagens (varredura da área do dono, 29/10):
   E243 — lista a 390: o cartão da conversa cabe na tela (antes ia a ~534 px) e os textos longos terminam em reticências.
   E244 — conversa aberta a 390: o painel fica dentro da tela (antes saía pela esquerda, com o voltar em −7 px).
   E245 — "Denunciar mensagem suspeita" aparece UMA vez, sem linhas soltas repetidas, a 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t648.${sufixo}@lab.vivanomads.test`, nome: "Helena Conversa", role: "owner" as const };
const mor = { email: `mor.t648.${sufixo}@lab.vivanomads.test`, nome: "Bruno Longo", role: "tenant" as const };
const ids: Record<string, string> = {};
const NOME_LONGO = `Studio Jardim Botânico com varanda gourmet e home office completo ${sufixo}`;
const MSG_LONGA = "Olá! Tenho interesse no studio para quatro meses a partir do mês que vem, trabalho remoto e sou bem tranquilo.";

/** Retângulos e contagens do que importa na tela de Mensagens. */
const medir = (p: Page) =>
  p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const r = (sel: string) => {
      const e = Array.from(document.querySelectorAll(sel)).find((x) => (x as HTMLElement).offsetParent !== null) as HTMLElement | undefined;
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { left: Math.round(b.left), right: Math.round(b.right) };
    };
    const denuncias = Array.from(document.querySelectorAll("[data-testid=denunciar-abrir]")).filter((x) => (x as HTMLElement).offsetParent !== null);
    // Onde cada "Denunciar" mora (a cadeia de testids até o <main>) — o diagnóstico do E245.
    const cadeias = denuncias.map((d) => {
      const c: string[] = [];
      for (let x = d.parentElement; x && x.tagName !== "MAIN"; x = x.parentElement) c.push(`${x.tagName.toLowerCase()}${x.getAttribute("data-testid") ? "#" + x.getAttribute("data-testid") : ""}`);
      return c.slice(0, 6).join(" < ");
    });
    const cortadoSemReticencia = Array.from(document.querySelectorAll("[data-testid=mensagens-conversa] span")).filter((s) => {
      const h = s as HTMLElement;
      if (h.children.length || !h.innerText.trim()) return false;
      const b = h.getBoundingClientRect();
      const passa = b.right > vw + 1;
      const cs = getComputedStyle(h);
      const reticencia = cs.textOverflow === "ellipsis" || (cs.webkitLineClamp !== "none" && cs.webkitLineClamp !== "");
      return passa || (h.scrollWidth > h.clientWidth + 1 && !reticencia);
    }).length;
    return { vw, cartao: r("[data-testid=mensagens-conversa]"), voltar: r("[aria-label='Voltar para a lista']"), nome: r("[data-testid=conversa-nome]"), denuncias: denuncias.length, cadeias, cortadoSemReticencia };
  });

test.describe("T648 — Mensagens: E243 + E244 + E245", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.mor]);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.im = await criarImovelPronto(ids.dono, NOME_LONGO, { ativo: true });
    await fotosReais(ids.im, ids.dono);
    await criarLead(ids.dono, ids.mor, ids.im, true);
    await gravarMensagem(ids.mor, ids.dono, ids.im, MSG_LONGA, conversationId(ids.mor, ids.dono, ids.im));
  });
  test.afterAll(async () => {
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.mor]);
  });

  test("390 px — lista: o cartão cabe na tela e os textos longos terminam em reticências (E243)", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("mensagens-conversa").first()).toBeVisible({ timeout: 30_000 });
    const m = await medir(p);
    console.log(`t648|lista-390|${JSON.stringify(m)}`);
    expect(m.cartao!.right, "cartão dentro da tela").toBeLessThanOrEqual(m.vw);
    expect(m.cortadoSemReticencia, "texto cortado sem reticências").toBe(0);
    await p.screenshot({ path: `${SAIDA}/t648-lista-390.png` });
    await p.context().close();
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — conversa aberta: painel dentro da tela (E244) e um só 'Denunciar' (E245)`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
      await p.getByTestId("mensagens-conversa").first().click({ timeout: 30_000 });
      await expect(p.getByTestId("conversa-nome")).toBeVisible({ timeout: 15_000 });
      await p.waitForTimeout(1500);
      const m = await medir(p);
      console.log(`t648|conversa-${largura}|${JSON.stringify(m)}`);
      if (largura === 390) {
        expect(m.voltar!.left, "voltar dentro da tela").toBeGreaterThanOrEqual(0);
        expect(m.nome!.right, "nome dentro da tela").toBeLessThanOrEqual(m.vw);
      }
      expect(m.denuncias, `'Denunciar' visível: ${JSON.stringify(m.cadeias)}`).toBe(1);
      await p.screenshot({ path: `${SAIDA}/t648-conversa-${largura}.png` });
      await p.context().close();
    });
  }
});
