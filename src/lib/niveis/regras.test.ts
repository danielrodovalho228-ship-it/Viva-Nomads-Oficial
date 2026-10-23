import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AREAS, CHAVES_NIVEL, CHAVES_NIVEL_FOTO, EXTRAS, ITENS_NIVEL, MATRIZ, PERGUNTAS_RUIDO, type Area, type ChaveNivel } from "../../config/niveis.ts";
import { CHAVES_CONFORTO, VERSAO_CONFORTO } from "../../config/conforto-minimo.ts";
import {
  classeRuido,
  fatosAtendidos,
  itemConta,
  itensDaConferencia,
  itensDoNivel,
  medidaPorPonto,
  nivelAoMenos,
  nivelDaArea,
  nivelDoImovel,
  pendenciaBloqueia,
  ruidoControlado,
  validarExtras,
  validarRespostasRuido,
  type EntradaNivel,
  type ItemDeclarado,
  type MedidaPonto,
  type RespostasRuido,
} from "./regras.ts";

const AGORA = new Date("2026-10-23T12:00:00Z");
const essencial = CHAVES_CONFORTO.map((chave) => ({ chave, confirmado: true, versao_lista: VERSAO_CONFORTO }));
const foto = (chave: string, extra: Partial<ItemDeclarado> = {}): ItemDeclarado => ({ chave, declarado: true, fotoPath: `dono/${chave}.webp`, fotoStatus: "aceita", ...extra });
const medida = (ponto: MedidaPonto["ponto"], boa = true, extra: Partial<MedidaPonto> = {}): MedidaPonto => ({
  ponto,
  validada: true,
  medidoEm: "2026-10-20T12:00:00Z",
  validoAte: "2027-04-20T12:00:00Z",
  downloadMbps: boa ? 200 : 8,
  uploadMbps: boa ? 100 : 2,
  latenciaMs: boa ? 15 : 200,
  ...extra,
});
const silencioso: RespostasRuido = { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false };

/** Entrada com tudo do Premium (todas as fotos, as duas medidas boas e ruído baixo). */
function premium(over: Partial<EntradaNivel> = {}): EntradaNivel {
  return {
    declaracoesConforto: essencial,
    itens: CHAVES_NIVEL_FOTO.map((k) => foto(k)),
    medidas: [medida("quarto_principal"), medida("trabalho")],
    ruido: silencioso,
    bloqueadas: [],
    agora: AGORA,
    ...over,
  };
}
/** Só os itens de Conforto (sem os de Premium). */
function conforto(over: Partial<EntradaNivel> = {}): EntradaNivel {
  const deConforto = new Set<string>(AREAS.flatMap((a) => MATRIZ[a].conforto));
  return premium({ itens: CHAVES_NIVEL_FOTO.filter((k) => deConforto.has(k)).map((k) => foto(k)), medidas: [medida("quarto_principal"), medida("trabalho", false)], ...over });
}

test("matriz: 9 áreas, itens únicos, cumulativa; Essencial = os 12 do padrão mínimo; nenhum item de segurança tem nível", () => {
  assert.deepEqual([...AREAS], ["sono", "clima", "banho", "cozinha", "sala", "trabalho", "internet", "lavanderia", "ruido"]);
  assert.equal(new Set(CHAVES_NIVEL).size, CHAVES_NIVEL.length);
  for (const a of AREAS) for (const k of MATRIZ[a].essencial) assert.ok((CHAVES_CONFORTO as readonly string[]).includes(k), `${a}: ${k} é do mínimo`);
  // Todo item de nível aparece em alguma área; os do mínimo cobrem as áreas que têm Essencial.
  const usados = new Set(AREAS.flatMap((a) => [...MATRIZ[a].conforto, ...MATRIZ[a].premium]));
  assert.deepEqual(CHAVES_NIVEL.filter((k) => !usados.has(k)), []);
  for (const k of ["fechadura_entrada", "entrega_limpa", "iluminacao"]) assert.ok(!AREAS.some((a) => MATRIZ[a].essencial.includes(k)), `${k} é condição, não nível`);
  for (const i of ITENS_NIVEL) assert.ok(i.rotulo && i.criterio, i.chave);
  // Revisão 1: Conforto com 2 travesseiros por pessoa; internet medida em dois pontos; ar-condicionado só a partir do Conforto.
  assert.ok(MATRIZ.sono.conforto.includes("sono_dois_travesseiros"));
  assert.deepEqual([...MATRIZ.internet.conforto], ["internet_medida_quarto", "internet_medida_trabalho"]);
  assert.ok(MATRIZ.clima.essencial.includes("ventilacao_quartos") && !MATRIZ.clima.essencial.some((k) => k.startsWith("ar_")));
});

test("elo mais fraco: tudo Premium → Premium; tudo Conforto → Conforto; sem itens de nível → Essencial; mínimo incompleto → em adequação", () => {
  assert.equal(nivelDoImovel(premium()).nivel, "premium");
  assert.equal(nivelDoImovel(conforto()).nivel, "conforto");
  assert.equal(nivelDoImovel(premium({ itens: [], medidas: [], ruido: null })).nivel, "essencial");
  assert.equal(nivelDoImovel(premium({ declaracoesConforto: essencial.slice(1) })).nivel, "em_adequacao");
});

test("elo mais fraco por área: cada área sozinha em Conforto deixa um Premium em Conforto (e em Essencial, deixa Essencial)", () => {
  for (const area of AREAS) {
    const tirarPremium = new Set<string>(MATRIZ[area].premium);
    const tirarConforto = new Set<string>([...MATRIZ[area].conforto, ...MATRIZ[area].premium]);
    const sem = (s: Set<string>, base: EntradaNivel): EntradaNivel => ({
      ...base,
      itens: base.itens.filter((i) => !s.has(i.chave)),
      medidas: s.has("internet_videochamada_trabalho") ? base.medidas.map((m) => (m.ponto === "trabalho" ? medida("trabalho", false) : m)) : base.medidas,
      ruido: s.has("ruido_controlado") ? { via_intensa: true, noturno_obra_100m: true, aviao_ferrovia: false, isolamento_acustico: false } : base.ruido,
      bloqueadas: [...s].filter((k) => k.startsWith("internet_medida")),
    });
    const r1 = nivelDoImovel(sem(tirarPremium, premium()));
    // Ruído tem o mesmo critério em Conforto e Premium: sem ele, a área cai direto ao Essencial.
    if (area === "ruido") {
      assert.equal(r1.nivel, "essencial");
      continue;
    }
    assert.equal(r1.nivel, "conforto", `${area} em Conforto`);
    assert.equal(r1.porArea[area], "conforto", area);
    // As outras áreas seguem Premium (diferenciais da ficha), exceto as que dividem o item retirado.
    assert.ok(r1.diferenciais.length >= 1, `${area}: diferenciais ${JSON.stringify(r1.diferenciais)}`);
    const r2 = nivelDoImovel(sem(tirarConforto, premium()));
    assert.equal(r2.nivel, "essencial", `${area} em Essencial`);
  }
});

test("elo mais fraco, combinações: em todas as 3^9 combinações de áreas, o imóvel fica no menor nível entre as áreas", () => {
  const ord = { em_adequacao: -1, essencial: 0, conforto: 1, premium: 2 } as const;
  const niveis = ["essencial", "conforto", "premium"] as const;
  for (let seed = 0; seed < 3 ** AREAS.length; seed++) {
    const alvo = {} as Record<Area, (typeof niveis)[number]>;
    let x = seed;
    for (const a of AREAS) {
      alvo[a] = niveis[x % 3];
      x = Math.floor(x / 3);
    }
    // Entrada real: o mínimo completo + as fotos/medidas/ruído pedidos por cada área para o nível sorteado.
    const fatos = new Set<string>();
    for (const a of AREAS) {
      if (alvo[a] !== "essencial") MATRIZ[a].conforto.forEach((k) => fatos.add(k));
      if (alvo[a] === "premium") MATRIZ[a].premium.forEach((k) => fatos.add(k));
    }
    const e = premium({
      itens: CHAVES_NIVEL_FOTO.filter((k) => fatos.has(k)).map((k) => foto(k)),
      medidas: [
        ...(fatos.has("internet_medida_quarto") ? [medida("quarto_principal")] : []),
        ...(fatos.has("internet_medida_trabalho") || fatos.has("internet_videochamada_trabalho") ? [medida("trabalho", fatos.has("internet_videochamada_trabalho"))] : []),
      ],
      ruido: fatos.has("ruido_controlado") ? silencioso : { via_intensa: true, noturno_obra_100m: true, aviao_ferrovia: false, isolamento_acustico: false },
    });
    const r = nivelDoImovel(e);
    // Cada área sustenta pelo menos o nível sorteado (itens compartilhados só podem subir a vizinha)…
    for (const a of AREAS) assert.ok(ord[r.porArea[a]] >= ord[alvo[a]], `seed ${seed} ${a}`);
    // …e o imóvel é exatamente o menor nível entre as áreas calculadas.
    const menor = AREAS.map((a) => r.porArea[a]).reduce((m, n) => (ord[n] < ord[m] ? n : m));
    assert.equal(r.nivel, menor, `seed ${seed}`);
  }
});

test("prova: item sem foto não conta; foto recusada tira o item; foto em análise conta; sem declaração não conta", () => {
  assert.equal(itemConta(foto("ar_sala", { fotoPath: null })), false);
  assert.equal(itemConta(foto("ar_sala", { fotoStatus: "recusada" })), false);
  assert.equal(itemConta(foto("ar_sala", { fotoStatus: "pendente" })), true);
  assert.equal(itemConta(foto("ar_sala", { declarado: false })), false);
  const semFoto = premium({ itens: premium().itens.map((i) => (i.chave === "ar_todos_quartos" ? { ...i, fotoPath: null } : i)) });
  assert.equal(nivelDoImovel(semFoto).nivel, "conforto");
  const recusada = premium({ itens: premium().itens.map((i) => (i.chave === "lavadora_no_imovel" ? { ...i, fotoStatus: "recusada" as const } : i)) });
  assert.equal(nivelDoImovel(recusada).nivel, "essencial", "a lavadora no imóvel é do Conforto: sem ela, a lavanderia fica no Essencial");
});

test("internet por ponto: medida válida e vigente nos dois pontos para Conforto; videochamada no ponto de trabalho para Premium", () => {
  const vencida = medida("trabalho", true, { validoAte: "2026-10-01T00:00:00Z" });
  const invalida = medida("trabalho", true, { validada: false });
  assert.equal(medidaPorPonto([vencida, invalida], AGORA).has("trabalho"), false);
  assert.equal(medidaPorPonto([medida(null)], AGORA).size, 0, "medição sem ponto não vale para o nível");
  assert.equal(nivelDoImovel(premium({ medidas: [medida("quarto_principal")] })).porArea.internet, "essencial");
  assert.equal(nivelDoImovel(premium({ medidas: [medida("quarto_principal"), medida("trabalho", false)] })).porArea.internet, "conforto");
  // A mais recente vale: uma medida nova ruim no trabalho derruba a videochamada.
  const nova = medida("trabalho", false, { medidoEm: "2026-10-22T12:00:00Z" });
  assert.equal(nivelDoImovel(premium({ medidas: [medida("quarto_principal"), medida("trabalho"), nova] })).porArea.trabalho, "conforto");
});

test("ruído: 16 combinações das 4 perguntas; Conforto/Premium bloqueados só com 'alto' sem isolamento", () => {
  let n = 0;
  for (let b = 0; b < 16; b++) {
    const r: RespostasRuido = { via_intensa: !!(b & 1), noturno_obra_100m: !!(b & 2), aviao_ferrovia: !!(b & 4), isolamento_acustico: !!(b & 8) };
    const fontes = (b & 1 ? 1 : 0) + (b & 2 ? 1 : 0) + (b & 4 ? 1 : 0);
    const classe = classeRuido(r);
    assert.equal(classe, fontes === 0 ? "baixo" : fontes === 1 ? "medio" : "alto", `combinação ${b}`);
    assert.equal(ruidoControlado(r), classe !== "alto" || r.isolamento_acustico, `combinação ${b}`);
    const nivel = nivelDoImovel(premium({ ruido: r })).nivel;
    assert.equal(nivel, classe === "alto" && !r.isolamento_acustico ? "essencial" : "premium", `combinação ${b}`);
    n++;
  }
  assert.equal(n, 16);
  assert.equal(PERGUNTAS_RUIDO.length, 4);
  assert.equal(ruidoControlado(null), false, "sem resposta não chega a Conforto");
  assert.equal(validarRespostasRuido({ via_intensa: true }).ok, false);
  assert.deepEqual(validarRespostasRuido({ ...silencioso, extra: 1 }), { ok: true, respostas: silencioso });
});

test("queda por pendência: 'não confere' no ar do quarto tira o Premium até a correção; contestação aberta também; resolvida volta", () => {
  assert.equal(nivelDoImovel(premium({ bloqueadas: ["ar_todos_quartos"] })).nivel, "conforto");
  assert.equal(nivelDoImovel(premium({ bloqueadas: ["ar_quarto_principal"] })).nivel, "essencial");
  assert.equal(nivelDoImovel(premium({ bloqueadas: ["ruido_controlado"] })).nivel, "essencial");
  assert.equal(nivelDoImovel(premium({ bloqueadas: [] })).nivel, "premium", "corrigida: volta");
  assert.equal(pendenciaBloqueia("aberta"), true);
  assert.equal(pendenciaBloqueia("contestada"), true);
  for (const s of ["corrigida", "improcedente", "procedente"]) assert.equal(pendenciaBloqueia(s), false, s);
  // Pendência num item do mínimo segue o fluxo do 59: o imóvel não cai abaixo do Essencial.
  assert.equal(nivelDoImovel(premium({ bloqueadas: ["agua_quente"] })).nivel, "essencial");
});

test("itens que definem o nível (conferência de entrada): Conforto pede os de Conforto; Premium pede os dois; Essencial nenhum", () => {
  assert.deepEqual(itensDoNivel("essencial"), []);
  const c = itensDaConferencia("conforto");
  const p = itensDaConferencia("premium");
  assert.ok(c.includes("ar_quarto_principal") && !c.includes("ar_todos_quartos"));
  assert.ok(p.includes("ar_todos_quartos") && p.includes("ar_quarto_principal"));
  assert.ok(!p.some((k: ChaveNivel) => k.startsWith("internet_") || k === "ruido_controlado"), "internet é medida e ruído tem pergunta própria");
  assert.deepEqual(nivelDoImovel(premium()).itensQueDefinem, itensDoNivel("premium"));
});

test("faltaParaProximo e diferenciais: a página do dono sabe o que falta; a ficha mostra a área acima do nível", () => {
  const r = nivelDoImovel(conforto({ itens: [...conforto().itens, foto("sala_assentos"), foto("ar_sala"), foto("ar_todos_quartos")] }));
  assert.equal(r.nivel, "conforto");
  assert.ok(r.diferenciais.some((d) => d.area === "sala" && d.nivel === "premium"), JSON.stringify(r.diferenciais));
  assert.deepEqual(r.faltaParaProximo.lavanderia, ["lavadora_secadora"]);
  assert.equal(nivelAoMenos("premium", "conforto"), true);
  assert.equal(nivelAoMenos("essencial", "conforto"), false);
  assert.equal(nivelAoMenos(null, "essencial"), false);
});

test("extras: lista fechada, nunca entram no cálculo; um extra quebrado não derruba nada", () => {
  assert.ok(EXTRAS.some((e) => e.chave === "air_fryer") && EXTRAS.some((e) => e.chave === "cafeteira"));
  assert.deepEqual(validarExtras(["tv", "tv", "piscina", 3]), ["tv"]);
  const fatos = fatosAtendidos(premium());
  for (const e of EXTRAS) assert.equal(fatos.has(e.chave), false);
  for (const a of AREAS) for (const k of [...MATRIZ[a].conforto, ...MATRIZ[a].premium]) assert.ok(!EXTRAS.some((e) => e.chave === k), k);
});

test("nada financeiro (D7) e nível não é selo nem compra posição: sem valor, taxa ou plano nas regras do nível", () => {
  for (const f of ["../../config/niveis.ts", "./regras.ts"]) {
    const fonte = readFileSync(new URL(f, import.meta.url), "utf8").replace(/Nada financeiro[^\n]*/g, "").replace(/NÃO muda a taxa[^\n]*/g, "").replace(/não muda taxa[^\n]*/g, "");
    assert.doesNotMatch(fonte, /R\$|multa|abatimento|desconto|reembolso|valor_|preco|cobran|assinatura|plano/i, f);
  }
});
