import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2095 — E656 (Pista 3; varredura "sem spec" das 142, lote B) @E656 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E656): o arquivo PEQUENO é recusado falando só do tamanho mínimo e do caminho — "Arquivo pequeno
  demais: o tamanho mínimo é 10 KB. Envie um arquivo maior." — nunca rotulando o documento ("documento válido/inválido",
  "parece não ser um documento"). O unitário e656-mensagem-tamanho.test.ts fixa a função e a leitura das três rotas;
  esta spec envia de verdade um PDF de 1 KB pela rota do documento do imóvel, com a sessão do dono.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2095.${sufixo}@lab.vivanomads.test`, nome: "Dirce Arquivo", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T2095 — E656: arquivo pequeno é recusado pelo tamanho, sem rotular o documento @E656", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("PDF de 1 KB na rota do documento → 400 com a mensagem do tamanho mínimo", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const r = await p.evaluate(async () => {
      const pdf = "%PDF-1.4\n" + "x".repeat(1000) + "\n%%EOF";
      const fd = new FormData();
      fd.append("file", new File([pdf], "pequeno.pdf", { type: "application/pdf" }));
      const resp = await fetch("/api/upload/documento", { method: "POST", body: fd });
      return { status: resp.status, json: await resp.json().catch(() => null) };
    });
    expect(r.status).toBe(400);
    const msg = String(r.json?.error ?? "");
    expect(msg).toBe("Arquivo pequeno demais: o tamanho mínimo é 10 KB. Envie um arquivo maior.");
    expect(msg).not.toMatch(/inválid|válid|parece não ser|documento/i);
    await p.context().close();
  });
});
