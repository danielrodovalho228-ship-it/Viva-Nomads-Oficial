import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";

/*
  T1571 — E722 (#3479, migração 0334): pré-aceitação de 72 horas, atrás da chave PRE_ACEITACAO_72H_ATIVA (desligada). Guarda no laboratório:
    1. banco (todas as migrações aplicadas): as colunas pre_aceitacao_* existem em `propostas` (propostas antigas ficam sem prazo);
    2. cron /api/cron/pre-aceitacao: sem cabeçalho ou com segredo errado não executa nada (401; 503 se o ambiente não tem CRON_SECRET).
  O fluxo completo (lembretes 24 h/6 h, expiração, reabertura, corrida) está nos testes de unidade do PR e só roda com a chave ligada.
*/
const COLUNAS = [
  "pre_aceitacao_ate",
  "pre_aceitacao_reaberturas",
  "pre_aceitacao_lembrete_24h_em",
  "pre_aceitacao_lembrete_6h_em",
  "pre_aceitacao_expirou_em",
  "pre_aceitacao_perdeu_em",
  "pre_aceitacao_encerrada_em",
  "pre_aceitacao_dono_ate",
];

test.describe("T1571 — E722: pré-aceitação de 72 h (0334)", () => {
  test("cron sem segredo ou com segredo errado não executa (401/503)", async ({ request }) => {
    const sem = await request.get("/api/cron/pre-aceitacao");
    expect([401, 503]).toContain(sem.status());
    const errado = await request.get("/api/cron/pre-aceitacao", { headers: { authorization: "Bearer segredo-errado" } });
    expect([401, 503]).toContain(errado.status());
  });

  test("as 8 colunas pre_aceitacao_* existem em propostas", async () => {
    test.skip(!NO_LABORATORIO, "Só no laboratório.");
    const { error } = await adm().from("propostas").select(COLUNAS.join(",")).limit(1);
    expect(error, JSON.stringify(error)).toBeNull();
  });
});
