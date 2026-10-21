/*
  Simulação da ordem (Prompt 33): ~200 ofertas sintéticas numa "Uberlândia de mentira" + buscas típicas.
  Rodar: node scripts/simular-ordem.ts   (sai com código 1 se algum invariante quebrar)
*/
import { destaquesHome, notaQualidade, ordenarBusca, prng, type FaixaCompat, type SinaisAnuncio } from "../src/lib/ranking/ordem.ts";

const AGORA = new Date("2026-11-01T12:00:00Z");
const r = prng(42);
const entre = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const sim = (p: number) => r() < p;
const diasAtras = (d: number) => new Date(AGORA.getTime() - d * 86_400_000).toISOString();

type Perfil = "bom" | "medio" | "ruim" | "gestor" | "novo_bom" | "exemplo" | "teste";
const perfilDe = new Map<string, Perfil>();

function oferta(id: string, donoId: string, perfil: Perfil): SinaisAnuncio {
  perfilDe.set(id, perfil);
  const q = { bom: 0.9, gestor: 0.7, novo_bom: 0.9, medio: 0.55, ruim: 0.2, exemplo: 0.9, teste: 0.9 }[perfil];
  const conv = perfil === "novo_bom" ? entre(0, 2) : entre(3, 30);
  return {
    id,
    donoId,
    ehExemplo: perfil === "exemplo",
    ehTeste: perfil === "teste",
    fotosTotal: entre(4, 25),
    comodosDistintos: sim(q) ? entre(5, 8) : entre(1, 3),
    fotosDeParceiro: sim(q * 0.4),
    descricaoPalavras: sim(q) ? entre(60, 200) : entre(5, 50),
    regrasCompletas: sim(q),
    enderecoExato: sim(Math.min(1, q + 0.1)),
    calendarioConfirmadoEm: sim(q) ? diasAtras(entre(0, 14)) : diasAtras(entre(15, 90)),
    identidadeConfirmada: sim(q),
    matriculaConferida: sim(q * 0.9),
    conversas: conv,
    conversasRespondidas: Math.round(conv * (sim(q) ? 0.95 : 0.5)),
    respostaMediaMin: conv ? (sim(q) ? entre(10, 200) : entre(300, 2000)) : null,
    avaliacoesQtd: perfil === "novo_bom" ? 0 : entre(0, 12),
    avaliacoesMedia: perfil === "novo_bom" ? null : sim(q) ? 4.5 + r() * 0.5 : 3 + r() * 1.2,
    cancelamentosDono12m: sim(q) ? 0 : entre(0, 2),
    precoJusto: sim(q * 0.5),
  };
}

const ofertas: SinaisAnuncio[] = [];
let n = 0;
const add = (perfil: Perfil, qtd: number, dono?: string) => {
  for (let i = 0; i < qtd; i++, n++) ofertas.push(oferta(`im${String(n).padStart(3, "0")}`, dono ?? `dono${n}`, perfil));
};
add("bom", 45);
add("medio", 75);
add("ruim", 40);
add("gestor", 15, "gestor_grande");
add("novo_bom", 15);
add("exemplo", 5);
add("teste", 5);

// Buscas típicas: compatibilidade e distância sorteadas por busca (a regra de compatibilidade já existe e não é o alvo aqui).
const BUSCAS = ["residente HC-UFU dez/4m", "executivo Santa Mônica 3m", "família Umuarama 6m com pet", "estudante até R$ 2.000", "sem filtro", "Centro 1 quarto"];
const falhas: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) falhas.push(msg); };

const resumo: Record<string, { top10: Record<string, number>; posMelhorNovo: number; maxPorDonoTop10: number }> = {};
for (const [k, nome] of BUSCAS.entries()) {
  const rb = prng(1000 + k);
  const itens = ofertas.map((s) => {
    const x = rb();
    const compat: FaixaCompat = x < 0.45 ? "exata" : x < 0.75 ? "parcial" : "fora";
    return { sinais: s, compat, distanciaKm: nome === "sem filtro" ? null : Math.round(rb() * 120) / 10 };
  });
  const res = ordenarBusca(itens, AGORA);
  const top10 = res.slice(0, 10);
  const cont: Record<string, number> = {};
  for (const p of top10) cont[perfilDe.get(p.id)!] = (cont[perfilDe.get(p.id)!] ?? 0) + 1;
  const donoTop = new Map<string, number>();
  for (const p of top10) { const d = ofertas.find((o) => o.id === p.id)!.donoId; donoTop.set(d, (donoTop.get(d) ?? 0) + 1); }
  const novosExatos = res.filter((p) => perfilDe.get(p.id) === "novo_bom" && p.compat === "exata");
  resumo[nome] = { top10: cont, posMelhorNovo: novosExatos.length ? res.indexOf(novosExatos[0]) + 1 : -1, maxPorDonoTop10: Math.max(...donoTop.values()) };

  // Invariantes
  check(!res.some((p) => perfilDe.get(p.id) === "teste"), `${nome}: anúncio de teste na busca`);
  check(!res.some((p) => perfilDe.get(p.id) === "exemplo"), `${nome}: exemplo na busca com anúncio real`);
  const ordemCompat = res.map((p) => ({ exata: 0, parcial: 1, fora: 2 })[p.compat]);
  check(ordemCompat.every((v, i) => i === 0 || v >= ordemCompat[i - 1]), `${nome}: compatibilidade fora de ordem`);
  check((cont.ruim ?? 0) <= 1, `${nome}: ${cont.ruim} anúncios ruins no top 10`);
}

// Home em 30 dias
const aparicoes = new Map<string, number>();
for (let d = 0; d < 30; d++) {
  const h = destaquesHome(ofertas, 4, AGORA, 20261101 + d);
  const donos = h.map((x) => ofertas.find((o) => o.id === x.id)!.donoId);
  check(new Set(donos).size === donos.length, `home dia ${d}: dono repetido`);
  check(!h.some((x) => ["exemplo", "teste"].includes(perfilDe.get(x.id)!)), `home dia ${d}: exemplo/teste`);
  check(h.every((x) => x.nota >= 70), `home dia ${d}: nota < 70`);
  check(donos.filter((x) => x === "gestor_grande").length <= 1, `home dia ${d}: gestor com mais de 1`);
  for (const x of h) aparicoes.set(x.id, (aparicoes.get(x.id) ?? 0) + 1);
}
const elegiveis = ofertas.filter((s) => !s.ehExemplo && !s.ehTeste && notaQualidade(s, AGORA).nota >= 70).length;

// Nota média por perfil (precisa ser monotônica: bom/novo_bom > médio > ruim)
const media = (p: Perfil) => { const xs = ofertas.filter((o) => perfilDe.get(o.id) === p).map((o) => notaQualidade(o, AGORA).nota); return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length); };
const medias = Object.fromEntries((["bom", "novo_bom", "gestor", "medio", "ruim"] as Perfil[]).map((p) => [p, media(p)]));
check(medias.bom > medias.medio && medias.medio > medias.ruim, `nota média fora de ordem: ${JSON.stringify(medias)}`);
check(medias.novo_bom >= medias.medio, "anúncio novo e bom abaixo do médio");

console.log("Nota média por perfil:", medias);
console.log("Top 10 por busca (perfil → quantidade), posição do melhor novo compatível, máx. por dono no top 10:");
for (const [k, v] of Object.entries(resumo)) console.log(`  ${k.padEnd(28)} ${JSON.stringify(v.top10).padEnd(45)} novo#${v.posMelhorNovo}  máxDono=${v.maxPorDonoTop10}`);
console.log(`Home (30 dias, 4 por dia): ${aparicoes.size} imóveis diferentes apareceram de ${elegiveis} elegíveis.`);
if (falhas.length) { console.error(`\nFALHOU (${falhas.length}):\n- ` + falhas.join("\n- ")); process.exit(1); }
console.log("\nTodos os invariantes passaram.");
