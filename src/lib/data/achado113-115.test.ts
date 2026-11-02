/*
  Varredura de erros e estados vazios (rodada 22, lotes 3 e 4 — últimas 22 leituras).
  Achado 113 (média): detalhe da visita → 404 ou endereço da presencial sumindo na falha.
  Achado 114 (ALTA): admin observador da QA — qa_admin/donos/is_teste engoliam o erro: "não é observador" ou "dono
                      de teste" por engano liberava ação sobre dado real, a Caixa dos Sócios e as chaves. Agora falha
                      FECHADA: a ação recusa ("Tente de novo"), a tela marca tudo só leitura, as páginas vão ao error.tsx.
  Achado 115 (baixa): laudo atual do imóvel → "sem laudo" na falha (quem exibe já trata).
  Sem ação (justificado): proximidadesDoAnuncio, situacaoDaRenovacao, meusLocais, cidadeDosMeusServicos (exibição,
  sem decisão); minhasVisitasNoImovel (a tela libera e o índice único do banco é a trava); gerarPacoteProvasRegistrado
  e pedidoParaEmail (quem chama já trata); medidaPublica e medidasPublicas (sem chamador); ultimaMedidaDoDono (o sinal
  do morador só deixa de disparar); listarMarcas (gravação idempotente); vistoriadosDosImoveis, niveisDosImoveis,
  exibicaoDoImovel, seloDoCandidato (quem chama já trata); vinculosConfirmados (selo só positivo); avaliacaoNaConversa
  (VISTORIA_ATIVA desligada; só exibição). Puladas pela regra "nada de LinkedIn": minhasRedes e seloLinkedinDe
  (src/lib/linkedin).
  Roda: node --test src/lib/data/achado113-115.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const fn = (s: string, de: string) => {
  const i = s.indexOf(de);
  const j = s.indexOf("\nexport ", i + 1);
  return s.slice(i, j < 0 ? undefined : j);
};

test("achado 113: detalhe da visita lança nas leituras da visita e do endereço", () => {
  const f = fn(ler("src/lib/data/visitas-video-actions.ts"), "export async function visitaDetalhe");
  assert.match(f, /if \(error\) throw new Error\("Não foi possível ler a visita\."\);/);
  assert.match(f, /if \(erroImovel\) throw new Error\(/);
});

test("achado 114: observador da QA falha FECHADO (ação recusa, tela só leitura, leituras lançam)", () => {
  const s = ler("src/lib/qa/observador.ts");
  assert.equal(s.match(/if \(error\) throw new Error\(MSG_PERMISSAO_SEM_LEITURA\);/g)?.length, 4);
  assert.match(s, /recusaComDeps\(deps\(admin\), userId, alvo\)\.catch\(\(\) => MSG_PERMISSAO_SEM_LEITURA\)/);
  assert.match(s, /soLeituraNaTelaOuFalha\(linhas\)\.catch\(\(\) => linhas\.map\(\(l\) => l\.id\)\)/);
  // A Caixa dos Sócios continua fechada ao observador: sem conferir, a página vai ao error.tsx (nunca abre).
  assert.match(ler("src/app/(dashboard)/admin/socios/page.tsx"), /if \(await ehObservadorQa\(uidAtual\)\) notFound\(\);/);
});

test("achado 115: laudo atual lança; a exibição do '· vistoriado' já trata", () => {
  assert.match(fn(ler("src/lib/vistoria/laudo-servidor.ts"), "export async function laudoAtual"), /if \(error\) throw new Error\(/);
  assert.match(ler("src/lib/data/exibicao-59.ts"), /exibicaoDoImovel\(admin, propertyId, agora\)\.catch\(\(\) => null\)/);
});
