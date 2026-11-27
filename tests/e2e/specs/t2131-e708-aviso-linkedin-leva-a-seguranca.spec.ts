import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2131 — E708 @E708: o aviso de vencimento do LinkedIn (cron diário) leva à Conta › Segurança.
  Regra decidida (E708; unitário src/lib/linkedin/e708-rotas-de-retorno.test.ts): a lista de confiança com a linha do
  LinkedIn mora em /dashboard/conta/seguranca (E66). A volta do conectar e do retorno (provada pelo t323 e pelo t351) e
  o aviso do cron "linkedin_vencendo" usam essa rota, nunca /dashboard/conta/privacidade. Esta spec prova a parte do
  cron, que nenhuma outra spec cobre.
  Conta com o selo "LinkedIn conectado" a vencer em 20 dias e sem aviso dado. O cron /api/cron/linkedin sobe num 2º
  servidor do mesmo build (porta 3131), com um CRON_SECRET só dele (padrão do t597 e do t711):
    1. a rodada avisa e marca aviso_em (uma vez só: a 2ª rodada não avisa de novo);
    2. o aviso do sino (avisos, evento linkedin_vencendo) aponta para /dashboard/conta/seguranca;
    3. aberto, esse destino mostra a linha do LinkedIn (a tela onde a pessoa reconecta). 390 e 1280 px.
*/
const PORTA = 3131;
const SEGREDO = `lab-t2131-${Math.random().toString(36).slice(2)}`;
const SAIDA_LOG = "tests/laboratorio/saida";
const ROTA_SEGURANCA = "/dashboard/conta/seguranca";
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `lnk.t2131.${sufixo}@lab.vivanomads.test`, nome: "Lia Linkedin", role: "tenant" as const };
const ids: Record<string, string> = {};
let servidor: ChildProcess | null = null;

async function rodarCron(): Promise<{ ok?: boolean; avisos?: number }> {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/linkedin`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const corpo = (await r.json().catch(() => ({}))) as { ok?: boolean; avisos?: number };
  expect(r.status, JSON.stringify(corpo)).toBe(200);
  return corpo;
}

test.describe("T2131 — E708: o aviso de vencimento do LinkedIn aponta para Conta › Segurança @E708", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.pessoa);
    const agora = Date.now();
    const { error } = await adm().from("confianca_linkedin").insert({
      user_id: ids.pessoa,
      // A tabela só aceita o HMAC do sub (64 hex): um valor aleatório no mesmo formato.
      sub_hash: randomBytes(32).toString("hex"),
      conectado_em: new Date(agora - 345 * 86_400_000).toISOString(),
      valido_ate: new Date(agora + 20 * 86_400_000).toISOString(),
      aviso_em: null,
    });
    if (error) throw error;
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (ids.pessoa) {
      await adm().from("avisos").delete().eq("usuario_id", ids.pessoa);
      await adm().from("confianca_linkedin").delete().eq("user_id", ids.pessoa);
    }
    await apagarContas([ids.pessoa]);
  });

  test("o cron avisa uma vez, o aviso leva a /dashboard/conta/seguranca, e lá está a linha do LinkedIn", async ({ browser }) => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const log = createWriteStream(`${SAIDA_LOG}/t2131-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/linkedin`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);

    // 1. a rodada avisa e marca; a 2ª não avisa de novo esta conta
    const primeira = await rodarCron();
    expect(primeira.ok).toBe(true);
    const { data: linha } = await adm().from("confianca_linkedin").select("aviso_em").eq("user_id", ids.pessoa).single();
    expect(linha?.aviso_em, "a conta ficou marcada como avisada").not.toBeNull();
    await rodarCron();

    // 2. o aviso do sino aponta para Segurança
    await expect
      .poll(async () => ((await adm().from("avisos").select("id").eq("usuario_id", ids.pessoa).eq("evento", "linkedin_vencendo")).data ?? []).length, { timeout: 30_000, message: "um aviso só, mesmo com 2 rodadas" })
      .toBe(1);
    const { data: avisos } = await adm().from("avisos").select("url").eq("usuario_id", ids.pessoa).eq("evento", "linkedin_vencendo");
    expect(avisos?.[0]?.url, "o destino do aviso").toBe(ROTA_SEGURANCA);

    // 3. o destino mostra a linha do LinkedIn
    for (const largura of [390, 1280] as const) {
      const p = await entrar(browser, pessoa.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      // A linha do LinkedIn fica atrás da chave LINKEDIN_CONECTAR_ATIVO, ligada só neste navegador pelo cookie do
      // laboratório (como o t323; em produção o cookie não vale nada).
      await p.context().addCookies([{ name: "vn_lab_linkedin", value: "1", url: new URL(p.url()).origin }]);
      await p.goto(avisos![0].url as string, { waitUntil: "domcontentloaded" });
      await expect(p).toHaveURL(new RegExp(`${ROTA_SEGURANCA}(\\?|#|$)`));
      await expect(p.getByTestId("confianca-linkedin"), `${largura} px: a linha do LinkedIn em Segurança, com o selo válido`).toHaveAttribute("data-situacao", "ok", { timeout: 30_000 });
      await p.context().close();
    }
  });
});
