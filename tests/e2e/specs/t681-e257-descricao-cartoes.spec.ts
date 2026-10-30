import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T681 — E257 (QA do Muse, 29/10): consistência da descrição dentro dos grupos de cartões dos Passos 5 e 6. Em cada
  grupo (os cartões irmãos de um mesmo contêiner; "Pronto para trabalhar" e as declarações de privacidade contam como um grupo só), ou todos têm a linha curta de descrição, ou nenhum tem; e nenhum
  cartão da grade foge do desenho (borda tracejada). Blocos opcionais abertos. 1280 e 390, com prints.
*/
const SAIDA = "tests/laboratorio/saida";

const grupos = (p: Page) =>
  p.evaluate(() => {
    const raiz = document.querySelector("main") ?? document.body;
    const porPai = new Map<Element, { com: string[]; sem: string[] }>();
    const tracejados: string[] = [];
    for (const c of Array.from(raiz.querySelectorAll("[data-cartao-assistente]"))) {
      const r = c.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const nome = (c.querySelector("span.block")?.textContent ?? "").trim().slice(0, 40);
      const temDica = !!c.querySelector("span.min-w-0 > span:nth-child(2)");
      // O grupo: o bloco "Pronto para trabalhar" inteiro (Essenciais + Opcionais), as declarações de privacidade (sem o
      // tipo de acesso, que é outro grupo) ou, no resto, os cartões irmãos do mesmo contêiner.
      const chave =
        c.closest('[data-testid="tipo-acesso"]') ??
        c.closest('[data-testid="pronto-trabalhar"]') ??
        c.closest('[data-testid="privacidade-campos"]') ??
        c.parentElement!;
      const g = porPai.get(chave) ?? { com: [], sem: [] };
      (temDica ? g.com : g.sem).push(nome);
      porPai.set(chave, g);
      if (getComputedStyle(c).borderStyle === "dashed") tracejados.push(nome);
    }
    const misturados = [...porPai.values()].filter((g) => g.com.length && g.sem.length).map((g) => `com: ${g.com.join(", ")} | sem: ${g.sem.join(", ")}`);
    return { grupos: porPai.size, misturados, tracejados };
  });

test.describe("T681 — E257: descrição dos cartões consistente em cada grupo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t681.${sufixo}@lab.vivanomads.test`, nome: "Rita Descricao", role: "owner" as const };
  const ids: Record<string, string> = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho t681 ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    for (const etapa of ["comodidades", "regras"] as const) {
      test(`${largura} px — ${etapa}: nenhum grupo mistura cartão com e sem descrição`, async ({ browser }) => {
        const p = await entrar(browser, dono.email, senha);
        await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=${etapa}`, { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("assistente-rodape")).toBeVisible({ timeout: 30_000 });
        await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        const desligados = p.locator('[data-testid^="bloco-"][data-testid$="-toggle"][aria-checked="false"]');
        for (let i = 0; i < 10 && (await desligados.count()) > 0; i++) {
          const id = await desligados.first().getAttribute("data-testid");
          await p.getByTestId(id!).evaluate((el) => el.scrollIntoView({ block: "center" }));
          await p.getByTestId(id!).click({ timeout: 10_000 });
          await expect(p.getByTestId(id!)).toHaveAttribute("aria-checked", "true", { timeout: 10_000 });
        }
        await p.waitForTimeout(500);
        const r = await grupos(p);
        console.log(`t681 ${largura} ${etapa}`, JSON.stringify(r));
        expect(r.grupos).toBeGreaterThan(1);
        expect(r.misturados, r.misturados.join("\n")).toEqual([]);
        expect(r.tracejados, `tracejados: ${r.tracejados.join(", ")}`).toEqual([]);
        if (etapa === "regras") {
          for (const t of ["Aceita crianças", "Permite fumar"]) await expect(p.getByRole("button", { name: new RegExp(t) }).first()).toBeVisible();
          await expect(p.getByText("Famílias com filhos podem pedir.")).toBeVisible();
        } else {
          await expect(p.getByTestId("cameras-externas")).toContainText("Diga onde ficam");
          await expect(p.getByTestId("trabalho-essenciais").getByText("Essencial", { exact: true })).toHaveCount(0);
        }
        await p.screenshot({ path: `${SAIDA}/t681-${etapa}-${largura}.png`, fullPage: true });
        await p.context().close();
      });
    }
  }
});
