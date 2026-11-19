import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test, expect, type Page } from "@playwright/test";
import { escutarErros } from "../fixtures/varredura";
import { MOTIVO_ARQUIVO_CANCELADO, MOTIVO_LEITURA_CANCELADA } from "../fixtures/requisicao-cancelada";

/*
  T1687 — E1009: o pedido que o próprio navegador cancela ao trocar de tela não é erro da página (critério d).
  A re-triagem de 17/11 achou a t1409 e a t1442 instáveis por causa de dois pedidos cancelados que a régua ainda contava
  como erro de console: o ícone do site (/favicon.ico) e a leitura do banco (GET em /rest/v1/profiles). A régua já
  aceitava o mesmo cancelamento para a ação do servidor, o arquivo de /_next e a leitura em /api.

  Página sintética, servida por um servidor da própria prova (nada chega ao site nem ao banco): o ícone, a leitura do
  banco e o arquivo de dados nunca respondem, então só terminam se forem cancelados. O teste prova as duas metades.
    1. Ícone e leitura do banco cancelados: nenhum erro; os dois ficam na lista de exceções do relatório.
       O ícone vai com versão no endereço (/favicon.ico?v=1): o Playwright quase nunca mostra o pedido do endereço
       exato /favicon.ico (medido: na varredura apareceu 1 vez em 30), e a prova precisa de um pedido que sempre
       aparece. A regra olha o caminho, que é o mesmo; o endereço exato está na guarda de unidade.
    2. A régua não afrouxou: escrita no banco cancelada, leitura do banco que falha por outro motivo e outro arquivo
       cancelado continuam acusados.
*/
const PAGINA = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><main>prova</main></body></html>`;

let servidor: Server;
let base = "";
let portaFechada = 0;

test.beforeAll(async () => {
  servidor = createServer((req, res) => {
    const caminho = new URL(req.url ?? "/", "http://x").pathname;
    if (caminho === "/prova") return void res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PAGINA);
    // /favicon.ico, /rest/v1/… e /dados.json: o servidor nunca responde.
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  // Uma porta sem ninguém ouvindo, para o erro de rede que NÃO é cancelamento.
  const outro = createServer();
  await new Promise<void>((ok) => outro.listen(0, "127.0.0.1", ok));
  portaFechada = (outro.address() as AddressInfo).port;
  await new Promise<void>((ok) => outro.close(() => ok()));
});
test.afterAll(async () => {
  servidor.closeAllConnections();
  await new Promise<void>((ok) => servidor.close(() => ok()));
});

/** Dispara o pedido na página e o cancela, como a tela faz ao sair (AbortController). */
async function pedirECancelar(page: Page, url: string, metodo = "GET"): Promise<void> {
  const pedido = page.waitForEvent("requestfailed", (r) => r.url() === url && r.method() === metodo);
  await page.evaluate(
    ([u, m]) => {
      const controle = new AbortController();
      fetch(u, { method: m, signal: controle.signal, body: m === "GET" ? undefined : "{}" }).catch(() => {});
      setTimeout(() => controle.abort(), 50);
    },
    [url, metodo] as const,
  );
  expect((await pedido).failure()?.errorText, `${metodo} ${url}`).toBe("net::ERR_ABORTED");
}

test.describe("T1687 — E1009: pedido cancelado pelo navegador não é erro da página", () => {
  test("ícone do site e leitura do banco cancelados: nenhum erro, e os dois entram na lista de exceções", async ({ page }) => {
    const erros = escutarErros(page);
    await page.goto(`${base}/prova`);
    await pedirECancelar(page, `${base}/favicon.ico?v=1`);
    await pedirECancelar(page, `${base}/rest/v1/profiles?select=papel_ativo&id=eq.123`);

    expect(erros.lista()).toEqual([]);
    expect(erros.ignorados()).toEqual(expect.arrayContaining([MOTIVO_ARQUIVO_CANCELADO, MOTIVO_LEITURA_CANCELADA]));
  });

  test("o resto continua acusado: escrita cancelada, outro arquivo cancelado e leitura que falha por outro motivo", async ({ page }) => {
    const erros = escutarErros(page);
    await page.goto(`${base}/prova`);
    await pedirECancelar(page, `${base}/rest/v1/profiles?id=eq.123`, "PATCH");
    await pedirECancelar(page, `${base}/dados.json`);
    const recusada = `http://127.0.0.1:${portaFechada}/rest/v1/profiles`;
    const falhou = page.waitForEvent("requestfailed", (r) => r.url() === recusada);
    await page.evaluate((u) => void fetch(u).catch(() => {}), recusada);
    expect((await falhou).failure()?.errorText).toBe("net::ERR_CONNECTION_REFUSED");

    expect(erros.lista().filter((t) => t.startsWith("requisição falhou"))).toEqual([
      `requisição falhou (fetch PATCH, net::ERR_ABORTED): ${base}/rest/v1/profiles`,
      `requisição falhou (fetch GET, net::ERR_ABORTED): ${base}/dados.json`,
      `requisição falhou (fetch GET, net::ERR_CONNECTION_REFUSED): ${recusada}`,
    ]);
  });
});
