/*
  Prompt 62-B1 — guardas lidas da fonte: o dono não escolhe o avaliador (nem por API), a chave esconde tudo do dono e do
  morador, nenhum texto promete pagamento pela plataforma, o catálogo não oferece avaliação e o vocabulário da tela.
  Roda: node --test src/lib/vistoria/telas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATEGORIAS_CATALOGO, CATEGORIAS_PARCEIRO, categoriaValida } from "../parceiros/regras.ts";

const raiz = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(raiz + p, "utf8");

const ACOES = ler("src/lib/vistoria/actions.ts");
const SERVIDOR = ler("src/lib/vistoria/servidor.ts");
const BLOCO_DONO = ler("src/components/vistoria/bloco-avaliacao-dono.tsx");
const MORADOR = ler("src/app/(dashboard)/dashboard/avaliacao-imovel/[id]/page.tsx");
const AVALIADOR = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx");
const ADMIN = ler("src/app/(dashboard)/admin/avaliadores/page.tsx");
const PUBLICA = ler("src/app/(public)/avaliadores/[numero]/page.tsx");
const TELAS = [BLOCO_DONO, MORADOR, AVALIADOR, ADMIN, PUBLICA];

const semComentarios = (f: string) => f.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

function corpo(fonte: string, nome: string): string {
  const i = fonte.indexOf(`export async function ${nome}`);
  assert.ok(i >= 0, nome);
  const j = fonte.indexOf("\n}\n", i);
  return fonte.slice(i, j < 0 ? undefined : j);
}

test("o dono não escolhe o avaliador, nem por API: o pedido só leva o imóvel e a designação vem do rodízio", () => {
  const pedir = corpo(ACOES, "pedirAvaliacao");
  assert.deepEqual([...pedir.matchAll(/form\.get\("(\w+)"\)/g)].map((m) => m[1]), ["propertyId"]);
  assert.doesNotMatch(pedir, /avaliador_id|avaliadorId/);
  assert.match(pedir, /await designar\(s\.admin, p\.id, agora\)/);
  // A designação usa só a regra pura do rodízio.
  assert.match(corpo(SERVIDOR, "designar"), /proximoAvaliador\(fila, pedido, historico, agora\)/);
  assert.doesNotMatch(BLOCO_DONO, /name="avaliador/);
});

test("chave VISTORIA_ATIVA desligada: nada para o dono nem para o morador; credenciamento e admin seguem", () => {
  assert.match(BLOCO_DONO, /if \(!\(await vistoriaAtiva\(\)\)\) return null;/);
  assert.match(MORADOR, /if \(!\(await vistoriaAtiva\(\)\)\) notFound\(\);/);
  assert.match(corpo(ACOES, "pedirAvaliacao"), /chaveAtiva: await vistoriaAtiva\(\)/);
  assert.match(corpo(ACOES, "concordarVisita"), /if \(!\(await vistoriaAtiva\(\)\)\) return DESLIGADA;/);
  assert.doesNotMatch(corpo(ACOES, "pedirCredenciamento"), /vistoriaAtiva/);
  assert.doesNotMatch(ADMIN, /vistoriaAtiva\(\)/);
  // O cookie do laboratório nunca vale em produção.
  assert.match(ler("src/lib/vistoria/chave.ts"), /if \(!integracoesSimuladas\(\)\) return false;/);
  assert.match(PUBLICA, /robots: VISTORIA_ATIVA \? undefined : \{ index: false, follow: false \}/);
});

test("nenhum texto promete pagamento pela plataforma; a taxa usa o texto da chave do 31b", () => {
  for (const f of [...TELAS, ACOES, ler("src/lib/vistoria/regras.ts"), ler("src/lib/notifications/eventos-email.ts").split("vistoria_designada")[1]]) {
    assert.doesNotMatch(f, /pague (pela|na) (plataforma|Viva)|pagamento pela plataforma (est[áa] ativo|liberado)|a Viva (cobra|recebe) (o valor|a avalia)/i);
  }
  assert.match(BLOCO_DONO, /textoTaxaServicoParceiros\(PAGAMENTO_PARCEIROS_ATIVO\)/);
  assert.match(AVALIADOR, /textoTaxaServicoParceiros\(PAGAMENTO_PARCEIROS_ATIVO\)/);
  assert.match(BLOCO_DONO, /\{FRASE_PAGA_AVALIACAO\}/);
});

test("conduta: o formulário não tem campo de resultado; a página pública mostra só a nota de conduta, sem contratar", () => {
  for (const f of [BLOCO_DONO, AVALIADOR]) assert.doesNotMatch(f, /name="(nota_)?resultado"/);
  assert.doesNotMatch(semComentarios(PUBLICA), /contratar|Solicitar orçamento|href=/i);
  assert.match(PUBLICA, /nota_conduta/);
});

test("catálogo: 'vistoria' é categoria de credenciamento, nunca contratável direto", () => {
  assert.ok(CATEGORIAS_PARCEIRO.some((c) => c.valor === "vistoria" && c.rotulo === "Avaliação de imóveis"));
  assert.ok(!CATEGORIAS_CATALOGO.some((c) => c.valor === "vistoria"));
  assert.equal(categoriaValida("vistoria"), false);
  for (const arq of ["src/components/parceiros/seja-parceiro-form.tsx", "src/components/parceiros/servicos-painel.tsx", "src/app/(public)/parceiros/buscar/page.tsx"]) {
    assert.doesNotMatch(ler(arq), /CATEGORIAS_PARCEIRO\b/, arq);
  }
  // E o banco recusa pedido de serviço de "vistoria" (a constraint de parceiro_pedidos não tem a categoria).
  assert.doesNotMatch(ler("supabase/migrations/0190_parceiros_ciclo.sql").split("create table if not exists public.parceiro_pedidos")[1].split(");")[0], /vistoria/);
});

test("vocabulário: 'avaliação do imóvel' e 'avaliador credenciado'; nunca inspeção, perícia ou engenharia na tela", () => {
  // "· vistoriado" é o fato que o anúncio ganha (Prompt 62-A); "vistoria" sozinha nunca aparece.
  for (const f of TELAS) assert.doesNotMatch(semComentarios(f), /inspe[çc][ãa]o|per[íi]cia|engenharia|vistoria(?!do|\.|_|\/|-|"|Ativa)/i);
  assert.match(BLOCO_DONO, /Pedir avaliação do imóvel/);
  assert.match(BLOCO_DONO, /Avaliador designado pela Viva: nº/);
});

test("credenciamento em teste → ativo só pelo admin com duas etapas", () => {
  const decidir = corpo(ACOES, "adminDecidirCredenciamento");
  assert.match(decidir, /const a = await exigirAdmin\(\);/);
  assert.match(ACOES, /perfil\?\.role === "admin" && \(await sessaoAal2\(s\.supabase\)\)/);
  assert.match(decidir, /transicaoCredenciamento\(c\.status as StatusCredenciamento, para\)\.ok/);
  assert.match(corpo(ACOES, "adminSalvarPreco"), /const a = await exigirAdmin\(\);/);
});
