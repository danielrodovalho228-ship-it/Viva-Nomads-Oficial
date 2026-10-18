import { test } from "node:test";
import assert from "node:assert/strict";
import {
  camposParaGravar,
  casoLabMatricula,
  decidirMatricula,
  estadoTelaDaMatricula,
  leituraMatriculaSimulada,
  nomesIguais,
  preenchimentoDaMatricula,
  resumoDoLaudo,
  sanearMatricula,
  statusDaMatricula,
  CASOS_DONO,
  MSG_MATRICULA,
  type EntradaMatricula,
  type LeituraMatricula,
} from "./conferencia-matricula.ts";

// Dados FICTÍCIOS (CPF de teste com dígitos válidos, nunca de uma pessoa real).
const CPF = "52998224725";
const HOJE = "2026-10-18";
const ENDERECO = { cep: "38400100", rua: "Avenida do Laboratório", numero: "120", bairro: "Centro", cidade: "Uberlândia" };

function entrada(over: Partial<EntradaMatricula> = {}): EntradaMatricula {
  return {
    perfil: { nome: "José da Silva", cpf: CPF },
    caf: { feita: true, ok: true },
    enderecoCadastro: ENDERECO,
    duplicado: 0,
    hoje: HOJE,
    ...over,
  };
}

function matricula(over: Partial<LeituraMatricula> = {}): LeituraMatricula {
  return {
    numero: "12.345",
    cartorio: "1º Ofício Fictício",
    endereco: { ...ENDERECO, uf: "MG" },
    unidade: "Apartamento 302",
    areaPrivativa: 68.5,
    areaTotal: 92.1,
    vaga: "vaga 12",
    proprietarios: [{ nome: "José da Silva", documento: CPF, fracao: "100%" }],
    dataUltimoAto: "2026-10-01",
    onus: [],
    legivel: true,
    sinaisDeEdicao: [],
    baixaConfianca: false,
    ...over,
  };
}

test("A — CAF ok e CPF do perfil igual ao da matrícula → conferido, sem fila", () => {
  const d = decidirMatricula(matricula(), entrada());
  assert.equal(d.resultado, "conferido");
  assert.equal(d.motivo, null);
  assert.equal(d.mensagem, "Documentação conferida ✓");
  assert.equal(statusDaMatricula(d.resultado), "approved");
  assert.equal(estadoTelaDaMatricula(d.resultado), "aprovado");
  assert.deepEqual(d.opcoes, []);
});

test("B — CAF ok, matrícula sem CPF e 'José da Silva' × 'JOSE SILVA' → provável (publica, amostra no admin)", () => {
  assert.ok(nomesIguais("José da Silva", "JOSE SILVA"));
  assert.ok(!nomesIguais("José da Silva", "José Souza"));
  const d = decidirMatricula(matricula({ proprietarios: [{ nome: "JOSE SILVA", documento: null, fracao: null }] }), entrada());
  assert.equal(d.resultado, "provavel");
  assert.equal(statusDaMatricula(d.resultado), "approved");
});

test("C — sem CAF e CPF digitado igual ao da matrícula → em revisão 'falta confirmar sua identidade' + botão CAF", () => {
  const d = decidirMatricula(matricula(), entrada({ caf: { feita: false, ok: false } }));
  assert.equal(d.resultado, "em_revisao");
  assert.equal(d.motivo, "falta_identidade");
  assert.equal(d.mensagem, "Documento recebido — falta confirmar sua identidade");
  assert.equal(d.pedirCaf, true);
  assert.equal(statusDaMatricula(d.resultado), "pending");
});

test("C' — CAF feita mas reprovada → em revisão, sem pedir de novo", () => {
  const d = decidirMatricula(matricula(), entrada({ caf: { feita: true, ok: false } }));
  assert.equal(d.motivo, "identidade_nao_confirmada");
  assert.equal(d.pedirCaf, false);
});

test("D — CPF diferente (ex.: casado, imóvel no nome do cônjuge) → em revisão com as opções, cônjuge entre elas", () => {
  const d = decidirMatricula(matricula({ proprietarios: [{ nome: "Maria Souza", documento: "11144477735", fracao: "100%" }] }), entrada());
  assert.equal(d.resultado, "em_revisao");
  assert.equal(d.motivo, "dono_diferente");
  assert.ok(d.opcoes.includes("conjuge"));
  assert.deepEqual(d.opcoes, CASOS_DONO.map((c) => c.valor));
  // CPF do outro proprietário: só os 3 últimos dígitos e o resultado da comparação.
  assert.deepEqual(d.comparacao[0], { nome: "Maria Souza", documentoFinal: "735", documentoConfere: false, nomeConfere: false, fracao: "100%" });
  const gravado = JSON.stringify(camposParaGravar(matricula({ proprietarios: [{ nome: "Maria Souza", documento: "11144477735", fracao: "100%" }] }), d.comparacao));
  assert.ok(!gravado.includes("11144477735"));
  assert.ok(!gravado.includes(CPF));
});

test("E — alienação fiduciária (Caixa) não bloqueia: CPF bate → conferido", () => {
  const d = decidirMatricula(matricula({ onus: [{ tipo: "alienacao_fiduciaria", credor: "Caixa Econômica Federal", emFavorDeTerceiro: false }] }), entrada());
  assert.equal(d.resultado, "conferido");
  const h = decidirMatricula(matricula({ onus: [{ tipo: "hipoteca", credor: "Banco X", emFavorDeTerceiro: false }] }), entrada());
  assert.equal(h.resultado, "conferido");
});

test("F — penhora → em revisão sempre, sem expor o ônus ao dono", () => {
  for (const onus of [
    { tipo: "penhora" as const, credor: null, emFavorDeTerceiro: false },
    { tipo: "indisponibilidade" as const, credor: null, emFavorDeTerceiro: false },
    { tipo: "usufruto" as const, credor: "Avó Fictícia", emFavorDeTerceiro: true },
  ]) {
    const d = decidirMatricula(matricula({ onus: [onus] }), entrada());
    assert.equal(d.resultado, "em_revisao", onus.tipo);
    assert.equal(d.motivo, "detalhe_matricula");
    assert.equal(d.mensagem, MSG_MATRICULA.detalhe_matricula);
    assert.ok(!/penhora|indispon|usufruto/i.test(d.mensagem));
  }
  // Usufruto do próprio dono não trava.
  assert.equal(decidirMatricula(matricula({ onus: [{ tipo: "usufruto", credor: null, emFavorDeTerceiro: false }] }), entrada()).resultado, "conferido");
});

test("G — endereço da matrícula ≠ CEP → aviso, sem mudar o resultado nem sobrescrever o cadastro", () => {
  const l = matricula({ endereco: { rua: "Rua das Matrículas", numero: "45", bairro: "Centro", cidade: "Uberlândia", cep: null, uf: "MG" } });
  const d = decidirMatricula(l, entrada());
  assert.equal(d.resultado, "conferido");
  assert.deepEqual(d.avisos.map((a) => a.texto), ["O endereço da matrícula é diferente do CEP — confira."]);
  // O preenchimento devolve o da matrícula; quem decide se usa é o dono (a tela não troca sozinha).
  assert.equal(preenchimentoDaMatricula(l).endereco.rua, "Rua das Matrículas");
  // Mesmo endereço: sem aviso.
  assert.deepEqual(decidirMatricula(matricula(), entrada()).avisos, []);
});

test("H — conta de teste: laudo simulado vale sem gastar CAF; numa conta real o simulado não vale", () => {
  const simulado = {
    caf_result: { light: "green", identity: true, liveness: true, document: true, demo: true, simulado: true },
    traffic_light: "green",
    valid_until: "2026-12-31T00:00:00Z",
    created_at: "2026-10-01T00:00:00Z",
  };
  const agora = new Date(`${HOJE}T12:00:00Z`);
  assert.deepEqual(resumoDoLaudo(simulado, agora, true), { feita: true, ok: true, ocrConfere: null });
  assert.deepEqual(resumoDoLaudo(simulado, agora, false), { feita: false, ok: false });
  assert.equal(decidirMatricula(matricula(), entrada({ caf: resumoDoLaudo(simulado, agora, true) })).resultado, "conferido");
});

test("laudo CAF: vencido (90 dias) não vale; risco alto não é ok; OCR com outro nome derruba o 'ok'", () => {
  const agora = new Date(`${HOJE}T12:00:00Z`);
  const real = { caf_result: { identity: true, liveness: true, document: true }, traffic_light: "green", valid_until: null, created_at: "2026-10-10T00:00:00Z" };
  assert.equal(resumoDoLaudo(real, agora, false).ok, true);
  assert.equal(resumoDoLaudo({ ...real, created_at: "2026-06-01T00:00:00Z" }, agora, false).feita, false);
  assert.equal(resumoDoLaudo({ ...real, traffic_light: "red" }, agora, false).ok, false);
  const ocrOutro = resumoDoLaudo({ ...real, caf_result: { ...real.caf_result, ocrConfere: false } }, agora, false);
  assert.equal(decidirMatricula(matricula(), entrada({ caf: ocrOutro })).resultado, "em_revisao");
});

test("matrícula antiga (último ato > 30 dias) → aceita com o pedido da certidão atualizada", () => {
  const d = decidirMatricula(matricula({ dataUltimoAto: "2024-03-10" }), entrada());
  assert.equal(d.resultado, "conferido");
  assert.deepEqual(d.avisos.map((a) => a.codigo), ["matricula_antiga"]);
});

test("duplicado, ilegível, sinal de edição e leitura incerta", () => {
  assert.equal(decidirMatricula(matricula(), entrada({ duplicado: 1 })).resultado, "recusado");
  assert.equal(decidirMatricula(null, entrada()).motivo, "falha_leitura");
  assert.equal(decidirMatricula(matricula({ legivel: false }), entrada()).motivo, "falha_leitura");
  assert.equal(decidirMatricula(matricula({ sinaisDeEdicao: ["fonte diferente no nome"] }), entrada()).motivo, "sinal_edicao");
  assert.equal(decidirMatricula(matricula({ baixaConfianca: true }), entrada()).motivo, "dono_diferente");
});

test("empresa: CNPJ do perfil igual ao da matrícula conta como o dono", () => {
  const d = decidirMatricula(
    matricula({ proprietarios: [{ nome: "Exemplo Imóveis Ltda", documento: "11222333000181", fracao: null }] }),
    entrada({ perfil: { nome: "José da Silva", cpf: CPF, cnpj: "11222333000181" } }),
  );
  assert.equal(d.resultado, "conferido");
});

test("preenchimento: área privativa arredondada, vagas pelo texto, CEP só com 8 dígitos", () => {
  const p = preenchimentoDaMatricula(matricula({ vaga: "2 vagas de garagem" }));
  assert.equal(p.areaM2, 69);
  assert.equal(p.vagas, 2);
  assert.equal(p.unidade, "Apartamento 302");
  assert.equal(p.endereco.cep, "38400100");
  assert.equal(preenchimentoDaMatricula(matricula({ areaPrivativa: null, vaga: null })).areaM2, 92);
  assert.equal(preenchimentoDaMatricula(matricula({ vaga: null })).vagas, null);
});

test("sanear: JSON da IA campo a campo; CPF só 11/14 dígitos; ônus desconhecido vira 'outro'", () => {
  const l = sanearMatricula({
    numero: "12.345",
    cartorio: "<b>1º Ofício</b>",
    endereco: { rua: "Rua A", numero: "1", bairro: null, cidade: "Uberlândia", uf: "mg", cep: "38400-100" },
    unidade: "Apto 1",
    area_privativa_m2: 50.456,
    area_total_m2: -3,
    vaga: null,
    proprietarios: [{ nome: "Fulano", cpf_cnpj: "529.982.247-25", fracao: "50%" }, { nome: "Ciclano", cpf_cnpj: "123", fracao: null }],
    data_ultimo_ato: "2026-01-02",
    onus_em_aberto: [{ tipo: "algo", credor: null, em_favor_de_terceiro: false }],
    legivel: true,
    sinais_de_edicao: [],
    baixa_confianca: false,
  })!;
  assert.equal(l.cartorio, "b1º Ofício/b");
  assert.equal(l.endereco.uf, "MG");
  assert.equal(l.endereco.cep, "38400100");
  assert.equal(l.areaPrivativa, 50.46);
  assert.equal(l.areaTotal, null);
  assert.equal(l.proprietarios[0].documento, CPF);
  assert.equal(l.proprietarios[1].documento, null);
  assert.equal(l.onus[0].tipo, "outro");
  assert.equal(sanearMatricula({ numero: "1" }), null);
});

test("laboratório: marcador no arquivo e leituras simuladas por caso", () => {
  const bytes = new TextEncoder().encode("%PDF-1.4 ... VIVA-LAB-MAT:outro_dono ...");
  assert.equal(casoLabMatricula(bytes), "outro_dono");
  assert.equal(casoLabMatricula(new TextEncoder().encode("VIVA-LAB-MAT:inventado")), null);
  const e = { perfil: { nome: "José da Silva", cpf: CPF }, endereco: ENDERECO, hoje: HOJE };
  assert.equal(decidirMatricula(leituraMatriculaSimulada("dono", e), entrada()).resultado, "conferido");
  assert.equal(decidirMatricula(leituraMatriculaSimulada("sem_cpf", e), entrada()).resultado, "provavel");
  assert.equal(decidirMatricula(leituraMatriculaSimulada("outro_dono", e), entrada()).motivo, "dono_diferente");
  assert.equal(decidirMatricula(leituraMatriculaSimulada("penhora", e), entrada()).motivo, "detalhe_matricula");
  assert.equal(decidirMatricula(leituraMatriculaSimulada("fiduciaria", e), entrada()).resultado, "conferido");
  assert.deepEqual(decidirMatricula(leituraMatriculaSimulada("antiga", e), entrada()).avisos.map((a) => a.codigo), ["matricula_antiga"]);
  assert.deepEqual(decidirMatricula(leituraMatriculaSimulada("outro_endereco", e), entrada()).avisos.map((a) => a.codigo), ["endereco_diferente"]);
});

test("decisão 1 — sem matrícula: IPTU + contrato de compra é aceito, mas fica 'em revisão' (nunca aprovado na hora)", async () => {
  const { semMatriculaVaiParaRevisao, MSG_SEM_MATRICULA } = await import("./conferencia-matricula.ts");
  const { decidirConferencia } = await import("./conferencia.ts");
  const cadastro = { nomeConta: "José da Silva", endereco: ENDERECO, operacao: "own", duplicado: 0, hoje: HOJE };
  const iptu = {
    tipo: "iptu" as const,
    titular: "José da Silva",
    cpfCnpjParcial: "982247",
    endereco: ENDERECO,
    dataDocumento: "2026",
    legivel: true,
    completo: true,
    sinaisDeEdicao: [],
    proprietariosListados: [],
    baixaConfianca: false,
  };
  // O IPTU certinho passaria na conferência do prompt 11…
  assert.equal(decidirConferencia(iptu, cadastro).estado, "aprovado");
  // …mas, sem matrícula, vai para a equipe (48 h), com o motivo explicado.
  const r = semMatriculaVaiParaRevisao(decidirConferencia(iptu, cadastro), iptu.tipo);
  assert.equal(r.estado, "revisao");
  assert.deepEqual(r.motivos, [{ codigo: "sem_matricula", texto: MSG_SEM_MATRICULA }]);
  // Conta de consumo e contrato de administração: mesma regra. Erro claro continua "Corrija".
  assert.equal(semMatriculaVaiParaRevisao(decidirConferencia({ ...iptu, tipo: "conta_consumo", dataDocumento: HOJE }, cadastro), "conta_consumo").estado, "revisao");
  assert.equal(semMatriculaVaiParaRevisao(decidirConferencia({ ...iptu, legivel: false }, cadastro), "iptu").estado, "corrija");
  // A matrícula aprovada não muda.
  const aprovado = { estado: "aprovado" as const, checklist: { titular: true, imovel: true, legivel: true, validade: true }, motivos: [] };
  assert.equal(semMatriculaVaiParaRevisao(aprovado, "matricula").estado, "aprovado");
});
