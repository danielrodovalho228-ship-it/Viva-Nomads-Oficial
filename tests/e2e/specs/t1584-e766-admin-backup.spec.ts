import { test, expect } from "@playwright/test";

/*
  T1584 — E766 (#3573): /admin/backup e /admin/backups davam 404; agora levam ao cartão completo do backup em /admin/sistema#backup (redirect
  temporário, 307, nunca permanente nem 404). Guarda determinística do redirecionamento (a página de destino exige login de admin: o redirect
  acontece antes). O resumo "Última cópia OK / Último teste OK" na inicial do /admin depende de massa de backups_execucoes e fica na varredura do admin.
*/
test.use({ storageState: { cookies: [], origins: [] } });

for (const rota of ["/admin/backup", "/admin/backups"]) {
  test(`${rota} redireciona (307) para /admin/sistema#backup`, async ({ request }) => {
    const r = await request.get(rota, { maxRedirects: 0 });
    expect(r.status(), "redirect temporário, não 404 nem 308").toBe(307);
    expect(r.headers()["location"] ?? "").toMatch(/\/admin\/sistema(#backup)?$/);
  });
}
