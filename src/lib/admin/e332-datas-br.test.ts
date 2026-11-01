import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.tsx$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

test("E332 — nenhum campo de data nativo (mm/dd/yyyy em navegador em inglês) nas telas do admin", () => {
  const telas = [...arquivos(join(raiz, "app/(dashboard)/admin")), ...arquivos(join(raiz, "components/admin"))];
  assert.ok(telas.length > 20);
  const nativos = telas.filter((f) => /type="(date|datetime-local)"/.test(readFileSync(f, "utf8")));
  assert.deepEqual(nativos, []);
});

test("E332 — Documentos (De/Até) e Qualidade (Prazo) usam o campo dd/mm/aaaa do site, enviando ISO pelo name", () => {
  const emitidos = readFileSync(join(raiz, "app/(dashboard)/admin/documentos/emitidos-client.tsx"), "utf8");
  assert.match(emitidos, /<CampoDataFormulario name="de" defaultValue=\{filtros\.de \?\? ""\}/);
  assert.match(emitidos, /<CampoDataFormulario name="ate" defaultValue=\{filtros\.ate \?\? ""\}/);
  const qualidade = readFileSync(join(raiz, "app/(dashboard)/admin/qualidade/page.tsx"), "utf8");
  assert.match(qualidade, /<CampoDataFormulario name="prazo" required/);
  const campo = readFileSync(join(raiz, "components/ui/campo-data.tsx"), "utf8");
  assert.match(campo, /export function CampoDataFormulario\(/);
  assert.match(campo, /\{name && <input type="hidden" name=\{name\} value=\{value\} \/>\}/);
  assert.match(campo, /placeholder="dd\/mm\/aaaa"/);
});
