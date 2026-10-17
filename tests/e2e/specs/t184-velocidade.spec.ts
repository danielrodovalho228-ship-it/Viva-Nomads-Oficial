import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/*
  T184 — VELOCIDADE (LCP e CLS) da home, da /buscar e do anúncio /imoveis/ube-001, visitante sem cookie.
   • 390x844 com CPU 4x mais lenta e rede "4G rápido" (150 ms de latência, ~1,6 Mbps de descida,
     ~750 kbps de subida), pelo protocolo do Chrome (CDP);
   • 1280x900 sem limitação.
  LCP e CLS medidos com PerformanceObserver injetado antes da página (buffered: true); deslocamento com
  entrada recente do usuário (hadRecentInput) não conta. Espera o "load" e mais 3 s, e lê o último LCP.
  Limites do Google para "bom": LCP ≤ 2500 ms e CLS ≤ 0,1.
  Os números medidos vão para tests/laboratorio/saida/t184-velocidade.json e para o relatório (anexo), para
  o PR citar valores reais. Nenhum número é escrito à mão aqui.
*/
const ROTAS = ["/", "/buscar", "/imoveis/ube-001"];
const LCP_MAX_MS = 2500;
const CLS_MAX = 0.1;
const ARQUIVO = path.join("tests", "laboratorio", "saida", "t184-velocidade.json");

const CENARIOS = [
  { nome: "390-4g-cpu4x", largura: 390, altura: 844, limitado: true },
  { nome: "1280-sem-limite", largura: 1280, altura: 900, limitado: false },
] as const;

type Medida = { rota: string; cenario: string; lcpMs: number | null; lcpElemento: string | null; cls: number; medidoEm: string };

/** Junta a medida no JSON de saída (um arquivo para as 6 combinações; os testes podem rodar em paralelo). */
function gravar(m: Medida) {
  mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  let atual: { limites: { lcpMs: number; cls: number }; medidas: Medida[] } = { limites: { lcpMs: LCP_MAX_MS, cls: CLS_MAX }, medidas: [] };
  try {
    atual = JSON.parse(readFileSync(ARQUIVO, "utf8"));
  } catch {
    /* primeira medida da rodada */
  }
  atual.limites = { lcpMs: LCP_MAX_MS, cls: CLS_MAX };
  atual.medidas = [...(atual.medidas ?? []).filter((x) => !(x.rota === m.rota && x.cenario === m.cenario)), m];
  writeFileSync(ARQUIVO, JSON.stringify(atual, null, 2) + "\n");
}

test.use({ storageState: { cookies: [], origins: [] } });
// Uma medida por vez, no mesmo worker: testes em paralelo disputariam a CPU (números piores que os reais) e o
// mesmo JSON. "default" mantém a ordem sem pular as seguintes quando uma medida passa do limite.
test.describe.configure({ mode: "default" });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium", "CDP (limitação de CPU e rede) só no Chromium do projeto do site");
});

for (const c of CENARIOS) {
  for (const rota of ROTAS) {
    test(`${rota} a ${c.largura}px${c.limitado ? " (4G rápido, CPU 4x)" : ""}: LCP ≤ ${LCP_MAX_MS} ms e CLS ≤ ${CLS_MAX}`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: c.largura, height: c.altura });

      await page.addInitScript(() => {
        const w = window as unknown as { __vel: { lcp: number | null; lcpEl: string | null; cls: number } };
        w.__vel = { lcp: null, lcpEl: null, cls: 0 };
        new PerformanceObserver((lista) => {
          const e = lista.getEntries();
          const ultimo = e[e.length - 1] as PerformanceEntry & { element?: Element | null };
          w.__vel.lcp = ultimo.startTime;
          const el = ultimo.element;
          w.__vel.lcpEl = el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.getAttribute("data-testid") ? `[data-testid=${el.getAttribute("data-testid")}]` : ""}` : null;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((lista) => {
          for (const e of lista.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
            if (!e.hadRecentInput) w.__vel.cls += e.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });

      if (c.limitado) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await cdp.send("Network.enable");
        await cdp.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: 150,
          downloadThroughput: (1.6 * 1024 * 1024) / 8, // ~1,6 Mbps em bytes/s
          uploadThroughput: (750 * 1024) / 8, // ~750 kbps em bytes/s
        });
      }

      const resp = await page.goto(rota, { waitUntil: "load", timeout: 90_000 });
      expect(resp?.status(), `${rota} responde 200`).toBe(200);
      await page.waitForTimeout(3_000); // assentar: imagens tardias e deslocamentos depois do load

      const v = await page.evaluate(() => (window as unknown as { __vel: { lcp: number | null; lcpEl: string | null; cls: number } }).__vel);
      const medida: Medida = {
        rota,
        cenario: c.nome,
        lcpMs: v.lcp === null ? null : Math.round(v.lcp),
        lcpElemento: v.lcpEl,
        cls: Math.round(v.cls * 10_000) / 10_000,
        medidoEm: new Date().toISOString(),
      };
      gravar(medida);
      await testInfo.attach(`t184-${c.nome}-${rota === "/" ? "home" : rota.replace(/^\//, "").replace(/\//g, "_")}.json`, {
        body: JSON.stringify(medida, null, 2),
        contentType: "application/json",
      });

      expect(medida.lcpMs, `${rota} (${c.nome}): o navegador não registrou LCP`).not.toBeNull();
      expect.soft(medida.lcpMs!, `LCP de ${rota} (${c.nome}) — elemento ${medida.lcpElemento ?? "?"}`).toBeLessThanOrEqual(LCP_MAX_MS);
      expect.soft(medida.cls, `CLS de ${rota} (${c.nome})`).toBeLessThanOrEqual(CLS_MAX);
    });
  }
}
