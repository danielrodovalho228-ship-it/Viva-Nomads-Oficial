/*
  E620 (ordem do Daniel, 05/11) — GRADUAR A MASSA DE ANÚNCIOS DE EXEMPLO pelo MESMO caminho computado do produto. PURO.

  Os anúncios de exemplo (SAMPLE_PROPERTIES, src/lib/properties.ts) nasceram fora do cadastro e nunca passaram pela
  Qualificação (os 12 itens do padrão mínimo), então o motor não tinha o que calcular: nenhum nível na busca nem no cartão.

  Aqui, cada exemplo RESPONDE a Qualificação com o que o anúncio tem de fato marcado (comodidades, mobília, internet,
  selo Pronto para Morar) — `respostasDoExemplo` —, as respostas viram as mesmas confirmações do Passo 5
  (`aplicarRespostas`, qualificacao-conforto.ts) e o nível sai do motor (`nivelDoImovel`, regras.ts). Nada de nível
  escrito à mão: um exemplo novo em SAMPLE_PROPERTIES já nasce graduado (properties.ts chama `graduarExemplo`).

  Regras de leitura dos atributos (conservadoras — sem o atributo, a pergunta fica sem resposta e o item falta):
  - Cama, apoio junto à cama e mobília das fotos: "Mobiliado completo" (furnished).
  - Ventilação dos quartos: comodidade "Ar-condicionado" (climatização). Sem ela, o anúncio não informa.
  - Cozinha básica: "Cozinha equipada" (inclui "compacta equipada") ou a lista da cozinha com geladeira e fogão/cooktop.
    "Cozinha compacta" sem "equipada" não diz que tem fogão e geladeira.
  - Roupa de cama e toalhas: "Roupa de cama e banho" listada, ou o selo Pronto para Morar (roupa de cama é critério dele).
  - Máquina de lavar: comodidade "Máquina de lavar" (no imóvel).
  - Água quente, luz, fechadura e entrega limpa: o selo Pronto para Morar (habitabilidade e limpeza são critérios dele).
  - Internet: a VELOCIDADE escrita no anúncio ("Internet fibra 300 Mbps"). "Internet fibra" sem número não é velocidade
    informada (a mesma regra do portão de publicar, FILTROS-1).

  Conforto e Premium: o motor exige itens provados por FOTO FEITA NA HORA e a internet MEDIDA (Prompt 57) — um exemplo
  não tem nenhum dos dois, e nada aqui inventa prova ou medição. O teto honesto da massa de exemplo é o Essencial.
*/
import { VERSAO_CONFORTO, type ChaveConforto } from "../../config/conforto-minimo.ts";
import type { Nivel } from "../../config/niveis.ts";
import type { Property } from "../types.ts";
import type { Exibicao59 } from "../data/exibicao-59.ts";
import { aplicarRespostas, faltamDoEssencial, type Respostas } from "../anuncio/qualificacao-conforto.ts";
import { nivelDoImovel, type ResultadoNivel } from "./regras.ts";

/** Comodidades e itens listados do anúncio (as três listas do exemplo), sem caixa. */
function listados(p: Property): string[] {
  const grupos = (p.amenityGroups ?? []).flatMap((g) => g.items);
  return [...(p.amenities ?? []), ...(p.workFeatures ?? []), ...grupos].map((s) => s.toLowerCase());
}

const tem = (l: readonly string[], re: RegExp) => l.some((s) => re.test(s));

/** Velocidade informada: o campo internetMbps ou o texto do anúncio ("Internet fibra 300 Mbps" → 300); sem número, null. */
export function mbpsInformado(p: Property): number | null {
  if (p.internetMbps && p.internetMbps > 0) return Math.round(p.internetMbps);
  for (const s of listados(p)) {
    const m = s.match(/(\d{2,4})\s*mbps/);
    if (m) return Number(m[1]);
  }
  return null;
}

/** As respostas da Qualificação que os atributos REAIS do exemplo sustentam (sem atributo, sem resposta). */
export function respostasDoExemplo(p: Property): Respostas {
  const l = listados(p);
  const mobiliado = !!p.furnished && tem(l, /mobiliado completo/);
  const pronto = !!p.readyToLiveBadge;
  const r: Respostas = {};
  if (mobiliado) {
    r.cama = true;
    r.apoio = true;
    r.mobilia = true;
  }
  if (tem(l, /^ar-condicionado$/)) r.ventilacao = "ar";
  const cozinhaEquipada = tem(l, /cozinha( compacta)? equipada/) || (tem(l, /^geladeira$/) && tem(l, /^(fogão|cooktop)$/));
  if (cozinhaEquipada) r.cozinha = tem(l, /^micro-?ondas$/) ? "micro" : "fogao";
  if (tem(l, /roupa de cama e banho/) || pronto) r.roupa = "todos";
  if (tem(l, /^máquina de lavar$/)) r.lavanderia = "imovel";
  else if (tem(l, /^lavanderia (compartilhada|coletiva|no prédio)/)) r.lavanderia = "predio"; // E754: "No prédio ou condomínio, com uso incluído"
  if (pronto) {
    r.agua = true;
    r.luz = true;
    r.fechadura = true;
    r.limpa = true;
  }
  const mbps = mbpsInformado(p);
  if (mbps) r.internet = String(mbps);
  return r;
}

export interface GraduacaoExemplo {
  /** O nível que o motor dá (null = abaixo do Essencial: o exemplo fica sem nível). */
  nivel: Nivel | null;
  /** Itens do padrão mínimo que os atributos do exemplo não sustentam (vazio quando tem nível). */
  faltam: ChaveConforto[];
  resultado: ResultadoNivel;
}

/** O MESMO caminho do cadastro: respostas → confirmações do Passo 5 → motor do nível. */
export function graduarExemplo(p: Property, agora: Date = new Date()): GraduacaoExemplo {
  const { conforto } = aplicarRespostas(respostasDoExemplo(p));
  const resultado = nivelDoImovel({
    // a confirmação na versão ATUAL da lista, como o Passo 5 grava (linhasConfirmacao)
    declaracoesConforto: conforto.map((chave) => ({ chave, confirmado: true, versao_lista: VERSAO_CONFORTO })),
    itens: [], // nenhuma foto feita na hora: nenhum item de Conforto/Premium provado
    medidas: [], // nenhuma medição do Prompt 57
    ruido: null,
    bloqueadas: [],
    agora,
  });
  const faltam = faltamDoEssencial(conforto);
  const nivel = faltam.length === 0 && resultado.nivel !== "em_adequacao" ? resultado.nivel : null;
  return { nivel, faltam: nivel ? [] : faltam, resultado };
}

/**
 * A ficha da página do exemplo: o MESMO nível do cartão (p.nivel, graduado acima), com os campos do imovel_nivel — sem
 * vistoria, ruído ou extras, que um exemplo não tem. O "padrão mínimo confirmado" acompanha o nível (12 de 12).
 */
export function exibicaoDoExemplo(p: Property): Exibicao59 {
  const n = p.nivel && p.nivel !== "em_adequacao" ? p.nivel : null;
  return {
    confortoConfirmado: !!n,
    taxaManutencao: null,
    nivel: n ? { nivel: n, vistoriado: false, diferenciais: [], ruidoClasse: null, isolamento: false, extras: [] } : null,
    avaliacao: null,
  };
}
