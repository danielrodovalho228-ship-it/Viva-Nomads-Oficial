import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1332 — E656 (#3056): a recusa de um arquivo pequeno demais fala só do TAMANHO ("o tamanho mínimo é 10 KB. Envie um
  arquivo maior."), sem dizer que o arquivo "não parece um documento válido". Rota /api/upload/inquilino-doc, com a
  candidatura já aceita e sessão real da inquilina. O limite (10 KB) não mudou: um PDF de 12 KB passa; um de 2 KB é
  recusado (400); um arquivo grande que não é PDF/JPG/PNG segue recusado por TIPO (415), em outra mensagem.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1332.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const inq = { email: `inq.t1332.${sufixo}@lab.vivanomads.test`, nome: "Ivo Inquilino", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};
const pdf = (kb: number) => Buffer.concat([Buffer.from("%PDF-1.4\n% laboratório\n"), Buffer.alloc(kb * 1024, 0x20), Buffer.from("\n%%EOF\n")]);

test.describe("T1332 — E656: recusa por tamanho fala só do tamanho", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T1332 ${sufixo}`, { ativo: true });
    const { data, error } = await adm().from("leads").insert({ property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, status: "accepted" }).select("id").single();
    expect(error).toBeNull();
    ids.lead = data!.id as string;
  });
  test.afterAll(async () => {
    if (ids.lead) {
      const { data } = await adm().from("documentos_inquilino").select("caminho").eq("lead_id", ids.lead);
      if (data?.length) await adm().storage.from("inquilino-docs").remove(data.map((d) => d.caminho as string));
      await adm().from("documentos_inquilino").delete().eq("lead_id", ids.lead);
      await adm().from("leads").delete().eq("id", ids.lead);
    }
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: arquivo pequeno é recusado só pelo tamanho; 12 KB passa; tipo errado segue em outra mensagem`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      const p = await entrarNaPagina(await ctx.newPage(), inq.email, senha);
      const enviar = (tipo: string, buffer: Buffer, mimeType = "application/pdf") =>
        p.request.post("/api/upload/inquilino-doc", { multipart: { leadId: ids.lead!, tipo, file: { name: `${tipo}.bin`, mimeType, buffer } } });

      const pequeno = await enviar("identidade", pdf(2));
      expect(pequeno.status()).toBe(400);
      const msg = String((await pequeno.json()).error);
      expect(msg).toContain("tamanho mínimo é 10 KB");
      expect(msg).toContain("Envie um arquivo maior");
      expect(msg).not.toMatch(/documento v[áa]lido/i);

      const tipoErrado = await enviar("renda", Buffer.alloc(12 * 1024, 0x41), "text/plain");
      expect(tipoErrado.status()).toBe(415);
      expect(String((await tipoErrado.json()).error)).toContain("Tipo de arquivo inválido");

      const ok = await enviar(w === 1280 ? "vinculo" : "identidade", pdf(12)); // um tipo por largura: cada tipo é enviado uma vez por candidatura
      expect(ok.status(), await ok.text()).toBeLessThan(300);
      await ctx.close();
    });
  }
});
