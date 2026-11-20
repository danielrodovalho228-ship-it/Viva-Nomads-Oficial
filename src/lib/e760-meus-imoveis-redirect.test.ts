/*
  E760 — /dashboard/meus-imoveis (rota antiga) redireciona para /dashboard/imoveis, e nenhum link interno aponta para ela.
  Roda: node --test src/lib/e760-meus-imoveis-redirect.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

test("next.config redireciona a rota antiga e as subrotas para a lista de anúncios atual", () => {
  const cfg = readFileSync("next.config.ts", "utf8");
  assert.match(cfg, /source: "\/dashboard\/meus-imoveis", destination: "\/dashboard\/imoveis"/);
  assert.match(cfg, /source: "\/dashboard\/meus-imoveis\/:path\*", destination: "\/dashboard\/imoveis\/:path\*"/);
  assert.ok(existsSync("src/app/(dashboard)/dashboard/imoveis/page.tsx"), "o destino existe");
  assert.ok(!existsSync("src/app/(dashboard)/dashboard/meus-imoveis"), "a rota antiga não existe mais como página");
});

test("nenhum link interno (telas, e-mails, textos, migrações) aponta para /dashboard/meus-imoveis", () => {
  const achados: string[] = [];
  const varrer = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) {
        if (nome !== "node_modules" && nome !== ".next") varrer(p);
      } else if (/\.(ts|tsx|sql|json|md)$/.test(nome) && !/\.test\.ts$/.test(nome) && !p.endsWith("e760-meus-imoveis-redirect.test.ts")) {
        if (/\/dashboard\/meus-imoveis/.test(readFileSync(p, "utf8"))) achados.push(p);
      }
    }
  };
  varrer("src");
  varrer("supabase");
  assert.deepEqual(achados, []);
});
