/*
  E776 — gate de frases proibidas no CI + fontes únicas das frases reguladas.
  Roda: node --test src/lib/frases-proibidas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { FORA_DO_GATE, FRASES_PROIBIDAS, achadosProibidos, semComentarios } from "./frases-proibidas.ts";
import { CAUCAO_FRASE, CONTATO_NUNCA_TROCADO, DIFERENCIAL_CHAT, FRASE_CONVERSA_CHAT, NOTA_CONTATO_MENSAGENS, NOTA_VISITA_DONO, PASSO_CONVERSE_TEXTO, TEXTO_REGRA_UNICA } from "../config/textos-regulados.ts";

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "node_modules" || n === ".next" ? [] : arquivos(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

test("as regras pegam o que deve pegar e deixam passar o que é correto", () => {
  const ruim = {
    "contato-depois-do-aceite": ["telefone e contato direto só depois do aceite.", "Telefone e e-mail só aparecem depois do aceite.", "contato direto só depois do aceite"],
    "caucao-em-poupanca": ["Caução de até 3 vezes o valor mensal, depositada em poupança", "A Caução fica em uma poupança e volta", "Caução na poupança"],
    "taxa-cobrada-do-morador": ["a taxa é cobrada do morador no aceite", "taxa paga pelo inquilino"],
  } as const;
  for (const [id, frases] of Object.entries(ruim)) for (const f of frases) assert.ok(achadosProibidos(f).some((a) => a.id === id), `${id}: ${f}`);
  const boa = [FRASE_CONVERSA_CHAT, PASSO_CONVERSE_TEXTO, DIFERENCIAL_CHAT, NOTA_CONTATO_MENSAGENS, NOTA_VISITA_DONO, CAUCAO_FRASE, TEXTO_REGRA_UNICA, "Nome completo depois do aceite; telefone nunca é trocado.", "O endereço exato só é liberado após o aceite da candidatura."];
  for (const f of boa) assert.deepEqual(achadosProibidos(f), [], f);
});

test("GATE: nenhuma superfície de src/ usa uma formulação proibida (exceto as fora do gate, justificadas)", () => {
  const achados: string[] = [];
  for (const f of arquivos("src")) {
    const caminho = f.split("\\").join("/");
    if (FORA_DO_GATE.some((x) => caminho.startsWith(x.prefixo) || caminho === x.prefixo)) continue;
    if (caminho === "src/lib/frases-proibidas.ts") continue;
    for (const a of achadosProibidos(semComentarios(readFileSync(f, "utf8")).join("\n"))) achados.push(`${caminho} [${a.id}] ${a.trecho}`);
  }
  assert.deepEqual(achados, []);
});

test("as exceções do gate existem de verdade (nada de exceção para arquivo que sumiu)", () => {
  for (const x of FORA_DO_GATE) assert.ok(existsSync(x.prefixo), x.prefixo);
  assert.equal(new Set(FRASES_PROIBIDAS.map((r) => r.id)).size, FRASES_PROIBIDAS.length);
});

test("FONTE ÚNICA: as frases de contato vêm de textos-regulados e as telas as importam", () => {
  assert.match(FRASE_CONVERSA_CHAT, new RegExp(CONTATO_NUNCA_TROCADO));
  assert.match(PASSO_CONVERSE_TEXTO, new RegExp(CONTATO_NUNCA_TROCADO));
  const conversa = readFileSync("src/config/conversa-chat.ts", "utf8");
  assert.match(conversa, /from "\.\/textos-regulados\.ts"/);
  assert.doesNotMatch(conversa, /export const \w+ =/, "conversa-chat só reexporta");
  // E764 (main): o estado vazio das mensagens tem a própria fonte (lib/mensagens-vazio.ts); a tela só a usa, e o gate a varre.
  assert.match(readFileSync("src/app/(dashboard)/dashboard/mensagens/messages-client.tsx", "utf8"), /\{TEXTO_MENSAGENS_VAZIO\}/);
  assert.match(readFileSync("src/app/(dashboard)/dashboard/visitas/page.tsx", "utf8"), /NOTA_VISITA_DONO/);
  // Caução e taxas: uma fonte só, reexportada.
  const regulados = readFileSync("src/config/textos-regulados.ts", "utf8");
  assert.match(regulados, /export \{ CAUCAO_FRASE \} from "\.\.\/lib\/faixas\.ts"/);
  assert.match(regulados, /export \{ TEXTO_REGRA_UNICA \} from "\.\.\/lib\/cobranca\/regra\.ts"/);
});

test("E776: a frase que nega a troca de contato (E764) passa; o interior de comentário de bloco não é superfície", () => {
  assert.deepEqual(achadosProibidos("Telefone e e-mail nunca são trocados na conversa: aparecem como “contato protegido”, em qualquer fase, inclusive depois do aceite."), []);
  assert.equal(achadosProibidos("o telefone só aparece depois do aceite").length, 1, "a formulação proibida continua barrada");
  assert.deepEqual(semComentarios("/*\n  dizia telefone só depois do aceite\n*/\nconst a = 1;"), ["", "", "", "const a = 1;"]);
});

test("GATE (fora de src/): e-mails, seeds, scripts e arquivos públicos também não usam formulação proibida", () => {
  // Inventário E776: supabase/ (seeds, templates de e-mail), public/ e scripts/ estavam sem varredura. tests/ e docs/ ficam de fora
  // de propósito: guardam as formulações ruins como exemplo de teste e descrevem as próprias regras.
  const achados: string[] = [];
  const varrer = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const n of readdirSync(dir)) {
      if (n === "node_modules" || n === ".next" || n === "saida") continue;
      const p = join(dir, n);
      const s = statSync(p);
      if (s.isDirectory()) { varrer(p); continue; }
      if (!/\.(ts|tsx|mjs|js|sql|json|md|html|txt)$/.test(n) || s.size > 2_000_000) continue;
      const bruto = readFileSync(p, "utf8");
      const texto = /\.(ts|tsx|mjs|js)$/.test(n) ? semComentarios(bruto).join("\n") : bruto;
      for (const a of achadosProibidos(texto)) achados.push(`${p.split("\\").join("/")} [${a.id}] ${a.trecho}`);
    }
  };
  for (const raiz of ["supabase", "public", "scripts"]) varrer(raiz);
  assert.deepEqual(achados, []);
});
