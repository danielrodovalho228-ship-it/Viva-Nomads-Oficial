/*
  Prompt 39-B1 — guardas das telas e da leitura de "Recibos e notas" (lidas da fonte; a parte pura está em regras.test).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MENU_POR_PAPEL } from "../../config/menu-por-papel.ts";
import { destinoDaRota } from "../../config/rotas-app.ts";

const raiz = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(raiz + p, "utf8");

const DADOS = ler("src/lib/data/recibos.ts");
const ROTA = ler("src/app/api/recibos/[relatorio]/route.ts");
const PAGINA = ler("src/app/(dashboard)/dashboard/recibos/page.tsx");
const BLOCOS = ler("src/components/recibos/blocos-recibos.tsx");
const RELATORIOS = ler("src/lib/recibos/relatorios.ts");

test("leitura com RLS: documentos_fiscais pelo cliente da pessoa, filtrando o lado dela (dono = owner_id, morador = tenant_id)", () => {
  assert.match(DADOS, /s\.supabase\.from\("documentos_fiscais"\)/);
  assert.doesNotMatch(DADOS, /admin\.from\("documentos_fiscais"\)/, "documentos nunca pelo cliente de serviço");
  assert.match(DADOS, /const lado = papel === "dono" \? "owner_id" : "tenant_id";/);
  assert.match(DADOS, /\.eq\(lado, s\.userId\)/);
  // Contas de teste fora dos resumos de quem não é de teste.
  assert.match(DADOS, /souTeste \? linhas : linhas\.filter/);
});

test("morador não vê recibo de outra estadia: o reembolso só aceita estadia que já está nos documentos dele", () => {
  assert.match(ROTA, /if \(!d\.recibos\.some\(\(r\) => r\.contratoId === contrato\)\) return erro\(404/);
  assert.match(ROTA, /relatorio === "reembolso" \|\| q\.get\("papel"\) === "morador" \? "morador" : "dono"/);
});

test("parceiro sem PAGAMENTO_PARCEIROS_ATIVO não vê o comprovante do gateway (a parte nem é desenhada)", () => {
  assert.match(BLOCOS, /\{pagamentoAtivo && \(\s*<p[^>]*data-testid="parceiro-comprovante-gateway"/);
  assert.match(ler("src/app/(dashboard)/dashboard/parceiro/page.tsx"), /<BlocoRecibosParceiro pagamentoAtivo=\{PAGAMENTO_PARCEIROS_ATIVO\} \/>/);
});

test("'Falta a nota do serviço' aparece na seção do parceiro; serviço concluído leva ao pedido para enviar a nota", () => {
  assert.match(BLOCOS, /pendenciasDeNota\(p\.servicos\)/);
  assert.match(BLOCOS, /data-testid="parceiro-pendencia-nota"/);
  assert.match(BLOCOS, /href=\{`\/dashboard\/servicos\/pedidos\/\$\{s\.id\}`\}/);
});

test("a palavra 'Impostos' não aparece em nenhum título; o aviso fixo está na página e nos relatórios", () => {
  for (const [nome, fonte] of [["página", PAGINA], ["blocos", BLOCOS], ["relatórios", RELATORIOS]] as const) assert.doesNotMatch(fonte, /impostos/i, nome);
  assert.match(PAGINA, /\{AVISO_FIXO\}/);
  assert.match(RELATORIOS, /AVISO_FIXO/);
});

test("CPF nunca na URL: os links levam só mês, ano, imóvel e contrato (ids)", () => {
  for (const fonte of [PAGINA, BLOCOS]) {
    for (const m of fonte.matchAll(/href=\{?[`"]([^`"]+)[`"]/g)) assert.doesNotMatch(m[1], /cpf|doc=|pagador/i, m[1]);
  }
});

test("menu: 'Recibos e notas' é subitem da área de Ganhos do dono, com rota interna e no app", () => {
  const dono = MENU_POR_PAPEL.find((s) => s.papel === "proprietario")!;
  const contratos = dono.itens.find((i) => i.id === "contratos")!;
  const item = contratos.filhos!.find((f) => f.id === "recibos");
  assert.equal(item?.href, "/dashboard/recibos");
  assert.equal(item?.rotulo, "Recibos e notas");
  assert.equal(destinoDaRota("/dashboard/recibos"), "app");
  // Ferramentas: atalho "Informe para o IR" ao lado do simulador.
  assert.match(ler("src/app/(dashboard)/dashboard/ferramentas/page.tsx"), /href="\/dashboard\/recibos#informe"[^>]*data-testid="atalho-informe-ir"/);
});
