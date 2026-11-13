/*
  E804: o pagamento é dito de UM jeito nas páginas públicas — direto ao proprietário, a Viva só conecta e nunca retém valores
  (aluguel e caução diretos ao dono). Guarda: /para-proprietarios e /como-funciona dizem "direto" (na conta do dono / ao
  proprietário) e nenhuma página pública diz que o morador paga "na plataforma" ou "sem intermediários".
  Roda: node --test src/lib/e804-pagamento-direto.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

test("as duas páginas dizem 'direto' ao proprietário e que nada passa pela Viva", () => {
  const prop = ler("app/(public)/para-proprietarios/page.tsx");
  assert.match(prop, /Pagamento mensal direto na sua conta\./);
  const cf = ler("app/(public)/como-funciona/page.tsx");
  assert.match(cf, /recebe direto na sua conta/);
  assert.match(cf, /Vão direto ao proprietário e ficam registrados na plataforma\. Nada passa pela Viva Nomads\./);
});

test("nenhuma página pública diz que o morador paga na plataforma ou 'sem intermediários'", () => {
  const arquivos: string[] = [];
  const andar = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) arquivos.push(p);
    }
  };
  andar(join(RAIZ, "app/(public)"));
  const proibido = /paga[^."]{0,40}(direto )?na plataforma|sem intermedi[aá]rios/i;
  const achados = arquivos.filter((p) => proibido.test(readFileSync(p, "utf8"))).map((p) => p.replace(RAIZ, ""));
  assert.deepEqual(achados, []);
});
