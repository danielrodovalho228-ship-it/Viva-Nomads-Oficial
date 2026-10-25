import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MEUS_PEDIDOS_VAZIO, NOMES_SERVICOS, NOTA_PAGAMENTO_DIRETO, NOTA_PAGAMENTO_PLATAFORMA, notaPagamentoServicos } from "./servicos-morador.ts";

/*
  Complemento da ordem 521c5af7 (coordenador, reteste do #869). O catálogo antigo (S1) saiu com o Prompt 31b: o
  pedido e o acompanhamento são os de parceiro_pedidos — nenhum sistema paralelo sobre servicos_adicionais.
*/
const ler = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const CATALOGO = "../app/(dashboard)/dashboard/servicos/catalogo-servicos.tsx";

test("guarda: nenhum nome de serviço sem o acento devido (migração, banco do lab e telas)", () => {
  assert.deepEqual(NOMES_SERVICOS, {
    assistencia_24h: "Assistência 24h",
    plano_manutencao: "Plano de manutenção",
    limpeza: "Limpeza",
    lavanderia_enxoval: "Lavanderia e enxoval",
    frete_mudanca: "Frete e mudança leve",
  });
  const sem = ["Assistencia 24h", "Plano de manutencao", "Frete e mudanca leve"];
  const mig = ler("../../supabase/migrations/0178_servicos_catalogo_inquilino.sql");
  for (const [id, nome] of Object.entries(NOMES_SERVICOS)) assert.ok(mig.includes(`'${nome}'`) && mig.includes(`'${id}'`), nome);
  for (const errado of sem) {
    // Só pode aparecer como o "antes" do comentário da correção.
    assert.ok(!mig.replace(/^--.*$/gm, "").includes(errado), errado);
  }
  assert.match(mig, /'limpeza', 'Limpeza', 'assistencia_inquilino', 'inquilino', null, 'em_breve'/);
  assert.match(mig, /'lavanderia_enxoval', 'Lavanderia e enxoval', 'assistencia_inquilino', 'inquilino', null, 'em_breve'/);
  assert.match(mig, /'frete_mudanca', 'Frete e mudança leve', 'assistencia_inquilino', 'inquilino', null, 'em_breve'/);
});

test("nota fixa: os dois textos no mesmo lugar, escolhidos pela chave PAGAMENTO_PARCEIROS_ATIVO", () => {
  assert.equal(notaPagamentoServicos(false), NOTA_PAGAMENTO_DIRETO);
  assert.equal(NOTA_PAGAMENTO_DIRETO, "Você paga direto ao prestador. A Viva indica parceiros e acompanha o pedido.");
  assert.equal(notaPagamentoServicos(true), NOTA_PAGAMENTO_PLATAFORMA);
  assert.equal(NOTA_PAGAMENTO_PLATAFORMA, "Pagamento pela plataforma: o valor vai direto ao prestador e a taxa da Viva é separada na origem.");
  assert.match(ler("./flags.ts"), /PAGAMENTO_PARCEIROS_ATIVO = process\.env\.NEXT_PUBLIC_PAGAMENTO_PARCEIROS_ATIVO === "on"/);
  assert.match(ler("../app/(dashboard)/dashboard/servicos/page.tsx"), /notaPagamentoServicos\(PAGAMENTO_PARCEIROS_ATIVO\)/);
});

test("'Meus pedidos' (Prompt 31b): os pedidos de parceiro do cliente; o catálogo antigo não é mais lido pela tela", () => {
  assert.equal(MEUS_PEDIDOS_VAZIO, "Quando você pedir um serviço, ele aparece aqui com o andamento.");
  const pagina = ler("../app/(dashboard)/dashboard/servicos/page.tsx");
  assert.match(pagina, /text=\{MEUS_PEDIDOS_VAZIO\}/);
  assert.match(pagina, /meusPedidosDeServico\(\)/);
  assert.doesNotMatch(pagina, /catalogoServicosMorador|servicos_adicionais|CatalogoServicos/);
  assert.equal(existsSync(fileURLToPath(new URL(CATALOGO, import.meta.url))), false, "o catálogo antigo saiu da tela");
  assert.doesNotMatch(ler("./data/servicos-morador-actions.ts"), /export async function (pedirServico|meusPedidosServico)/);
});

test("catálogo antigo removido sem deixar código morto (decisão do Muse no #967)", () => {
  const acoes = ler("./data/servicos-morador-actions.ts");
  for (const f of ["catalogoServicosMorador", "avisarServicoDisponivel", "contratoAtivoDoMorador", "ServicoView"]) {
    assert.doesNotMatch(acoes, new RegExp(`export (async function|interface|type) ${f}\\b`), f);
  }
  const regras = ler("./servicos-morador.ts");
  for (const f of ["servicoAceitaPedido", "servicosDoInquilino", "hrefPedidoServico", "PEDIDO_SERVICO_31B_NO_AR", "ServicoCatalogo"]) {
    assert.doesNotMatch(regras, new RegExp(`export (function|const|interface|type) ${f}\\b`), f);
  }
  assert.equal(existsSync(fileURLToPath(new URL("../config/fotos-servicos.ts", import.meta.url))), false);
  assert.equal(existsSync(fileURLToPath(new URL("../../public/images/servicos", import.meta.url))), false);
});

test("0178 continua aplicada (histórico): a tabela do avise-me é só da própria pessoa", () => {
  const mig = ler("../../supabase/migrations/0178_servicos_catalogo_inquilino.sql");
  assert.match(mig, /create table if not exists public\.interesse_servico/);
  assert.match(mig, /unique \(user_id, servico_id\)/);
  assert.match(mig, /with check \(user_id = \(select auth\.uid\(\)\)\)/);
  const prod = ler("../../supabase/producao/aplicar-0178.sql");
  assert.match(prod, /^begin;/m);
  assert.match(prod, /'20261019000178', '0178_servicos_catalogo_inquilino'/);
});
