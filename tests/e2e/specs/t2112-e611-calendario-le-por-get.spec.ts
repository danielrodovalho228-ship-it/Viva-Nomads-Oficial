import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2112 — E611 (Pista 3; varredura "sem spec" das 142, lote H) @E611 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E611; unitário e611-leituras-fora-da-fila.test.ts): as LEITURAS do calendário do dono (bloqueios,
  estadias e o link de exportação .ics) vão por GET a /api/imoveis/<id>/calendario?parte=…, fora da fila das Server
  Actions — o calendário e o "Carregando o link…" não esperam o autosave. A rota responde sem cache (no-store) e recusa
  a parte desconhecida com 400.
  O que se mede na tela de edição do anúncio (onde está o calendário "Fechar datas"), a 390 e 1280 px:
    - a página pede blocos e exportação por GET a essa rota, com 200, { ok: true } e cache-control no-store (se as
      leituras voltassem a ser Server Actions, esses GET não existiriam);
    - a grade do calendário aparece e o link de exportação sai do "Carregando o link…".
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2112.${sufixo}@lab.vivanomads.test`, nome: "Carla Calendario", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T2112 — E611: o calendário do dono lê por GET, sem cache, fora da fila das Server Actions @E611", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do calendário ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — editar o anúncio: blocos e exportação por GET (200, no-store); a grade e o link aparecem`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const rota = `/api/imoveis/${ids.imovel}/calendario`;
      const leituras: { parte: string; status: number; cache: string; ok: unknown }[] = [];
      p.on("response", async (r) => {
        const u = new URL(r.url());
        if (u.pathname !== rota || r.request().method() !== "GET") return;
        const j = (await r.json().catch(() => null)) as { ok?: unknown } | null;
        leituras.push({ parte: u.searchParams.get("parte") ?? "", status: r.status(), cache: r.headers()["cache-control"] ?? "", ok: j?.ok });
      });

      // A seção "Disponibilidade" da edição vem fechada; o endereço com #calendario a abre sozinha.
      await p.goto(`/dashboard/imoveis/${ids.imovel}/editar#calendario`, { waitUntil: "domcontentloaded" });
      const grade = p.getByTestId("calendario-dono-grade");
      await grade.scrollIntoViewIfNeeded({ timeout: 30_000 }).catch(() => {});
      await expect(grade, "a grade do calendário aparece").toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("exportar-calendario-link").or(p.getByTestId("exportar-calendario-indisponivel")).first(), "o link sai do Carregando").toBeVisible({ timeout: 15_000 });
      await expect(p.getByTestId("exportar-calendario")).not.toContainText("Carregando o link…");

      for (const parte of ["blocos", "exportacao"]) {
        const l = leituras.find((x) => x.parte === parte);
        expect(l, `GET ${rota}?parte=${parte} foi feito`).toBeTruthy();
        expect(l!.status, `${parte}: 200`).toBe(200);
        expect(l!.ok, `${parte}: { ok: true }`).toBe(true);
        expect(l!.cache, `${parte}: sem cache`).toContain("no-store");
      }

      // A parte desconhecida é recusada com 400, também sem cache.
      const r = await p.evaluate(async (u) => {
        const x = await fetch(`${u}?parte=nada`, { cache: "no-store" });
        return { status: x.status, cache: x.headers.get("cache-control") ?? "", json: await x.json().catch(() => null) };
      }, rota);
      expect(r.status).toBe(400);
      expect(r.cache).toContain("no-store");
      expect(r.json).toEqual({ ok: false, error: "Parte do calendário desconhecida." });
      await p.context().close();
    });
  }
});
