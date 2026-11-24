import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/*
  E1164 (ORDEM-DUET-687/714): as travas de unidade que leem o código-fonte tiram os comentários com o ajudante único
  `src/lib/fonte-sem-comentarios.ts`, nunca com uma cópia. A cópia antiga ("/\\*[\\s\\S]*?\\*\\/" em qualquer ponto) toma o
  "/*" de um texto — `accept="application/pdf,image/*"` — por começo de comentário e apaga o código até ao comentário
  seguinte: a trava passa a ler uma tela sem as linhas que diz conferir.
  A troca vai em fatias (até 15 arquivos por PR). Esta varredura:
   1. proíbe cópia nova: um arquivo com cópia fora da lista PENDENTES falha;
   2. obriga a lista a encolher: um arquivo da lista que já não tem cópia falha até sair dela.
  Roda: node --test src/lib/e1164-sem-copias-do-ajudante.test.ts
*/

/** A assinatura da cópia: a expressão que apaga de "/*" até "*\/" em qualquer ponto ([\s\S] ou [^]). */
const COPIA = /\\\/\\\*\[(?:\\s\\S|\^)\]\*\?\\\*\\\//;

/** Ainda por trocar (fatias seguintes do E1164, e os arquivos que estão em PRs abertos). Só encolhe. */
const PENDENTES = new Set([
  "scripts/lab/gerar-cobertura.mjs",
  "src/components/layout/logo-sem-link-aninhado.test.ts",
  "src/components/ui/e538-esqueleto-neutro.test.ts",
  "src/components/ui/voltar-lista.test.ts",
  "src/lib/anuncio/chegada-e-pedido.test.ts",
  "src/lib/anuncio/desempenho.test.ts",
  "src/lib/anuncio/e242-selo-titulo.test.ts",
  "src/lib/busca/contagem-vitrine.test.ts",
  "src/lib/busca/e580-filtro-preco-justo-visivel.test.ts",
  "src/lib/busca/e82-busca-clean.test.ts",
  "src/lib/calendario/calendario-pt-br-e136.test.ts",
  "src/lib/cartoes/compartilhar.test.ts",
  "src/lib/ci/prova-ao-vivo.ts",
  "src/lib/cobranca-mensal/e641-regras.test.ts",
  "src/lib/cobranca/p078-escada-sem-gestor.test.ts",
  "src/lib/cobranca/plano-gestor-lead.test.ts",
  "src/lib/conta/leva2-e68-e71.test.ts",
  "src/lib/data/perfil-publico-privacidade.test.ts",
  "src/lib/documento/matricula-no-inicio.test.ts",
  "src/lib/e1082-caucao-na-garantia-do-fechamento.test.ts",
  "src/lib/e1119-varredura-caucao.test.ts",
  "src/lib/e292-numeros-do-dono.test.ts",
  "src/lib/estadia/confirmacao.test.ts",
  "src/lib/estilo/estilo-padrao.test.ts",
  "src/lib/etapas-anuncio.test.ts",
  "src/lib/fiscal/documentos-56.test.ts",
  "src/lib/notifications/pioneiras-e287.test.ts",
  "src/lib/pagamento-forma/e647-forma-pagamento.test.ts",
  "src/lib/pagamento-forma/e647-proposta.test.ts",
  "src/lib/painel/erro-site-publico.test.ts",
  "src/lib/painel/hoje-dono.test.ts",
  "src/lib/painel/inicio-dono.test.ts",
  "src/lib/qa/e591-socios-observadora.test.ts",
  "src/lib/ranking/ordem.test.ts",
  "src/lib/rotas-remissoes/e916-404-rodape-busca.test.ts",
  "src/lib/selos-estrutura-e225.test.ts",
  "src/lib/sem-aluguel-texto.test.ts",
  "src/lib/textos-garantias-ferramentas.test.ts",
  "src/lib/textos-publicos.test.ts",
  "src/lib/vinculo/selo-publico.test.ts",
  "src/lib/vistoria/e1077-avaliador-em-teste.test.ts",
  "src/lib/vistoria/e1118-prazos-sem-literal.test.ts",
  "src/lib/vistoria/e648-escolha-do-dono.test.ts",
  "src/lib/vistoria/telas-exibicao.test.ts",
  "src/lib/vistoria/telas.test.ts",
  "src/lib/vocab-a.test.ts",
  "src/lib/vocabulario-publico.test.ts",
  "tests/laboratorio/e744-linhas-de-base-evidencia.test.ts",
]);

const AJUDANTE = new Set(["src/lib/fonte-sem-comentarios.ts", "src/lib/fonte-sem-comentarios.test.ts", "src/lib/e1164-sem-copias-do-ajudante.test.ts"]);

function arquivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n.startsWith(".")) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...arquivos(p));
    else if (/\.(ts|tsx|mts|mjs)$/.test(n)) out.push(p);
  }
  return out;
}

const comCopia = ["src", "tests", "scripts"].flatMap(arquivos).filter((f) => !AJUDANTE.has(f) && COPIA.test(readFileSync(f, "utf8"))).sort();

test("E1164: nenhuma cópia nova do ajudante que tira comentários (use src/lib/fonte-sem-comentarios.ts)", () => {
  assert.deepEqual(comCopia.filter((f) => !PENDENTES.has(f)), []);
});

test("E1164: a lista dos pendentes só encolhe — o arquivo já trocado sai dela", () => {
  assert.deepEqual([...PENDENTES].filter((f) => !comCopia.includes(f)).sort(), []);
});

test("E1164: a assinatura reconhece a cópia e não o ajudante", () => {
  assert.ok(COPIA.test('s.replace(/\\/\\*[\\s\\S]*?\\*\\//g, "")'));
  assert.ok(COPIA.test('s.replace(/\\/\\*[^]*?\\*\\//g, "")'));
  assert.ok(!COPIA.test('import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";'));
});
