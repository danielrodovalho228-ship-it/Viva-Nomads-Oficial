import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

/*
  Prompt 60 — correção de segurança das dependências (auditoria de 22/10). Estas guardas impedem que uma volta de
  versão (merge antigo, lockfile regenerado) traga de volta o que foi corrigido.
*/
const raiz = new URL("../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, raiz), "utf8");
const pkg = JSON.parse(ler("package.json"));
const lock = JSON.parse(ler("package-lock.json")) as { packages: Record<string, { version?: string }> };

const partes = (v: string) => v.replace(/^[^\d]*/, "").split(/[.-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
const pelo = (v: string, minimo: string) => {
  const [a, b] = [partes(v), partes(minimo)];
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};
/** Todas as cópias de um pacote no lockfile (o npm pode instalar mais de uma). */
const copias = (nome: string) =>
  Object.entries(lock.packages)
    .filter(([caminho]) => caminho === `node_modules/${nome}` || caminho.endsWith(`/node_modules/${nome}`))
    .map(([caminho, p]) => ({ caminho, versao: p.version ?? "0.0.0" }));

const MINIMOS: Record<string, string> = {
  next: "16.4.2", // crítica: desvio do proxy/middleware no App Router e DoS em Server Actions
  sharp: "0.35.5", // alta: libvips/libheif no processamento das fotos enviadas
  postcss: "8.5.23", // alta: XSS e leitura de arquivo
  nanoid: "3.3.18", // alta
  "source-map-js": "1.2.2", // alta
  "baseline-browser-mapping": "2.11.0", // moderada
};

test("Prompt 60: next e eslint-config-next fixos em 16.4.2 ou mais no package.json", () => {
  for (const nome of ["next", "eslint-config-next"]) {
    const v = pkg.dependencies?.[nome] ?? pkg.devDependencies?.[nome];
    assert.ok(v, `${nome} no package.json`);
    assert.ok(pelo(v, "16.4.2"), `${nome} ${v} < 16.4.2`);
  }
});

test("Prompt 60: nenhuma cópia vulnerável no package-lock.json", () => {
  for (const [nome, minimo] of Object.entries(MINIMOS)) {
    const c = copias(nome);
    assert.ok(c.length > 0, `${nome} está no lockfile`);
    for (const { caminho, versao } of c) assert.ok(pelo(versao, minimo), `${caminho} ${versao} < ${minimo}`);
  }
});

test("Prompt 60: todo setup-node dos workflows usa Node 24.22.1 ou superior (CVE-2026-111497, Brotli)", () => {
  const pasta = new URL(".github/workflows/", raiz);
  let vistos = 0;
  for (const arq of readdirSync(pasta).filter((f) => /\.ya?ml$/.test(f))) {
    const yml = readFileSync(new URL(arq, pasta), "utf8");
    for (const m of yml.matchAll(/uses:\s*actions\/setup-node@[^\n]*\n((?:\s+[^\n]*\n){0,6})/g)) {
      vistos++;
      const versao = /node-version:\s*["']?([^"'\s]+)/.exec(m[1])?.[1];
      assert.ok(versao, `${arq}: setup-node sem node-version explícito`);
      assert.match(versao!, /^\d+\.\d+\.\d+$/, `${arq}: node-version ${versao} deve ser exata (24.22.1 ou superior)`);
      assert.ok(pelo(versao!, "24.22.1"), `${arq}: node-version ${versao} < 24.22.1`);
    }
  }
  assert.ok(vistos >= 8, `achou ${vistos} setup-node`);
});

test("Prompt 60: Dependabot semanal do npm, só PR de correção de segurança", () => {
  const yml = ler(".github/dependabot.yml");
  assert.match(yml, /package-ecosystem:\s*npm/);
  assert.match(yml, /interval:\s*weekly/);
  // Limite 0 desliga as PRs de versão comum; as de segurança não respeitam esse limite.
  assert.match(yml, /open-pull-requests-limit:\s*0\b/);
});
