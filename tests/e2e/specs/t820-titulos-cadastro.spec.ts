import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T820 — títulos do cadastro (02/11, Pista A): em cada etapa há um h1 só e a hierarquia não pula nível (h1 → h3 sem
  h2 no meio). Antes, Fotos, Comodidades e Regras pulavam do h1 para o h3. 390 e 1280.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t820.${sufixo}@lab.vivanomads.test`, nome: "Tito Titulos", role: "owner" as const };
const ids: Record<string, string> = {};
const ETAPAS = ["tipo", "fotos", "endereco", "detalhes", "comodidades", "regras", "descricao", "preco", "disponibilidade", "revisao"] as const;

test.describe("T820 — cadastro: hierarquia de títulos sem pulo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: um h1 por etapa e nenhum pulo de nível`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      for (const etapa of ETAPAS) {
        await p.goto(`/dashboard/imoveis/novo?etapa=${etapa}`, { waitUntil: "domcontentloaded" });
        await noPasso(p, etapa, 30_000);
        const r = await p.evaluate(() => {
          const hs = [...document.querySelectorAll("main h1, main h2, main h3, main h4, main h5, main h6")].filter((h) => !h.closest("[aria-hidden=true]"));
          const pulos: string[] = [];
          let ant = 0;
          for (const h of hs) {
            const n = Number(h.tagName[1]);
            if (ant && n > ant + 1) pulos.push(`h${ant}→h${n} ${h.textContent?.trim().slice(0, 30)}`);
            ant = n;
          }
          return { h1: hs.filter((h) => h.tagName === "H1").length, pulos };
        });
        expect(r.h1, `${etapa}: um h1`).toBe(1);
        expect(r.pulos, `${etapa}: sem pulo`).toEqual([]);
      }
      await p.context().close();
    });
  }
});
