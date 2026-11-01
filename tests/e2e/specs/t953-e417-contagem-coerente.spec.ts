import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T953 — E417 (#2066, D8): o cartão de contagem do Passo de fotos mostrava "8 / 8 fotos" e, logo abaixo, "Faltam 8 fotos
  para continuar" — duas contas. Agora o aviso sai da MESMA conta do número; com o mínimo já enviado e o lote ainda
  terminando, diz "Terminando o envio: as fotos entram na galeria em instantes." Pela tela real, 1280 e 390: envia 8
  fotos e registra, a cada mudança do cartão, o número e o aviso. Em todo instante:
    • "Faltam K" (no aviso ou ao lado do número) só com K = 8 − número mostrado;
    • com o número em 8, nunca "Faltam"/"Falta" — no máximo o "Terminando o envio…" (role=status, não vermelho);
  e no fim: 8 / 8 sem aviso de trava.
*/
const SAIDA = "tests/laboratorio/saida";
const FOTOS = ["sala", "quarto-1", "quarto-2", "cozinha", "banheiro", "home-office", "varanda", "fachada"].map((n) => `public/images/imoveis/ube/ube-001-${n}.webp`);
const TERMINANDO = "Terminando o envio: as fotos entram na galeria em instantes.";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t953.${sufixo}@lab.vivanomads.test`, nome: "Lia Coerente", role: "owner" as const };
const ids: Record<string, string> = {};

type Quadro = { n: string; trava: string | null; travaCodigo: string | null; ao_lado: string };

test.describe("T953 — E417: o aviso do cartão de fotos sai da mesma conta do número", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    for (const w of [1280, 390]) ids[`r${w}`] = await prepararRascunho(ids.dono, `Studio Coerente ${w} ${sufixo}`, {}, 0);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`${w} px — número e aviso nunca se contradizem durante o envio`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids[`r${w}`], "fotos", w);
      const numero = p.getByTestId("fotos-contagem-numero");
      await expect(numero).toHaveText("0", { timeout: 30_000 });
      await p.evaluate(() => {
        const win = window as unknown as { __quadros: Quadro[] };
        win.__quadros = [];
        const etapa = document.querySelector('[data-testid="etapa-fotos"]')!;
        const ler = () => {
          const n = document.querySelector('[data-testid="fotos-contagem-numero"]')?.textContent ?? "";
          const t = document.querySelector('[data-testid="fotos-trava"]');
          const linha = document.querySelector('[data-testid="fotos-contagem-numero"]')?.parentElement?.textContent ?? "";
          win.__quadros.push({ n, trava: t?.textContent ?? null, travaCodigo: t?.getAttribute("data-trava") ?? null, ao_lado: linha });
        };
        ler();
        new MutationObserver(ler).observe(etapa, { childList: true, characterData: true, subtree: true, attributes: true });
      });
      await p.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles(FOTOS);
      await expect(numero).toHaveText("8", { timeout: 90_000 });
      await expect(p.getByTestId("fotos-trava")).toHaveCount(0, { timeout: 60_000 });
      const quadros = await p.evaluate(() => (window as unknown as { __quadros: Quadro[] }).__quadros);
      console.log(`t953 ${w}`, quadros.length, JSON.stringify(quadros.filter((q, i, a) => i === 0 || q.n !== a[i - 1].n || q.trava !== a[i - 1].trava)));

      const faltamDe = (s: string | null) => {
        const m = /Falta(?:m)? (\d+) foto/.exec(s ?? "");
        return m ? Number(m[1]) : null;
      };
      for (const q of quadros) {
        const n = Number(q.n);
        if (!Number.isFinite(n)) continue;
        for (const [onde, texto] of [["aviso", q.trava], ["ao lado do número", q.ao_lado]] as const) {
          const k = faltamDe(texto);
          if (k !== null) expect(k, `"${texto}" (${onde}) com o número em ${n}`).toBe(Math.max(0, 8 - n));
        }
        if (n >= 8) {
          expect(faltamDe(q.trava), `com 8 / 8 o aviso não pode dizer "faltam": ${q.trava}`).toBeNull();
          if (q.trava) {
            expect(q.trava).toBe(TERMINANDO);
            expect(q.travaCodigo).toBe("enviando");
          }
        }
      }
      // Se o "Terminando o envio…" apareceu, é um status (não um erro vermelho).
      if (quadros.some((q) => q.travaCodigo === "enviando")) test.info().annotations.push({ type: "e417", description: `"Terminando o envio" visto @${w}` });
      await expect(p.getByTestId("fotos-contagem")).not.toContainText("Faltam");
      await p.getByTestId("fotos-contagem").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t953-contagem-${w}.png` });
      await p.context().close();
    });
  }
});
