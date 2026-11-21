import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";

/*
  T931 — E293 relatório honesto (#2017, Pista B): o relatório simulado de retenção (eliminacoes_simulado, gravado pela
  rodada de eliminação dentro do cron das automações) passa a CONTAR os cinco itens de fase 2 com prazo declarado —
  medição do morador (internet_medicoes/morador), motivo da saída, denúncia resolvida, eventos e push_envios — em vez
  do "0 vencidos" sem ninguém ter contado. Os coletores só contam: a fase 2 nunca apaga.
  Prova: um 2º servidor do mesmo build (porta 3191) com um CRON_SECRET só dele roda o cron em MODO SIMULADO
  (?simular=1 — nada é enviado nem apagado; sem AUTOMACOES_ATIVO). Depois: a rodada de eliminação volta sem falhas e,
  para cada um dos cinco itens, há linha do dia de hoje (BRT) em eliminacoes_simulado gerada nesta rodada, com
  real = false e os números de vencidos preenchidos (≥ 0).
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3191;
const SEGREDO = `lab-t931-${Math.random().toString(36).slice(2)}`;
const ITENS = ["internet_medicoes/morador", "saidas_motivos", "denuncias_anuncio", "eventos", "push_envios"];
let servidor: ChildProcess | null = null;

test.describe("T931 — E293 (#2017): o relatório simulado conta os itens de fase 2", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 180_000 });
  test.afterAll(() => {
    servidor?.kill("SIGTERM");
  });

  test("cron simulado: eliminação sem falhas e as cinco linhas do dia gravadas", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    mkdirSync(SAIDA, { recursive: true });
    const log = createWriteStream(`${SAIDA}/t931-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);

    const inicio = new Date(Date.now() - 5_000).toISOString();
    const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes?simular=1`, { headers: { authorization: `Bearer ${SEGREDO}` } });
    const corpo = (await r.json().catch(() => ({}))) as { simulado?: boolean; eliminacao?: { eliminados: number; simulados: number; falhas: number } };
    console.log(`t931|cron|status=${r.status}|simulado=${corpo.simulado}|eliminacao=${JSON.stringify(corpo.eliminacao)}`);
    expect(r.status).toBe(200);
    expect(corpo.simulado, "modo simulado").toBe(true);
    expect(corpo.eliminacao?.eliminados, "simulado: nada apagado").toBe(0);
    expect(corpo.eliminacao?.falhas, "nenhum coletor falhou (inclusive os cinco de fase 2)").toBe(0);

    const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const { data, error } = await adm().from("eliminacoes_simulado").select("item, vencidos, vencidos_teste, real, gerado_em").eq("dia", dia).in("item", ITENS);
    expect(error).toBeNull();
    for (const l of data ?? []) console.log(`t931|linha|${JSON.stringify(l)}`);
    for (const item of ITENS) {
      const l = (data ?? []).find((x) => x.item === item);
      expect(l, `${item}: linha do dia no relatório`).toBeTruthy();
      expect(Date.parse(String(l!.gerado_em)) >= Date.parse(inicio), `${item}: gerada nesta rodada`).toBe(true);
      expect(l!.real, `${item}: fase 2 nunca apaga`).toBe(false);
      expect(Number(l!.vencidos), `${item}: vencidos contados`).toBeGreaterThanOrEqual(0);
    }
  });
});
