/*
  F1 (decisão do Daniel, 12/10): nenhum texto público, de SEO, de atendimento
  ou de e-mail afirma que 30–180 dias é "locação por temporada (art. 48)".
  O prazo "30 a 180 dias" continua; só a classificação jurídica sai até o
  parecer. Os modelos de contrato NÃO entram nesta varredura de propósito.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(process.cwd(), "src");

function arquivos(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, achados);
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.ts$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

const ALVOS = [
  ...arquivos(join(RAIZ, "app", "(public)")),
  ...arquivos(join(RAIZ, "lib", "seo")),
  ...arquivos(join(RAIZ, "lib", "atendimento")),
  ...arquivos(join(RAIZ, "components", "layout")),
  join(RAIZ, "app", "layout.tsx"),
  join(RAIZ, "app", "manifest.ts"),
  join(RAIZ, "app", "opengraph-image.tsx"),
  join(RAIZ, "app", "auth", "page.tsx"),
  join(RAIZ, "lib", "notifications", "templates.ts"),
  join(RAIZ, "lib", "agentes", "central.ts"),
];

const PROIBIDOS: Array<[string, RegExp]> = [
  ["art. 48", /art\.?\s*48/i],
  ["por temporada / para temporada", /(por|para|de)\s+temporada/i],
  ["Lei 8.245", /8\.245/],
];

for (const [nome, regra] of PROIBIDOS) {
  test(`texto público/SEO/atendimento não contém "${nome}"`, () => {
    const culpados = ALVOS.filter((f) => regra.test(readFileSync(f, "utf8"))).map((f) => f.replace(RAIZ, "src"));
    assert.deepEqual(culpados, []);
  });
}

test("telas do dono não classificam a locação como temporada (art. 48)", () => {
  const dono = arquivos(join(RAIZ, "app", "(dashboard)")).filter((f) =>
    /art\.?\s*48|locação\s+(por|para)\s+temporada|contrato\s+de\s+temporada/i.test(readFileSync(f, "utf8")),
  );
  assert.deepEqual(dono.map((f) => f.replace(RAIZ, "src")), []);
});

test("o prazo 30 a 180 dias continua no rodapé e no título", () => {
  assert.match(readFileSync(join(RAIZ, "components", "layout", "footer.tsx"), "utf8"), /30 a 180 dias/);
  assert.match(readFileSync(join(RAIZ, "app", "layout.tsx"), "utf8"), /estadias de 30 a 180 dias/);
});
