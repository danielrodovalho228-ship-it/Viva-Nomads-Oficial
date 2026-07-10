#!/usr/bin/env node
/*
  Trava de consistência (Varredura do Moacir → checagem permanente).
  Impede que a "família" do vazamento e o vocabulário proibido renasçam.

  Roda no CI (e local via `npm run check:consistency`). Sai com código != 0
  se achar violação — com arquivo:linha e o motivo.

  Escopo: superfícies de USUÁRIO (src/app, src/components), EXCLUINDO as
  ferramentas internas de modelagem (simulador de sócios), que são páginas
  admin/noindex onde "repasse de serviço" é legítimo.

  Exceção pontual: adicione `consistency-ignore` na mesma linha para permitir
  um caso específico e justificado.
*/
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src/app", "src/components"];
// Diretórios/arquivos isentos (ferramentas internas de modelagem de negócio).
const EXCLUDE = [
  "src/components/simulacao",
  "src/components/modelo-negocio",
  "src/app/(public)/simulacao",
  "src/app/(public)/roi",
  "src/app/(public)/modelodenegocio",
  "src/app/(public)/socios",
  "src/app/(public)/decisao",
];

// 1) Vocabulário que sugere a plataforma MOVIMENTANDO dinheiro (regra de ouro).
//    NOTA: "carteira" (portfólio de imóveis) e "reembolso" (devolução de caução)
//    são termos legítimos e NÃO entram aqui.
const MONEY = [
  /\bsaldo\b/i,
  /\brepasse\b/i,
  /receba pela plataforma/i,
  /processamos o pagamento/i,
  /movimenta(mos)? o dinheiro/i,
  /transferimos o (aluguel|valor)/i,
];

// 2) Vazamento de contato: join de perfil trazendo e-mail/telefone da outra
//    parte para o cliente (o defeito original do e-mail de interessado).
const PROFILE_LEAK = /profiles!.*\b(email|phone|telefone)\b/i;

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e);
    const rel = relative(ROOT, full);
    if (EXCLUDE.some((x) => rel.startsWith(x))) continue;
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|jsx?)$/.test(e) && !/\.test\./.test(e)) out.push(full);
  }
  return out;
}

const violations = [];
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file);
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (line.includes("consistency-ignore")) return;
      for (const rx of MONEY) {
        if (rx.test(line))
          violations.push({ rel, n: i + 1, why: `vocabulário de dinheiro (${rx})`, line: line.trim() });
      }
      if (PROFILE_LEAK.test(line))
        violations.push({ rel, n: i + 1, why: "join de perfil traz contato ao cliente", line: line.trim() });
    });
  }
}

// Também varre a camada de dados (src/lib/data) só para o vazamento de contato.
for (const file of walk(join(ROOT, "src/lib/data"))) {
  const rel = relative(ROOT, file);
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (line.includes("consistency-ignore")) return;
      if (PROFILE_LEAK.test(line))
        violations.push({ rel, n: i + 1, why: "join de perfil traz contato ao cliente", line: line.trim() });
    });
}

if (violations.length === 0) {
  console.log("✓ Consistência OK — sem vocabulário de dinheiro nem vazamento de contato em superfícies de usuário.");
  process.exit(0);
}

console.error(`\n✗ ${violations.length} violação(ões) de consistência:\n`);
for (const v of violations) {
  console.error(`  ${v.rel}:${v.n} — ${v.why}`);
  console.error(`      ${v.line}`);
}
console.error(
  "\nCorrija o texto (regra de ouro: a plataforma nunca movimenta dinheiro; nunca expõe contato antes do aceite)."
);
console.error("Se for um caso legítimo e justificado, marque a linha com `consistency-ignore`.\n");
process.exit(1);
