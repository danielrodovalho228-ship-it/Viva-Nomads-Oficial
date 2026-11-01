import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T934 — #2021 (Pista A, varredura 01/11): no formulário de avaliação, as estrelas vazias (o próprio controle da nota)
  eram sage-200 sobre branco (1,25:1; controle gráfico pede 3:1) e passaram a contorno sage (~5:1); a marcada ganha
  contorno champagne-600 além do preenchimento. Na tela de verdade: morador com estadia encerrada ontem
  (encerrado_sem_renovacao, janela de avaliação aberta) abre "Avaliar o proprietário" em Locações, a 390 e a 1280 px:
   - as 5 estrelas vazias têm contorno (stroke) com contraste ≥ 3:1 contra o fundo;
   - depois de escolher 3 estrelas, as 3 marcadas têm preenchimento e contorno ≥ 3:1 e as 2 vazias seguem ≥ 3:1.
  Nada é enviado (só escolhe a nota). Massa própria, apagada no fim.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const emails = { dono: `dono.t934.${sufixo}@lab.vivanomads.test`, inq: `inq.t934.${sufixo}@lab.vivanomads.test` };
const ids: { dono?: string; inq?: string; contrato?: string } = {};
const somar = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

test.describe("T934 — #2021: estrelas do formulário de avaliação visíveis (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta({ email: emails.dono, nome: "Dora Estrelas", role: "owner" }, senha);
    ids.inq = await criarConta({ email: emails.inq, nome: "Ivo Estrelas", role: "tenant" }, senha);
    const imovel = await criarImovelPronto(ids.dono, `Studio estrelas t934 ${sufixo}`, { ativo: true, preco: 3200 });
    const lead = await criarLead(ids.dono, ids.inq, imovel, true);
    const agora = new Date().toISOString();
    const fim = somar(hojeBRT(), -1);
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({ property_id: imovel, tenant_id: ids.inq, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, capacidade_snapshot: 3, status: "encerrado_sem_renovacao", encerrado_em: new Date(Date.now() - 86_400_000).toISOString(), garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio: somar(fim, -59), fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora });
    if (eb) throw eb;
  });
  test.afterAll(async () => {
    if (ids.contrato) {
      for (const t of ["avaliacoes", "contrato_eventos", "contrato_blocos"]) await adm().from(t).delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [390, 1280] as const) {
    test(`Locações @${largura}: estrelas vazias e marcadas com contraste ≥ 3:1`, async ({ browser }) => {
      const page = await entrar(browser, emails.inq, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/locacoes#avaliar-${ids.contrato}`, { waitUntil: "domcontentloaded" });
      const bloco = page.locator(`[id="avaliar-${ids.contrato}"]`);
      await expect(bloco).toBeAttached({ timeout: 30_000 });
      await bloco.scrollIntoViewIfNeeded();
      await bloco.getByRole("button", { name: /Avaliar/ }).first().click();
      const grupo = bloco.getByRole("radiogroup", { name: "Nota de 1 a 5" });
      await expect(grupo).toBeVisible();
      const medir = () =>
        grupo.locator("svg").evaluateAll((svgs) => {
          const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
          const lum = ([r, g, b]: number[]) => {
            const f = (v: number) => {
              const s = v / 255;
              return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          const razao = (x: string, y: string) => {
            const [a, b] = [lum(rgb(x)), lum(rgb(y))].sort((p, q) => q - p);
            return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
          };
          const fundo = (e: Element | null): string => {
            for (let x = e; x; x = x.parentElement) {
              const c = getComputedStyle(x).backgroundColor;
              const v = rgb(c);
              if (v.length >= 3 && (v.length < 4 || v[3] > 0.9)) return c;
            }
            return "rgb(255, 255, 255)";
          };
          return svgs.map((s) => {
            const cs = getComputedStyle(s);
            const bg = fundo(s.parentElement);
            const preenchida = cs.fill !== "none" && !/rgba\(0, 0, 0, 0\)/.test(cs.fill);
            return { contorno: cs.stroke, preenchimento: cs.fill, bg, preenchida, razaoContorno: razao(cs.stroke, bg) };
          });
        });
      const vazias = await medir();
      console.log(`t934|${largura}|vazias|${JSON.stringify(vazias)}`);
      expect(vazias).toHaveLength(5);
      for (const [i, m] of vazias.entries()) {
        expect(m.preenchida, `estrela ${i + 1}: vazia antes da nota`).toBe(false);
        expect(m.razaoContorno, `estrela ${i + 1} vazia: contorno ${m.contorno} sobre ${m.bg}`).toBeGreaterThanOrEqual(3);
      }
      await grupo.getByRole("radio", { name: "3 estrelas" }).click();
      await page.mouse.move(0, 0);
      await expect(grupo.getByRole("radio", { name: "3 estrelas" })).toHaveAttribute("aria-checked", "true");
      const marcadas = await medir();
      console.log(`t934|${largura}|3-estrelas|${JSON.stringify(marcadas)}`);
      for (const [i, m] of marcadas.entries()) {
        expect(m.preenchida, `estrela ${i + 1}: ${i < 3 ? "marcada" : "vazia"}`).toBe(i < 3);
        expect(m.razaoContorno, `estrela ${i + 1}: contorno ${m.contorno} sobre ${m.bg}`).toBeGreaterThanOrEqual(3);
      }
      await bloco.screenshot({ path: `${SAIDA}/t934-estrelas-${largura}.png` });
      await page.context().close();
    });
  }
});
