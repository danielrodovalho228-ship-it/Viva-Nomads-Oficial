import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";

/*
  T2149 — E331 @E331: em Admin → Documentos → Emitidos, dois contratos DIFERENTES com o mesmo número público não parecem
  a mesma emissão: cada linha mostra o seu "Registro nº" (registro_seq, único).
  Regra decidida (E331; unitários src/lib/contratos/numero-contrato-unico.test.ts e e543-numero-no-dado.test.ts): o número
  público do contrato é VN-CT- + os 8 primeiros hex do id. A massa 0268 deu a dois contratos ids com o mesmo começo, e a
  lista mostrava "VN-CT-A0268B00" duas vezes, sem nada que as distinguisse. A 0301 impede contrato NOVO com número repetido,
  mas o registro guarda os que já existem; por isso a lista leva o nº único do registro em cada linha.
  A semente: o gatilho da 0301 não deixa o lab criar a colisão por contratos, mas o registro aceita-a (o índice único de
  número/versão exclui o VN-CT, 0201). A chave de serviço grava duas emissões VN-CT de teste com o MESMO número e ref_id
  diferentes — o estado de produção da 0268. O registro é imutável (não se apaga): as duas linhas ficam no banco do lab,
  marcadas como teste. 390 e 1280 px.
*/
const hex = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
const NUMERO = `VN-CT-2149${hex}`;
const seqs: number[] = [];

test.describe("T2149 — E331: dois contratos com o mesmo número aparecem como duas emissões, cada uma com o seu Registro nº @E331", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (chave de serviço e admin com 2FA).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ storageState: authFile("admin") });

  test.beforeAll(async () => {
    const { data, error } = await adm()
      .from("documentos_registro")
      .insert([randomUUID(), randomUUID()].map((ref) => ({ prefixo: "VN-CT", numero: NUMERO, tipo: "contrato", ref_tabela: "contratos", ref_id: ref, is_teste: true })))
      .select("registro_seq");
    if (error) throw error;
    for (const l of (data ?? []) as { registro_seq: number }[]) seqs.push(Number(l.registro_seq));
    expect(seqs, "a semente: duas emissões com o mesmo número").toHaveLength(2);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — as duas emissões ${"VN-CT-2149…"} aparecem, cada uma com o seu Registro nº, e os dois são diferentes`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/admin/documentos?aba=emitidos&tipo=VN-CT", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("documentos-aba-emitidos")).toHaveAttribute("aria-current", "page", { timeout: 30_000 });

      const linhas = page.getByTestId("emitido").filter({ has: page.getByTestId("emitido-numero").getByText(NUMERO, { exact: true }) });
      await expect(linhas, "as duas emissões com o mesmo número estão na lista").toHaveCount(2, { timeout: 30_000 });

      const registros = (await linhas.getByTestId("emitido-registro").allInnerTexts()).map((t) => t.trim());
      expect(registros, "cada linha diz o seu Registro nº").toHaveLength(2);
      const mostrados = registros.map((t) => Number((t.match(/^Registro nº (\d+)$/) ?? [])[1]));
      expect(new Set(mostrados).size, `os dois Registros são diferentes (${registros.join(" × ")})`).toBe(2);
      expect([...mostrados].sort((a, b) => a - b), "o Registro nº é o registro_seq de cada emissão").toEqual([...seqs].sort((a, b) => a - b));
    });
  }
});
