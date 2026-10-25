/*
  Adendo 59.1, Parte A — exibição dos níveis: textos da ficha, o que falta no cadastro, a queda no painel do dono, o
  filtro da busca, o cartão e a Central de Pendências "decisões primeiro".
  Roda: node --test src/lib/niveis/exibicao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAVES_CONFORTO, VERSAO_CONFORTO } from "../../config/conforto-minimo.ts";
import { AREAS, MATRIZ, type ChaveNivel } from "../../config/niveis.ts";
import type { EntradaNivel } from "./regras.ts";
import { CRITERIO_NIVEL, nivelAgoraEFalta, proximoNivel, quedaPorPendencia, textoDiferenciais, textoExtras, textoQueda, textoRuido, tituloNivel } from "./exibicao.ts";
import { itensSintese } from "../cartao-sintese.ts";
import { resumoFiltros, FILTROS_PAINEL_VAZIOS } from "../busca/painel-filtros.ts";
import { rotuloFiltroNivel } from "../busca/filtro-nivel.ts";
import { decisoesDoProprietario } from "../painel/decisoes.ts";

const SRC = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(SRC + p, "utf8");

const SILENCIO = { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false };
const FOTO = (chave: string) => ({ chave, declarado: true, fotoPath: "a/b.webp", fotoStatus: "aceita" as const });
const MEDIDA = (ponto: "quarto_principal" | "trabalho", boa: boolean) => ({
  ponto,
  validada: true,
  validoAte: "2099-01-01T00:00:00Z",
  medidoEm: "2026-10-01T00:00:00Z",
  downloadMbps: boa ? 300 : 20,
  uploadMbps: boa ? 100 : 5,
  latenciaMs: boa ? 12 : 90,
});
const essencial = (): EntradaNivel => ({
  declaracoesConforto: CHAVES_CONFORTO.map((chave) => ({ chave, confirmado: true, versao_lista: VERSAO_CONFORTO })),
  itens: [],
  medidas: [],
  ruido: SILENCIO,
  bloqueadas: [],
  agora: new Date("2026-10-23T12:00:00Z"),
});
const fotosDe = (nivel: "conforto" | "premium") =>
  [...new Set(AREAS.flatMap((a) => [...MATRIZ[a].conforto, ...(nivel === "premium" ? MATRIZ[a].premium : [])]))].filter((k) => !k.startsWith("internet_") && k !== "ruido_controlado");
const conforto = (): EntradaNivel => ({ ...essencial(), itens: fotosDe("conforto").map(FOTO), medidas: [MEDIDA("quarto_principal", true), MEDIDA("trabalho", false)] });
const premium = (): EntradaNivel => ({ ...essencial(), itens: fotosDe("premium").map(FOTO), medidas: [MEDIDA("quarto_principal", true), MEDIDA("trabalho", true)] });

test("ficha: título do nível com '· vistoriado' e critério resumido de cada nível; abaixo do Essencial, nada", () => {
  assert.equal(tituloNivel("conforto"), "Nível Conforto");
  assert.equal(tituloNivel("premium", true), "Nível Premium · vistoriado");
  assert.equal(tituloNivel("em_adequacao"), null);
  assert.equal(tituloNivel(null), null);
  for (const n of ["essencial", "conforto", "premium"] as const) assert.ok(CRITERIO_NIVEL[n].length > 20 && CRITERIO_NIVEL[n].length < 220, n);
  assert.match(CRITERIO_NIVEL.essencial, /padrão mínimo/);
});

test("ficha: diferenciais por área, ruído como fato e extras na ordem da lista", () => {
  assert.equal(textoDiferenciais([{ area: "sala", nivel: "premium" }, { area: "trabalho", nivel: "premium" }]), "Sala: Premium · Trabalho: Premium");
  assert.equal(textoDiferenciais([]), null);
  assert.equal(textoRuido("baixo"), "Ruído baixo");
  assert.equal(textoRuido("alto", true), "Ruído alto, com janelas de isolamento acústico");
  assert.equal(textoRuido(null), null);
  assert.equal(textoExtras(["air_fryer", "secador_cabelo", "inventado"]), "Secador de cabelo, Air fryer");
  assert.equal(textoExtras([]), null);
});

test("cadastro: os 3 anúncios de teste (Essencial, Conforto, Premium) e o que falta para o próximo, por área", () => {
  const e = nivelAgoraEFalta(essencial());
  assert.equal(e.nivel, "essencial");
  assert.equal(e.proximo, "conforto");
  const chavesE = e.falta.flatMap((g) => g.itens.map((i) => i.chave));
  assert.ok(chavesE.includes("ar_quarto_principal") && chavesE.includes("sono_dois_jogos"));
  assert.equal(new Set(chavesE).size, chavesE.length, "item que vale para duas áreas aparece uma vez");
  assert.ok(e.falta.every((g) => g.itens.every((i) => i.criterio.length > 0)));

  const c = nivelAgoraEFalta(conforto());
  assert.equal(c.nivel, "conforto");
  assert.equal(c.proximo, "premium");
  const chavesC = c.falta.flatMap((g) => g.itens.map((i) => i.chave));
  assert.ok(chavesC.includes("ar_sala") && chavesC.includes("internet_videochamada_trabalho"));
  assert.ok(!chavesC.includes("ar_quarto_principal"), "o que já conta não aparece");

  const p = nivelAgoraEFalta(premium());
  assert.equal(p.nivel, "premium");
  assert.equal(p.proximo, null);
  assert.deepEqual(p.falta, []);

  const sem = nivelAgoraEFalta({ ...essencial(), declaracoesConforto: [] });
  assert.equal(sem.nivel, "em_adequacao");
  assert.deepEqual(sem.falta, [], "abaixo do Essencial, o que falta é o padrão mínimo (checklist acima)");
  assert.equal(proximoNivel("em_adequacao"), "essencial");
});

test("painel do dono: queda de nível por pendência aberta, com o item que segura", () => {
  const p = premium();
  assert.equal(quedaPorPendencia(p), null);
  const q = quedaPorPendencia({ ...p, bloqueadas: ["ar_todos_quartos"] });
  assert.deepEqual(q, { de: "premium", para: "conforto", itens: ["ar_todos_quartos"] });
  assert.equal(textoQueda("Casa Premium", q!, ["Ar-condicionado em todos os quartos"]), "Casa Premium caiu de Premium para Conforto: corrija Ar-condicionado em todos os quartos");
  assert.equal(quedaPorPendencia({ ...essencial(), bloqueadas: ["ar_todos_quartos"] }), null, "sem queda, sem aviso");

  const agora = new Date("2026-10-23T12:00:00Z");
  const d = decisoesDoProprietario(
    {
      quedasNivel: [{ propertyId: "p1", imovel: "Casa Premium", de: "premium", para: "conforto", itens: ["ar_todos_quartos"], contratoId: "c1", prazoAte: "2026-10-26T12:00:00Z" }],
      pendenciasDono: [{ id: "x", contratoId: "c1", imovel: "Casa Premium", chave: "ar_todos_quartos" as ChaveNivel, status: "aberta", prazoAte: "2026-10-26T12:00:00Z" }],
    } as never,
    agora,
  );
  const linha = d.find((x) => x.id === "nivel-queda-p1");
  assert.equal(linha?.texto, "Casa Premium caiu de Premium para Conforto: corrija Ar-condicionado em todos os quartos");
  assert.equal(linha?.href, "/dashboard/contratos/c1#pendencias-conforto");
  assert.match(linha?.prazoTexto ?? "", /^Corrija até /);
  assert.equal(d.filter((x) => x.id === "pendencia-x").length, 0, "a pendência que causou a queda não aparece duas vezes");
});

test("busca: Nível Essencial / Conforto / Premium na pílula (E105: saiu da folha), com contagem ao vivo e no resumo", () => {
  assert.equal(rotuloFiltroNivel("conforto"), "Nível Conforto ou acima");
  assert.equal(rotuloFiltroNivel("premium"), "Nível Premium");
  assert.equal(rotuloFiltroNivel(""), null);
  assert.match(resumoFiltros({ ...FILTROS_PAINEL_VAZIOS, nivelMin: "essencial" }), /Nível Essencial ou acima/);
  const pilulas = ler("components/busca/barra-pilulas.tsx");
  assert.match(pilulas, /p\.contar\(\{ \.\.\.f, nivelMin: v \}\)/, "cada chip conta ao vivo com os outros filtros");
  assert.match(ler("app/(public)/buscar/search-client.tsx"), /setNivelMin\(f\.nivelMin \?\? ""\)/);
});

test("cartão: o nível abre a linha de fatos; em adequação não aparece; o selo da foto não muda", () => {
  const t = (p: Parameters<typeof itensSintese>[0]) => itensSintese(p).map((i) => i.texto).join(" · ");
  assert.equal(t({ nivel: "conforto", bedrooms: 2, bathrooms: 1 }), "Conforto · 2 quartos · 1 banheiro");
  assert.equal(t({ nivel: "em_adequacao", bedrooms: 2 }), "2 quartos");
  assert.equal(t({ nivel: null, bedrooms: 1 }), "1 quarto");
  assert.doesNotMatch(ler("lib/card-selos.ts"), /nivel/i, "o nível não vira selo");
});

test("ficha e cadastro: blocos montados nas telas certas", () => {
  const ficha = ler("app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(ficha, /<BomSaber property=\{property\} \/>\s*<NivelImovel dados=\{exibicao59\?\.nivel\} \/>/);
  const bloco = ler("components/niveis/nivel-imovel.tsx");
  assert.match(bloco, /Como funcionam os níveis/);
  for (const id of ["nivel-diferenciais", "nivel-ruido", "nivel-extras"]) assert.match(bloco, new RegExp(`data-testid="${id}"`));
  const cadastro = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  const comodidades = cadastro.slice(cadastro.indexOf("{step === ETAPA.comodidades && ("), cadastro.indexOf("{step === ETAPA.regras && ("));
  // E141: sem o alerta do topo; a cobrança das fotos fica só no nível.
  assert.match(comodidades, /<NivelNoCadastro propertyId=\{imovelId\} conforto=\{conforto\} sugeridas=\{sugeridasFotos\} recarregar=\{nivelVersao\} \/>/);
  // DETECTA-B: as sugestões das fotos ficam logo antes do nível, no mesmo passo.
  assert.ok(comodidades.indexOf("<SugestoesDasFotos") >= 0 && comodidades.indexOf("<SugestoesDasFotos") < comodidades.indexOf("<NivelNoCadastro"));
  assert.match(ler("components/niveis/nivel-cadastro.tsx"), /nivel-cadastro-foto-\$\{item\.chave\}/);
});

test("admin: Central de Pendências com 'decisões primeiro' — a equipe decide antes, cada fila com a contagem e o botão", () => {
  const c = ler("app/(dashboard)/admin/pendencias/page.tsx");
  assert.ok(c.indexOf("<DecisoesDaCentral") < c.indexOf("<Panel title={filtro ?"), "as decisões vêm antes da lista");
  assert.match(c, /\{ lado: "equipe", titulo: "Decide a equipe da Viva" \}/);
  assert.match(c, /data-testid=\{`central-filtro-\$\{f\.chave\}`\}/);
  assert.match(ler("config/menu-admin.ts"), /"\/admin\/pendencias"/);
});
