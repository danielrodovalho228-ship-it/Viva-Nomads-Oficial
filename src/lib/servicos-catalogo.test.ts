import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MEUS_PEDIDOS_VAZIO, NOMES_SERVICOS, NOTA_PAGAMENTO_DIRETO, NOTA_PAGAMENTO_PLATAFORMA, hrefPedidoServico, notaPagamentoServicos, servicosDoInquilino } from "./servicos-morador.ts";
import { FOTOS_ESPERADAS, FOTOS_SERVICOS } from "../config/fotos-servicos.ts";

/*
  Complemento da ordem 521c5af7 (coordenador, reteste do #869): catálogo de serviços do morador (S1). S2/S3 viram as
  telas do 31b — nenhum sistema paralelo sobre servicos_adicionais.
*/
const ler = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const CATALOGO = "../app/(dashboard)/dashboard/servicos/catalogo-servicos.tsx";

test("a lista do inquilino traz só categorias com quem_paga = inquilino (o Plano de manutenção do dono fica fora)", () => {
  const banco = [
    { id: "assistencia_24h", quem_paga: "inquilino", status: "em_breve" },
    { id: "plano_manutencao", quem_paga: "proprietario", status: "ativo" },
    { id: "limpeza", quem_paga: "inquilino", status: "em_breve" },
    { id: "lavanderia_enxoval", quem_paga: "inquilino", status: "em_breve" },
    { id: "frete_mudanca", quem_paga: "inquilino", status: "em_breve" },
    { id: "velho", quem_paga: "inquilino", status: "inativo" },
  ];
  assert.deepEqual(servicosDoInquilino(banco).map((s) => s.id), ["assistencia_24h", "limpeza", "lavanderia_enxoval", "frete_mudanca"]);
  assert.match(ler("./data/servicos-morador-actions.ts"), /servicosDoInquilino\(/);
});

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

test("'Meus pedidos' só com o estado vazio até o 31b; nada de formulário de pedido nem lista paralela", () => {
  assert.equal(MEUS_PEDIDOS_VAZIO, "Quando você pedir um serviço, ele aparece aqui com o andamento.");
  const pagina = ler("../app/(dashboard)/dashboard/servicos/page.tsx");
  assert.match(pagina, /\{MEUS_PEDIDOS_VAZIO\}/);
  assert.doesNotMatch(pagina + ler(CATALOGO), /pedirServico|meusPedidosServico|type="date"|servico-form/);
  assert.doesNotMatch(ler("./data/servicos-morador-actions.ts"), /export async function (pedirServico|meusPedidosServico)/);
  assert.equal(existsSync(fileURLToPath(new URL("../app/(dashboard)/dashboard/servicos/pedidos-servico.tsx", import.meta.url))), false);
  // Com parceiro aprovado (31b no ar), o cartão leva ao pedido com contrato e imóvel preenchidos.
  assert.equal(hrefPedidoServico("limpeza", "c1", "p1"), "/dashboard/servicos/pedido?servico=limpeza&contrato=c1&imovel=p1");
});

test("guarda: cartão de categoria só com FOTO (sem foto não aparece; nenhum ícone no lugar)", () => {
  const cat = ler(CATALOGO);
  assert.doesNotMatch(cat, /lucide-react/, "nenhum ícone no catálogo");
  assert.match(cat, /<Image src=\{s\.foto\.src\} alt=\{s\.foto\.alt\}/);
  assert.match(cat, /grid grid-cols-2 gap-3 lg:grid-cols-4/, "grade par: 2 a 390 px, 4 a 1280 px");
  const acoes = ler("./data/servicos-morador-actions.ts");
  assert.match(acoes, /const foto = fotoDoServico\(String\(s\.id\)\);\s*if \(!foto\) return \[\];/);
  // Toda foto declarada existe em public/images/servicos, em webp.
  for (const [id, f] of Object.entries(FOTOS_SERVICOS)) {
    assert.ok((FOTOS_ESPERADAS as readonly string[]).includes(id), id);
    assert.equal(f.src, `/images/servicos/${id}.webp`);
    assert.ok(existsSync(fileURLToPath(new URL(`../../public${f.src}`, import.meta.url))), f.src);
    assert.ok(f.alt.trim().length > 10, `alt de ${id}`);
  }
});

test("avise-me por categoria (0178): só a própria pessoa grava e lê; o servidor confere que a categoria é do inquilino", () => {
  const mig = ler("../../supabase/migrations/0178_servicos_catalogo_inquilino.sql");
  assert.match(mig, /create table if not exists public\.interesse_servico/);
  assert.match(mig, /unique \(user_id, servico_id\)/);
  assert.match(mig, /with check \(user_id = \(select auth\.uid\(\)\)\)/);
  const acoes = ler("./data/servicos-morador-actions.ts");
  assert.match(acoes, /export async function avisarServicoDisponivel/);
  assert.match(acoes, /servico\.quem_paga !== "inquilino"/);
  const prod = ler("../../supabase/producao/aplicar-0178.sql");
  assert.match(prod, /^begin;/m);
  assert.match(prod, /'20261019000178', '0178_servicos_catalogo_inquilino'/);
});
