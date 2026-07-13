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

// 3) Vazamento de DADO DE DEMONSTRAÇÃO em superfície de usuário (QA 10/07):
//    personas e números de contrato fictícios ("Ana Carvalho", "VN-CT-2026-…")
//    só podem aparecer em código que renderiza SOB o gate de demonstração
//    (useDashDemo / demo ? …). Se uma dessas strings estiver numa tela sem gate,
//    ela vaza para conta real. A trava exige `consistency-ignore` na MESMA linha
//    quando o uso é legítimo (literal do seed/persona usado só no ramo demo).
const DEMO_LEAK = [
  /\bAna Carvalho\b/,
  /\bMarcos Andrade\b/,
  // Nome da conta de TESTE (inquilino-teste) — nunca pode ser hardcoded numa
  // superfície de usuário (item 1 do fechamento do QA: o nome vem SEMPRE do
  // perfil, via lib/display-name; nada de string de nome na UI).
  /\bLucas Gabriel\b/,
  /\b(?:CTR|VN-CT)-20\d{2}-\d{3,4}\b/,
];

// 4) Jargão interno em superfície de USUÁRIO (ADENDO /qualificar, item 2).
//    "Camada 1/2" e "contrato-mãe" são alto-sinal → banidos direto (raros em
//    código). "gate/flag/lead" vivem legitimamente em CÓDIGO (nomes de
//    componente como PlanGate, flags.ts, classe CSS .lead, rota /api/test-lead)
//    — por isso só contam em linhas que NÃO parecem código. Caso legítimo:
//    `consistency-ignore` na mesma linha.
const JARGAO_DURO = [/\bCamada [12]\b/, /contrato-m[ãa]e/i];
const JARGAO_PALAVRA = /\b(gate|flag|lead)\b/i;

// 5) Overclaim jurídico da conferência de documentos (fila de moderação). Nós
//    conferimos o DOCUMENTO enviado — não atestamos propriedade nem garantimos o
//    imóvel. Banir "propriedade/imóvel verificado(a)/garantido(a)/conferido(a)/
//    comprovado(a)" em superfície de usuário. O selo correto é "Documentação
//    conferida". Escape legítimo: `consistency-ignore` na linha.
const OVERCLAIM = [
  /propriedade\s+(verificad|garantid|conferid|comprovad)[ao]/i,
  /im[óo]vel\s+(verificad|garantid|conferid|comprovad)o/i,
];

// 6) "Garantia/garantidor digital" é PROIBIDO em superfície de usuário: sugere
//    garantia DA plataforma (fere a regra de ouro). O produto do parceiro é
//    "seguro-fiança" (termo legal — art. 37, Lei 8.245). Um nome comercial só
//    nasce COM o parceiro assinado. A categoria guarda-chuva "Garantia
//    locatícia" continua permitida. Escape legítimo: `consistency-ignore`.
const GARANTIA_BANIDA = /\bgarant(ia|idor)\s+digital\b/i;

// 7) Termos de prazo fora do padrão. UI/marketing usam "média duração"; "média
//    estadia" e "curtíssimo prazo" são variações soltas e ficam banidas. Ver a
//    decisão de terminologia (temporada só em contexto jurídico — art. 48).
const PRAZO_BANIDO = [/m[ée]dia\s+estadia/i, /curt[íi]ssim[oa]\s+prazo/i];

// 8) Contato "liberado após o aceite" é PROIBIDO: telefone/e-mail nunca são
//    trocados — a conversa segue toda pela plataforma (regra de ouro). O aceite
//    revela IDENTIDADE (nome + foto), não contato. Exige a palavra "contato"
//    perto de "liberad(o) ... aceite" — NÃO pega "endereço liberado após o
//    aceite" (revelação legítima do endereço). Escape: `consistency-ignore`.
const CONTATO_BANIDO = /\bcontato\b(?:(?!\.).){0,60}liberad[ao](?:(?!\.).){0,25}aceite/i;
function pareceCodigo(linha) {
  const t = linha.trimStart();
  return (
    t.startsWith("//") ||
    t.startsWith("*") ||
    t.startsWith("/*") ||
    t.startsWith("{/*") || // comentário JSX
    t.startsWith("import ") ||
    t.startsWith("export ") ||
    /className|styles\.|PlanGate|plan-gate|\/api\/|test-lead|\.module\.css|href=|src=/.test(linha)
  );
}

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
      for (const rx of DEMO_LEAK) {
        if (rx.test(line))
          violations.push({
            rel,
            n: i + 1,
            why: `dado de demonstração fora do gate demo (${rx})`,
            line: line.trim(),
          });
      }
      // Jargão só conta em TEXTO de tela: pula rotas /api e linhas que parecem
      // código (comentários, imports, classes, nomes de componente/CSS/rota).
      if (!rel.includes("/api/") && !pareceCodigo(line)) {
        for (const rx of JARGAO_DURO) {
          if (rx.test(line))
            violations.push({ rel, n: i + 1, why: `jargão interno na tela (${rx})`, line: line.trim() });
        }
        if (JARGAO_PALAVRA.test(line))
          violations.push({ rel, n: i + 1, why: "jargão interno na tela (gate/flag/lead)", line: line.trim() });
        for (const rx of OVERCLAIM) {
          if (rx.test(line))
            violations.push({
              rel,
              n: i + 1,
              why: `overclaim: conferimos o documento, não a propriedade (${rx})`,
              line: line.trim(),
            });
        }
        if (GARANTIA_BANIDA.test(line))
          violations.push({
            rel,
            n: i + 1,
            why: "garantia 'digital' sugere garantia da plataforma — use 'seguro-fiança'",
            line: line.trim(),
          });
        for (const rx of PRAZO_BANIDO) {
          if (rx.test(line))
            violations.push({
              rel,
              n: i + 1,
              why: `termo de prazo fora do padrão (${rx}) — use "média duração" / "curta duração"`,
              line: line.trim(),
            });
        }
        if (CONTATO_BANIDO.test(line))
          violations.push({
            rel,
            n: i + 1,
            why: "contato NUNCA é liberado — telefone/e-mail não são trocados; a conversa segue pela plataforma (o aceite revela identidade, não contato)",
            line: line.trim(),
          });
      }
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
