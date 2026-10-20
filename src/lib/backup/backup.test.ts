/*
  Resiliência 2 — cópia noturna cifrada + teste de restauração: as partes puras.
  Roda: node --test src/lib/backup/backup.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { quaisFicam, removidosParaPodar, planoRetencao, diaDaCopia } from "./retencao.ts";
import { montarManifesto, lerManifesto, dadoPessoalNoManifesto, type EntradaManifesto } from "./manifesto.ts";
import { contarDump } from "./dump-contagem.ts";
import { motivosDeAlarme, montarAlarme, motivoSeguro, tamanhoLegivel, LINK_RESTAURACAO } from "./alarme.ts";
import { estadoBackup, duracaoLegivel, type LinhaBackup } from "./cartao.ts";
import { compararContagens, compararMigracoes, conferirChaves, sortearAmostra, lerCheckCombinado, conferirAmostra, motivoDoDrill, numeroMigracao } from "./drill.ts";
import { lerRespostas, CONSULTAS_CHAVE } from "./consultas-chave.ts";

// ---------- datas de apoio ----------
const DIA = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const t0 = (s: string) => Date.parse(`${s}T00:00:00Z`);
/** Uma cópia por dia, às 03:15, de `de` até `ate` (inclusive). */
function diarias(de: string, ate: string, hora = "0315"): string[] {
  const r: string[] = [];
  for (let t = t0(de); t <= t0(ate); t += DIA) r.push(`${iso(t)}_${hora}.dump`);
  return r;
}
const dom = (s: string) => new Date(t0(s.slice(0, 10))).getUTCDay() === 0;

// ---------- quaisFicam ----------
test("quaisFicam: um ano e meio de cópias diárias → 14 diárias, 8 semanais (domingo) e 12 mensais (dia 1)", () => {
  const todas = diarias("2025-04-01", "2026-10-19");
  const r = quaisFicam(todas, "2026-10-19");
  assert.equal(r.diarias.length, 14);
  assert.equal(r.diarias[0], "2026-10-06_0315.dump");
  assert.equal(r.diarias[13], "2026-10-19_0315.dump");
  assert.equal(r.semanais.length, 8);
  assert.ok(r.semanais.every(dom), "toda semanal é de domingo");
  assert.deepEqual(r.semanais.slice(-2), ["2026-10-11_0315.dump", "2026-10-18_0315.dump"]);
  assert.equal(r.semanais[0], "2026-08-30_0315.dump");
  assert.equal(r.mensais.length, 12);
  assert.ok(r.mensais.every((d) => d.slice(8, 10) === "01"), "toda mensal é do dia 1");
  assert.equal(r.mensais[0], "2025-11-01_0315.dump");
  assert.equal(r.mensais[11], "2026-10-01_0315.dump");
  // O resto pode ser apagado; nada é apagado e mantido ao mesmo tempo.
  const fica = new Set([...r.diarias, ...r.semanais, ...r.mensais]);
  assert.equal(r.apagar.length + fica.size, todas.length);
  assert.ok(r.apagar.every((d) => !fica.has(d)));
  assert.ok(fica.size <= 14 + 8 + 12);
});

test("quaisFicam: virada de mês — no dia 1 a mensal nova entra e a de 12 meses atrás sai", () => {
  const r = quaisFicam(diarias("2025-09-01", "2026-11-01"), "2026-11-01");
  assert.equal(r.mensais.length, 12);
  assert.equal(r.mensais[11], "2026-11-01_0315.dump");
  assert.equal(r.mensais[0], "2025-12-01_0315.dump");
  assert.ok(r.apagar.includes("2025-11-01_0315.dump"));
  // 01/11/2026 é domingo: é diária, semanal e mensal ao mesmo tempo.
  assert.ok(r.diarias.includes("2026-11-01_0315.dump") && r.semanais.includes("2026-11-01_0315.dump"));
  // As diárias atravessam a virada: 19/10 a 01/11.
  assert.equal(r.diarias[0], "2026-10-19_0315.dump");
});

test("quaisFicam: virada de ano — semana de 27/12 a 02/01 e mensais de jan/2027 e dez/2026", () => {
  const r = quaisFicam(diarias("2025-12-15", "2027-01-10"), "2027-01-10");
  assert.equal(r.mensais[11], "2027-01-01_0315.dump");
  assert.equal(r.mensais[10], "2026-12-01_0315.dump");
  assert.equal(r.mensais[0], "2026-02-01_0315.dump");
  assert.ok(r.semanais.includes("2026-12-27_0315.dump"), "domingo antes da virada");
  assert.ok(r.semanais.includes("2027-01-03_0315.dump") && r.semanais.includes("2027-01-10_0315.dump"));
  assert.equal(r.semanais.length, 8);
  assert.equal(r.diarias[0], "2026-12-28_0315.dump");
});

test("quaisFicam: domingo que falhou → vale a primeira cópia da semana; dia 1 que falhou → a primeira do mês", () => {
  const todas = diarias("2026-08-20", "2026-10-19").filter((d) => d !== "2026-10-11_0315.dump" && d !== "2026-10-01_0315.dump");
  const r = quaisFicam(todas, "2026-10-19");
  assert.ok(r.semanais.includes("2026-10-12_0315.dump"));
  assert.ok(r.mensais.includes("2026-10-02_0315.dump"));
});

test("quaisFicam: a mais nova nunca sai, nome fora do padrão nunca é apagado, duas no mesmo dia ficam", () => {
  const r = quaisFicam(["2020-01-05_0315.dump", "lixo.txt", "2026-10-19_0315.dump", "2026-10-19_1402.dump"], "2026-10-19");
  assert.ok(r.diarias.includes("2026-10-19_1402.dump") && r.diarias.includes("2026-10-19_0315.dump"));
  assert.ok(!r.apagar.includes("lixo.txt"));
  const so = quaisFicam(["2020-01-05_0315.dump"], "2026-10-19");
  assert.deepEqual(so.diarias, ["2020-01-05_0315.dump"]);
  assert.deepEqual(so.apagar, []);
  assert.throws(() => quaisFicam([], "19/10/2026"));
  assert.equal(diaDaCopia("2026-02-30_0315.dump"), null);
});

test("removidosParaPodar: só pastas AAAA-MM-DD com mais de 30 dias", () => {
  const r = removidosParaPodar(["2026-09-18/", "2026-09-19/", "2026-10-01/", "outra/", "2025-12-31"], "2026-10-19");
  assert.deepEqual(r, ["2025-12-31", "2026-09-18/"]);
});

test("planoRetencao: copia para semanal/mensal antes de apagar e poda manifestos sem cópia", () => {
  const diario = diarias("2026-09-25", "2026-10-19");
  const plano = planoRetencao("2026-10-19", { diario, semanal: [], mensal: [] }, ["2026-09-01.json", "2026-10-01.json", "2026-10-19.json"], ["2026-09-01/", "2026-10-18/"]);
  const iCopia = plano.findIndex((l) => l.startsWith("copiar"));
  const iApaga = plano.findIndex((l) => l.startsWith("apagar"));
  assert.ok(iCopia >= 0 && iCopia < iApaga, "copia antes de apagar");
  assert.ok(plano.includes("copiar diario 2026-10-18_0315.dump semanal"));
  assert.ok(plano.includes("copiar diario 2026-10-01_0315.dump mensal"));
  assert.ok(plano.includes("apagar diario 2026-09-25_0315.dump"));
  assert.ok(!plano.some((l) => l.includes("2026-10-19_0315.dump") && l.startsWith("apagar")));
  assert.ok(plano.includes("purgar-removidos 2026-09-01"));
  assert.ok(plano.includes("apagar-manifesto 2026-09-01.json"));
  assert.ok(!plano.includes("apagar-manifesto 2026-10-01.json"), "manifesto da mensal fica");
});

// ---------- contagem do dump ----------
test("contagem do dump: conta as linhas de cada COPY e lê só version/name das migrações", () => {
  const texto = [
    "SET statement_timeout = 0;",
    "COPY public.profiles (id, full_name, email) FROM stdin;",
    "1\tMaria Silva\tmaria@exemplo.com",
    "2\tJoão\\nSegunda linha\tjoao@exemplo.com",
    "\\.",
    'COPY public."Estranha" (id) FROM stdin;',
    "\\.",
    "COPY supabase_migrations.schema_migrations (version, statements, name, created_by) FROM stdin;",
    "20261019000186\t{x}\t0186_cartoes_compartilhaveis\tdaniel@exemplo.com",
    "20261019000191\t{y}\t0191_backups_execucoes\tdaniel@exemplo.com",
    "\\.",
  ].join("\n");
  const c = contarDump(texto);
  assert.deepEqual(c.tabelas, { "public.Estranha": 0, "public.profiles": 2, "supabase_migrations.schema_migrations": 2 });
  assert.deepEqual(c.migracoes, ["20261019000186 0186_cartoes_compartilhaveis", "20261019000191 0191_backups_execucoes"]);
  assert.doesNotMatch(JSON.stringify(c), /@|Maria|João/);
});

// ---------- manifesto ----------
const entrada = (): EntradaManifesto => ({
  geradoEm: "2026-10-19T06:21:04Z",
  dump: { arquivo: "2026-10-19_0315.dump", bytes: 34_603_008, sha256: "a".repeat(64) },
  tabelas: { "public.profiles": 120, "auth.users": 121, "storage.objects": 812, "public.contratos": 7 },
  buckets: { avatars: { objetos: 90, bytes: 9_000_000 }, "property-photos": { objetos: 700, bytes: 26_000_000 }, documentos: { objetos: 22, bytes: 1_200_000 } },
  migracoes: ["20261019000191 0191_backups_execucoes", "20261019000186 0186_cartoes_compartilhaveis"],
  chaves: { contrato: true, imovel: true, perfil: true, conferencia: false, proposta: true },
});

test("manifesto: tamanho, hash, linhas por tabela, objetos por bucket, migrações — sem e-mail, CPF, telefone nem nome de arquivo", () => {
  const m = montarManifesto(entrada());
  assert.equal(m.dump.bytes, 34_603_008);
  assert.equal(m.totalLinhas, 120 + 121 + 812 + 7);
  assert.equal(m.storage.objetos, 812);
  assert.equal(m.storage.bytes, 36_200_000);
  assert.equal(m.migracoes.total, 2);
  assert.equal(m.migracoes.ultima, "20261019000191 0191_backups_execucoes");
  const json = JSON.stringify(m);
  assert.doesNotMatch(json, /@/, "sem e-mail");
  assert.doesNotMatch(json, /\d{3}\.\d{3}\.\d{3}-\d{2}/, "sem CPF");
  assert.doesNotMatch(json, /\(?\d{2}\)?\s?9?\d{4}-\d{4}/, "sem telefone");
  assert.doesNotMatch(json, /\.(jpe?g|png|webp|pdf|heic)\b|\//i, "sem nome nem caminho de arquivo");
  assert.equal(dadoPessoalNoManifesto(m), null);
  assert.deepEqual(lerManifesto(json), m);
});

test("manifesto: o que tem cara de dado pessoal ou de arquivo de usuário derruba a cópia (sem citar o valor)", () => {
  const casos: [string, (e: EntradaManifesto) => void][] = [
    ["bucket com e-mail", (e) => (e.buckets["maria@exemplo.com"] = { objetos: 1, bytes: 1 })],
    ["bucket com caminho", (e) => (e.buckets["fotos/123/rg.jpg"] = { objetos: 1, bytes: 1 })],
    ["tabela com CPF", (e) => (e.tabelas["public.123.456.789-09"] = 1)],
    ["migração com e-mail", (e) => e.migracoes.push("20261019000186 daniel@exemplo.com")],
    ["dump com outro nome", (e) => (e.dump.arquivo = "documento-maria.pdf")],
    ["contagem negativa", (e) => (e.tabelas["public.x"] = -1)],
    ["consulta desconhecida", (e) => ((e.chaves as Record<string, boolean>)["cpf_do_dono"] = true)],
  ];
  for (const [nome, estraga] of casos) {
    const e = entrada();
    estraga(e);
    assert.throws(
      () => montarManifesto(e),
      (err: Error) => /fora do formato/.test(err.message) && !/@|123\.456|rg\.jpg|maria/i.test(err.message),
      nome,
    );
  }
  assert.equal(dadoPessoalNoManifesto({ a: "fale com (62) 99999-1234" }), "telefone");
  assert.equal(dadoPessoalNoManifesto({ a: "123.456.789-09" }), "cpf");
  assert.equal(dadoPessoalNoManifesto({ a: "x@y.com" }), "email");
  assert.equal(dadoPessoalNoManifesto({ "usuarios/abc/foto.jpg": 1 }), "arquivo");
});

// ---------- alarmes ----------
test("alarmes: falha, dump < 50% do anterior e storage −20% de uma noite para a outra", () => {
  assert.deepEqual(motivosDeAlarme({ tipo: "copia", ok: true, bytesBanco: 100, objetosStorage: 100 }, { bytesBanco: 100, objetosStorage: 100 }), []);
  assert.deepEqual(motivosDeAlarme({ tipo: "copia", ok: true, bytesBanco: 50, objetosStorage: 80 }, { bytesBanco: 100, objetosStorage: 100 }), []);
  const m = motivosDeAlarme({ tipo: "copia", ok: true, bytesBanco: 49 * 1024 ** 2, objetosStorage: 79 }, { bytesBanco: 100 * 1024 ** 2, objetosStorage: 100 });
  assert.equal(m.length, 2);
  assert.match(m[0], /menos da metade.*100 MB → 49 MB/);
  assert.match(m[1], /mais de 20%.*100 → 79/);
  assert.deepEqual(motivosDeAlarme({ tipo: "copia", ok: true, bytesBanco: 1, objetosStorage: 1 }, null), [], "primeira cópia: nada a comparar");
  const f = motivosDeAlarme({ tipo: "drill", ok: false, motivo: "falha na etapa: restauração" }, null);
  assert.deepEqual(f, ["Falhou: falha na etapa: restauração."]);
});

test("alarme: formato do e-mail (assunto, o que aconteceu, o que fazer, links) e nenhum dado no motivo", () => {
  const a = montarAlarme({
    tipo: "copia",
    motivos: ["Falhou: pg_dump falhou: postgresql://postgres:segredo@db.exemplo.co:5432/postgres <b>x</b> maria@exemplo.com 123.456.789-09."],
    quando: new Date("2026-10-19T06:15:00Z"),
    linkExecucao: "https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/actions/runs/123456",
  });
  assert.equal(a.assunto, "[Viva Nomads] Alarme do backup: cópia noturna com problema");
  const linhas = a.texto.split("\n");
  assert.equal(linhas[0], "O que aconteceu em 19/10/2026 03:15 (horário de Brasília):");
  assert.match(linhas[1], /^• Falhou: pg_dump falhou: \[link\]/);
  assert.ok(a.texto.includes("O que fazer: "));
  assert.ok(a.texto.includes("Execução: https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/actions/runs/123456"));
  assert.ok(a.texto.includes(`Passo a passo de restauração: ${LINK_RESTAURACAO}`));
  for (const t of [a.texto, a.html]) {
    assert.doesNotMatch(t, /segredo|maria@|123\.456\.789-09|postgresql:/);
  }
  assert.match(a.html, /&lt;b&gt;x&lt;\/b&gt;/, "HTML escapado");
  const d = montarAlarme({ tipo: "drill", motivos: ["x"], quando: new Date(), linkExecucao: "https://evil.example/actions/runs/1" });
  assert.equal(d.assunto, "[Viva Nomads] Alarme do backup: teste de restauração com problema");
  assert.ok(!d.texto.includes("evil.example"), "só link do GitHub Actions");
  assert.equal(motivoSeguro("  a   b "), "a b");
  assert.equal(motivoSeguro("ligue (62) 99999-1234"), "ligue [número]");
  assert.equal(motivoSeguro(""), null);
  assert.equal(tamanhoLegivel(70 * 1024 ** 2), "70 MB");
  assert.equal(tamanhoLegivel(1.5 * 1024 ** 3), "1,5 GB");
});

// ---------- cartão do admin ----------
const linha = (o: Partial<LinhaBackup> & Pick<LinhaBackup, "tipo" | "inicio" | "ok">): LinhaBackup => ({
  fim: null,
  motivo: null,
  bytes_banco: null,
  objetos_storage: null,
  bytes_storage: null,
  duracao_restauracao_s: null,
  bytes_pasta: null,
  ...o,
});

test("cartão: verde com cópia < 36 h e teste < 8 dias; vermelho por idade, falha ou alerta", () => {
  const agora = new Date("2026-10-19T12:00:00Z");
  const verde = estadoBackup(
    [
      linha({ tipo: "copia", inicio: "2026-10-19T06:15:00Z", fim: "2026-10-19T06:21:00Z", ok: true, bytes_pasta: 2 * 1024 ** 3 }),
      linha({ tipo: "drill", inicio: "2026-10-18T09:00:00Z", fim: "2026-10-18T09:06:00Z", ok: true, duracao_restauracao_s: 252 }),
    ],
    agora,
  );
  assert.equal(verde.vermelho, false);
  assert.equal(verde.bytesPasta, 2 * 1024 ** 3);
  assert.equal(verde.avisoGoogleOne, false);

  const velha = estadoBackup([linha({ tipo: "copia", inicio: "2026-10-17T23:00:00Z", ok: true }), linha({ tipo: "drill", inicio: "2026-10-18T09:00:00Z", ok: true })], agora);
  assert.equal(velha.copia.vermelho, true);
  assert.match(velha.copia.porque ?? "", /36 h/);

  const falhou = estadoBackup(
    [linha({ tipo: "copia", inicio: "2026-10-19T06:15:00Z", ok: false, motivo: "falha na etapa: dump do banco" }), linha({ tipo: "copia", inicio: "2026-10-18T06:15:00Z", ok: true })],
    agora,
  );
  assert.equal(falhou.copia.porque, "A última cópia falhou.");
  assert.equal(falhou.copia.ultimaOk?.inicio, "2026-10-18T06:15:00Z");

  const alerta = estadoBackup([linha({ tipo: "copia", inicio: "2026-10-19T06:15:00Z", ok: true, motivo: "Alerta: dump menor" })], agora);
  assert.equal(alerta.copia.porque, "A última cópia terminou com alerta.");

  const drillVelho = estadoBackup([linha({ tipo: "copia", inicio: "2026-10-19T06:15:00Z", ok: true }), linha({ tipo: "drill", inicio: "2026-10-10T09:00:00Z", ok: true })], agora);
  assert.equal(drillVelho.drill.vermelho, true);
  assert.match(drillVelho.drill.porque ?? "", /8 dias/);

  const nada = estadoBackup([], agora);
  assert.equal(nada.vermelho, true);
  assert.equal(nada.copia.porque, "Nenhuma cópia concluída ainda.");

  const cheio = estadoBackup([linha({ tipo: "copia", inicio: "2026-10-19T06:15:00Z", ok: true, bytes_pasta: 11 * 1024 ** 3 })], agora);
  assert.equal(cheio.avisoGoogleOne, true);
  assert.equal(duracaoLegivel(252), "4 min 12 s");
  assert.equal(duracaoLegivel(38), "38 s");
  assert.equal(duracaoLegivel(3720), "1 h 02 min");
});

// ---------- conferência do teste de restauração ----------
test("drill: contagens, migrações (manifesto e repositório), consultas-chave, amostra e motivo sem dado", () => {
  assert.equal(compararContagens({ "public.a": 1, "public.b": 2 }, { "public.a": 1, "public.b": 2, "public.c": 9 }).ok, true);
  const dif = compararContagens({ "public.a": 1, "public.b": 2 }, { "public.a": 1 });
  assert.equal(dif.ok, false);
  assert.match(dif.detalhe, /1 de 2 tabelas diferentes: public\.b/);

  const lista = ["20261018000189 0189_x", "20261019000191 0191_y"];
  assert.equal(compararMigracoes(lista, [...lista], [76, 189, 191]).ok, false, "0076 não registrada");
  assert.equal(compararMigracoes(["1 0076_a", ...lista], ["1 0076_a", ...lista], [76, 189, 191, 192]).ok, true, "0192 mais nova que o backup não conta");
  assert.equal(compararMigracoes(lista, lista.slice(0, 1), [189]).ok, false, "restaurado diferente do manifesto");
  assert.equal(numeroMigracao("20261019000191 0191_y"), 191);

  const chaves = conferirChaves({ contrato: true, imovel: false }, { contrato: false, conferencia: true, imovel: false, perfil: null, proposta: true });
  assert.deepEqual(
    chaves.map((c) => c.ok),
    [false, true, true, false, true],
  );
  assert.deepEqual(lerRespostas("t|f|t|t|f"), { contrato: true, conferencia: false, imovel: true, perfil: true, proposta: false });
  assert.equal(Object.keys(CONSULTAS_CHAVE).length, 5);

  let i = 0;
  const seq = [0.5, 0.1, 0.9, 0.3];
  const amostra = sortearAmostra(Array.from({ length: 50 }, (_, k) => k), 20, () => seq[i++ % seq.length]);
  assert.equal(amostra.length, 20);
  assert.equal(new Set(amostra).size, 20);
  assert.equal(sortearAmostra([1, 2], 20, Math.random).length, 2);

  const c = lerCheckCombinado("= a/b.jpg\n= c.pdf\n* d.png\n");
  assert.deepEqual(c, { iguais: 2, diferentes: 1 });
  assert.equal(conferirAmostra(3, c, false).ok, false);
  assert.equal(conferirAmostra(2, { iguais: 2, diferentes: 0 }, false).ok, true);

  const motivo = motivoDoDrill([dif, ...chaves]);
  assert.ok(motivo && motivo.startsWith("Não bateu: Linhas por tabela = manifesto"));
  assert.doesNotMatch(motivo ?? "", /public\.b|@/, "o motivo leva só o nome da conferência");
  assert.equal(motivoDoDrill([{ nome: "x", ok: true, detalhe: "" }]), null);
});
