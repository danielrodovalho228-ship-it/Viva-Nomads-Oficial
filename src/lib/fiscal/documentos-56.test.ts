/* Roda: node --test src/lib/fiscal/documentos-56.test.ts — Prompt 56 (registro único, numeração, marca, /conferir). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PREFIXOS, TEXTO_RPG, linhaConferir, numeroAditivo, numeroExibido, numeroOrcamentoParceiro, rotuloRegistro, temRps } from "./prefixos.ts";
import { aceitaArquivo, camposExibidos, hashConfere, hexDe, normalizarCodigo, situacaoDoDocumento, type LinhaConferida } from "./conferir.ts";
import { conteudoCorrecao, conteudoFechamento, podeMarcarReparo, prontaParaFechar, semResposta, type EstadoParaFechar } from "./fechamento.ts";
import { conteudoDocumento, textoDocumento, temContato, type DadosDocumento } from "./documento.ts";
import { gerarPdf, sha256 } from "./pdf.ts";
import { PENDENTE_ITEM_13, RETENCAO_DOCUMENTOS, podeApagarDocumento } from "../../config/retencao.ts";

const raiz = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");
/** O código sem comentários (o comentário pode explicar o que NÃO entra). */
const codigo = (p: string) => ler(p).replace(/\{?\/\*[\s\S]*?\*\/\}?|\/\/.*$/gm, "");

function arquivos(dir: string): string[] {
  return readdirSync(join(raiz, dir)).flatMap((n) => {
    const p = join(dir, n);
    return statSync(join(raiz, p)).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

const RECIBO: DadosDocumento = {
  tipo: "recibo_aluguel",
  numero: "REC-2026-000001",
  emitidoEm: "2026-10-06T14:03:00Z",
  locador: { nome: "Carlos Eduardo Mendes", doc: "12345678909" },
  locatario: { nome: "Juliana Prado", doc: "98765432100" },
  imovelEndereco: "Rua Professor Mário Porto, 1.245, Uberlândia",
  contratoRef: "VN-CT-11281A61",
  periodoInicio: "2026-10-01",
  periodoFim: "2026-10-31",
  valor: 3200,
  encargos: [],
  dataPagamento: "2026-10-05",
  forma: "pix",
  conferirUrl: "https://vivanomads.com.br/conferir/9f3b82d14471a0c3e5d7f9b1a2c4e6f8",
  codigo: "9f3b82d14471a0c3e5d7f9b1a2c4e6f8",
  siteUrl: "https://vivanomads.com.br",
};

test("numeração: versão como sufixo, aditivo -ADn, orçamento do parceiro sem ORC, Registro nº com 6 dígitos", () => {
  assert.equal(numeroExibido("ORC-2026-0002", 1), "ORC-2026-0002");
  assert.equal(numeroExibido("ORC-2026-0002", 2), "ORC-2026-0002 v2");
  assert.equal(numeroAditivo("VN-CT-11281A61", 1), "VN-CT-11281A61-AD1");
  assert.equal(numeroOrcamentoParceiro("VN-SV-LOV4CA8I", 2), "VN-SV-LOV4CA8I · orçamento v2");
  assert.doesNotMatch(numeroOrcamentoParceiro("VN-SV-LOV4CA8I", 2), /ORC/);
  assert.equal(rotuloRegistro(1), "Registro nº 000001");
  assert.equal(linhaConferir("https://vivanomads.com.br/", "abc"), "Confira em vivanomads.com.br/conferir com o código abc");
});

test("prefixos: RSV (nunca RPS), legado VN-CT/VN-SV, reservados sem gerador, RPG com o texto fixo", () => {
  assert.ok(!("RPS" in PREFIXOS));
  assert.equal(PREFIXOS.RSV.rotulo, "Recibo de serviço");
  assert.ok(PREFIXOS["VN-CT"].legado && PREFIXOS["VN-SV"].legado);
  for (const p of ["RPG", "RSV", "INF", "REG", "NFSE"] as const) assert.ok(PREFIXOS[p].reservado, p);
  assert.equal(TEXTO_RPG, "Comprovante de pagamento. Não é documento fiscal.");
  assert.equal(PREFIXOS.NFSE.marca, "fiscal");
  assert.equal(PREFIXOS.REC.marca, "emissor");
  assert.equal(PREFIXOS.PRV.marca, "plataforma");
  assert.ok(temRps("RPS nº 12") && !temRps("CORPS e RPSX"));
});

test("guarda: todo gerador de PDF passa por registrarDocumento", () => {
  const geradores = arquivos("src").filter((p) => !p.endsWith("fiscal/pdf.ts") && /\bgerarPdf\(/.test(ler(p)));
  assert.ok(geradores.length >= 2, "esperava ao menos emitir.ts e pacote-provas.ts");
  for (const p of geradores) assert.match(ler(p), /registrarDocumento\(/, `${p} gera PDF sem registrarDocumento`);
});

test("guarda: RPS nunca como prefixo nem em texto de documento da Viva", () => {
  const sql = ler("supabase/migrations/0201_documentos_registro.sql");
  assert.match(sql, /numero !~\* '\^RPS'/);
  assert.match(sql, /RPS é a sigla oficial da NFS-e/);
  for (const tipo of ["recibo_aluguel", "comprovante_caucao", "termo_devolucao_caucao"] as const) {
    assert.ok(!temRps(textoDocumento(conteudoDocumento({ ...RECIBO, tipo, caucaoTotal: 3200, confirmadoEm: "2026-12-02" }))), tipo);
  }
  for (const p of arquivos("src/lib/fiscal")) assert.doesNotMatch(ler(p).replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "").replace(/"RPS"|'RPS'|RPS é a sigla|nunca "RPS"|\\bRPS\\b|\^RPS|RPS não/g, ""), /\bRPS\b/, p);
});

test("marca D1-b: o recibo leva o emissor em destaque, a Viva discreta, número e código no cabeçalho/rodapé comuns", () => {
  const c = conteudoDocumento(RECIBO);
  assert.equal(c.titulo, "Recibo de locação");
  assert.equal(c.cabecalho?.marca, "emissor");
  assert.equal(c.cabecalho?.emissor?.nome, "Carlos Eduardo Mendes");
  assert.equal(c.cabecalho?.emissor?.linha, "Locador — pessoa física");
  assert.equal(c.cabecalho?.numero, "REC-2026-000001");
  assert.equal(c.cabecalho?.emitidoEm, "06/10/2026 às 11:03 (horário de Brasília)");
  assert.equal(c.cabecalho?.conferir, "Confira em vivanomads.com.br/conferir com o código 9f3b82d14471a0c3e5d7f9b1a2c4e6f8");
  // o código no rodapé não dispara a trava de contato (32 hex com dígitos parecidos com telefone)
  assert.equal(temContato(textoDocumento(c)), false);
  assert.ok(!textoDocumento(c).includes("@"));
});

test("/conferir: o hash confere com o PDF certo e falha com o PDF alterado (o mesmo cálculo do navegador)", async () => {
  const pdf = await gerarPdf(conteudoDocumento(RECIBO));
  const registrado = sha256(pdf);
  const noNavegador = hexDe(createHash("sha256").update(pdf).digest().buffer.slice(0) as ArrayBuffer);
  assert.equal(noNavegador, registrado);
  assert.ok(hashConfere(registrado, noNavegador));
  const alterado = new Uint8Array(pdf);
  alterado[alterado.length - 10] ^= 0xff;
  assert.ok(!hashConfere(registrado, sha256(alterado)));
  assert.ok(!hashConfere(null, registrado));
});

test("/conferir: só pelo código; sem valor nem nomes; status, versão vigente e documento de teste", () => {
  const pagina = codigo("src/app/(public)/conferir/[codigo]/page.tsx");
  assert.match(pagina, /rpc\("conferir_documento"/);
  assert.match(pagina, /LIMITE_HORA = 20/);
  assert.doesNotMatch(pagina, /doc\.valor|\bvalor:|locador|locatario|iniciais|brl\(/);
  assert.doesNotMatch(ler("src/app/(public)/conferir/[codigo]/conferir-arquivo.tsx"), /fetch\(|FormData|action=/, "o arquivo não vai ao servidor");
  const sql = ler("supabase/migrations/0201_documentos_registro.sql");
  const funcao = sql.slice(sql.indexOf("create function public.conferir_documento"), sql.indexOf("grant execute on function public.conferir_documento"));
  assert.doesNotMatch(funcao, /valor|iniciais|locador|locatario/);
  assert.match(funcao, /p_codigo ~ '\^\[0-9a-f\]\{32\}\$' and r\.codigo_verificacao = p_codigo/);
  assert.equal(normalizarCodigo(" 9F3B 82D1 "), "9f3b82d1");
  const base: LinhaConferida = { prefixo: "ORC", tipo: "proposta", numero: "ORC-2026-0002", versao: 1, status: "substituido", anulado_motivo: null, status_em: null, emitido_em: "2026-10-06T14:03:00Z", hash_sha256: null, is_teste: false, registro_seq: 7, versao_vigente: 2 };
  assert.match(situacaoDoDocumento(base).texto, /SUBSTITUÍDO pela versão 2/);
  assert.match(situacaoDoDocumento({ ...base, status: "anulado", anulado_motivo: "Duplicidade" }).texto, /ANULADO \(Duplicidade\)/);
  assert.equal(situacaoDoDocumento({ ...base, status: "valido", is_teste: true }).estado, "teste");
  assert.equal(situacaoDoDocumento({ ...base, status: "anulado", is_teste: true }).estado, "anulado", "anulado vale também para o de teste");
  assert.equal(situacaoDoDocumento({ ...base, status: "valido" }).estado, "valido");
  const campos = camposExibidos({ ...base, versao: 2 }, () => "06/10/2026");
  assert.deepEqual(campos.map(([k]) => k), ["Documento", "Número", "Emitido em"]);
  assert.equal(campos[1][1], "ORC-2026-0002 v2");
  assert.deepEqual(camposExibidos({ ...base, prefixo: "VN-CT", tipo: "contrato", numero: "VN-CT-11281A61" }, () => "x").find(([k]) => k === "Registro")?.[1], "nº 000007");
  assert.ok(aceitaArquivo("REC") && aceitaArquivo("PRV") && !aceitaArquivo("ORC") && !aceitaArquivo("PRT"));
});

test("conferência (D5): o hash de fechamento cobre itens, cada foto, respostas e laudo; reparo só antes do fechamento", () => {
  const e: EstadoParaFechar = {
    conferenciaId: "c1",
    contrato: "VN-CT-11281A61",
    tipo: "entrada",
    itens: [{ parte: "proprietario", comodo: "Sala", descricao: "Sofá novo", fotoPath: "u/f1.webp", criadoEm: "2026-10-01T10:00:00Z" }],
    respostas: [{ parte: "proprietario", decisao: "confirmou", motivo: null, decididoEm: "2026-10-01T11:00:00Z" }],
    laudo: null,
    hashes: { "u/f1.webp": "a".repeat(64) },
  };
  const h = (t: string) => createHash("sha256").update(t).digest("hex");
  const base = h(conteudoFechamento(e, "janela_encerrada"));
  assert.notEqual(h(conteudoFechamento({ ...e, hashes: { "u/f1.webp": "b".repeat(64) } }, "janela_encerrada")), base, "foto trocada muda o hash");
  assert.notEqual(h(conteudoFechamento({ ...e, itens: [{ ...e.itens[0], descricao: "Sofá rasgado" }] }, "janela_encerrada")), base);
  assert.notEqual(h(conteudoFechamento({ ...e, laudo: { path: "u/l.pdf", parte: "inquilino", criadoEm: "2026-10-02" }, hashes: { ...e.hashes, "u/l.pdf": "c".repeat(64) } }, "janela_encerrada")), base);
  assert.equal(h(conteudoFechamento(e, "janela_encerrada")), base, "mesmo estado, mesmo hash");
  assert.deepEqual(semResposta(e), ["inquilino"]);
  assert.match(conteudoFechamento(e, "janela_encerrada"), /Sem resposta: inquilino/);
  assert.ok(!prontaParaFechar(e.respostas) && prontaParaFechar([...e.respostas, { parte: "inquilino" }]));
  assert.ok(podeMarcarReparo({ fechadaEm: null }) && !podeMarcarReparo({ fechadaEm: "2026-10-03T00:00:00Z" }));
  assert.match(conteudoCorrecao({ fechamentoHash: base, versao: 2, motivo: "Item esquecido", texto: "Tomada solta" }), new RegExp(`v2 .*${base}`));
});

test("proposta (D4): nome completo das partes e nenhum CPF/CNPJ", () => {
  const acoes = ler("src/lib/data/propostas-actions.ts");
  assert.match(acoes, /nomeNaProposta\(/);
  assert.doesNotMatch(acoes, /nomeNaConversa/);
  for (const p of ["src/app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx"]) assert.doesNotMatch(codigo(p), /cpf|cnpj/i, p);
  assert.match(acoes, /prefixo: "ORC"/);
  assert.match(acoes, /novaVersao: true/);
});

test("32 convertido: aditivo ADn com o hash assinado, lista PRT com o código, encerramento ENC", () => {
  const e = ler("src/lib/data/estadia-actions.ts");
  assert.match(e, /prefixo: "VN-CT",\s*tipo: "aditivo"/);
  assert.match(e, /numero: numeroAditivo\(numeroPublicoContrato\(a\.contrato_id\), a\.numero\)/);
  assert.match(e, /conteudo: \(\) => documentoDoAditivo\(a\)\.join\("\\n"\)/);
  assert.match(e, /prefixo: "PRT"/);
  assert.match(e, /Lista \$\{numero\} · \$\{linhaConferir\(SITE_URL, codigo\)\}/);
  assert.match(e, /prefixo: "ENC"/);
  assert.match(e, /fecharConferencia\(admin, saida\.id as string, "encerramento_concluido"\)/);
});

test("retenção: uma constante; tudo pendente (item 13) menos a lista da portaria; nada pendente se apaga", () => {
  for (const [p, r] of Object.entries(RETENCAO_DOCUMENTOS)) {
    if (p === "PRT") assert.deepEqual([r.dias, r.situacao], [90, "definido"]);
    else assert.equal(r.situacao, PENDENTE_ITEM_13, p);
  }
  assert.ok(!podeApagarDocumento("REC", 100_000));
  assert.ok(!podeApagarDocumento("PRT", 90) && podeApagarDocumento("PRT", 91));
  // Nenhuma rotina apaga documento: nem do registro, nem dos documentos fiscais, nem do bucket (só o desfazer de um
  // upload que falhou na própria emissão).
  for (const p of arquivos("src")) {
    const t = ler(p);
    assert.doesNotMatch(t, /from\("documentos_registro"\)\.delete|from\("documentos_fiscais"\)\.delete/, p);
    if (!p.endsWith("fiscal/emitir.ts")) assert.doesNotMatch(t, /storage\.from\(BUCKET_DOCUMENTOS\)\.remove/, p);
  }
});
