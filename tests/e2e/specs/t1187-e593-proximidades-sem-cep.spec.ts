import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1187 — E593 (#2714, 05/11): o editor de um anúncio PUBLICADO que perdeu o CEP (o draft_data é zerado ao publicar)
 * pedia /api/proximidades só com o id e levava 400 "CEP inválido" (L-99, bloco 319). Agora a API usa o ponto gravado
 * do próprio anúncio. O E593 entrou só com teste de unidade; aqui é a tela, a 390 e 1280:
 *   1. anúncio ativo do dono, sem CEP (nem no rascunho nem em cep_proximidades), com o ponto gravado (lat/lng);
 *   2. ao abrir o editor (/dashboard/imoveis/novo?id=…), a chamada a /api/proximidades responde 200, sem "CEP inválido";
 *   3. nenhum erro de console sobre proximidades ou CEP.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1187.${sufixo}@lab.vivanomads.test`, nome: "Lia Ponto", role: "owner" as const };
const ids: { dono?: string } = {};

test.describe("T1187 — E593: o editor do anúncio publicado sem CEP busca as proximidades pelo ponto gravado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`proximidades sem 400 no editor (${w})`, async ({ browser }) => {
      const imovel = await criarImovelPronto(ids.dono!, `Publicado sem CEP ${w} ${sufixo}`, { ativo: true, preco: 3200 });
      const { error } = await adm().from("properties").update({ draft_data: null, cep_proximidades: null, lat: -18.918, lng: -48.258 }).eq("id", imovel);
      if (error) throw error;

      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
        const errosConsole: string[] = [];
        p.on("console", (m) => {
          if (m.type() === "error" && /proximidades|CEP/i.test(m.text())) errosConsole.push(m.text());
        });
        const resposta = p.waitForResponse((r) => r.url().includes("/api/proximidades") && r.request().method() === "POST", { timeout: 60_000 });
        await p.goto(`/dashboard/imoveis/novo?id=${imovel}`, { waitUntil: "domcontentloaded" });
        const r = await resposta;
        const corpo = await r.text();
        expect(r.status(), `/api/proximidades: ${corpo.slice(0, 200)}`).toBe(200);
        expect(corpo).not.toContain("CEP inválido");
        expect(JSON.parse(corpo).fonte, "a origem é o ponto do anúncio (simulado no laboratório)").not.toBe("sem_cep");
        await p.waitForTimeout(1_000);
        expect(errosConsole, "sem erro de console de proximidades/CEP").toEqual([]);
      } finally {
        await ctx.close();
      }
    });
  }
});
