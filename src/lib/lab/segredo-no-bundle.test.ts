import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Nenhum segredo no bundle do navegador (.next/static). Só roda depois de
 * `npm run build` (o laboratório faz isso); sem build, é pulado.
 * Ordem 2567f1af (LAB 1/2, parte C).
 */
const STATIC = join(process.cwd(), ".next/static");

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else if (/\.(js|css|map|json|html)$/.test(n)) acc.push(p);
  }
  return acc;
}

/** Padrões de segredo (valor, não nome de variável — nomes aparecem em mensagens de erro). */
export const PADROES_SEGREDO: Array<[string, RegExp]> = [
  ["JWT service_role", /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/],
  ["chave sb_secret", /sb_secret_[A-Za-z0-9_-]{16,}/],
  ["chave Anthropic", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["chave Resend", /re_[A-Za-z0-9]{24,}/],
  ["token Asaas", /\$aact_[A-Za-z0-9_.-]{20,}/],
  ["chave privada", /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/],
];

test("detector pega um JWT service_role de exemplo (caso negativo do varredor)", () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "service_role", iss: "supabase" })}.assinaturaFalsa1234567890`;
  assert.ok(PADROES_SEGREDO[0][1].test(`const k="${jwt}"`));
  assert.ok(!PADROES_SEGREDO[0][1].test(`const k="${b64({ alg: "HS256" })}.${b64({ role: "anon" })}.x1234567890"`));
});

test("bundle do navegador sem segredo", { skip: !existsSync(STATIC) && "sem .next/static (rode npm run build)" }, () => {
  const achados: string[] = [];
  for (const f of arquivos(STATIC)) {
    const txt = readFileSync(f, "utf8");
    for (const [nome, re] of PADROES_SEGREDO) if (re.test(txt)) achados.push(`${nome} em ${f}`);
  }
  assert.deepEqual(achados, []);
});
