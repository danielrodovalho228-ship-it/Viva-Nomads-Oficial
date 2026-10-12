import { test, expect } from "@playwright/test";

/**
 * T41 — Segurança vista de FORA (sem login, sem env): cabeçalhos, portões,
 * APIs privadas, open redirect e vazamento de detalhes em erro.
 * Ordem 2567f1af (LAB 1/2, parte C). Não grava nada: só GET/POST recusados.
 */
const PAGINAS_PUBLICAS = ["/", "/buscar", "/precos", "/como-funciona", "/auth"];

test.describe("T41 cabeçalhos de segurança @seguranca", () => {
  for (const rota of PAGINAS_PUBLICAS) {
    test(`${rota}: HSTS, nosniff, frame, referrer e CSP`, async ({ request }) => {
      const r = await request.get(rota);
      expect(r.status(), rota).toBeLessThan(500);
      const h = r.headers();
      expect(h["strict-transport-security"]).toMatch(/max-age=\d{7,}/);
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      // CSP: enforçada OU em modo observação (hoje Report-Only — ver achado no PR).
      const csp = h["content-security-policy"] ?? h["content-security-policy-report-only"];
      expect(csp, "sem CSP").toBeTruthy();
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
    });
  }

  test("CSP está ENFORÇADA (não só Report-Only)", async ({ request }) => {
    // Falha conhecida: a CSP ainda roda em Report-Only (next.config.ts). Quando
    // for promovida, este teste passa e o `test.fail` abaixo avisa para removê-lo.
    test.fail(true, "CSP ainda em Report-Only — promover depois de observar as violações");
    const r = await request.get("/");
    expect(r.headers()["content-security-policy"]).toBeTruthy();
  });
});

test.describe("T41 portões sem login @seguranca", () => {
  const PRIVADAS = [
    "/dashboard",
    "/dashboard/imoveis",
    "/dashboard/mensagens",
    "/dashboard/contratos",
    "/dashboard/conta",
    "/dashboard/carteira",
    "/qualificar",
    "/pedidos",
    "/admin",
    "/admin/documentos",
    "/admin/financeiro",
    "/admin/agentes",
  ];
  for (const rota of PRIVADAS) {
    test(`${rota} sem login manda para /auth`, async ({ request }) => {
      const r = await request.get(rota, { maxRedirects: 0 });
      expect([301, 302, 303, 307, 308], `${rota} → ${r.status()}`).toContain(r.status());
      expect(r.headers()["location"] ?? "").toContain("/auth");
    });
  }

  for (const rota of ["/decisao", "/modelodenegocio", "/roi", "/socios", "/tributario"]) {
    test(`${rota} (interna dos sócios) sem código não abre`, async ({ request }) => {
      const r = await request.get(rota, { maxRedirects: 0 });
      expect([301, 302, 303, 307, 308]).toContain(r.status());
      expect(r.headers()["location"] ?? "").toContain("/acesso-socios");
    });
  }
});

test.describe("T41 APIs privadas sem login @seguranca", () => {
  const NEGADAS_POST = [
    "/api/admin/aprovacoes",
    "/api/admin/agentes/chat",
    "/api/admin/agentes/executar",
    "/api/admin/agentes/memoria",
    "/api/admin/agentes/reuniao",
    "/api/upload/documento",
    "/api/upload/inquilino-doc",
    "/api/ai/anuncio",
    "/api/caf/verify",
    "/api/assinatura",
    "/api/contrato",
    "/api/comissao",
  ];
  for (const rota of NEGADAS_POST) {
    test(`POST ${rota} é negado`, async ({ request }) => {
      const r = await request.post(rota, { data: {} });
      expect([401, 403], `${rota} → ${r.status()}`).toContain(r.status());
    });
  }

  test("GET /api/documentos/<id> de outro é negado", async ({ request }) => {
    const r = await request.get("/api/documentos/00000000-0000-0000-0000-000000000000");
    expect([401, 403, 404]).toContain(r.status());
  });

  test("GET /api/properties/mine sem login não devolve imóvel nenhum", async ({ request }) => {
    const r = await request.get("/api/properties/mine");
    expect(r.status()).toBeLessThan(500);
    const j = (await r.json().catch(() => ({}))) as { properties?: unknown[] };
    expect(j.properties ?? []).toHaveLength(0);
  });

  for (const rota of ["/api/test-email?to=a@b.co", "/api/test-lead?to=a@b.co"]) {
    test(`${rota.split("?")[0]} sem chave é bloqueada`, async ({ request }) => {
      expect((await request.get(rota)).status()).toBe(403);
    });
  }

  test("cron e webhook sem segredo não executam", async ({ request }) => {
    for (const rota of ["/api/cron/atendimento", "/api/cron/avisos-daniel", "/api/cron/resumo-pedidos"]) {
      const r = await request.get(rota);
      expect([401, 403, 405], `${rota} → ${r.status()}`).toContain(r.status());
    }
    const w = await request.post("/api/webhooks/asaas", { data: { event: "PAYMENT_RECEIVED" } });
    expect([401, 403], `webhook asaas → ${w.status()}`).toContain(w.status());
  });
});

test.describe("T41 open redirect @seguranca", () => {
  const MALICIOSOS = ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/%09/evil.example"];
  for (const alvo of MALICIOSOS) {
    test(`/auth/callback?next=${alvo} não sai do site`, async ({ request, baseURL }) => {
      const r = await request.get(`/auth/callback?next=${encodeURIComponent(alvo)}`, { maxRedirects: 0 });
      const loc = r.headers()["location"];
      if (loc) expect(new URL(loc, baseURL).origin).toBe(new URL(baseURL!).origin);
    });
    test(`/auth?redirect=${alvo} não sai do site`, async ({ page, baseURL }) => {
      await page.goto(`/auth?redirect=${encodeURIComponent(alvo)}`);
      expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
    });
  }
});

test.describe("T41 erros sem detalhe interno @seguranca", () => {
  const VAZAMENTOS = /(stack|at \S+ \(|node_modules|supabase\.co|postgres|SQLSTATE|relation ".*" does not exist|service_role|\.next\/)/i;

  test("404 não mostra stack nem host", async ({ request }) => {
    const r = await request.get("/pagina-que-nao-existe-" + Date.now());
    expect(r.status()).toBe(404);
    expect(await r.text()).not.toMatch(VAZAMENTOS);
  });

  test("filtro PostgREST malicioso em /buscar não gera 500 nem vaza SQL", async ({ request }) => {
    for (const q of ["cidade=a'%20or%201=1--", "q=%22);drop%20table%20properties;--", "bairro=*,profiles(*)", "preco_max=abc"]) {
      const r = await request.get(`/buscar?${q}`);
      expect(r.status(), q).toBeLessThan(500);
      expect(await r.text(), q).not.toMatch(VAZAMENTOS);
    }
  });

  test("API com corpo inválido responde JSON limpo", async ({ request }) => {
    const r = await request.post("/api/evento", { data: "{não é json", headers: { "content-type": "application/json" } });
    expect(r.status()).toBeLessThan(500);
    expect(await r.text()).not.toMatch(VAZAMENTOS);
  });
});
