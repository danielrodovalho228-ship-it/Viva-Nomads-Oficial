/*
  Polos por cidade (ordem 9f68d9d3, item 3). Um polo é um conjunto de BAIRROS perto de um
  lugar que atrai quem fica de 30 a 180 dias (ex.: hospital universitário). Módulo puro:
  só nome de bairro, nunca endereço nem coordenada. Sem número de mercado inventado:
  o valor médio vem dos anúncios reais (calcularPrecosMedios), e some com menos de 3.
*/
import { chaveCidade } from "./cidades.ts";

export interface Polo {
  slug: string;
  cidade: string; // slug da cidade
  nome: string; // "Perto do HC-UFU e Umuarama"
  referencia: string; // "HC-UFU e Umuarama"
  bairros: readonly string[];
  intro: string;
  publico: string;
}

export const POLOS: readonly Polo[] = [
  {
    slug: "hc-ufu-umuarama",
    cidade: "uberlandia",
    nome: "Perto do HC-UFU e Umuarama",
    referencia: "HC-UFU e Umuarama",
    bairros: ["Umuarama", "Jardim Umuarama"],
    intro:
      "Região do campus Umuarama da UFU e do Hospital de Clínicas, em Uberlândia. Boa para quem está em residência, plantão, congresso, pesquisa ou projeto de poucos meses e quer chegar a pé ou com deslocamento curto.",
    publico: "Profissionais de saúde, residentes, pesquisadores e estudantes em estadia de 30 a 180 dias.",
  },
  {
    slug: "ufu-santa-monica",
    cidade: "uberlandia",
    nome: "Perto da UFU Santa Mônica",
    referencia: "UFU Santa Mônica",
    bairros: ["Santa Mônica"],
    intro:
      "Região do campus Santa Mônica da UFU, em Uberlândia. Indicada para quem faz intercâmbio, mestrado, doutorado ou projeto de curta duração e prefere morar mobiliado perto do campus.",
    publico: "Estudantes, professores visitantes e pesquisadores em estadia de 30 a 180 dias.",
  },
];

export function polosDaCidade(cidade: string): Polo[] {
  return POLOS.filter((p) => p.cidade === cidade);
}

export function acharPolo(cidade: string, slug: string): Polo | null {
  return POLOS.find((p) => p.cidade === cidade && p.slug === slug) ?? null;
}

/** O bairro do anúncio pertence ao polo? (sem acento, sem maiúscula) */
export function bairroNoPolo(polo: Polo, bairro: string | null | undefined): boolean {
  const k = chaveCidade(bairro);
  return !!k && polo.bairros.some((b) => chaveCidade(b) === k);
}

export function imoveisDoPolo<T extends { neighborhood: string }>(polo: Polo, imoveis: readonly T[]): T[] {
  return imoveis.filter((i) => bairroNoPolo(polo, i.neighborhood));
}

/** Perguntas e respostas do polo. Sem valor inventado: o preço só aparece se houver média real. */
export function perguntasDoPolo(polo: Polo, cidadeNome: string, mediaGeral: number | null): { q: string; a: string }[] {
  return [
    {
      q: `Dá para morar mobiliado perto de ${polo.referencia} por poucos meses?`,
      a: `Sim. Os imóveis do Viva Nomads em ${cidadeNome} são mobiliados e a estadia é de 30 a 180 dias, com contrato registrado na plataforma.`,
    },
    {
      q: `Quanto custa por mês perto de ${polo.referencia}?`,
      a:
        mediaGeral === null
          ? "Ainda não há anúncios suficientes na região para mostrar um valor médio. Quando houver pelo menos 3 anúncios no mesmo grupo, a média aparece aqui."
          : `A média dos anúncios publicados na região é de R$ ${mediaGeral.toLocaleString("pt-BR")} por mês. Cada imóvel mostra o valor mensal e as contas incluídas.`,
    },
    {
      q: "A Viva Nomads recebe o pagamento?",
      a: "Não. O valor combinado vai direto ao proprietário; a plataforma não toca em dinheiro. A conversa e o contrato ficam registrados.",
    },
  ];
}
