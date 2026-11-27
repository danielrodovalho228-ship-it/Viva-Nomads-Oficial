import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios } from "./fonte-sem-comentarios.ts";

/*
  ORDEM-DUET-682 (ponto 3). O ajudante que tira os comentários do código lido pelas travas de unidade. A cópia antiga
  confundia o "/*" de `accept="application/pdf,image/*"` com o começo de um comentário e apagava 169 linhas da página do
  avaliador; quatro travas da vistoria liam a página sem elas.
  Roda: node --test src/lib/fonte-sem-comentarios.test.ts
*/
const PAGINA_DO_AVALIADOR = "src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx";
const ler = (p: string) => readFileSync(p, "utf8");
/** A cópia antiga, como estava nas travas: fica aqui só para medir o que ela apagava. */
const copiaAntiga = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("o '/*' dentro de um texto não é comentário: o código a seguir fica", () => {
  const codigo = ['<input accept="application/pdf,image/*" />', "<p>linha que a tela mostra</p>", "{/* comentário de verdade */}", "<p>fim</p>"].join("\n");
  const limpo = fonteSemComentarios(codigo);
  assert.match(limpo, /accept="application\/pdf,image\/\*"/);
  assert.match(limpo, /linha que a tela mostra/);
  assert.doesNotMatch(limpo, /comentário de verdade/);
  // A cópia antiga apagava a linha do meio — é o defeito.
  assert.doesNotMatch(copiaAntiga(codigo), /linha que a tela mostra/);
});

test("sai o comentário JSX, o bloco que começa a linha e a linha só de comentário; o código fica", () => {
  const codigo = [
    "/**",
    " * cabeçalho com uma frase proibida",
    " */",
    "export const A = 1;",
    "  /* bloco recuado",
    "     em duas linhas */",
    "const b = 2;",
    "  // linha só de comentário",
    "const url = \"https://exemplo.test/caminho\";",
    "return (",
    "  <div>",
    "    {/* comentário JSX",
    "        em duas linhas */}",
    "    { /* com espaços */ }",
    "    <span>texto</span>",
    "  </div>",
    ");",
  ].join("\n");
  const limpo = fonteSemComentarios(codigo);
  for (const fora of ["frase proibida", "bloco recuado", "em duas linhas", "linha só de comentário", "comentário JSX", "com espaços"]) assert.ok(!limpo.includes(fora), `sai: ${fora}`);
  for (const fica of ["export const A = 1;", "const b = 2;", 'const url = "https://exemplo.test/caminho";', "<span>texto</span>"]) assert.ok(limpo.includes(fica), `fica: ${fica}`);
});

test("o comentário no fim de uma linha de código fica — de propósito: a mais nunca cega a trava", () => {
  const limpo = fonteSemComentarios("const prazo = 72; // horas\nconst x = 1; /* nota */");
  assert.match(limpo, /const prazo = 72; \/\/ horas/);
  assert.match(limpo, /const x = 1; \/\* nota \*\//);
});

test("a página do avaliador chega inteira à trava: as linhas que a cópia antiga apagava estão lá", () => {
  const pagina = ler(PAGINA_DO_AVALIADOR);
  assert.match(pagina, /accept="application\/pdf,image\/\*"/, "o texto que enganava a cópia antiga continua na página");
  const limpo = fonteSemComentarios(pagina);
  const antigo = copiaAntiga(pagina);
  // O que a tela tem depois do seletor de arquivo e a cópia antiga não via.
  for (const marca of ['data-testid="credenciamento-enviar"', 'data-testid="avaliacoes-historico"', 'data-testid="avaliacao-fora"', "foraDaMinhaFila.map("]) {
    assert.ok(pagina.includes(marca), `a página tem ${marca}`);
    assert.ok(limpo.includes(marca), `a trava vê ${marca}`);
    assert.ok(!antigo.includes(marca), `a cópia antiga não via ${marca}`);
  }
  // Toda linha de código da página (a que não é comentário) chega à trava.
  const linhasDeCodigo = pagina.split("\n").filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*|\{\s*\/\*)/.test(l) && !/\*\/\}?\s*$/.test(l));
  const perdidas = linhasDeCodigo.filter((l) => !limpo.includes(l));
  assert.deepEqual(perdidas, [], "nenhuma linha de código se perde");
  assert.ok(linhasDeCodigo.filter((l) => !antigo.includes(l)).length > 100, "a cópia antiga perdia mais de 100 linhas de código");
});

test("as travas que leem a página do avaliador usam este ajudante, não uma cópia", () => {
  for (const trava of ["e1101-relogio-do-pedido", "e1146-descarte-e-motivo", "e1153-aviso-e-confirmacao-do-aceite", "e1155-regra-do-reagendamento-no-avaliador"]) {
    const fonte = ler(`src/lib/vistoria/${trava}.test.ts`);
    assert.ok(fonte.includes(PAGINA_DO_AVALIADOR), `${trava} lê a página do avaliador`);
    assert.match(fonte, /import \{ fonteSemComentarios as semComentarios \} from "\.\.\/fonte-sem-comentarios\.ts";/, `${trava} importa o ajudante`);
    assert.doesNotMatch(fonte, /replace\(\/\\\/\\\*\[\\s\\S\]\*\?\\\*\\\/\/g/, `${trava} não tem cópia que apaga "/*" em qualquer ponto`);
  }
});

// E1164 fatia 2: a regra do comentário JSX casava "{" + quebra de linha + "/**" — o começo de uma interface ou de um
// objeto cujo primeiro membro é um JSDoc — e apagava o código até ao próximo "*/ }". Na página das Ferramentas perdiam-se
// 164 linhas, entre elas a da caução que a trava do E1110 confere.
test("um JSDoc no primeiro membro de uma interface não é comentário JSX: o código fica", () => {
  const codigo = ["interface Ferramenta {", "  /** Sem href = card informativo. */", "  href?: string;", "  titulo: string;", "}", "const x = { a: 1 }; /* fim */ }"].join("\n");
  const limpo = fonteSemComentarios(codigo);
  assert.match(limpo, /href\?: string;/);
  assert.match(limpo, /titulo: string;/);
  assert.match(fonteSemComentarios("<div>{/* comentário JSX */}</div>"), /^<div><\/div>$/);
  assert.match(fonteSemComentarios("<div>{ /* com espaços */ }</div>"), /^<div><\/div>$/);
});

test("a página das Ferramentas chega inteira à trava (nenhuma linha de código se perde)", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/ferramentas/page.tsx");
  const limpo = fonteSemComentarios(pagina);
  assert.ok(limpo.includes("Caução Viva: ${REGRA_CAUCAO}, devolvível — o dinheiro nunca fica com a plataforma."), "a linha da caução (E1110) chega à trava");
  assert.ok(limpo.includes("interface Ferramenta {") && limpo.includes("  titulo: string;"), "a interface chega inteira");
});
