/*
  Viva Nomads — Captura automática das telas da demo.

  Uso:
    npm run capturas                # login real via .env.local (conta de TESTE)
    CAPTURAS_DEMO=1 npm run capturas # injeta sessão admin + modo demo (sem login real)

  Regras (inegociáveis):
   • Credenciais só por env (.env.local) — nunca commitadas. Conta de TESTE, nunca a pessoal.
   • Liga o MODO DEMONSTRAÇÃO antes das telas do painel. Nada de dado real é criado/editado.
   • O run NUNCA falha inteiro por uma tela: 404/elemento ausente/timeout = PENDENTE e segue.
   • Ferramenta de desenvolvimento (devDependency), fora do bundle de produção.

  Saída: docs/capturas/<NN-nome>.png + RELATORIO_CAPTURAS.md + RELATORIO_CAPTURAS.pdf
*/

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

// Playwright: usa o pacote instalado; cai no core no ambiente do agente.
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  ({ chromium } = await import("playwright-core"));
}

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const OUT = join(ROOT, "docs", "capturas");

// ── .env.local (simples, sem dependência) ────────────────────────────────────
function loadEnvLocal() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvLocal();

const BASE_URL = (process.env.CAPTURAS_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.CAPTURAS_EMAIL || "";
const SENHA = process.env.CAPTURAS_SENHA || "";
const DEMO_INJECT = process.env.CAPTURAS_DEMO === "1"; // injeta sessão local (sem login real)

let COMMIT = "desconhecido";
try {
  COMMIT = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
} catch {}

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────
const esperarEstavel = async (page) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
};

async function login(page) {
  if (DEMO_INJECT) {
    // Sessão de DEMONSTRAÇÃO injetada (admin) — não faz login real, não expõe
    // credenciais e permite capturar as telas do painel em modo demo.
    await page.addInitScript(() => {
      localStorage.setItem(
        "vivanomads-auth",
        JSON.stringify({
          state: {
            user: {
              id: "captura-admin",
              name: "Demo",
              email: "demo@vivanomads.local",
              role: "admin",
              plan: "gestor",
            },
            activeMode: "owner",
          },
          version: 0,
        })
      );
    });
    return true;
  }
  if (!EMAIL || !SENHA) {
    console.error(
      "✖ Faltam CAPTURAS_EMAIL/CAPTURAS_SENHA (.env.local). Use uma conta de TESTE, nunca a pessoal.\n" +
        "  Ou rode com CAPTURAS_DEMO=1 para injetar uma sessão de demonstração local."
    );
    return false;
  }
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(SENHA);
  await page.locator('button[type="submit"]').first().click();
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });
    return true;
  } catch {
    console.error("✖ Login não concluiu (sem redirect para /dashboard). Abortando o run.");
    return false; // nunca captura tela de erro com credencial digitada
  }
}

async function ligarModoDemo(page, rel) {
  // O toggle 'Modo demonstração' só existe para admin. Se não existir, segue.
  try {
    const toggle = page.getByText(/Modo demonstra/i).first();
    await toggle.waitFor({ timeout: 4000 });
    await toggle.click().catch(() => {});
    await page.waitForTimeout(400);
  } catch {
    rel.notas.push("Toggle 'Modo demonstração' não encontrado (conta não-admin?) — telas do painel saem sem demo.");
  }
}

async function papelProprietario(page) {
  try {
    const tab = page.getByRole("tab", { name: /Propriet[áa]rio/i }).first();
    if (await tab.count()) {
      await tab.click().catch(() => {});
      await page.waitForTimeout(300);
    }
  } catch {}
}

// ── Manifesto das telas (dirigido por dados) ─────────────────────────────────
// status por tela: CAPTURADA | DIVERGENTE | PENDENTE
const TELAS = [
  {
    arquivo: "01-home.png",
    rota: "/home",
    chave: 'form, input, a[href="/buscar"]',
    fullPage: false,
  },
  {
    arquivo: "02-buscar.png",
    rota: "/buscar?periodo=90",
    chave: "text=/resultado|im[óo]ve|filtro|R\\$/i",
    fullPage: false,
  },
  {
    arquivo: "03-imovel.png",
    rota: "/imoveis/ube-001",
    chave: "text=/Pronto para/i",
    fullPage: false,
  },
  {
    arquivo: "04-pedido-bloqueio.png",
    rota: "/pedidos/novo",
    async preparo(page) {
      // Preenche o formulário e dispara a validação anti-contato SEM submeter.
      await page.locator('input').first().fill("Uberlândia").catch(() => {});
      const ta = page.locator("textarea").first();
      await ta.fill("Oi, me chama no 34 99999-8888 pra combinar").catch(() => {});
      await ta.blur().catch(() => {});
      await page.waitForTimeout(300);
    },
    chave: "text=/telefone|contato|n[ãa]o inclua|WhatsApp/i",
    fullPage: false,
  },
  {
    arquivo: "05-dashboard.png",
    rota: "/dashboard",
    painel: true,
    chave: "text=/Vis[ãa]o geral|painel|Bem/i",
    fullPage: false,
  },
  {
    arquivo: "06-editor-secoes.png",
    rota: "/dashboard/imoveis/ube-001/editar",
    painel: true,
    async preparo(page) {
      const fotos = page.getByRole("button", { name: /^Fotos/ }).first();
      if (await fotos.count()) await fotos.click().catch(() => {});
      await page.waitForTimeout(300);
    },
    chave: "text=/completo/i",
    fullPage: false,
  },
  {
    arquivo: "07-ferramentas.png",
    rota: "/dashboard/ferramentas",
    painel: true,
    chave: "text=/Seguro inc[êe]ndio/i",
    fullPage: true,
  },
  {
    arquivo: "08-fechamento.png",
    rota: "/dashboard/fechamento",
    painel: true,
    chave: "text=/cau[çc][ãa]o|bloco/i",
    fullPage: false,
  },
  {
    arquivo: "09-contratos.png",
    rota: "/dashboard/contratos",
    painel: true,
    chave: "text=/registra e documenta/i",
    fullPage: true,
  },
  {
    arquivo: "10-simulacao.png",
    rota: "/simulacao",
    chave: "text=/Comiss[ãa]o de garantias e seguros/i",
    fullPage: false,
  },
];

// ── Runner ─────────────────────────────────────────────────────────────────────
const rel = { notas: [], linhas: [] };

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "pt-BR",
  timezoneId: "America/Sao_Paulo",
});
const page = await context.newPage();

const logado = await login(page);
if (!logado && !DEMO_INJECT) {
  await browser.close();
  process.exit(0); // inventário, não teste — sai limpo
}

let demoLigado = false;
for (const tela of TELAS) {
  const linha = { tela: tela.arquivo.replace(/\.png$/, ""), status: "PENDENTE", motivo: "", arquivo: tela.arquivo };
  try {
    const resp = await page.goto(`${BASE_URL}${tela.rota}`, { waitUntil: "domcontentloaded" });
    const status = resp ? resp.status() : 0;
    const url = page.url();
    if (status === 404 || /\/auth(\?|$)/.test(url)) {
      linha.motivo = status === 404 ? "rota inexistente (404)" : "redirecionou para /auth (sem sessão/guard)";
      rel.linhas.push(linha);
      continue;
    }

    // Painel: liga demo (uma vez) e garante papel Proprietário.
    if (tela.painel && !demoLigado) {
      await ligarModoDemo(page, rel);
      demoLigado = true;
    }
    if (tela.painel) await papelProprietario(page);

    await esperarEstavel(page);
    if (tela.preparo) {
      try {
        await tela.preparo(page);
      } catch (e) {
        rel.notas.push(`${linha.tela}: preparo falhou (${String(e).slice(0, 60)}) — capturando mesmo assim.`);
      }
    }

    // Valida o elemento-chave do roteiro.
    // "attached" (presente no DOM) é o critério do inventário — evita falso
    // DIVERGENTE quando o elemento existe mas o primeiro match é um nó auxiliar
    // (ex.: <title> de SVG) que o Playwright considera não-visível.
    let achou = true;
    try {
      await page.locator(tela.chave).first().waitFor({ timeout: 5000, state: "attached" });
    } catch {
      achou = false;
    }

    await page.screenshot({ path: join(OUT, tela.arquivo), fullPage: !!tela.fullPage });
    linha.status = achou ? "CAPTURADA" : "DIVERGENTE";
    linha.motivo = achou ? "" : "elemento-chave do roteiro não encontrado nesta tela";
  } catch (e) {
    linha.status = "PENDENTE";
    linha.motivo = `erro: ${String(e).slice(0, 80)}`;
  }
  rel.linhas.push(linha);
  console.log(`  ${linha.status.padEnd(10)} ${linha.tela}`);
}

// ── Relatório (Markdown) ────────────────────────────────────────────────────
const agora = new Date().toISOString();
const md = [
  "# Relatório de capturas — Viva Nomads",
  "",
  `- **Data/hora:** ${agora}`,
  `- **BASE_URL:** ${BASE_URL}`,
  `- **Commit:** ${COMMIT}`,
  `- **Modo:** ${DEMO_INJECT ? "demonstração injetada (sem login real)" : "login real (conta de teste)"}`,
  "",
  "| Tela | Status | Motivo | Arquivo |",
  "|------|--------|--------|---------|",
  ...rel.linhas.map((l) => `| ${l.tela} | ${l.status} | ${l.motivo || "—"} | ${l.arquivo} |`),
  "",
  ...(rel.notas.length ? ["## Notas", ...rel.notas.map((n) => `- ${n}`)] : []),
  "",
].join("\n");
writeFileSync(join(OUT, "RELATORIO_CAPTURAS.md"), md);

// ── Relatório (PDF) — via HTML renderizado no próprio chromium ────────────────
const badge = (s) =>
  s === "CAPTURADA"
    ? "#166534;background:#dcfce7"
    : s === "DIVERGENTE"
      ? "#92400e;background:#fef3c7"
      : "#991b1b;background:#fee2e2";
// Compressor opcional (sharp): mantém os PNGs nítidos p/ anotar e reduz o PDF.
let sharp = null;
try {
  ({ default: sharp } = await import("sharp"));
} catch {}
async function embed(arquivo) {
  const p = join(OUT, arquivo);
  if (!existsSync(p)) return '<div class="miss">sem imagem (PENDENTE)</div>';
  if (sharp) {
    try {
      const buf = await sharp(p).resize({ width: 1240, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
      return `<img src="data:image/jpeg;base64,${buf.toString("base64")}" />`;
    } catch {}
  }
  return `<img src="data:image/png;base64,${readFileSync(p).toString("base64")}" />`;
}
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:0}
  .cover{padding:48px}
  h1{font-size:28px;margin:0 0 8px} .muted{color:#64748b;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e2e8f0}
  .tag{padding:2px 8px;border-radius:999px;font-weight:700;font-size:11px}
  .page{page-break-before:always;padding:24px 32px}
  .page h2{font-size:16px;margin:0 0 4px}
  .page .st{font-size:12px;margin:0 0 12px}
  img{width:100%;border:1px solid #e2e8f0;border-radius:8px}
  .miss{padding:60px;text-align:center;color:#991b1b;background:#fef2f2;border:1px dashed #fecaca;border-radius:8px}
</style></head><body>
  <div class="cover">
    <h1>Viva Nomads — Telas da demonstração</h1>
    <p class="muted">Gerado em ${agora} · BASE_URL ${BASE_URL} · commit ${COMMIT} · ${
      DEMO_INJECT ? "modo demonstração" : "login de teste"
    }</p>
    <table><thead><tr><th>Tela</th><th>Status</th><th>Motivo</th></tr></thead><tbody>
    ${rel.linhas
      .map(
        (l) =>
          `<tr><td>${l.tela}</td><td><span class="tag" style="color:${badge(l.status)}">${l.status}</span></td><td>${
            l.motivo || "—"
          }</td></tr>`
      )
      .join("")}
    </tbody></table>
    ${rel.notas.length ? `<p class="muted" style="margin-top:16px"><b>Notas:</b> ${rel.notas.join(" · ")}</p>` : ""}
  </div>
  ${(
    await Promise.all(
      rel.linhas.map(
        async (l) =>
          `<div class="page"><h2>${l.tela}</h2><p class="st"><span class="tag" style="color:${badge(
            l.status
          )}">${l.status}</span> ${l.motivo || ""}</p>${await embed(l.arquivo)}</div>`
      )
    )
  ).join("")}
</body></html>`;

const pdfPage = await context.newPage();
await pdfPage.setContent(html, { waitUntil: "load" });
await pdfPage.pdf({
  path: join(OUT, "RELATORIO_CAPTURAS.pdf"),
  format: "A4",
  printBackground: true,
  margin: { top: "0", bottom: "0", left: "0", right: "0" },
});

await browser.close();

const resumo = rel.linhas.reduce((a, l) => ((a[l.status] = (a[l.status] || 0) + 1), a), {});
console.log(
  `\n✔ ${rel.linhas.length} telas · CAPTURADA ${resumo.CAPTURADA || 0} · DIVERGENTE ${
    resumo.DIVERGENTE || 0
  } · PENDENTE ${resumo.PENDENTE || 0}`
);
console.log(`  PDF: docs/capturas/RELATORIO_CAPTURAS.pdf`);
process.exit(0);
