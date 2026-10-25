/*
  ADMIN-3 — /admin/sistema ("Chaves e integrações").
  Roda: node --test src/config/chaves-ambiente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CHAVES_AMBIENTE, CHAVES_PLATAFORMA } from "./chaves-ambiente.ts";
import { PAGINAS_BARRA_ADMIN } from "./menu-admin.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const SISTEMA = "src/app/(dashboard)/admin/sistema/page.tsx";

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

test("a lista das chaves de ambiente cobre TODAS as exportações de src/lib/flags.ts (e nada além)", () => {
  const exportadas = [...ler("src/lib/flags.ts").matchAll(/^export const (\w+)/gm)].map((m) => m[1]).sort();
  assert.deepEqual(CHAVES_AMBIENTE.map((c) => c.nome).sort(), exportadas);
  for (const c of CHAVES_AMBIENTE) {
    assert.ok(c.rotulo.length > 5, c.nome);
    assert.match(ler("src/lib/flags.ts"), new RegExp(`process\\.env\\.${c.variavel}\\b`), `${c.nome}: ${c.variavel}`);
  }
});

test("a lista de ambiente é só leitura: sem botão, sem formulário, só o estado ligada/desligada", () => {
  const p = ler(SISTEMA);
  const bloco = p.slice(p.indexOf('data-testid="chaves-ambiente"'), p.indexOf('aria-labelledby="sistema-saude-titulo"'));
  assert.doesNotMatch(bloco, /<button|<Button|<form|onClick|process\.env/);
  assert.match(bloco, /valores\[c\.nome\] \? "Ligada" : "Desligada"/);
});

test("nenhuma chave aparece fora de /admin/sistema (as telas antigas só têm o aviso de uma linha)", () => {
  const telas = arquivos("src/app").filter((f) => f !== SISTEMA);
  for (const f of telas) {
    const s = ler(f);
    assert.doesNotMatch(s, /<ChaveSmsPainel|<ParceiroGeralForm/, f);
  }
  assert.match(ler(SISTEMA), /<ChaveSmsPainel /);
  assert.match(ler(SISTEMA), /<ParceiroGeralForm /);
  assert.match(ler("src/app/(dashboard)/admin/pedidos/page.tsx"), /data-testid="aviso-chave-sms"/);
  assert.match(ler("src/app/(dashboard)/admin/parceiros/page.tsx"), /data-testid="aviso-chaves-parceiros"/);
  assert.doesNotMatch(ler("src/app/(dashboard)/admin/parceiros/page.tsx"), /data-testid="chave-pagamento-parceiros"/);
});

test("as duas chaves da plataforma pedem confirmação na página e usam as ações que já existiam", () => {
  assert.deepEqual(CHAVES_PLATAFORMA.map((c) => c.chave), ["SMS_ATIVO", "PARCEIRO_GERAL_FALLBACK"]);
  const sms = ler("src/components/admin/chave-sms.tsx");
  assert.match(sms, /definirChaveSms\(!ligada\)/);
  assert.match(sms, /data-testid="chave-sms-confirmacao"/);
  const geral = ler("src/components/admin/parceiro-geral-form.tsx");
  assert.match(geral, /definirParceiroGeral\(/);
  assert.match(geral, /<ConfirmarNaPagina/);
});

test("a saúde (IA, Detecção, Backup, E-mail, Mapas, Push) saiu da inicial e mora em Sistema; o item está na barra", () => {
  const inicial = ler("src/app/(dashboard)/admin/page.tsx");
  const sistema = ler(SISTEMA);
  for (const c of ["PainelIaCadastro", "ContadorDeteccao", "CartaoBackup", "CartaoEntradaEmail", "CartaoMapas", "CartaoPush"]) {
    assert.doesNotMatch(inicial, new RegExp(`<${c} `), c);
    assert.match(sistema, new RegExp(`<${c} />`), c);
  }
  assert.ok(PAGINAS_BARRA_ADMIN.some((i) => i.href === "/admin/sistema" && i.rotulo === "Chaves e integrações"));
});
