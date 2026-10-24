/*
  VOCAB-A — guarda automática do vocabulário: "comissão" e "inquilino" não aparecem em TEXTO VISÍVEL de página pública
  ou tela logada (strings de JSX e textos de config). Fora da guarda: nomes de variáveis e chaves (sem espaço), /termos e
  /privacidade (congelados até o parecer jurídico) e as telas de admin e dos sócios (internas, atrás do código).
  Roda: node --test src/lib/vocab-a.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { FAQ } from "./atendimento/faq.ts";
import { FAIXAS_COMISSAO_PADRAO, pctTexto } from "./cobranca/regra.ts";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const ler = (p: string) => readFileSync(join(SRC, p), "utf8");

/** Telas internas: admin, sócios (código de acesso) e as rotas das planilhas deles; jurídico congelado. */
const FORA = /(^|\/)(admin|socios|acesso-socios|termos|privacidade|api|decisao|modelodenegocio|roi|simulacao|tributario|dev)(\/|$)|\.test\.|components\/(decisao|modelo-negocio|financeiro)\/|config\/(premissas-financeiras|retencao)\.ts/;
const PALAVRA = /\binquilin[oa]s?\b|\bcomiss(?:ão|ões)\b/i;

/** Os textos que aparecem na tela: literais com espaço (frases, não chaves) e o texto entre tags de JSX. */
export function textosVisiveis(fonte: string): string[] {
  const s = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const out: string[] = [];
  for (const m of s.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
    const t = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
    if (/\s/.test(t.trim())) out.push(t);
  }
  for (const m of s.matchAll(/>([^<>{}]*[A-Za-zÀ-ú][^<>{}]*)</g)) out.push(m[1]);
  return out;
}

function arquivos(dir: string): string[] {
  return readdirSync(join(SRC, dir)).flatMap((f) => {
    const rel = join(dir, f);
    if (statSync(join(SRC, rel)).isDirectory()) return arquivos(rel);
    return /\.tsx?$/.test(f) ? [rel] : [];
  });
}

test("guarda: nenhum 'comissão' nem 'inquilino' em texto visível (públicas e telas logadas)", () => {
  const achados: string[] = [];
  // Os guias públicos (/guias) moram em lib, mas são texto de página: entram na guarda.
  for (const rel of [...["app", "components", "config"].flatMap(arquivos), "lib/guias/guias.ts"]) {
    if (FORA.test(rel)) continue;
    for (const t of textosVisiveis(ler(rel))) if (PALAVRA.test(t)) achados.push(`${relative(".", rel)}: ${t.trim().slice(0, 80)}`);
  }
  assert.deepEqual(achados, []);
});

test("a guarda pega frase e texto de JSX, mas não chave nem nome de variável", () => {
  assert.ok(textosVisiveis('const a = "O inquilino confirma";').some((t) => PALAVRA.test(t)));
  assert.ok(textosVisiveis("<p>Avaliar o inquilino</p>").some((t) => PALAVRA.test(t)));
  assert.ok(textosVisiveis("<p>Sem comissão</p>").some((t) => PALAVRA.test(t)));
  assert.ok(!textosVisiveis('if (modo === "inquilino") return comissaoSobreContrato(x);').some((t) => PALAVRA.test(t)));
  assert.ok(!textosVisiveis('<p data-testid="contrato-inquilino">Contrato</p>').some((t) => PALAVRA.test(t)));
});

test("(a) FAQ 'Esqueci minha senha' com o texto do coordenador; a Viva usa a mesma resposta", () => {
  const senha = FAQ.find((p) => p.id === "senha")!;
  assert.equal(senha.pergunta, "Esqueci minha senha");
  assert.equal(
    senha.resposta,
    'Você não precisa de senha: em Entrar, digite o seu e-mail e use o código de 6 dígitos que enviamos. Se você criou uma senha e a esqueceu, em Entrar escolha "Entrar com senha" e toque em "Esqueci minha senha": enviamos um link para criar uma nova. Nunca pedimos a sua senha — nem por chamado, nem por e-mail.',
  );
  assert.match(ler("lib/atendimento/viva-prompt.ts"), /import \{ FAQ \} from "\.\/faq\.ts";/);
});

test("(b) /seguranca: 'Morar com segurança na Viva Nomads', 'morador' e nada de aluguel em título e chamada", () => {
  const p = ler("app/(public)/seguranca/page.tsx");
  assert.match(p, /Morar com segurança na Viva Nomads/);
  assert.doesNotMatch(p, /Alugar com segurança|inquilin|\balugu/i);
  assert.equal((p.match(/\bmorador\b/g) ?? []).length >= 3, true);
});

test("(c) /para-proprietarios: 'taxa de serviço' com os números da fonte única (nada digitado à mão)", () => {
  const p = ler("app/(public)/para-proprietarios/page.tsx");
  assert.match(p, /import \{ FAIXAS_COMISSAO_PADRAO, pctTexto \} from "@\/lib\/cobranca\/regra";/);
  assert.match(p, /A taxa de serviço da Viva é de \{TAXA_MAIOR\}/);
  assert.doesNotMatch(p, /\d+ ?%/, "nenhum percentual escrito à mão");
  // Os números que a página mostra são os da regra.
  const publicas = FAIXAS_COMISSAO_PADRAO.filter((f) => !f.gestor);
  assert.equal(pctTexto(Math.max(...publicas.map((f) => f.taxa))), "12%");
  assert.equal(pctTexto(Math.min(...publicas.map((f) => f.taxa))), "6%");
});

test("(e) /decisao já exige o acesso dos sócios (porta única no proxy)", () => {
  assert.match(ler("proxy.ts"), /"\/decisao",\s*"\/decisao\/:path\*"/);
});
