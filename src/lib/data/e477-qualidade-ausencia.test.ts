/*
  E477 (auditoria de 06/11): a conta observadora da QA (qa_admin) é admin com 2FA próprio, então passa em exigirAdmin/sessaoAal2. Uma
  varredura das ações de servidor que gravam e exigem admin achou o que ainda ficou sem a guarda do observador:
   • Qualidade (adminDefinirCorrecao, adminFecharCorrecao, adminEstadoDenuncia): gravam correções e o estado das denúncias, que são
     dado real do atendimento; e a tela mostrava os formulários habilitados ao observador;
   • registrarAusencia (vistoria): o ramo "admin" deixava o observador registrar a ausência de qualquer visita.
  Agora as ações recusam o observador ANTES da primeira escrita, a tela de Qualidade mostra "Só leitura" no lugar dos formulários e o ramo
  admin da ausência só vale para dado de teste (mesma regra das outras ações: dado real é só leitura; dado de teste segue liberado).
  Roda: node --test src/lib/data/e477-qualidade-ausencia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const ESCRITA = /\.(insert|update|upsert|delete)\(|notify\(|avisar\(|passarAoProximo\(|\.rpc\(/;

function corpo(src: string, fn: string): string {
  const i = src.search(new RegExp(`export async function ${fn}\\b`));
  assert.ok(i >= 0, `${fn} existe`);
  const fim = src.indexOf("\n}\n", i);
  return src.slice(i, fim);
}

for (const fn of ["adminDefinirCorrecao", "adminFecharCorrecao", "adminEstadoDenuncia"]) {
  test(`${fn}: recusa a conta observadora antes da primeira escrita`, () => {
    const src = ler("src/lib/saida/acoes.ts");
    assert.match(src, /import \{ recusaObservador \} from "@\/lib\/qa\/observador";/);
    const c = corpo(src, fn);
    const g = c.indexOf("recusaObservador(");
    assert.ok(g >= 0, "tem a guarda");
    const e = c.search(ESCRITA);
    assert.ok(e < 0 || g < e, "a guarda vem antes da primeira escrita");
  });
}

test("registrarAusencia: o ramo admin recusa o observador (dado de teste segue liberado) antes de avisar ou passar ao próximo", () => {
  const src = ler("src/lib/vistoria/actions.ts");
  assert.match(src, /import \{ recusaObservador \} from "@\/lib\/qa\/observador";/);
  const c = corpo(src, "registrarAusencia");
  const g = c.indexOf("recusaObservador(");
  assert.ok(g >= 0, "tem a guarda");
  // só quando quem age é o admin (dono e avaliador seguem exatamente como antes), com o imóvel como alvo (dado de teste liberado)
  assert.match(c, /if \(ehAdmin &&[^\n]*\{\n\s*const recusaQa = await recusaObservador\(s\.userId, \{ imoveis: \[/);
  assert.ok(g < c.search(ESCRITA), "a guarda vem antes da primeira escrita");
});

test("a tela de Qualidade mostra 'Só leitura' ao observador no lugar dos três formulários", () => {
  const p = ler("src/app/(dashboard)/admin/qualidade/page.tsx");
  assert.match(p, /import \{ soLeituraNaTela \} from "@\/lib\/qa\/observador";/);
  assert.match(p, /import \{ SoLeituraQa \} from "@\/components\/admin\/so-leitura-qa";/);
  assert.match(p, /const soLeitura = \(await soLeituraNaTela\(\[\{ id: "configuracao" \}\]\)\)\.length > 0;/);
  const casos = [...p.matchAll(/<FormAcao acao=\{(adminDefinirCorrecao|adminFecharCorrecao|adminEstadoDenuncia)\}/g)].map((m) => m[1]);
  assert.equal(casos.length, 3, "os três formulários continuam na tela");
  // cada formulário só aparece sem soLeitura; com ele, o aviso
  assert.match(p, /soLeitura \? <SoLeituraQa \/> : \(\s*<div className="mt-2 grid gap-3 md:grid-cols-2">/);
  assert.match(p, /soLeitura \? <SoLeituraQa \/> : \(\s*<FormAcao acao=\{adminEstadoDenuncia\}/);
});
