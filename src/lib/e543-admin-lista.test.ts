/*
  E543 (reprova de 05/11) — Admin › Contratos, VN-CT-A0268B00:
   (1) a LISTA dizia "Aguardando 1º pagamento · Assinado pelas duas partes" e o DETALHE "Encerrado em 30/10/2026". O
       #2508 pôs o período na fonte única (estadoDoContratoUnico), mas a consulta da lista do admin (contratosReais)
       não lia a coluna `periodo` — o selo saía sem ela. Agora a lista lê as mesmas colunas de estado
       (COLUNAS_ESTADO_CONTRATO) que o detalhe.
   (2) "o mesmo contrato duas vezes, totais dobrados": em produção (leitura) são DOIS contratos da massa 0268 —
       a0268b00-…0011 (terminou em 30/10) e a0268b00-…0021 (entrada em 10/11), R$ 3.200 cada — com o MESMO número
       público (VN-CT- + 8 primeiros hex do id; E331). Os totais (2 contratos, R$ 6.400) estão certos; o que fazia
       parecer duplicata era o número igual. Quando dois contratos da lista têm o mesmo número, cada linha mostra o
       desempate (o fim do id) — o número público em si não muda (é a identidade dos documentos já emitidos).
  Roda: node --test src/lib/e543-admin-lista.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { numerosDaLista } from "./contrato-ref.ts";
import { seloParaEquipe } from "./contrato-estado.ts";

const ler = (p: string) => readFileSync(new URL(`./${p}`, import.meta.url), "utf8");
const A = "a0268b00-0000-4000-8000-000000000011";
const I = "a0268b00-0000-4000-8000-000000000021";

test("lista do admin com o período: o contrato que terminou em 30/10 sai 'Encerrado em 30/10/2026' (como o detalhe)", () => {
  const linha = { status: "ativo", periodo: "[2026-09-30,2026-10-31)", assinado_proprietario_em: "2026-10-31T02:32:26Z", assinado_inquilino_em: "2026-10-31T02:32:26Z", pagamentos_bloco: [] };
  assert.equal(seloParaEquipe(linha), "Encerrado em 30/10/2026");
  const sem = { ...linha, periodo: null };
  assert.equal(seloParaEquipe(sem), "Aguardando 1º pagamento", "sem o período era o que a lista mostrava");
});

test("a consulta da lista lê as mesmas colunas de estado do detalhe (com o período)", () => {
  const s = ler("data/admin-indicadores.ts");
  assert.match(s, /\.select\(`id, created_at, property_id, tenant_id, aluguel_mensal, prazo_total_dias, comissao_valor, comissao_percent, lead_id, owner_plan, properties!inner\(owner_id, title, city\), leads\(accepted_at\), \$\{COLUNAS_ESTADO_CONTRATO\}`\)/);
});

test("dois contratos com o mesmo número: cada linha ganha o desempate; os outros ficam como estão", () => {
  const outro = "11281a61-0000-4000-8000-000000000001";
  const m = numerosDaLista([A, I, outro]);
  assert.equal(m.get(A), "VN-CT-A0268B00 · id …0011");
  assert.equal(m.get(I), "VN-CT-A0268B00 · id …0021");
  assert.equal(m.get(outro), "VN-CT-11281A61");
  assert.equal(numerosDaLista([A]).get(A), "VN-CT-A0268B00");
});

test("a lista do admin usa o número com desempate", () => {
  const p = readFileSync(new URL("../app/(dashboard)/admin/contratos/page.tsx", import.meta.url), "utf8");
  assert.match(p, /const numeros = numerosDaLista\(lista\.map\(\(c\) => c\.id\)\);/);
  assert.match(p, /\{numeros\.get\(c\.id\)\} · \{c\.imovel\}/);
});
