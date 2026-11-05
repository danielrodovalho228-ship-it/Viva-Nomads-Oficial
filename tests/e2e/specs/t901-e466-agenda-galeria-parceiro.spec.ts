import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T901 — E466 (PC10):
    (i) Agenda do parceiro (/dashboard/parceiro#agenda): o mini-calendário tem mês anterior/próximo e os dias são
        clicáveis — o dia escolhido filtra os horários ("Nenhum horário combinado neste dia." / "Ver todos");
    (ii) página pública do parceiro: clicar numa foto da galeria abre a visualização ampliada (contador, próxima, Esc).
  390 e 1280, sessão real.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `gal.t901.${sufixo}@lab.vivanomads.test`, nome: "Gilda Galeria", role: "owner" as const };
const ids: Record<string, string> = {};
const slug = `gilda-t901-${sufixo}`;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

test.describe("T901 — E466: agenda navegável e galeria ampliável", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.pessoa, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `[TESTE QA] Gilda Limpeza T901 ${sufixo}`, slug, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = data.id as string;
    await adm().from("profiles").update({ papel_ativo: "parceiro" }).eq("id", ids.pessoa);
    const arquivos = ["public/images/parceiros-categorias/manutencao.webp", "public/images/parceiros-categorias/lavanderia.webp"];
    for (const i of [0, 1]) {
      const path = `${ids.parceiro}/galeria-t901-${i}.webp`;
      const { error: eUp } = await adm().storage.from("parceiros").upload(path, readFileSync(arquivos[i]), { contentType: "image/webp", upsert: true });
      if (eUp) throw eUp;
      const { error: eIns } = await adm().from("parceiro_galeria").insert({ parceiro_id: ids.parceiro, path, ordem: i });
      if (eIns) throw eIns;
    }
  });
  test.afterAll(async () => {
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.pessoa]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: galeria pública amplia; agenda navega e filtra por dia`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390, hasTouch: w === 390 });

      // (ii) Galeria pública: a foto abre ampliada; próxima; Esc fecha.
      const pub = await ctx.newPage();
      await pub.goto(`/parceiros/${slug}`, { waitUntil: "domcontentloaded" });
      const fotos = pub.getByTestId("parceiro-galeria-foto");
      await expect(fotos).toHaveCount(2, { timeout: 30_000 });
      if (w === 390) await fotos.first().tap();
      else await fotos.first().click();
      const caixa = pub.getByTestId("galeria-lightbox");
      await expect(caixa).toBeVisible();
      await expect(pub.getByTestId("galeria-contador")).toHaveText("1 / 2");
      await caixa.getByRole("button", { name: "Próxima foto" }).click();
      await expect(pub.getByTestId("galeria-contador")).toHaveText("2 / 2");
      await pub.screenshot({ path: `tests/laboratorio/saida/t901-galeria-${w}.png` });
      await pub.keyboard.press("Escape");
      await expect(caixa).toHaveCount(0);

      // (i) Agenda do parceiro: mês anterior/próximo e dia clicável.
      const p = await entrarNaPagina(await ctx.newPage(), pessoa.email, senha);
      await p.goto("/dashboard/parceiro#agenda", { waitUntil: "domcontentloaded" });
      const cal = p.getByTestId("parceiro-agenda-calendario");
      await expect(cal).toBeVisible({ timeout: 30_000 });
      const titulo = cal.getByTestId("agenda-parceiro-mes");
      const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const prox = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
      const nome = (d: Date) => `${MESES[d.getMonth()][0].toUpperCase()}${MESES[d.getMonth()].slice(1)} de ${d.getFullYear()}`;
      await expect(titulo).toHaveText(nome(agora));
      await cal.getByRole("button", { name: "Próximo mês" }).click();
      await expect(titulo).toHaveText(nome(prox));
      await cal.getByRole("button", { name: "Mês anterior" }).click();
      await expect(titulo).toHaveText(nome(agora));
      // Um dia do mês: filtra (sem horário combinado → o aviso) e "Ver todos" volta.
      const dia = cal.locator("button[data-dia]").nth(14);
      const iso = await dia.getAttribute("data-dia");
      await dia.click();
      await expect(cal.getByTestId("agenda-parceiro-filtro")).toHaveAttribute("data-dia", iso!);
      await expect(cal.getByTestId("agenda-parceiro-dia-vazio")).toBeVisible();
      await expect(dia).toHaveAttribute("data-marca", /selecionado|hoje/);
      await p.screenshot({ path: `tests/laboratorio/saida/t901-agenda-${w}.png` });
      await cal.getByTestId("agenda-parceiro-ver-todos").click();
      await expect(cal.getByTestId("agenda-parceiro-filtro")).toHaveCount(0);
      await ctx.close();
    });
  }
});
