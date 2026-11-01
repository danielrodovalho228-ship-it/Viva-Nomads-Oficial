import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
function tsx(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? tsx(p) : n.endsWith(".tsx") && !n.includes(".test.") ? [p] : [];
  });
}

test("varredura 01/11: nenhum datetime-local nativo fora do CampoDataHora (mm/dd/yyyy e AM/PM em navegador em inglês)", () => {
  const achados = tsx(raiz)
    .filter((f) => !f.endsWith("components/ui/campo-data.tsx"))
    .filter((f) => /type="datetime-local"/.test(readFileSync(f, "utf8")));
  assert.deepEqual(achados, []);
});

test("varredura 01/11: CampoDataHora — data dd/mm/aaaa + hora em 24 h no computador; nativo sem value controlado no toque", () => {
  const c = readFileSync(join(raiz, "components/ui/campo-data.tsx"), "utf8");
  assert.match(c, /export function CampoDataHora\(/);
  assert.match(c, /const HORAS = Array\.from\(\{ length: 33 \}/);
  // O valor inteiro "AAAA-MM-DDTHH:MM" preenchido no campo da data vale (os specs e quem cola).
  assert.match(c, /aceitarTexto=\{\(bruto\) => \{\s+const t = DATA_HORA\.exec\(bruto\);/);
  assert.match(c, /if \(aceitarTexto\?\.\(bruto\.trim\(\)\)\) return;/);
  assert.match(c, /defaultValue=\{value\}\s+onChange=\{\(e\) => \{\s+ultimo\.current = e\.target\.value;/);
  assert.match(c, /export function CampoDataHoraFormulario\(/);
});

test("varredura 01/11: os seis campos de data e hora usam o campo do site", () => {
  const usa = (rel: string, re: RegExp) => assert.match(readFileSync(join(raiz, rel), "utf8"), re, rel);
  usa("components/property/visita-video.tsx", /<CampoDataHora\s+key=\{h\.id\}/);
  usa("components/visitas/cartao-visita.tsx", /<CampoDataHora\s+testid="visita-outro-horario"/);
  usa("app/(dashboard)/dashboard/servicos/pedidos/[id]/pedido-tela.tsx", /<CampoDataHora rotulo="Outro horário \(horário de Brasília\)"/);
  usa("components/parceiros/solicitar-orcamento.tsx", /<CampoDataHora\s+key=\{i\}/);
  usa("components/vistoria/bloco-avaliacao-dono.tsx", /<CampoDataHoraFormulario name="quando" required/);
  usa("app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx", /<CampoDataHoraFormulario name="quando" required/);
});
