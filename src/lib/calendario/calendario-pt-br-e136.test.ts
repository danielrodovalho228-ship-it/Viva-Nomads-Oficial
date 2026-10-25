import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/*
  E136 NÃO FECHOU (QA do Muse, 25/10): o pop-up do seletor de datas do navegador sai no idioma do NAVEGADOR. Guarda:
  ninguém abre o pop-up nativo (`showPicker`), e os campos de data de quem usa o site passam pelo campo do site
  (`CampoData`/`CampoDataUnico`), que no computador abre o calendário em pt-BR (`CalendarioBR`).
*/
const RAIZ = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

function arquivos(dir: string): string[] {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const rel = join(dir, n);
    if (statSync(join(RAIZ, rel)).isDirectory()) return arquivos(rel);
    return /\.tsx$/.test(n) && !/\.test\./.test(n) ? [rel] : [];
  });
}

// Só o toque usa o campo nativo (o calendário do aparelho); e formulários internos da equipe que enviam por `name`.
const NATIVO_PERMITIDO = new Set([
  "components/ui/campo-data.tsx",
  "app/(dashboard)/dashboard/imoveis/novo/campos.tsx",
  "app/(dashboard)/admin/documentos/emitidos-client.tsx",
  "app/(dashboard)/admin/qualidade/page.tsx",
]);

test("E136 — ninguém abre o pop-up de datas do navegador", () => {
  for (const f of arquivos(".")) {
    const src = ler(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.doesNotMatch(src, /showPicker\(/, `${f} abre o pop-up nativo (sai no idioma do navegador)`);
    if (!NATIVO_PERMITIDO.has(f)) assert.doesNotMatch(src, /type="date"/, `${f}: use CampoData (calendário em pt-BR)`);
  }
});

test("E136 — o campo do computador abre o calendário do site, e o cadastro, a busca e o parceiro usam esse campo", () => {
  const campo = ler("components/ui/campo-data.tsx");
  assert.match(campo, /<CalendarioBR/);
  assert.match(campo, /if \(!toque\)/);
  assert.match(ler("app/(dashboard)/dashboard/imoveis/novo/campos.tsx"), /<CampoDataTexto/);
  assert.match(ler("components/busca/barra-pilulas.tsx"), /<CampoData\b/);
  assert.match(ler("app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx"), /<CampoData\b/);
  assert.match(ler("app/(public)/pedidos/novo/page.tsx"), /<CampoData\b/);
  const cal = ler("components/ui/calendario-br.tsx");
  assert.match(cal, /TEXTOS_CALENDARIO\.limpar/);
  assert.match(cal, /TEXTOS_CALENDARIO\.hoje/);
  assert.match(cal, /rotuloDiaBR\(iso\)/);
  assert.doesNotMatch(cal, /toLocale|Intl\.DateTimeFormat\(undefined/);
});
