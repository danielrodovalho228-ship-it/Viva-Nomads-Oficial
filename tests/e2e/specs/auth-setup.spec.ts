import { test, expect } from "@playwright/test";
import { ALL_ROLES, type Role } from "../fixtures/accounts";
import { roleStatus } from "../fixtures/auth";

/**
 * Verificação de login (saída do global-setup) — separa os três baldes que o
 * revisor pediu, de forma HONESTA:
 *   • "ready"        → passa;
 *   • "missing"      → SKIP (falta de credencial = infra, não defeito);
 *   • "login_failed" → FALHA ALTA (credencial presente + login quebrado =
 *     DEFEITO de produto), com o erro do Supabase, a URL final e o screenshot.
 *
 * Assim um login quebrado NUNCA se esconde atrás de um skip de infra.
 */
test.describe("Setup — login das contas de teste @criticos", () => {
  for (const role of ALL_ROLES as Role[]) {
    test(`login do papel "${role}"`, async ({}, testInfo) => {
      const s = roleStatus(role);

      test.skip(
        s.status === "missing",
        `Credencial de "${role}" ausente (TESTES_${role.toUpperCase()}_*). SKIP por infra, não defeito.`
      );

      if (s.status === "login_failed") {
        if (s.screenshot) {
          await testInfo
            .attach(`login-fail-${role}`, { path: s.screenshot, contentType: "image/png" })
            .catch(() => {});
        }
        throw new Error(
          `LOGIN DO "${role}" FALHOU — defeito de produto (credenciais presentes).\n` +
            `erro: ${s.error ?? "(sem mensagem)"}\n` +
            `URL final: ${s.finalUrl ?? "(desconhecida)"}\n` +
            `screenshot: ${s.screenshot ?? "(não capturado)"}`
        );
      }

      expect(s.status, `papel "${role}" deveria estar autenticado`).toBe("ready");
    });
  }
});
