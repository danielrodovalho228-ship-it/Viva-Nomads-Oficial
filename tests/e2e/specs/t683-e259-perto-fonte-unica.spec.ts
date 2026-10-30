import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T683 — E259 item 7: "O que tem por perto" do assistente e a página pública do MESMO anúncio saem da mesma fonte.
  Caso fixado: Av. João Naves de Ávila, 2121, Saraiva, Uberlândia (VN-A02590) — o assistente dizia "Não achamos lugares
  por perto, num raio de 2 km" e a página mostrava "≈ 600 m em linha reta até a UFU — Campus Santa Mônica".
   1. Com o ponto público do anúncio e a âncora oficial com as coordenadas de produção, a busca do assistente
      (/api/proximidades, com o id do anúncio) traz a UFU — Campus Santa Mônica a ~600 m, em Educação.
   2. O "Tempo até" da página (/api/tempos/imovel/<id>) mostra a mesma UFU (sem rota, "≈ 600 m em linha reta").
  A âncora volta às coordenadas de antes no fim (a base do lab é compartilhada).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t683.${sufixo}@lab.vivanomads.test`, nome: "Dono Perto Sobrenome", role: "owner" as const };
const PONTO_PUBLICO = { lat: -18.913856, lng: -48.2617463059656 };
const UFU = { lat: -18.918473, lng: -48.2581763 };
const ids: { dono?: string; imovel?: string } = {};
let antes: { lat: number | null; lng: number | null; ativo: boolean } | null = null;

test.describe("T683 — E259: o que tem por perto, assistente × página, mesma fonte", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const { data } = await adm().from("destinos").select("lat, lng, ativo").eq("slug", "ufu-santa-monica").maybeSingle();
    antes = (data as typeof antes) ?? null;
    await adm().from("destinos").update({ lat: UFU.lat, lng: UFU.lng, ativo: true }).eq("slug", "ufu-santa-monica");
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Perto da UFU ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ city: "Uberlândia", state: "MG", lat: PONTO_PUBLICO.lat, lng: PONTO_PUBLICO.lng }).eq("id", ids.imovel);
  });

  test.afterAll(async () => {
    if (antes) await adm().from("destinos").update({ lat: antes.lat, lng: antes.lng, ativo: antes.ativo }).eq("slug", "ufu-santa-monica");
    await apagarContas([ids.dono]);
  });

  test("a busca do assistente e o 'Tempo até' da página trazem a UFU — Campus Santa Mônica a ~600 m", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    const r = await page.request.post("/api/proximidades", {
      data: { cep: "38408100", rua: "Avenida João Naves de Ávila", numero: "2121", bairro: "Saraiva", cidade: "Uberlândia", uf: "MG", imovelId: ids.imovel },
    });
    expect(r.ok()).toBe(true);
    const corpo = (await r.json()) as { itens: { nome: string; categoria: string; distanciaM: number }[]; fonte: string };
    const ufu = corpo.itens.find((l) => l.nome === "UFU — Campus Santa Mônica");
    expect(ufu, "a âncora oficial entra na lista do assistente").toBeTruthy();
    expect(ufu!.categoria).toBe("educacao");
    expect(ufu!.distanciaM).toBeGreaterThanOrEqual(550);
    expect(ufu!.distanciaM).toBeLessThan(650);
    expect(corpo.fonte).not.toBe("sem_lugares");

    // A página pública do mesmo anúncio: o "Tempo até" lê a mesma âncora, do mesmo ponto.
    const t = await page.request.get(`/api/tempos/imovel/${ids.imovel}`);
    const linhas = ((await t.json()) as { linhas: { destino: string; tempos: string[] }[] }).linhas;
    const linha = linhas.find((l) => /UFU — Campus Santa Mônica/.test(l.destino));
    expect(linha, "o 'Tempo até' mostra a mesma UFU").toBeTruthy();
    // Sem rota (provedor simulado sem minuto), a linha reta é a mesma conta: ≈ 600 m.
    const reta = linha!.tempos.find((x) => /linha reta/.test(x));
    if (reta) expect(reta).toMatch(/600 m em linha reta/);
    await page.context().close();
  });
});
