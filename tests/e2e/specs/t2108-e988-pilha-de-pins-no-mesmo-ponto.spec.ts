import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2108 — E988 (Pista 3) @E988 @E525 — sem @ao-vivo-seguro: precisa do laboratório (cria anúncios ativos com a chave
  de serviço). É a TRAVA NOMEADA do E988 (decisão do Gerente, ronda 06:51), no lugar do t840.
  Regra decidida (E525 + E988; Gerente 06:51): pins no mesmo ponto do mapa NÃO se sobrepõem. Quando não cabem no
  quadro do mapa, a regra só se cumpre AGRUPANDO em "+N" (o Code 2 implementa; o limiar é decisão de engenharia dele,
  registada no PR do agrupamento). Nenhum anúncio some do mapa: cada um é um pin ou entra na conta de um "+N".
  Por que esta spec e não o t840 (main 851ce940b): o t840 não leva @E988; só morde a 390 px e por acaso do seed (23
  pins de R$ 3.200 juntos); a 1280 px é verde na main e no #3912.
  A pilha é montada aqui: anúncios ativos com o MESMO ponto exato, numa cidade só deles (Araguari), busca filtrada
  por ela. O ponto público é o aproximado da 0066 (±0,004°, ~450 m): ~100 px entre eles na vista enquadrada, e cada
  "Zoom out" junta-os mais (~12 px no 3º). Mede-se na vista inicial e depois de cada um de 3 "Zoom out".
  Os quatro casos (medidos com a própria afastarPins da main 851ce940b e do #3912 7e0d9525c; pins 74 × 28 px, juntos em
  3–100 px, 40 sementes):
    1. 390 px, 29 pins — cabem no quadro do celular (350 × 591): a main deixa ≥ 9 pares sobrepostos, o #3912 nenhum.
    2. 1280 px, 60 pins — quadro 560–760 × 700–800: a main deixa ≥ 16 pares, o #3912 nenhum.
    3. 390 px, 31 pins — o caso pedido pelo Gerente (DUET-1515). Na main, sempre vermelho (≥ 13 pares). No #3912:
       com a pilha toda no mesmo pixel (zoom muito afastado) os 31 cabem (0 pares, medido); nos zooms intermédios
       (pins a 12–24 px uns dos outros) às vezes sobra 1–2 pares e às vezes nenhum — depende do ponto aproximado de
       cada anúncio, que vem do id gerado em cada corrida. Por isso este caso é VERMELHO SÓ EM ALGUMAS CORRIDAS no
       #3912, e verde em todas só quando o afastamento/agrupamento resolver os zooms intermédios.
    4. 390 px, 80 pins — NÃO cabem: o quadro do celular leva ~72 pins (4 colunas × 18 linhas de 74 × 32 px). Sem
       agrupamento há sobreposição em QUALQUER corrida: no mínimo 563 pares na main e 160 no #3912 (quadros de
       350 × 591 a 390 × 700). VERMELHO DETERMINÍSTICO até o "+N" funcionar.
  Como se conta o "+N" — a marcação que o #3912 entregou (search-map.tsx, aplicarAfastamento): o "+N" é um selo
  [data-testid="pin-grupo"] com data-n, posto DENTRO do pin visível [data-testid="pin-mapa"]; os N anúncios agrupados
  ficam escondidos como [data-testid="pin-mapa-agrupado"]. Cada pin visível representa ele mesmo (1) mais o data-n do
  seu selo. (Antes do #3912 a spec previa um pin "+N" à parte, que representaria N; ajustado aqui à marcação real,
  como o próprio comentário previa, depois da 1ª prova sobre a main corrigida.)
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2108.${sufixo}@lab.vivanomads.test`, nome: "Pilar Pilha", role: "owner" as const };
const ids: { dono?: string; imoveis: string[] } = { imoveis: [] };
const CIDADE = "Araguari";
const PONTO = { lat: -18.6456, lng: -48.1934 };
/** Os quatro casos, na ordem em que a pilha cresce (29 → 31 → 60 → 80). */
const CASOS = [
  { largura: 390, pilha: 29, nota: "cabem no quadro do celular" },
  { largura: 390, pilha: 31, nota: "o caso dos 31 do Gerente, intermitente no #3912 nos zooms intermédios" },
  { largura: 1280, pilha: 60, nota: "cabem no quadro do computador" },
  { largura: 390, pilha: 80, nota: "não cabem no celular, só o agrupamento em +N cumpre" },
] as const;

async function abrirMapa(page: Page, largura: number) {
  await page.goto(`/buscar?local=${encodeURIComponent(CIDADE)}`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
  if (largura < 1024) {
    const botao = page.getByRole("button", { name: /mapa/i }).first();
    if (await botao.isVisible().catch(() => false)) await botao.click();
  }
  await expect(page.getByTestId("mapa-busca")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("pin-mapa").first()).toBeAttached({ timeout: 30_000 });
}

/** Quantos anúncios o mapa representa: o "+N" conta N, os outros pins 1 cada. */
const representados = (page: Page) =>
  page.getByTestId("pin-mapa").evaluateAll((ps) =>
    ps.reduce((n, p) => n + 1 + Number(p.querySelector<HTMLElement>('[data-testid="pin-grupo"]')?.dataset.n ?? 0), 0),
  );

/** Os pares de pins que se cobrem e os pins fora do mapa (o critério do t840). */
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

test.describe("T2108 — E988: pins no mesmo ponto não se sobrepõem; o que não cabe vira +N @E988 @E525", () => {
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
    ids.dono = await criarConta(dono, senha);
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    // A pilha sai do mapa de todos assim que a spec acaba (os anúncios vão com a conta).
    if (ids.imoveis.length) await adm().from("properties").update({ status: "paused", pausa_motivo: "admin" }).in("id", ids.imoveis);
    await apagarContas([ids.dono]);
  });

  for (const caso of CASOS) {
    test(`${caso.largura} px — ${caso.pilha} anúncios no mesmo ponto (${caso.nota}): nenhum pin sobre outro, nenhum fora do mapa, nenhum anúncio some, também depois do zoom`, async ({ browser }) => {
      await pilhaCom(caso.pilha);
      const ctx = await browser.newContext({ viewport: { width: caso.largura, height: caso.largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await abrirMapa(page, caso.largura);
      await expect.poll(() => representados(page), { timeout: 30_000, message: "o mapa representa a pilha inteira (pins + +N)" }).toBe(caso.pilha);
      await expect.poll(() => medirPins(page), { timeout: 10_000, message: "vista inicial" }).toEqual({ sobre: [], nSobre: 0, foraDoMapa: [] });

      for (const nome of ["Zoom out", "Zoom out", "Zoom out"]) {
        await page.getByRole("button", { name: nome }).click();
        await page.waitForTimeout(600);
        await expect.poll(() => medirPins(page), { timeout: 10_000, message: `depois de ${nome}` }).toEqual({ sobre: [], nSobre: 0, foraDoMapa: [] });
        await expect.poll(() => representados(page), { timeout: 10_000, message: `depois de ${nome}: nenhum anúncio some` }).toBe(caso.pilha);
      }
      await ctx.close();
    });
  }
});
