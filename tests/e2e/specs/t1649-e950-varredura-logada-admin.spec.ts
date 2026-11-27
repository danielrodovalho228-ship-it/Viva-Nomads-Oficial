import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";
import { EXCECOES_TERCEIROS, abrirComoConta, lerMassa, temContaVarredura } from "../fixtures/varredura";
import {
  BUSCAS_NO_BANCO,
  CONTA_DA_PERSONA,
  ESPERA_ESQUELETO_MS,
  LARGURAS,
  PERSONAS,
  SELETOR_ESQUELETO,
  TELAS_DA_AMOSTRA,
  classificar,
  lerInventario,
  lerRedirecionamentos,
  resolverRota,
  rotasDaPersona,
  type ExtrasDoBanco,
  type Largura,
  type Modo,
  type Parcial,
  type Persona,
} from "../fixtures/e950-varredura";
import { recursoFicticioDoLab } from "../../../src/lib/varredura-texto";

/*
  T1649 — E950 (alavanca 2): VARREDURA AUTOMÁTICA da área logada e do admin, só no laboratório.
  Percorre TODAS as rotas do inventário do Apêndice A de docs/e793-painel-sessao-servidor.md (108 páginas) com cinco
  personas (morador, proprietário com imóvel publicado, conta de dois papéis — a "três papéis" da massa —, parceiro
  aprovado e admin com o 2FA da persona do lab, gerado na semeadura) a 390 e 1280 px.
  Em cada tela REGISTRA (não falha): HTTP ≠ 200 ou redirecionamento, console/pageerror (hidratação à parte), imagem
  quebrada, estouro horizontal, frase proibida (gate do E776/E785), texto undefined/null/NaN/[object Object] e esqueleto
  visível 5 s depois do carregamento. Rota com parâmetro sem registro semeado vai para "não varrida" com o motivo.
  Cada teste grava a sua parcial em tests/laboratorio/saida/varredura-logada-e950/; scripts/lab/juntar-varredura-logada.mjs
  junta tudo em tests/laboratorio/saida/varredura-logada.json e escreve o resumo do job (com a cobertura).
  O teste só fica vermelho se a varredura NÃO TERMINAR (conta ausente, login que não entra, tempo esgotado).
*/
const PASTA = "tests/laboratorio/saida/varredura-logada-e950";
const DOC_INVENTARIO = readFileSync("docs/e793-painel-sessao-servidor.md", "utf8");
const INVENTARIO = lerInventario(DOC_INVENTARIO);
// ORDEM-DUET-102: as telas que redirecionam de propósito, com o destino que a varredura afirma.
const REDIRECIONAMENTOS = lerRedirecionamentos(DOC_INVENTARIO);
const MASSA = lerMassa();
const slug = (s: string) => s.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 90);
/** Completa só no workflow varredura-logada.yml; no lab-critico e nas fatias gerais (teto curto), a amostra prova que a máquina roda. */
const MODO: Modo = process.env.LAB_VARREDURA_E950 === "completa" ? "completa" : "amostra";
const TETO_POR_TESTE = MODO === "completa" ? 75 * 60_000 : 5 * 60_000;

/** Registros que a semeadura já criou para as rotas com parâmetro de BUSCAS_NO_BANCO (leitura com a chave de serviço). */
async function buscarExtras(persona: Persona): Promise<ExtrasDoBanco> {
  const extras: ExtrasDoBanco = {};
  const db = adm();
  const conta = persona === "admin" ? null : CONTA_DA_PERSONA[persona];
  const usuario = conta ? MASSA?.ids?.[conta] : undefined;
  const parceiro = persona === "parceiro" ? MASSA?.parceiro : persona === "dois-papeis" ? MASSA?.parceiroTres : undefined;
  for (const b of BUSCAS_NO_BANCO) {
    if ((persona === "admin") !== !!b.qualquer) continue;
    let id: string | null = null;
    if (b.qualquer) {
      const { data } = await db.from(b.tabela).select("id").limit(1);
      id = (data?.[0] as { id?: string } | undefined)?.id ?? null;
    } else {
      // avaliador_id é o credenciamento do parceiro (avaliadores_credenciamento), não a conta.
      let avaliador: string | undefined;
      if (b.viaAvaliador && parceiro) {
        const { data } = await db.from("avaliadores_credenciamento").select("id").eq("parceiro_id", parceiro).limit(1);
        avaliador = (data?.[0] as { id?: string } | undefined)?.id;
      }
      const filtros = b.colunas.flatMap((c) => {
        const valor = c === "parceiro_id" && b.usaParceiro ? parceiro : b.viaAvaliador ? avaliador : usuario;
        return valor ? [`${c}.eq.${valor}`] : [];
      });
      if (filtros.length) {
        const { data } = await db.from(b.tabela).select("id").or(filtros.join(",")).limit(1);
        id = (data?.[0] as { id?: string } | undefined)?.id ?? null;
      }
    }
    extras[b.rota] = { ...(extras[b.rota] ?? {}), [persona]: id };
  }
  return extras;
}

/** Console (erro) e pageerror da tela atual; a foto fictícia do lab e o ruído de terceiros ficam de fora (mesma regra da t48/t249). */
function escutar(page: Page): { console: string[]; pageErrors: string[]; zerar: () => void } {
  const r = { console: [] as string[], pageErrors: [] as string[], zerar: () => {} };
  r.zerar = () => {
    r.console.length = 0;
    r.pageErrors.length = 0;
  };
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const texto = `${m.text()} ${m.location().url ?? ""}`.trim();
    if (/Failed to load resource/i.test(m.text()) && recursoFicticioDoLab(m.location().url)) return;
    if (EXCECOES_TERCEIROS.some((x) => x.padrao.test(texto))) return;
    r.console.push(texto.replace(/\?\S*/g, ""));
  });
  page.on("pageerror", (e) => r.pageErrors.push(e.message));
  return r;
}

async function esqueletoDepoisDe5s(page: Page): Promise<string[]> {
  const visiveis = () =>
    page.evaluate((sel) => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
        if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const id = el.getAttribute("data-testid");
        out.push(id ? `[data-testid="${id}"]` : ".animate-pulse");
      }
      return [...new Set(out)];
    }, SELETOR_ESQUELETO);
  const limite = Date.now() + ESPERA_ESQUELETO_MS;
  let agora = await visiveis().catch(() => []);
  while (agora.length && Date.now() < limite) {
    await page.waitForTimeout(250);
    agora = await visiveis().catch(() => []);
  }
  return agora;
}

test.describe("T1649 — E950 varredura logada e admin (laboratório)", () => {
  test.skip(!NO_LABORATORIO, "só no laboratório (Supabase local, integrações simuladas, personas do seed-lab)");
  test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium", "roda só no projeto chromium (as larguras saem dentro do teste)"));

  for (const persona of PERSONAS) {
    for (const largura of LARGURAS) {
      test(`E950 — varredura logada: ${persona} @${largura}`, async ({ browser }) => {
        test.setTimeout(TETO_POR_TESTE);
        if (persona === "admin") {
          expect(existsSync(authFile("admin")), "sem a sessão do admin (global-setup + TESTES_ADMIN_TOTP_SEGREDO da semeadura)").toBe(true);
        } else {
          expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
          expect(temContaVarredura(CONTA_DA_PERSONA[persona]), `sem a conta ${CONTA_DA_PERSONA[persona]} da massa`).toBe(true);
        }
        mkdirSync(PASTA, { recursive: true });
        const arquivo = `${PASTA}/${persona}-${largura}.json`;
        const parcial: Parcial = { modo: MODO, persona, largura: largura as Largura, terminou: false, registros: [], naoVarridas: [] };
        const gravar = () => writeFileSync(arquivo, JSON.stringify(parcial, null, 2));

        const page =
          persona === "admin"
            ? await (await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } })).newPage()
            : (await abrirComoConta(browser, CONTA_DA_PERSONA[persona], String(largura) as "390" | "1280")).page;
        const ouvido = escutar(page);
        const extras = await buscarExtras(persona);

        try {
          for (const rota of rotasDaPersona(persona, INVENTARIO)) {
            if (MODO === "amostra" && parcial.registros.length >= TELAS_DA_AMOSTRA) break;
            const res = resolverRota(rota, persona, MASSA, extras);
            if ("motivo" in res) {
              parcial.naoVarridas.push({ rota, persona, motivo: res.motivo });
              continue;
            }
            for (const url of MODO === "amostra" ? res.urls.slice(0, 1) : res.urls) {
              // Sai da tela anterior ANTES de zerar: o fetch que ela cancela ao sair ("Failed to fetch") não pode cair na próxima.
              await page.goto("about:blank").catch(() => {});
              ouvido.zerar();
              let status: number | null = null;
              let erroAbertura: string | undefined;
              try {
                const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40_000 });
                status = resp?.status() ?? null;
                await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => {});
              } catch (e) {
                erroAbertura = String(e).split("\n")[0];
              }
              const esqueleto = erroAbertura ? [] : await esqueletoDepoisDe5s(page);
              const tela = erroAbertura
                ? { final: null, imagens: [] as string[], scrollWidth: 0, clientWidth: 0, texto: "" }
                : await page
                    .evaluate(() => {
                      const fotoDoLab = (s: string) => {
                        try {
                          const u = new URL(s);
                          const alvo = u.pathname === "/_next/image" ? new URL(u.searchParams.get("url") ?? "", location.href) : u;
                          return alvo.hostname === "lab.vivanomads.test";
                        } catch {
                          return false;
                        }
                      };
                      const imagens = Array.from(document.images)
                        .filter((img) => img.complete && img.naturalWidth === 0 && img.getBoundingClientRect().width > 1 && !fotoDoLab(img.currentSrc || img.src))
                        .map((img) => (img.currentSrc || img.src || "(sem src)").replace(/\?.*$/, ""));
                      return { final: location.pathname, imagens, scrollWidth: document.body.scrollWidth, clientWidth: document.body.clientWidth, texto: document.body.innerText };
                    })
                    .catch(() => ({ final: null, imagens: [] as string[], scrollWidth: 0, clientWidth: 0, texto: "" }));
              const achados = classificar({
                pedido: url,
                largura,
                final: tela.final,
                status,
                erroAbertura,
                console: [...ouvido.console],
                pageErrors: [...ouvido.pageErrors],
                imagensQuebradas: tela.imagens,
                scrollWidth: tela.scrollWidth,
                clientWidth: tela.clientWidth,
                texto: tela.texto,
                esqueletoVisivel: esqueleto,
              }, REDIRECIONAMENTOS);
              let captura: string | null = null;
              if (achados.length) {
                captura = `${PASTA}/${persona}-${largura}-${slug(url)}.png`;
                await page.screenshot({ path: captura }).catch(() => (captura = null));
                for (const a of achados) console.log(`E950|${persona}|${largura}|${url.replace(/[0-9a-f-]{36}/g, ":id")}|${a.tipo}|${a.detalhe}`);
              }
              parcial.registros.push({ rota, url, persona, largura: largura as Largura, achados, captura });
              gravar();
            }
          }
          parcial.terminou = true;
        } finally {
          gravar();
          await page.context().close();
        }
        // Achado não é falha: o teste só confirma que a varredura terminou e abriu alguma tela.
        expect(parcial.terminou).toBe(true);
        expect(parcial.registros.length, "nenhuma tela aberta").toBeGreaterThan(0);
      });
    }
  }
});
