import { test, expect, type Request } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1601 — E789: Conta/Perfil abria em cartões brancos vazios por ~5 s antes dos dados (contas do Lucas e da observadora).
  Causa: a página era de cliente; o HTML chegava com o esqueleto e o navegador pedia os dados por Server Actions, que o
  Next enfileira (uma depois da outra). Correção: a página é de servidor e o Perfil chega preenchido na primeira resposta.

  1) Determinístico: o HTML da PRIMEIRA resposta de /dashboard/conta/perfil já traz o nome da pessoa no campo e não traz o
     esqueleto. Na main antiga falha (o HTML só tem `perfil-carregando`).
  2) Medição (390 e 1280): do início da navegação até o nome aparecer no campo, quantas Server Actions o navegador
     precisou e quantos ms levou. Exige zero Server Actions antes do primeiro conteúdo útil; os ms vão para o relatório
     (anotação "E789 medição") para comparar antes × depois no mesmo laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `inq.t1601.${sufixo}@lab.vivanomads.test`, nome: `Lia Primeira Pintura ${sufixo}`, role: "tenant" as const };
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

  test("o HTML da primeira resposta já traz o nome no campo, sem esqueleto", async ({ browser }) => {
    const p = await entrar(browser, pessoa.email, senha);
    const r = await p.request.get("/dashboard/conta/perfil");
    expect(r.status()).toBe(200);
    const html = await r.text();
    expect(html).toContain('data-testid="perfil-nome"');
    expect(html).toContain(`value="${pessoa.nome}"`);
    expect(html).not.toContain('data-testid="perfil-carregando"');
    await p.context().close();
  });

  for (const w of [390, 1280] as const) {
    test(`${w}: medição do tempo até o primeiro conteúdo útil (zero Server Actions antes do nome)`, async ({ browser }) => {
      const p = await entrar(browser, pessoa.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      // Aquece a rota (compilação/caches do servidor) para medir a tela, não a primeira compilação.
      await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("perfil-nome")).toHaveValue(pessoa.nome, { timeout: 30_000 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });

      let acoesAntes = 0;
      let conteudo = false;
      const contar = (req: Request) => {
        if (!conteudo && req.method() === "POST" && req.headers()["next-action"]) acoesAntes++;
      };
      p.on("request", contar);
      const t0 = Date.now();
      await p.goto("/dashboard/conta/perfil", { waitUntil: "commit" });
      await expect(p.getByTestId("perfil-nome")).toHaveValue(pessoa.nome, { timeout: 30_000 });
      conteudo = true;
      const ms = Date.now() - t0;
      p.off("request", contar);

      const linha = `E789 medição ${w}px: ${ms} ms até o nome no campo; ${acoesAntes} Server Action(s) antes`;
      console.log(linha);
      test.info().annotations.push({ type: "E789 medição", description: linha });
      await p.screenshot({ path: `tests/laboratorio/saida/t1601-perfil-${w}.png` });
      expect(acoesAntes, "o primeiro conteúdo útil não pode depender de Server Action do navegador").toBe(0);
      await p.context().close();
    });
  }
});
