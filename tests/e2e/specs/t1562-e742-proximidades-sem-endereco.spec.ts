import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1562 — E742 (#3531; L-104 do relatório 08/11): "Qualificar o imóvel" chama POST /api/proximidades com o id do anúncio do próprio dono,
  que ainda não tem CEP nem ponto (a massa de varredura é assim). Antes: 400 "CEP inválido" (erro de console em toda a tela). Agora: 200
  { itens: [], fonte: "sem_endereco" }. O 400 continua valendo para entrada inválida: sem id e sem CEP, e id de anúncio de OUTRA pessoa.
  Só no laboratório (cria contas e anúncio).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1562.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const outro = { email: `outro.t1562.${sufixo}@lab.vivanomads.test`, nome: "Otto Outro", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T1562 — E742: /api/proximidades sem endereço não é erro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.outro = await criarConta(outro, senha);
    ids.im = await criarImovelPronto(ids.dono, `T1562 sem endereço ${sufixo}`, { ativo: false });
    const { data } = await adm().from("properties").select("cep_proximidades, lat, lng, lat_exata, lng_exata, draft_data").eq("id", ids.im).single();
    expect(data?.cep_proximidades ?? null, "massa: sem CEP gravado").toBeNull();
    expect(data?.lat ?? null, "massa: sem ponto").toBeNull();
  });
  test.afterAll(async () => {
    if (ids.im) await adm().from("properties").delete().eq("id", ids.im);
    await apagarContas([ids.dono, ids.outro]);
  });

  test("o dono, com anúncio sem CEP e sem ponto: 200 e fonte sem_endereco, lista vazia", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    const r = await p.request.post("/api/proximidades", { data: { propertyId: ids.im } });
    expect(r.status(), await r.text()).toBe(200);
    const j = await r.json();
    expect(j.fonte).toBe("sem_endereco");
    expect(j.itens).toEqual([]);
    await p.context().close();
  });

  test("entrada inválida segue 400: sem id e sem CEP; e o id de anúncio de OUTRA pessoa não vira 200 de endereço", async ({ browser }) => {
    const p = await entrar(browser, outro.email, senha);
    const semNada = await p.request.post("/api/proximidades", { data: {} });
    expect(semNada.status()).toBe(400);
    const alheio = await p.request.post("/api/proximidades", { data: { propertyId: ids.im } });
    expect(alheio.status(), "anúncio de outro dono").toBe(400);
    expect((await alheio.json()).fonte).not.toBe("sem_endereco");
    await p.context().close();
  });
});
