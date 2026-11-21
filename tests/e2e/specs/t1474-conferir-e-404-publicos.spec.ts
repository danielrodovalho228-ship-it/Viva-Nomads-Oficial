import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";

/*
  T1474 — TESTE PROPOSTO PELA QA (rodada 03:35, 08/11): três respostas públicas que a Pista QA provou ao vivo e que viram
  teste determinístico. Visitante, sem login.
    - /conferir/{código inexistente} diz "Nenhum documento com este código";
    - /conferir/{código de documento de teste} mostra "Documento de teste" (a faixa data-testid="conferir-teste");
    - /parceiros/{inexistente} e /avaliadores/{inexistente} respondem 404.
  O caso "/avaliadores/{suspenso}" fica de fora: precisa de um avaliador suspenso na massa (pendência registrada no relatório).
  O código de teste vem de um documento que já existe no laboratório; sem nenhum, o caso se declara pulado (não passa em falso).
*/
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("T1474 — /conferir e 404 públicos (visitante)", () => {
  test("código inexistente: 'Nenhum documento com este código'", async ({ page }) => {
    await page.goto("/conferir/0123456789abcdef0123456789abcdef");
    await expect(page.getByText(/Nenhum documento com este código/)).toBeVisible();
  });

  test("código de documento de teste: 'Documento de teste'", async ({ page }) => {
    test.skip(!NO_LABORATORIO, "precisa do banco do laboratório");
    const { data } = await adm().from("documentos_fiscais").select("codigo_verificacao").limit(200);
    let codigo: string | null = null;
    for (const l of (data ?? []) as { codigo_verificacao?: string }[]) {
      if (!l.codigo_verificacao) continue;
      const r = await adm().rpc("conferir_documento", { p_codigo: l.codigo_verificacao });
      const linha = (Array.isArray(r.data) ? r.data[0] : r.data) as { is_teste?: boolean; status?: string } | null | undefined;
      if (linha?.is_teste && linha.status === "valido") {
        codigo = l.codigo_verificacao;
        break;
      }
    }
    test.skip(!codigo, "o laboratório não tem documento de teste válido para conferir");
    await page.goto(`/conferir/${codigo}`);
    await expect(page.getByTestId("conferir-teste")).toBeVisible();
    await expect(page.getByText(/Documento de teste/)).toBeVisible();
  });

  for (const rota of ["/parceiros/slug-que-nao-existe-t1474", "/avaliadores/999999999"]) {
    test(`${rota} responde 404`, async ({ page }) => {
      const r = await page.goto(rota);
      expect(r?.status()).toBe(404);
    });
  }
});
