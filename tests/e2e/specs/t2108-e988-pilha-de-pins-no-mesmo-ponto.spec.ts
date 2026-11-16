import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2108 — E988 (Pista 3; o caso em falta do t840, ronda 06:27) @E988 @E525 — sem @ao-vivo-seguro: precisa do
  laboratório (cria anúncios ativos com a chave de serviço). TRAVA VERMELHA até o #3912 (Code 2) entrar.
  Regra decidida (E525 + E988): no mapa da busca nenhum pin fica em cima de outro, também quando MUITOS anúncios caem no
  mesmo ponto — o afastamento procura casa livre até a borda do mapa, não só nas 8 direções de 8 anéis.
  O que falta ao t840 (main 851ce940b), e esta spec cobre:
    1. o t840 não leva a etiqueta @E988 — a trava do E951 não liga o item a spec nenhuma;
    2. o t840 só morde a 390 px e só por acaso do seed (23 pins de R$ 3.200 juntos). A 1280 px ele passa na main e no
       #3912: verde dos dois lados, inútil para o E988 no computador;
    3. a pilha depende do seed do dia: se o seed mudar, o t840 deixa de morder.
  Aqui a pilha é montada pela própria spec: PILHA anúncios ativos com o MESMO ponto exato, numa cidade só deles
  (Araguari), e a busca filtrada por ela. O ponto público de cada um é o aproximado da 0066 (±0,004°, ~450 m): na vista
  enquadrada eles ficam a ~100 px uns dos outros, e cada "Zoom out" junta-os ainda mais (a ~12 px no 3º).
  O tamanho da pilha foi medido com a própria afastarPins (main 851ce940b × #3912 7e0d9525c), pins 74 × 28 px juntos
  em 12–100 px, 5 sementes, nos quadros do mapa:
    - 390 px (350 × 591 e 358 × 560): com 29 pins a main deixa ≥ 9 pares sobrepostos e o #3912 nenhum. A partir de 31
      o #3912 também deixa (o quadro do celular acaba — a Dúvida do próprio #3912), por isso 29 e não mais;
    - 1280 px (560–760 × 700–800): com 60 pins a main deixa ≥ 16 pares e o #3912 nenhum.
  A 390 px a pilha tem 29; antes do teste de 1280 px ela cresce para 60. Mede-se na vista inicial e depois de cada um
  de 3 "Zoom out".
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2108.${sufixo}@lab.vivanomads.test`, nome: "Pilar Pilha", role: "owner" as const };
const ids: { dono?: string; imoveis: string[] } = { imoveis: [] };
/** Pins da pilha em cada largura (ver a conta acima). */
const PILHA: Record<390 | 1280, number> = { 390: 29, 1280: 60 };
const CIDADE = "Araguari";
const PONTO = { lat: -18.6456, lng: -48.1934 };

async function abrirMapa(page: Page, largura: 390 | 1280) {
  await page.goto(`/buscar?local=${encodeURIComponent(CIDADE)}`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
  if (largura < 1024) {
    const botao = page.getByRole("button", { name: /mapa/i }).first();
    if (await botao.isVisible().catch(() => false)) await botao.click();
  }
  await expect(page.getByTestId("mapa-busca")).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => page.getByTestId("pin-mapa").count(), { timeout: 30_000, message: "a pilha inteira no mapa" }).toBe(PILHA[largura]);
}

/** Os pares de pins que se cobrem e os pins fora do mapa (o mesmo critério do t840). */
const medirPins = (page: Page) =>
  page.evaluate(() => {
    const m = document.querySelector('[data-testid="mapa-busca"]')!.getBoundingClientRect();
    const pins = [...document.querySelectorAll<HTMLElement>('[data-testid="pin-mapa"]')].map((e, i) => ({ t: `${i}:${e.textContent!.trim()}`, r: e.getBoundingClientRect() }));
    const sobre: string[] = [];
    for (let i = 0; i < pins.length; i++)
      for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i].r, b = pins[j].r;
        if (!(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)) sobre.push(`${pins[i].t}×${pins[j].t}`);
      }
    const foraDoMapa = pins.filter(({ r }) => r.left < m.left - 1 || r.right > m.right + 1).map((p) => p.t);
    return { sobre: sobre.slice(0, 5), nSobre: sobre.length, foraDoMapa };
  });

test.describe("T2108 — E988: uma pilha de anúncios no mesmo ponto não deixa pin sobre pin @E988 @E525", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  /** Cresce a pilha até `n` anúncios ativos, todos no MESMO ponto exato e na cidade só deles. */
  async function pilhaCom(n: number) {
    while (ids.imoveis.length < n) {
      const i = ids.imoveis.length;
      // Em lotes de 6 (cada anúncio sobe 8 fotos).
      const lote = await Promise.all(
        Array.from({ length: Math.min(6, n - i) }, (_, k) => criarImovelPronto(ids.dono!, `Pilha ${CIDADE} ${sufixo} ${i + k + 1}`, { ativo: true, preco: 3000 + ((i + k) % 7) * 100 })),
      );
      // O gatilho da 0066 tira o aproximado de cada um a partir do mesmo ponto.
      const { error } = await adm().from("properties").update({ city: CIDADE, state: "MG", lat: PONTO.lat, lng: PONTO.lng }).in("id", lote);
      if (error) throw error;
      ids.imoveis.push(...lote);
    }
  }

  test.beforeAll(async () => {
    test.setTimeout(300_000);
    ids.dono = await criarConta(dono, senha);
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    // A pilha sai do mapa de todos assim que a spec acaba (os anúncios vão com a conta).
    if (ids.imoveis.length) await adm().from("properties").update({ status: "paused", pausa_motivo: "admin" }).in("id", ids.imoveis);
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — ${PILHA[largura]} pins no mesmo ponto: nenhum sobre outro, nenhum fora do mapa, também depois do zoom`, async ({ browser }) => {
      await pilhaCom(PILHA[largura]);
      const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await abrirMapa(page, largura);
      await expect.poll(() => medirPins(page), { timeout: 10_000, message: "vista inicial" }).toEqual({ sobre: [], nSobre: 0, foraDoMapa: [] });

      for (const nome of ["Zoom out", "Zoom out", "Zoom out"]) {
        await page.getByRole("button", { name: nome }).click();
        await page.waitForTimeout(600);
        await expect.poll(() => medirPins(page), { timeout: 10_000, message: `depois de ${nome}` }).toEqual({ sobre: [], nSobre: 0, foraDoMapa: [] });
      }
      await ctx.close();
    });
  }
});
