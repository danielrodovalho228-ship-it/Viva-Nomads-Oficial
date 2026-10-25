/* Adendo ao prompt 28, item 3: o botão "Nova jornada de teste" sempre responde na tela; nada de janelinha do navegador. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { destinoForaDoPapel } from "../config/menu-painel.ts";
import { ACOES_JORNADA } from "./jornada-teste.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("guarda: nenhum window.confirm, alert( ou prompt( em src/ (o QA automatizado cancela em silêncio)", () => {
  const raiz = fileURLToPath(new URL("../", import.meta.url));
  const achados: string[] = [];
  const andar = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const c = join(dir, n);
      if (statSync(c).isDirectory()) andar(c);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n)) {
        readFileSync(c, "utf8")
          .split("\n")
          .forEach((linha, i) => {
            // Ignora comentários; uma chamada de verdade é "confirm(" colado (o texto "prompt (FAQ…)" não é chamada).
            const codigo = linha.trim().startsWith("*") || linha.trim().startsWith("/*") ? "" : linha.replace(/\/\/.*$/, "");
            if (/window\.(confirm|alert|prompt)\s*\(|(^|[^.\w])(confirm|alert|prompt)\(/.test(codigo)) achados.push(`${c.slice(raiz.length)}:${i + 1}`);
          });
      }
    }
  };
  andar(raiz);
  assert.deepEqual(achados, []);
});

test("Nova jornada: confirmação em dois passos na página e resultado sempre visível (criada / reaproveitada / erro)", () => {
  const tela = ler("../app/(dashboard)/admin/dados-de-teste/nova-jornada.tsx");
  assert.match(tela, /data-testid="jornada-confirmacao"/);
  assert.match(tela, /Confirmar e criar/);
  assert.match(tela, /A candidatura e\s+o contrato antigos ficam como histórico/);
  for (const id of ["jornada-ok", "jornada-erro", "jornada-numero", "jornada-motivo", "jornada-link", "jornada-link-candidaturas", "jornada-link-leads"])
    assert.match(tela, new RegExp(`data-testid="${id}"`), id);
  // Erro inesperado também vira texto na tela.
  assert.match(tela, /\.catch\(\(e: unknown\) =>/);
  const acao = ler("./data/jornada-teste-actions.ts");
  assert.match(acao, /logModeracao\(/);
  assert.match(acao, /ACOES_JORNADA\.erro/);
  assert.deepEqual(Object.keys(ACOES_JORNADA), ["criada", "reaproveitada", "erro"]);
  assert.match(ler("../app/(dashboard)/admin/dados-de-teste/page.tsx"), /Últimas jornadas de teste/);
});

test("Locações do dono: sem estadia própria, cai em Contratos & blocos e o menu não mostra 'Locações'", () => {
  assert.match(ler("../app/(dashboard)/dashboard/locacoes/page.tsx"), /locacoes\.length === 0 && \(await temImovelAnunciado\(\)\)\) redirect\("\/dashboard\/contratos"\)/);
  assert.match(ler("../config/menu-por-papel.ts"), /href: "\/dashboard\/locacoes", quando: \(ctx\) => !\(ctx\.temImovel && !ctx\.estadiaAtiva\)/);
  // O guarda do painel no navegador segue a mesma regra (no celular ele corria antes do servidor).
  assert.equal(destinoForaDoPapel("/dashboard/locacoes"), "/dashboard/contratos");
  assert.equal(destinoForaDoPapel("/dashboard/favoritos"), "/dashboard");
  assert.match(ler("../components/layout/dashboard-shell.tsx"), /router\.replace\(destinoForaDoPapel\(pathname\)\)/);
});
