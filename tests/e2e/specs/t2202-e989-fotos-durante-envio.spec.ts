import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2202 — E989 @E989: soltar fotos DURANTE um envio não apaga o lote anterior. Antes, cada envio fechava sobre a
  galeria do começo: o 2º lote (solto enquanto o 1º subia) terminava com "galeria antiga + lote 2" e sobrescrevia o
  lote 1. Rascunho vazio no passo Fotos → 3 fotos pelo botão → com o envio em andamento (upload atrasado de propósito),
  solta mais 2 na galeria → no fim, as 5 estão na galeria e no rascunho. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2202.${sufixo}@lab.vivanomads.test`, nome: "Lia Lotes", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const arq = (n: string) => `public/images/imoveis/ube/ube-001-${n}.webp`;
const LOTE1 = ["sala", "quarto-1", "cozinha"].map(arq);
const LOTE2 = ["banheiro", "varanda"].map(arq);

test.describe("T2202 — E989: o 2º lote solto durante o envio não apaga o 1º", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Rascunho das fotos ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px — 3 fotos + 2 soltas durante o envio = 5 na galeria e no rascunho`, async ({ browser }) => {
      await adm().from("properties").update({ status: "draft", draft_data: { title: `Rascunho das fotos ${sufixo}`, propertyType: "apartamento", city: "Uberlândia", uf: "MG", photos: [], step: 1 } }).eq("id", ids.imovel!);
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: 900 });
      // O envio ao armazenamento fica lento de propósito: o 2º lote cai com o 1º ainda subindo.
      await p.route("**/storage/v1/object/**", async (r) => {
        await new Promise((ok) => setTimeout(ok, 2500));
        await r.continue();
      });
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=fotos`, { waitUntil: "domcontentloaded" });
      const galeria = p.getByTestId("fotos-galeria").first();
      await expect(galeria).toBeVisible({ timeout: 30_000 });
      await p.getByTestId("fotos-input").first().setInputFiles(LOTE1);
      await expect(p.getByTestId("fotos-adicionar").first()).toContainText(/Enviando|Conferindo/, { timeout: 10_000 });
      // Solta o 2º lote na galeria enquanto o 1º sobe.
      const arquivos = LOTE2.map((c) => ({ nome: c.split("/").pop()!, b64: readFileSync(c).toString("base64") }));
      const dt = await p.evaluateHandle((lista) => {
        const d = new DataTransfer();
        for (const a of lista) d.items.add(new File([Uint8Array.from(atob(a.b64), (ch) => ch.charCodeAt(0))], a.nome, { type: "image/webp" }));
        return d;
      }, arquivos);
      await galeria.dispatchEvent("dragover", { dataTransfer: dt });
      await galeria.dispatchEvent("drop", { dataTransfer: dt });
      await expect(p.getByText(/^5\/\d+ fotos/)).toBeVisible({ timeout: 120_000 });
      await expect
        .poll(async () => (((await adm().from("properties").select("draft_data").eq("id", ids.imovel!).single()).data?.draft_data as { photos?: unknown[] } | null)?.photos ?? []).length, { timeout: 30_000 })
        .toBe(5);
      await p.screenshot({ path: `docs/capturas/e989/preview-e989-fotos-${largura}.png` });
      await p.context().close();
    });
  }
});
