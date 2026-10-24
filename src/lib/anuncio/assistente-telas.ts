/*
  Assistente de cadastro em 10 passos — o que cada TELA mostra (mockups cadastro-imovel-01..10, aprovados em 23/10).
  O mapa de dados (que campo cada etapa grava, que item da prontidão resolve) é o da Pista B, em assistente-dez-etapas.ts.
  Vocabulário da casa: onde o desenho diz "hóspedes" ou "viajantes", aqui é "moradores". PURO.
*/
import { propertyTypeLabel } from "../amenities.ts";
import { linhaLocalizacao } from "../localizacao.ts";

export interface TelaAssistente {
  /** Rótulo curto (barra de passos, lista de conferência). */
  rotulo: string;
  /** H1 da tela. */
  titulo: string;
  subtitulo: string;
}

/** Na ordem dos passos (índice = ID da etapa em etapas-ids.ts). */
export const TELAS_ASSISTENTE: readonly TelaAssistente[] = [
  { rotulo: "Tipo", titulo: "Qual é o tipo do seu imóvel?", subtitulo: "Escolha a opção que melhor descreve seu espaço. Você pode editar depois." },
  { rotulo: "Fotos", titulo: "Adicione as fotos do imóvel", subtitulo: "Mostre o melhor do seu espaço. Você pode adicionar mais fotos depois." },
  { rotulo: "Endereço", titulo: "Onde fica o imóvel?", subtitulo: "Vamos cadastrar o endereço para que moradores encontrem seu imóvel com facilidade." },
  { rotulo: "Detalhes", titulo: "Detalhes do imóvel", subtitulo: "Informe os detalhes do seu imóvel para finalizar o cadastro." },
  { rotulo: "Comodidades", titulo: "O que o imóvel oferece?", subtitulo: "Selecione todas as comodidades disponíveis no seu imóvel. Isso ajuda moradores a encontrarem o que precisam." },
  { rotulo: "Regras", titulo: "Regras da casa", subtitulo: "Configure as regras para o seu morador." },
  { rotulo: "Descrição", titulo: "Título e descrição do anúncio", subtitulo: "Escreva o título e a descrição que aparecerão no seu anúncio." },
  { rotulo: "Preço", titulo: "Quanto custa por mês?", subtitulo: "Informe os custos mensais do imóvel. Você poderá editar depois." },
  { rotulo: "Disponibilidade", titulo: "Disponibilidade", subtitulo: "Escolha a partir de quando o imóvel está disponível e as datas que ficam fechadas." },
  { rotulo: "Revisão", titulo: "Revise e publique", subtitulo: "Confirme todos os detalhes antes de publicar seu anúncio. Você poderá editar depois." },
];

/** "Passo 3 de 10". */
export const textoPasso = (pos: number, total = TELAS_ASSISTENTE.length) => `Passo ${pos + 1} de ${total}`;
/** Largura da barra de progresso (0–100). */
export const progressoPasso = (pos: number, total = TELAS_ASSISTENTE.length) => Math.round(((pos + 1) / total) * 100);

/**
 * Passo 1 (Cadastro 01-b / E87, mockup cadastro-imovel-01): os NOVE tipos, todos em cartões-foto numa linha única
 * rolável, nesta ordem — um só array (saíram os três cartões grandes, a seção "Outros tipos" e os chips). `alt` descreve
 * o tipo da foto, que é ilustrativa.
 */
export const TIPOS_ASSISTENTE: readonly { valor: string; rotulo: string; alt: string }[] = [
  { valor: "casa", rotulo: "Casa", alt: "Foto ilustrativa de uma casa" },
  { valor: "apartamento", rotulo: "Apartamento", alt: "Foto ilustrativa de um prédio de apartamentos" },
  { valor: "quarto", rotulo: "Quarto", alt: "Foto ilustrativa de um quarto mobiliado" },
  { valor: "studio", rotulo: "Studio", alt: "Foto ilustrativa de um studio" },
  { valor: "loft", rotulo: "Loft", alt: "Foto ilustrativa de um loft" },
  { valor: "cobertura", rotulo: "Cobertura", alt: "Foto ilustrativa de uma cobertura" },
  { valor: "casa_condominio", rotulo: "Casa de condomínio", alt: "Foto ilustrativa de uma casa de condomínio" },
  { valor: "flat", rotulo: "Flat/apart-hotel", alt: "Foto ilustrativa de um flat em apart-hotel" },
  { valor: "chacara", rotulo: "Chácara/Sítio", alt: "Foto ilustrativa de uma chácara" },
];

/** Título da prévia: o do dono; sem título, "Apartamento no Santa Mônica" (tipo + bairro), como no desenho. */
export function tituloPrevia(titulo: string, tipo: string, bairro: string): string {
  const t = titulo.trim();
  if (t) return t;
  const rotulo = tipo ? propertyTypeLabel(tipo) : "Seu imóvel";
  const b = bairro.trim();
  return b ? `${rotulo} no ${b}` : rotulo;
}

/** "2 quartos · 65 m²" (o que estiver preenchido; studio com 0 quartos não diz "0 quartos"). */
export function linhaPrevia(quartos: number, areaM2: number): string {
  const partes: string[] = [];
  if (quartos > 0) partes.push(`${quartos} ${quartos === 1 ? "quarto" : "quartos"}`);
  if (areaM2 > 0) partes.push(`${areaM2} m²`);
  return partes.join(" · ");
}

/** Revisão (mockup cadastro-imovel-10): "2 quartos · 2 banheiros · 65 m²". */
export function linhaRevisao(quartos: number, banheiros: number, areaM2: number): string {
  const partes: string[] = [];
  if (quartos > 0) partes.push(`${quartos} ${quartos === 1 ? "quarto" : "quartos"}`);
  if (banheiros > 0) partes.push(`${banheiros} ${banheiros === 1 ? "banheiro" : "banheiros"}`);
  if (areaM2 > 0) partes.push(`${areaM2} m²`);
  return partes.join(" · ");
}

/**
 * Textos da revisão (mockup cadastro-imovel-10). A linha do total troca o "Cobrado ao hóspede · Você recebe conforme
 * política de pagamento" do desenho: o vocabulário da casa é morador, e a plataforma não recebe nem repassa dinheiro.
 */
export const TEXTOS_REVISAO = {
  lista: "Lista de conferência",
  listaTudoCerto: "Tudo certo para publicar",
  linhaTotal: "Total mensal que o morador vê no anúncio",
  editarDepois: "Você poderá editar a qualquer momento após publicar",
} as const;

/** "Santa Mônica, Uberlândia - MG" — a mesma linha pública do anúncio (E101). */
export function localPrevia(bairro: string, cidade: string, uf: string): string {
  return linhaLocalizacao(bairro, cidade, uf);
}
