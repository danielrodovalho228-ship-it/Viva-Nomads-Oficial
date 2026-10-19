import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { estadoDoContratoUnico, primeiroPagamentoConfirmado } from "./contrato-estado.ts";
import { conflitoDePeriodo, lerDaterange, mensagemConflitoPeriodo, periodoDaEstadia, sobrepoe } from "./contrato-periodo.ts";
import { montarCarteira } from "./carteira-dono.ts";

/*
  Complemento do coordenador (19/10, depois do reteste do #864):
   1. estado do contrato com UMA fonte (estadoDoContratoUnico) — detalhe, listas, carteira, Resumo e manutenção;
   2. nenhum período sobreposto no mesmo imóvel (regra por datas; 0174).
*/
const ler = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const SRC = fileURLToPath(new URL("..", import.meta.url));
const t = "2026-10-19T12:00:00Z";
const pago = [{ tipo: "aluguel", confirmado_pelo_inquilino: true }];

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

// Os 7 estados do pedido, com o selo esperado para cada lado.
const MATRIZ = [
  { nome: "aguardando assinatura", linha: { status: "ativo" }, dono: "Aguardando assinatura · falta você e o inquilino", inq: "Aguardando assinatura · falta você e o proprietário" },
  { nome: "falta você (dono)", linha: { status: "ativo", assinado_inquilino_em: t }, dono: "Aguardando assinatura · falta você", inq: "Aguardando assinatura · falta o proprietário" },
  { nome: "falta a outra parte (dono assinou)", linha: { status: "ativo", assinado_proprietario_em: t }, dono: "Aguardando assinatura · falta o inquilino", inq: "Aguardando assinatura · falta você" },
  { nome: "aguardando 1º pagamento", linha: { status: "ativo", assinado_proprietario_em: t, assinado_inquilino_em: t, pagamentos_bloco: [{ tipo: "aluguel", confirmado_pelo_inquilino: false }] }, dono: "Aguardando 1º pagamento", inq: "Aguardando 1º pagamento" },
  { nome: "em vigência", linha: { status: "ativo", assinado_proprietario_em: t, assinado_inquilino_em: t, pagamentos_bloco: pago }, dono: "Em vigência", inq: "Em vigência" },
  { nome: "concluído", linha: { status: "concluido", assinado_proprietario_em: t, assinado_inquilino_em: t, pagamentos_bloco: pago }, dono: "Concluído", inq: "Concluído" },
  { nome: "cancelado", linha: { status: "cancelado" }, dono: "Cancelado", inq: "Cancelado" },
];

test("1. matriz: cada estado tem um selo por lado, vindo da função única", () => {
  for (const m of MATRIZ) {
    assert.equal(estadoDoContratoUnico(m.linha, "proprietario").selo, m.dono, m.nome);
    assert.equal(estadoDoContratoUnico(m.linha, "inquilino").selo, m.inq, m.nome);
  }
  // O caso do reteste: assinado pelas duas partes e 1º aluguel confirmado = Em vigência (antes: "Aguardando 1º pagamento" fixo).
  assert.equal(estadoDoContratoUnico(MATRIZ[4].linha, "inquilino").chave, "em_vigencia");
  // A caução confirmada não é o 1º pagamento.
  assert.equal(primeiroPagamentoConfirmado([{ tipo: "caucao", confirmado_pelo_inquilino: true }]), false);
  assert.equal(estadoDoContratoUnico({ status: "encerrado_sem_renovacao" }, "inquilino").selo, "Encerrado (sem renovação)");
  assert.equal(estadoDoContratoUnico({ status: "encerrado_em_acerto" }, "inquilino").selo, "Em acerto de saída");
});

test("1. guarda: nenhum 'primeiroPagamentoConfirmado: false/true' fora de testes; etapaContrato só na função única", () => {
  for (const f of arquivos(SRC)) {
    const s = readFileSync(f, "utf8");
    assert.doesNotMatch(s, /primeiroPagamentoConfirmado:\s*(false|true)\b/, f);
    if (!f.endsWith("contrato-estado.ts") && !f.endsWith("contrato-etapas.ts")) assert.doesNotMatch(s, /\betapaContrato\s*\(/, f);
  }
  // A segunda cópia da regra (estadoDoContrato do prompt 28 e statusAssinaturaCurto) saiu.
  assert.doesNotMatch(ler("./fechamento-contrato.ts"), /export function (estadoDoContrato|statusAssinaturaCurto)\b/);
});

test("1. toda tela lê o estado da fonte única: detalhe, listas dos dois lados, carteira, Resumo, candidaturas e manutenção", () => {
  const detalhe = ler("../components/contrato/contrato-detalhe.tsx");
  assert.match(detalhe, /\{c\.estado\.selo\}/);
  assert.match(detalhe, /data-testid="contrato-selo"/);
  assert.match(ler("./data/contrato-assinar-actions.ts"), /estado: estadoDoContratoUnico\(c, papel\)/);
  assert.match(ler("./data/contrato-assinar-actions.ts"), /pagamentos_bloco\(tipo, confirmado_pelo_inquilino\)/);
  const acoes = ler("./data/contratos-actions.ts");
  assert.equal((acoes.match(/estadoDaLinha\(c, "(proprietario|inquilino)"\)/g) ?? []).length, 3, "dono, inquilino e locações");
  assert.match(acoes, /estadoDaLinha\(data as Record<string, unknown>, papel\)/, "Resumo do fechamento");
  assert.match(ler("../app/(dashboard)/dashboard/contratos/contratos-client.tsx"), /\{contrato\.estado\.selo\}/);
  assert.match(ler("../app/(dashboard)/dashboard/locacoes/locacoes-client.tsx"), /\{l\.estado\.selo\}/);
  assert.match(ler("../app/(dashboard)/dashboard/carteira/carteira-client.tsx"), /data-testid="carteira-selo"/);
  assert.match(ler("./data/carteira.ts"), /selo: c\.estado\.selo/);
  assert.match(ler("./data/leads-actions.ts"), /estadoDoContratoUnico\(c, "inquilino"\)\.selo/);
  assert.match(ler("./manutencao-solicitacoes.ts"), /estadoDoContratoUnico\(c, "proprietario"\)/);
});

test("2. datas: sobreposição com fim inclusivo; o sequencial (entrada no dia seguinte ao fim) é livre", () => {
  const a = { inicio: "2026-10-19", fim: "2026-12-17" };
  assert.equal(sobrepoe(a, { inicio: "2026-12-17", fim: "2027-01-15" }), true, "mesmo dia do fim");
  assert.equal(sobrepoe(a, { inicio: "2026-12-18", fim: "2027-01-16" }), false, "dia seguinte ao fim");
  assert.equal(sobrepoe(a, { inicio: "2026-09-01", fim: "2026-10-19" }), true, "termina no dia da entrada");
  assert.equal(sobrepoe(a, { inicio: "2026-11-01", fim: "2026-11-10" }), true, "dentro");
  assert.deepEqual(periodoDaEstadia("2026-10-19", 2), a, "2 meses = 60 dias, como os blocos");
  // O daterange do Postgres vem com o fim exclusivo.
  assert.deepEqual(lerDaterange("[2026-10-19,2026-12-18)"), a);
  assert.deepEqual(lerDaterange("[2026-10-19,2026-12-17]"), a);
  assert.equal(lerDaterange(null), null);
  assert.equal(lerDaterange("empty"), null);
  const c = conflitoDePeriodo({ inicio: "2026-12-01", fim: "2027-01-29" }, [{ inicio: "2027-03-01", fim: "2027-04-29" }, a]);
  assert.deepEqual(c, a);
  assert.equal(mensagemConflitoPeriodo(c!), "Este imóvel já tem contrato de 19/10/2026 a 17/12/2026. Escolha outra data de entrada.");
  assert.equal(conflitoDePeriodo({ inicio: "2026-12-18", fim: "2027-02-15" }, [a]), null);
});

test("2. carteira: um contrato por imóvel (o vigente) e os seguintes como 'Próximo morador'", () => {
  const itens = montarCarteira(
    [{ id: "p1", titulo: "Santa Mônica", bairro: "Santa Mônica" }],
    [
      { id: "b0000000-prox", propertyId: "p1", status: "ativo", etapa: "aguardando_assinatura", selo: "Aguardando assinatura · falta você", valorMensal: 3300, blocos: [{ inicio: "2026-12-18", fim: "2027-02-15" }], morador: "Rui P." },
      { id: "a0000000-vig", propertyId: "p1", status: "ativo", etapa: "em_vigencia", selo: "Em vigência", valorMensal: 3200, blocos: [{ inicio: "2026-10-19", fim: "2026-12-17" }], morador: "Iara J." },
      { id: "c0000000-canc", propertyId: "p1", status: "cancelado", etapa: "aguardando_assinatura", selo: "Cancelado", valorMensal: 3000, blocos: [{ inicio: "2026-11-01", fim: "2026-12-30" }], morador: null },
    ],
    "2026-10-20",
  );
  assert.equal(itens.length, 1);
  assert.equal(itens[0].contratoId, "a0000000-vig");
  assert.equal(itens[0].selo, "Em vigência");
  assert.equal(itens[0].situacao, "ocupado");
  assert.deepEqual((itens[0].proximos ?? []).map((p) => [p.contratoId, p.inicio, p.morador]), [["b0000000-prox", "2026-12-18", "Rui P."]]);
  assert.match(ler("../app/(dashboard)/dashboard/carteira/carteira-client.tsx"), /Próximo morador a partir de \{p\.inicio \? dataBR\(p\.inicio\) : "—"\}/);
});

test("2. app: aceite da candidatura, aceite da proposta, 'Gerar contrato', renovação e calendário conferem as datas", () => {
  const leads = ler("./data/leads-actions.ts");
  assert.match(leads, /conflitoNoImovel\(admin, lead\.property_id as string, periodoDaEstadia\(String\(lead\.inicio_desejado\)/);
  assert.match(ler("./data/propostas-actions.ts"), /conflitoNoImovel\(admin, p\.property_id, periodoDaEstadia\(String\(v\.data_entrada\)\.slice\(0, 10\), Number\(v\.meses\)\)\)/);
  const acts = ler("./data/actions.ts");
  const reg = acts.slice(acts.indexOf("export async function registrarContrato"), acts.indexOf("export async function renovarBloco"));
  assert.ok(reg.indexOf("conflitoNoImovel(") < reg.indexOf('.from("contratos")\n    .insert('), "confere antes de gravar");
  assert.match(reg, /periodo: `\[\$\{periodo\.inicio\},\$\{periodo\.fim\}\]`/);
  assert.match(reg, /cErr\.code === ERRO_SOBREPOSICAO_PG/);
  assert.match(acts.slice(acts.indexOf("export async function renovarBloco")), /bErr\.code === ERRO_SOBREPOSICAO_PG/);
  assert.match(ler("./data/blocks-actions.ts"), /export async function getDatasIndisponiveis/);
  assert.match(ler("../components/property/availability-calendar.tsx"), /getDatasIndisponiveis\(property\.id\)/);
  assert.match(ler("./erros-banco.ts"), /case "23P01":/);
  // O calendário só recebe datas: nunca quem mora.
  assert.match(ler("./data/periodo-servidor.ts"), /select\("id, periodo"\)/);
});

test("2. Nova jornada de teste: encerra a jornada de teste anterior do anúncio (só is_teste) antes de criar", () => {
  const j = ler("./data/jornada-teste-actions.ts");
  assert.ok(j.indexOf("encerrarJornadasAnteriores(admin, input.propertyId)") < j.indexOf('.from("leads")\n    .insert('));
  assert.match(j, /filter\(\(p\) => p\.is_teste === true\)/);
  assert.match(j, /status: "encerrado_sem_renovacao"/);
});

test("2. banco (0174): período por gatilho, EXCLUDE gist nos ativos, sobreposição de teste resolvida, conta real para", () => {
  const mig = ler("../../supabase/migrations/0174_contratos_sem_sobreposicao.sql");
  assert.match(mig, /create extension if not exists btree_gist/);
  assert.match(mig, /add column if not exists periodo daterange/);
  assert.match(mig, /daterange\(min\(b\.inicio\), max\(b\.fim\), '\[\]'\)/);
  assert.match(mig, /b\.status is distinct from 'nao_aceito'/);
  assert.match(mig, /after insert or delete or update of inicio, fim, status, contrato_id on public\.contrato_blocos/);
  assert.match(mig, /exclude using gist \(property_id with =, periodo with &&\) where \(status = 'ativo'\)/);
  assert.match(mig, /not \(ta\.so_teste and tb\.so_teste\)/);
  assert.match(mig, /raise exception '0174 parou: contratos ativos com períodos sobrepostos em conta real/);
  assert.match(mig, /\(a\.created_at, a\.id\) < \(b\.created_at, b\.id\)/, "o mais antigo do par");
  assert.match(mig, /_bkp_0174_contratos_encerrados/);
  const prod = ler("../../supabase/producao/aplicar-0174.sql");
  assert.match(prod, /^begin;/m);
  assert.match(prod, /'20261019000174', '0174_contratos_sem_sobreposicao'/);
  assert.match(prod, /commit;\s*$/);
  const rb = ler("../../supabase/producao/rollback/0174_rollback.sql");
  assert.match(rb, /drop constraint if exists contratos_periodo_sem_sobreposicao/);
  assert.match(rb, /update public\.contratos c set status = b\.status/);
});
