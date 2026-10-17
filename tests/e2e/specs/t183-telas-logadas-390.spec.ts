import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { telasDaPersona, telasForaDaLista } from "../fixtures/telas-logadas";

/*
  T183 — TODAS AS TELAS LOGADAS em 390 px, com cada persona da sessão salva (inquilino, proprietário, admin).
  Lista em tests/e2e/fixtures/telas-logadas.ts (guarda: a lista bate com src/app/(dashboard)/**\/page.tsx).
  A 390x844, em cada tela:
   • HTTP < 400 (redirecionar para outra tela permitida é normal; cair no login não);
   • sem rolagem lateral (scrollWidth - innerWidth <= 1);
   • nenhum elemento mais largo que a tela fora de um contêiner com rolagem/corte próprio (o que um
     overflow-x escondido no body mascararia);
   • no fim da rolagem, o último controle da tela não fica embaixo da barra de abas nem do "Fale com a Viva"
     (mesma conferência do t59: elementFromPoint no centro do controle);
   • a tela tem um h1 visível; captura da página inteira.
  A 1280x900: só rolagem lateral e h1.
  Os problemas de todas as telas saem juntos (expect.soft por tela, como no t48).
*/
type Persona = "inquilino" | "proprietario" | "admin";
const PERSONAS: Persona[] = ["inquilino", "proprietario", "admin"];
const SAIDA = "tests/laboratorio/saida";

const slug = (rota: string) => rota.replace(/^\//, "").replace(/\//g, "_") || "raiz";

/** Abre a rota sem esperar "networkidle" (o painel não assenta, lab 17/10) e devolve os problemas de carga. */
async function abrir(page: Page, rota: string): Promise<string[]> {
  const problemas: string[] = [];
  const resp = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 }).catch((e) => {
    problemas.push(`não abriu: ${String(e).slice(0, 140)}`);
    return null;
  });
  if (!resp) return problemas;
  if (resp.status() >= 400) problemas.push(`HTTP ${resp.status()}`);
  const destino = new URL(page.url()).pathname;
  if (destino === "/auth") problemas.push("caiu no login (sessão salva não vale)");
  await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => problemas.push("sem <main> em 20 s"));
  await page.waitForTimeout(400); // hidratação e fontes: a medida de largura sai estável
  return problemas;
}

async function semRolagemLateral(page: Page, largura: number): Promise<string[]> {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  return sobra > 1 ? [`rolagem lateral de ${sobra}px a ${largura}px`] : [];
}

async function temH1(page: Page): Promise<string[]> {
  const visiveis = await page.locator("h1:visible").count();
  return visiveis > 0 ? [] : ["sem h1 visível"];
}

/** Elementos que passam da largura da tela sem estar dentro de um contêiner que rola/corta na horizontal. */
async function maisLargosQueATela(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const W = window.innerWidth;
    const desc = (el: Element) => {
      const tid = el.getAttribute("data-testid");
      const cls = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join(".") : "";
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${tid ? `[data-testid=${tid}]` : ""}${cls ? `.${cls}` : ""}`;
    };
    const fora: string[] = [];
    const apontados: Element[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.right <= W + 1 && r.left >= -1) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "contents") continue;
      if (cs.position === "absolute" && cs.clip !== "auto") continue; // sr-only
      let contido = false;
      for (let n: Element | null = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.position === "fixed") { contido = true; break; } // fixo não gera rolagem do documento
        if (n !== el && s.overflowX !== "visible") { contido = true; break; }
      }
      if (contido) continue;
      // Só o mais externo: um filho de quem já foi apontado não acrescenta nada.
      if (apontados.some((a) => a.contains(el))) continue;
      apontados.push(el);
      fora.push(`${desc(el)} (${Math.round(r.left)}→${Math.round(r.right)}px)`);
      if (fora.length >= 5) break;
    }
    return fora.map((f) => `mais largo que a tela: ${f}`);
  });
}

/** No fim da rolagem, o último controle da tela não pode estar embaixo da barra de abas nem do "Fale com a Viva". */
async function ultimoControleLivre(page: Page): Promise<string[]> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const raiz = document.querySelector("main") ?? document.body;
    const SEL = "a[href], button, input:not([type=hidden]), select, textarea, [role=button], [data-cta]";
    const dentroDeFixo = (el: Element) => {
      for (let n: Element | null = el; n; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return true;
      return false;
    };
    const candidatos = Array.from(raiz.querySelectorAll<HTMLElement>(SEL)).filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 2 || r.height < 2 || cs.visibility === "hidden" || el.closest("[aria-hidden='true'], [inert]")) return false;
      return !dentroDeFixo(el);
    });
    if (candidatos.length === 0) return [];
    const ultimo = candidatos.reduce((a, b) => (b.getBoundingClientRect().bottom >= a.getBoundingClientRect().bottom ? b : a));
    const r = ultimo.getBoundingClientRect();
    const nome = (ultimo.textContent || ultimo.getAttribute("aria-label") || ultimo.getAttribute("name") || ultimo.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
    const y = r.top + r.height / 2;
    const x = Math.min(Math.max(r.left + r.width / 2, 0), window.innerWidth - 1);
    if (y > window.innerHeight - 1) return [`último controle "${nome}" fica fora da tela mesmo no fim da rolagem`];
    const topo = document.elementFromPoint(x, Math.max(y, 0));
    if (!topo || ultimo === topo || ultimo.contains(topo)) return [];
    if (topo instanceof HTMLLabelElement && topo.control === ultimo) return [];
    const quem = topo.closest("[data-testid='fale-com-a-viva-raiz']")
      ? "o botão Fale com a Viva"
      : topo.closest("nav") && dentroDeFixo(topo)
        ? "a barra de abas"
        : dentroDeFixo(topo)
          ? `um elemento fixo (${topo.tagName.toLowerCase()})`
          : null;
    return quem ? [`último controle "${nome}" tampado por ${quem}`] : [];
  });
}

test("guarda: a lista do t183 cobre todas as telas logadas do disco", () => {
  expect(telasForaDaLista()).toEqual({ faltando: [], sobrando: [] });
});

for (const persona of PERSONAS) {
  test.describe(`T183 — telas logadas (${persona})`, () => {
    test.use({ storageState: authFile(persona) });
    test.beforeEach(({}, info) => {
      test.skip(!hasAccount(persona), `Sem a conta de teste ${persona}.`);
      test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
    });

    test(`390 px: carrega, sem rolagem lateral, nada mais largo que a tela, último controle livre, h1 e captura`, async ({ page }) => {
      const rotas = telasDaPersona(persona);
      test.setTimeout(rotas.length * 25_000);
      await page.setViewportSize({ width: 390, height: 844 });
      for (const rota of rotas) {
        const problemas = await abrir(page, rota);
        if (!problemas.some((p) => p.startsWith("não abriu"))) {
          problemas.push(...(await semRolagemLateral(page, 390)));
          problemas.push(...(await maisLargosQueATela(page)));
          problemas.push(...(await temH1(page)));
          problemas.push(...(await ultimoControleLivre(page)));
          await page.screenshot({ path: `${SAIDA}/t183-${persona}-${slug(rota)}-390.png`, fullPage: true }).catch(() => {});
        }
        expect.soft(problemas, `${persona} ${rota} @390`).toEqual([]);
      }
    });

    test(`1280 px: sem rolagem lateral e com h1`, async ({ page }) => {
      const rotas = telasDaPersona(persona);
      test.setTimeout(rotas.length * 20_000);
      await page.setViewportSize({ width: 1280, height: 900 });
      for (const rota of rotas) {
        const problemas = await abrir(page, rota);
        if (!problemas.some((p) => p.startsWith("não abriu"))) {
          problemas.push(...(await semRolagemLateral(page, 1280)));
          problemas.push(...(await temH1(page)));
        }
        expect.soft(problemas, `${persona} ${rota} @1280`).toEqual([]);
      }
    });
  });
}
