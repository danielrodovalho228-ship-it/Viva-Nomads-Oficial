import { test, expect, type Response } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1601 — E789: Conta/Perfil abria em cartões brancos vazios por ~5 s antes dos dados (contas do Lucas e da observadora).
  Causa: a página era de cliente; o HTML chegava com o esqueleto e o navegador pedia os dados por Server Actions, que o
  Next enfileira (uma depois da outra). Correção: a página é de servidor e o Perfil chega preenchido na primeira resposta.

  1) Determinístico: a PRIMEIRA resposta de /dashboard/conta/perfil já traz os dados da pessoa (o nome vem junto com a página,
     nos dados do servidor). Na main antiga falha: o nome só chegava depois, pedido pelo navegador.
     Observação: o HTML do painel inteiro passa pelo AuthGuard, que só desenha o conteúdo depois de o navegador conferir a
     sessão — por isso o teste olha os dados da página, não o campo já desenhado (ver docs/e789-perfil-carregamento.md).
  2) Medição (390 e 1280): do início da navegação até o nome aparecer no campo, quantos ms e quantas Server Actions do
     navegador devolveram os dados do perfil antes disso. Exige ZERO (as demais ações do painel rodam em paralelo e não
     entram); os ms vão para o relatório (anotação "E789 medição") para comparar antes × depois no mesmo laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `inq.t1601.${sufixo}@lab.vivanomads.test`, nome: `Lia Primeira Pintura ${sufixo}`, role: "tenant" as const };
// A medição tem conta e grupo próprios: roda (e registra os ms) mesmo quando o teste do HTML reprova.
const medida = { email: `med.t1601.${sufixo}@lab.vivanomads.test`, nome: `Lia Medida ${sufixo}`, role: "tenant" as const };
const ids: Record<string, string> = {};

test.describe("T1601 — E789: o Perfil chega preenchido na primeira resposta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.pessoa]);
  });

  test("a primeira resposta já traz os dados do perfil (o nome vem com a página)", async ({ browser }) => {
    const p = await entrar(browser, pessoa.email, senha);
    const r = await p.request.get("/dashboard/conta/perfil");
    expect(r.status()).toBe(200);
    const html = await r.text();
    expect(html, "o nome vem com a página (dados do servidor), não depois pelo navegador").toContain(pessoa.nome);
    await p.context().close();
  });
});

test.describe("T1601 — E789: medição do tempo até o primeiro conteúdo útil", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.medida = await criarConta(medida, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.medida]);
  });

  for (const w of [390, 1280] as const) {
    test(`${w}: medição do tempo até o primeiro conteúdo útil (dados do perfil sem Server Action do navegador)`, async ({ browser }) => {
      const p = await entrar(browser, medida.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      // Aquece a rota (compilação/caches do servidor) para medir a tela, não a primeira compilação.
      await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("perfil-nome")).toHaveValue(medida.nome, { timeout: 30_000 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });

      let acoesAntes = 0;
      let perfilPeloNavegador = 0;
      let conteudo = false;
      const corpos: Promise<void>[] = [];
      const contar = (res: Response) => {
        const req = res.request();
        if (conteudo || req.method() !== "POST" || !req.headers()["next-action"]) return;
        acoesAntes++;
        // A ação que devolve o nome da pessoa é a leitura do perfil (getPerfilInicial / getMeusDados): essa não pode existir.
        corpos.push(res.text().then((t) => { if (t.includes(medida.nome)) perfilPeloNavegador++; }, () => {}));
      };
      p.on("response", contar);
      const t0 = Date.now();
      await p.goto("/dashboard/conta/perfil", { waitUntil: "commit" });
      await expect(p.getByTestId("perfil-nome")).toHaveValue(medida.nome, { timeout: 30_000 });
      conteudo = true;
      const ms = Date.now() - t0;
      p.off("response", contar);
      await Promise.all(corpos);

      const linha = `E789 medição ${w}px: ${ms} ms até o nome no campo; ${acoesAntes} Server Action(s) do painel antes, ${perfilPeloNavegador} delas com os dados do perfil`;
      console.log(linha);
      test.info().annotations.push({ type: "E789 medição", description: linha });
      await p.screenshot({ path: `tests/laboratorio/saida/t1601-perfil-${w}.png` });
      expect(perfilPeloNavegador, "os dados do perfil não podem depender de Server Action do navegador").toBe(0);
      await p.context().close();
    });
  }
});
