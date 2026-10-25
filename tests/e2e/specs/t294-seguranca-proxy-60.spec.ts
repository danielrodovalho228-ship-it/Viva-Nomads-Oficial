import { test, expect, type APIRequestContext } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { jpegComGps, lerMetadados } from "../fixtures/exif";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";

/*
  T294 — Prompt 60 (correção de segurança: Next 16.2.9 → 16.4.2, sharp 0.35.5). Prova de que, depois da subida:
  1) as rotas protegidas pelo proxy (src/proxy.ts) continuam negando acesso sem sessão, inclusive com os cabeçalhos
     usados nos ataques de desvio do middleware/proxy (x-middleware-subrequest, RSC, prefetch, Next-Action);
  2) a API do admin continua recusando quem não é admin (a trava é na própria rota, não no proxy);
  3) o upload de foto continua recodificando para WebP e sem EXIF nem GPS (o arquivo guardado no depósito).
*/
const PRIVADAS = ["/admin", "/admin/imoveis", "/admin/contratos", "/dashboard", "/dashboard/imoveis", "/dashboard/contratos", "/pedidos"];

const DESVIOS: Record<string, string>[] = [
  {},
  { "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware" },
  { "x-middleware-subrequest": "src/proxy:src/proxy:src/proxy:src/proxy:src/proxy" },
  { "x-middleware-subrequest": "proxy:proxy:proxy:proxy:proxy" },
  { RSC: "1" },
  { RSC: "1", "Next-Router-Prefetch": "1" },
  { "Next-Router-Prefetch": "1", Purpose: "prefetch" },
  { "Next-Action": "0".repeat(40) },
  { "x-nextjs-data": "1" },
];

const API_ADMIN: { metodo: "get" | "post"; rota: string }[] = [
  { metodo: "get", rota: "/api/admin/aprovacoes" },
  { metodo: "get", rota: "/api/admin/agentes/memoria" },
  { metodo: "get", rota: "/api/admin/agentes/anexos" },
  { metodo: "post", rota: "/api/admin/agentes/executar" },
  { metodo: "post", rota: "/api/admin/agentes/chat" },
  { metodo: "post", rota: "/api/admin/ia-diagnostico" },
];

/** A resposta não pode entregar a página privada: ou manda para o login, ou recusa. */
async function negado(request: APIRequestContext, rota: string, headers: Record<string, string>) {
  const r = await request.get(rota, { headers, maxRedirects: 0, failOnStatusCode: false });
  const s = r.status();
  const destino = r.headers()["location"] ?? "";
  const ok = (s >= 300 && s < 400 && /\/auth(\?|$)/.test(destino)) || s === 401 || s === 403 || s === 404;
  return { ok, detalhe: `${rota} ${JSON.stringify(headers)} → ${s} ${destino}` };
}

test.describe("T294 — proxy e uploads depois da subida do Next (Prompt 60)", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium", "só chromium"));

  test.describe("visitante", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("rotas protegidas mandam para o login, com ou sem cabeçalho de desvio", async ({ request }) => {
      const falhas: string[] = [];
      for (const rota of PRIVADAS)
        for (const h of DESVIOS) {
          const n = await negado(request, rota, h);
          if (!n.ok) falhas.push(n.detalhe);
        }
      expect(falhas, falhas.join("\n")).toEqual([]);
    });

    test("caminhos disfarçados do admin não abrem a área sem sessão", async ({ request }) => {
      const falhas: string[] = [];
      for (const rota of ["/admin/", "/admin//imoveis", "/admin/./imoveis", "/%61dmin", "/admin%2Fimoveis", "/dashboard/", "/dashboard%2Fimoveis"]) {
        const r = await request.get(rota, { maxRedirects: 5, failOnStatusCode: false });
        const final = new URL(r.url()).pathname;
        if (r.status() === 200 && /^\/(admin|dashboard)/.test(decodeURIComponent(final))) falhas.push(`${rota} → 200 em ${final}`);
      }
      expect(falhas, falhas.join("\n")).toEqual([]);
    });

    test("API do admin recusa sem sessão (401/403), também com x-middleware-subrequest", async ({ request }) => {
      const falhas: string[] = [];
      for (const { metodo, rota } of API_ADMIN)
        for (const headers of [{}, { "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware" }] as Record<string, string>[]) {
          const r = await request[metodo](rota, { headers, data: metodo === "post" ? {} : undefined, maxRedirects: 0, failOnStatusCode: false });
          if (![401, 403].includes(r.status())) falhas.push(`${metodo.toUpperCase()} ${rota} ${JSON.stringify(headers)} → ${r.status()}`);
        }
      expect(falhas, falhas.join("\n")).toEqual([]);
    });

    test("upload de foto sem sessão: 401", async ({ request }) => {
      const r = await request.post("/api/upload/foto", { multipart: { file: { name: "a.jpg", mimeType: "image/jpeg", buffer: await jpegComGps(1) } } });
      expect(r.status()).toBe(401);
    });
  });

  test.describe("morador logado (não é admin)", () => {
    test.use({ storageState: authFile("inquilino") });

    test("não entra no /admin e a API do admin recusa (403)", async ({ page, request }) => {
      // Não-admin: o proxy reescreve para a página 404 (src/proxy.ts) e a URL continua /admin; vale o status.
      const resp = await page.goto("/admin");
      expect(resp?.status()).toBe(404);
      for (const { metodo, rota } of API_ADMIN) {
        const r = await request[metodo](rota, { data: metodo === "post" ? {} : undefined, failOnStatusCode: false });
        expect([401, 403], `${metodo.toUpperCase()} ${rota}`).toContain(r.status());
      }
    });
  });

  test.describe("proprietário logado", () => {
    test.use({ storageState: authFile("proprietario") });

    test("foto com EXIF e GPS vira WebP e o arquivo guardado sai sem EXIF nem GPS", async ({ request }) => {
      const entrada = await jpegComGps(60);
      const antes = lerMetadados(entrada);
      expect(antes.exif && antes.gps, "pré-condição: a foto de teste tem EXIF e GPS").toBe(true);
      const r = await request.post("/api/upload/foto", { multipart: { file: { name: "celular.jpg", mimeType: "image/jpeg", buffer: entrada } } });
      expect(r.status()).toBe(200);
      const { path } = (await r.json()) as { path: string };
      expect(path).toMatch(/\.webp$/);
      test.skip(!NO_LABORATORIO, "A leitura do depósito só roda no laboratório.");
      const { data, error } = await adm().storage.from("property-photos").download(path);
      expect(error, error?.message).toBeNull();
      const m = lerMetadados(Buffer.from(await data!.arrayBuffer()));
      expect(m).toMatchObject({ formato: "webp", exif: false, gps: false });
      await adm().storage.from("property-photos").remove([path]);
    });
  });
});
