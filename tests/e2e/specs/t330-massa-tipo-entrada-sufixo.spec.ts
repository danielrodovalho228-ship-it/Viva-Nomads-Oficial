import { test, expect } from "@playwright/test";
import { tipoEntradaBloqueia, tipoEntradaValido } from "../../../src/lib/anuncio/chegada-e-pedido";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T330 — GUARDA DA MASSA DO LABORATÓRIO (Pista C, 23/10). Testes permanentes dos merges #1163 e #1161:
   1. #1163: o anúncio pronto da massa (criarImovelPronto) nasce com tipo de entrada "porteiro", que o 61-B exige para
      publicar anúncio novo; com semTipoEntrada nasce sem (a t327 depende disso para o aviso do painel).
   2. #1161 / L-32 (t237): o sufixo da massa nunca tem dígito. Sufixo hex só de dígitos (~6% dos sorteios) fazia
      "Studio Fila 1280 482913" (10 dígitos) virar telefone na regra de contato do título (0057, 23514), e o beforeAll
      da t237 caía (o Playwright atribui a falha ao 1º teste, o de 390 px).
  Os casos 1 e 2 sem banco rodam em qualquer lugar; o resto só no laboratório.
*/
test.describe("T330 — massa do laboratório: tipo de entrada e sufixo sem dígito", () => {
  test("sufixo da massa: só letras, 6 caracteres, sem repetir em 2000 sorteios", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const s = novoSufixo();
      expect(s).toMatch(/^[a-p]{6}$/);
      vistos.add(s);
    }
    expect(vistos.size).toBeGreaterThan(1990);
  });

  test("o padrão da massa ('porteiro') é um tipo de entrada válido e não bloqueia a publicação", () => {
    expect(tipoEntradaValido("porteiro")).toBe(true);
    expect(tipoEntradaBloqueia({ tipoEntrada: "porteiro", jaPublicado: false })).toBe(false);
    expect(tipoEntradaBloqueia({ tipoEntrada: null, jaPublicado: false })).toBe(true);
  });

  test.describe("no banco do laboratório", () => {
    test.skip(!NO_LABORATORIO, "Só no laboratório.");
    const senha = novaSenha();
    const sufixo = novoSufixo();
    const ids: { dono?: string } = {};

    test.beforeAll(async () => {
      ids.dono = await criarConta({ email: `dono.massa.t330.${sufixo}@lab.vivanomads.test`, nome: `Mario Massa ${sufixo}`, role: "owner" }, senha);
    });
    test.afterAll(async () => {
      await apagarContas([ids.dono]);
    });

    test("criarImovelPronto: 'porteiro' por padrão; semTipoEntrada deixa sem", async () => {
      const com = await criarImovelPronto(ids.dono!, `Studio Massa 390 ${sufixo}`);
      const sem = await criarImovelPronto(ids.dono!, `Studio Massa 1280 ${sufixo}`, { semTipoEntrada: true });
      const { data } = await adm().from("properties").select("id, tipo_entrada").in("id", [com, sem]);
      const por = Object.fromEntries((data ?? []).map((p) => [p.id as string, p.tipo_entrada as string | null]));
      expect(por[com]).toBe("porteiro");
      expect(por[sem]).toBeNull();
    });

    test("título com número + sufixo: o formato antigo cai na regra de contato, o novo passa (o caso da t237)", async () => {
      // Com a chave de serviço o gatilho roda (só postgres/supabase_admin passam direto): o mesmo caminho da massa.
      const id = await criarImovelPronto(ids.dono!, `Studio Massa ${sufixo}`);
      const antigo = await adm().from("properties").update({ title: "Studio Fila 1280 482913" }).eq("id", id);
      expect(antigo.error?.code, "o sufixo hex só de dígitos virava telefone").toBe("23514");
      for (let i = 0; i < 20; i++) {
        const r = await adm().from("properties").update({ title: `Studio Fila 1280 ${novoSufixo()}` }).eq("id", id);
        expect(r.error?.message ?? null).toBeNull();
      }
    });
  });
});
