/*
  Complemento do Prompt 29, item 1: a taxa fixa por pedido dos fotógrafos (R$ 40/60/80) sumiu. Vale a taxa de serviço
  de 10% para todas as categorias, com o aviso "em breve" enquanto o pagamento pela plataforma estiver desligado.
  Roda: node --test src/config/taxa-servico-parceiros.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE, TEXTO_TAXA_SERVICO_PARCEIROS, textoTaxaServicoParceiros } from "./taxa-servico-parceiros.ts";
import { TAXA_PARCERIA_TEXTO } from "../lib/atendimento/parceiros-texto.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("texto único: 10% para todas as categorias, 90/10 na origem, a Viva não guarda o dinheiro", () => {
  assert.equal(
    TEXTO_TAXA_SERVICO_PARCEIROS,
    "Taxa de serviço: 10% sobre o valor do serviço, para todas as categorias. Quando o pagamento pela plataforma estiver ativo, o valor é dividido na origem: 90% direto ao parceiro e 10% à Viva. A Viva não guarda o dinheiro."
  );
  assert.equal(textoTaxaServicoParceiros(false), `${TEXTO_TAXA_SERVICO_PARCEIROS} Pagamento pela plataforma em breve.`);
  assert.equal(textoTaxaServicoParceiros(true), TEXTO_TAXA_SERVICO_PARCEIROS);
  assert.equal(TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE, "Pagamento pela plataforma em breve.");
  assert.ok(TAXA_PARCERIA_TEXTO.startsWith(TEXTO_TAXA_SERVICO_PARCEIROS), "a Central de Ajuda e a Viva usam o mesmo texto");
});

test("admin usa o texto único; as páginas públicas usam as regras claras (Prompt 31a), sempre com a chave de pagamento", () => {
  assert.match(ler("src/app/(dashboard)/admin/parceiros/page.tsx"), /textoTaxaServicoParceiros\(PAGAMENTO_PARCEIROS_ATIVO\)/);
  for (const p of ["src/app/(public)/parceiros/page.tsx", "src/app/(public)/parceiros/fotografos/page.tsx"]) {
    assert.match(ler(p), /<RegrasParceiros pagamentoAtivo=\{PAGAMENTO_PARCEIROS_ATIVO\}/, p);
  }
  assert.equal(existsSync("src/config/taxa-parceria.ts"), false);
  assert.equal(existsSync("src/components/parceiros/faixas-taxa.tsx"), false);
  const admin = ler("src/app/(dashboard)/admin/parceiros/page.tsx");
  assert.doesNotMatch(admin, /taxa_valor|TaxaForm|salvarTaxaParceria|config_parceria/);
});

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

test("guarda: nenhum 'R$ 40', 'R$ 60', 'R$ 80' nem 'taxa de parceria por pedido' em src/; taxa_valor não é lida nem escrita", () => {
  const achados: string[] = [];
  for (const f of arquivos("src")) {
    const s = ler(f);
    if (/R\$\s?(40|60|80)(?![\d.,])/.test(s)) achados.push(`${f}: R$ 40/60/80`);
    if (/taxa de parceria por pedido/i.test(s)) achados.push(`${f}: taxa de parceria por pedido`);
    if (/\btaxa_valor\b/.test(s)) achados.push(`${f}: taxa_valor`);
  }
  assert.deepEqual(achados, []);
});
