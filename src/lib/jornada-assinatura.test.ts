import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { formatarDocumento } from "./documento-pessoa.ts";
import { conteudoDocumento, temContato, textoDocumento, type DadosDocumento } from "./fiscal/documento.ts";
import { rotuloPagamentoBloco } from "./pagamento-bloco.ts";

/*
  Complemento da jornada de assinatura (reteste do Muse, 19/10, contrato VN-CT-11281A61):
   1. recibo nunca emitido — o CPF gravado só com dígitos casava com o padrão de telefone e a emissão abortava;
   2. rótulo do pagamento em bloco; 3. nomes de quem assinou (contrato-assinar.test.ts); 4. "Li e concordo" persistente.
*/
const ler = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const CPF_DONO = "52998224725"; // CPF válido, só dígitos, como fica gravado
const CPF_INQ = "11144477735";

const recibo = (p: Partial<DadosDocumento> = {}): DadosDocumento => ({
  tipo: "recibo_aluguel",
  numero: "REC-2026-000001",
  emitidoEm: "2026-10-19T17:32:00Z",
  locador: { nome: "Ana Souza", doc: CPF_DONO },
  locatario: { nome: "Iara Jornada", doc: CPF_INQ },
  imovelEndereco: "Rua das Flores, 100, Uberlândia",
  contratoRef: "CT-11281A61",
  periodoInicio: "2026-10-19",
  periodoFim: "2026-12-18",
  valor: 6400,
  encargos: [],
  dataPagamento: "2026-10-19",
  forma: "pix",
  conferirUrl: "https://vivanomads.com.br/conferir/0123456789abcdef0123456789abcdef",
  rotuloPagamento: "Bloco 1 (2 meses: 19/10 a 18/12) — R$ 6.400 (2 × R$ 3.200)",
  ...p,
});

test("1a. formatarDocumento: CPF e CNPJ por extenso a partir dos dígitos, venha como vier", () => {
  assert.equal(formatarDocumento("52998224725"), "529.982.247-25");
  assert.equal(formatarDocumento("529.982.247-25"), "529.982.247-25");
  assert.equal(formatarDocumento("11222333000181"), "11.222.333/0001-81");
  assert.equal(formatarDocumento(" 11.222.333/0001-81 "), "11.222.333/0001-81");
  assert.equal(formatarDocumento(null), null);
  assert.equal(formatarDocumento(""), null);
});

test("1a. o recibo escreve o CPF formatado (o CPF/CNPJ 12345678901 de antes não volta)", () => {
  const texto = textoDocumento(conteudoDocumento(recibo()));
  assert.match(texto, /Ana Souza \(CPF\/CNPJ 529\.982\.247-25\)/);
  assert.match(texto, /Iara Jornada \(CPF\/CNPJ 111\.444\.777-35\)/);
  assert.doesNotMatch(texto, /CPF\/CNPJ \d{11}\b/);
});

test("1b. temContato: CPF/CNPJ com e sem máscara NÃO bloqueia; telefone e e-mail continuam bloqueados", () => {
  // A causa do reteste: recibo com CPF só-dígitos era bloqueado como "documento traria contato".
  assert.equal(temContato(`Locador: Ana (CPF/CNPJ ${CPF_DONO})`), false);
  assert.equal(temContato("Locador: Ana (CPF/CNPJ 11222333000181)"), false);
  assert.equal(temContato("Locador: Ana (CPF/CNPJ 529.982.247-25)"), false);
  assert.equal(temContato(textoDocumento(conteudoDocumento(recibo({ locador: { nome: "Ana", doc: CPF_DONO } })))), false);
  // O que é contato continua pego.
  assert.equal(temContato("ligue (34) 99999-8888"), true);
  assert.equal(temContato("whats 34999998888"), true, "um celular de 11 dígitos não é CPF válido");
  assert.equal(temContato("fale com ana@exemplo.com"), true);
});

test("1c/1e. falha visível: a emissão registra a falha; a fila do admin tem 'Emitir de novo'; o texto da promessa", () => {
  const emitir = ler("./fiscal/emitir.ts");
  assert.match(emitir, /async function registrarResultado/);
  assert.match(emitir, /from\("documentos_falhas"\)/);
  assert.match(ler("./data/contratos-actions.ts"), /after\(\(\) => emitirDoPagamentoComRegistro\(pagamentoId\)\)/);
  assert.match(ler("./data/documentos-actions.ts"), /after\(\(\) => emitirTermoDevolucaoComRegistro\(acertoId\)\)/);
  const fila = ler("../app/(dashboard)/admin/documentos/falhas-client.tsx");
  assert.match(fila, /Documentos com falha/);
  assert.match(fila, /Emitir de novo/);
  assert.match(fila, /Emitir os pendentes/);
  const tela = ler("../components/documentos/documentos-contrato.tsx");
  assert.match(tela, /Recibo em preparação/);
  assert.match(tela, /Baixar recibo \(PDF\)/);
  assert.match(tela, /Ao confirmar, o recibo em PDF fica disponível aqui e vai por e-mail para você e para o proprietário\./);
  assert.doesNotMatch(tela, /sai o recibo em PDF para você e para o proprietário/);
  // Os dois lados mostram os recibos.
  assert.match(ler("../app/(dashboard)/dashboard/locacoes/locacoes-client.tsx"), /recibos=\{extras\[l\.id\]\?\.recibos \?\? \[\]\}/);
  assert.match(ler("../app/(dashboard)/dashboard/contratos/contratos-client.tsx"), /recibos=\{extra\.recibos\}/);
  // A fila é só do admin (RLS) e a escrita só pelo servidor.
  const sql = ler("../../supabase/migrations/0175_documentos_falhas.sql");
  assert.match(sql, /revoke all on public\.documentos_falhas from anon, authenticated;/);
  assert.match(sql, /using \(public\.is_admin\(\)\)/);
});

test("1d. retroativo pelo botão do admin: pagamentos confirmados sem documento", () => {
  const emitir = ler("./fiscal/emitir.ts");
  assert.match(emitir, /export async function pagamentosConfirmadosSemDocumento/);
  assert.match(ler("./data/documentos-falhas-actions.ts"), /export async function emitirPendentes\(\)/);
  assert.match(ler("./data/documentos-falhas-actions.ts"), /exigirAdminAal2/);
});

test("2. rótulo do pagamento em bloco: 2 meses mostra o bloco e a conta; 1 mês, sem conta", () => {
  assert.equal(
    rotuloPagamentoBloco({ tipo: "aluguel", valor: 6400, bloco: { numero: 1, meses: 2, inicio: "2026-10-19", fim: "2026-12-18" }, valorMensal: 3200 }),
    "Bloco 1 (2 meses: 19/10 a 18/12) — R$ 6.400 (2 × R$ 3.200)",
  );
  assert.equal(
    rotuloPagamentoBloco({ tipo: "aluguel", valor: 3200, bloco: { numero: 1, meses: 1, inicio: "2026-10-19", fim: "2026-11-17" }, valorMensal: 3200 }),
    "Bloco 1 (1 mês: 19/10 a 17/11) — R$ 3.200",
  );
  // Pagamento parcial do bloco: sem a conta (ela não fecharia).
  assert.equal(rotuloPagamentoBloco({ tipo: "aluguel", valor: 3000, bloco: { numero: 2, meses: 2, inicio: "2026-12-19", fim: "2027-02-16" }, valorMensal: 3200 }), "Bloco 2 (2 meses: 19/12 a 16/02) — R$ 3.000");
  assert.equal(rotuloPagamentoBloco({ tipo: "caucao", valor: 3200, bloco: { numero: 1, meses: 2, inicio: null, fim: null } }), "Caução do bloco 1 — R$ 3.200");
  // Nunca "Valor mensal de" com o valor do bloco.
  assert.doesNotMatch(ler("../components/documentos/documentos-contrato.tsx"), /"Valor mensal"\} de/);
  // O mesmo rótulo no recibo em PDF.
  const texto = textoDocumento(conteudoDocumento(recibo()));
  assert.match(texto, /Referente a: Bloco 1 \(2 meses: 19\/10 a 18\/12\) — R\$ 6\.400 \(2 × R\$ 3\.200\)/);
  assert.match(ler("./fiscal/emitir.ts"), /rotuloPagamento: rotuloPagamentoBloco\(/);
});

test("4. 'Li e concordo' persistente: sessionStorage por contrato, restaurado ao recarregar e limpo depois de assinar", () => {
  const c = ler("../components/contrato/assinar-contrato.tsx");
  assert.match(c, /const chave = `vn-li-concordo:\$\{contratoId\}`;/);
  assert.match(c, /window\.sessionStorage\.getItem\(chave\) === "1"/);
  assert.match(c, /window\.sessionStorage\.removeItem\(chave\);/);
  assert.equal((c.match(/try \{/g) ?? []).length >= 3, true, "todo acesso ao armazenamento em try/catch");
  // O servidor continua exigindo o aceite.
  assert.match(ler("./data/contrato-assinar-actions.ts"), /aceite/);
});

test("1. o e-mail do recibo leva o link de verificação no botão; o laboratório registra o destino do botão", () => {
  assert.match(ler("./fiscal/emitir.ts"), /cta: \{ label: "Conferir autenticidade", url: doc\.conferirUrl \}/);
  assert.match(ler("./notifications/email.ts"), /\$\{rotulo\} \(\$\{href\}\) /);
});
