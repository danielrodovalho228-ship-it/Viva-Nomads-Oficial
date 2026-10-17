/*
  EXEMPLO ILUSTRATIVO (prompt 9, decisão do Daniel em 17/10).
  Os 15 anúncios do site são de demonstração. Para mostrar o perfil do proprietário e as avaliações como
  ficam nos anúncios reais, estes dados FICTÍCIOS aparecem só neles, sempre com o selo "Exemplo ilustrativo".
  - Nada disto vai para o banco, para o JSON-LD (Google) nem para o sitemap.
  - Nada disto vale para anúncio real: todas as funções devolvem null/[] quando o id não é de exemplo.
  - Nenhum nome ou foto de pessoa real: nomes inventados, só iniciais em círculo.
*/
import { isExemplo } from "../lib/demo-listing.ts";

export interface ProprietarioExemplo {
  /** Rota: /proprietario/{id}. */
  id: "exemplo-1" | "exemplo-2" | "exemplo-3";
  /** Nome curto, já com a marcação de exemplo. */
  nome: string;
  cidade: string;
  /** AAAA-MM: "Na Viva desde". */
  desde: string;
  idiomas: string[];
  bio: string;
  /** "Costuma responder em até N horas". */
  respostaHoras: number;
  estadiasConcluidas: number;
  selos: string[];
  /** Anúncios de exemplo deste proprietário. */
  imoveis: string[];
}

export interface AvaliacaoExemplo {
  /** Primeiro nome + inicial (fictício). */
  autor: string;
  nota: number;
  titulo: string;
  texto: string;
  /** AAAA-MM da estadia. */
  mes: string;
  resposta?: string;
}

export const SELO_EXEMPLO = "Exemplo ilustrativo";
export const AVISO_EXEMPLO = "Anúncio de demonstração: nos anúncios reais estes dados vêm do perfil e das estadias verificadas.";

export const PROPRIETARIOS_EXEMPLO: readonly ProprietarioExemplo[] = [
  {
    id: "exemplo-1",
    nome: "Helena M. (exemplo)",
    cidade: "Uberlândia (MG)",
    desde: "2025-03",
    idiomas: ["Português", "Inglês"],
    bio: "Arquiteta, moro em Uberlândia e cuido pessoalmente dos imóveis: entrega das chaves, conferência de entrada e suporte durante a estadia.",
    respostaHoras: 8,
    estadiasConcluidas: 14,
    selos: ["E-mail confirmado", "Telefone verificado", "Identidade verificada"],
    imoveis: ["ube-001", "ube-002", "ube-006", "ube-009", "ube-015"],
  },
  {
    id: "exemplo-2",
    nome: "Rafael T. (exemplo)",
    cidade: "Uberlândia (MG)",
    desde: "2025-06",
    idiomas: ["Português", "Espanhol"],
    bio: "Professor na região do Umuarama. Meus imóveis ficam perto da UFU e dos hospitais, pensados para quem chega para estudar, trabalhar ou acompanhar tratamento.",
    respostaHoras: 4,
    estadiasConcluidas: 9,
    selos: ["E-mail confirmado", "Telefone verificado"],
    imoveis: ["ube-004", "ube-005", "ube-007", "ube-011", "ube-012"],
  },
  {
    id: "exemplo-3",
    nome: "Lúcia B. (exemplo)",
    cidade: "Uberlândia (MG)",
    desde: "2024-11",
    idiomas: ["Português"],
    bio: "Tenho casas e imóveis maiores para famílias em mudança de cidade. Gosto de deixar tudo pronto para o primeiro dia, com a cozinha equipada.",
    respostaHoras: 12,
    estadiasConcluidas: 21,
    selos: ["E-mail confirmado", "Telefone verificado", "Identidade verificada"],
    imoveis: ["ube-003", "ube-008", "ube-010", "ube-013", "ube-014"],
  },
];

const AVALIACOES: Record<string, AvaliacaoExemplo[]> = {
  "ube-001": [
    { autor: "Marina C.", nota: 5, titulo: "Estadia de 6 meses", mes: "2026-04", texto: "O home office é de verdade: mesa ampla, cadeira boa e internet estável para chamadas o dia todo. A conferência de entrada com fotos deixou tudo claro desde o início.", resposta: "Obrigada, Marina! Foi ótimo receber você. A mesa fica à disposição para a próxima vinda." },
    { autor: "Thiago R.", nota: 5, titulo: "Estadia de 4 meses", mes: "2026-01", texto: "Bairro tranquilo, perto do campus e de mercado. A Helena respondeu rápido pelo chat sempre que precisei." },
    { autor: "Paula S.", nota: 4, titulo: "Estadia de 3 meses", mes: "2025-09", texto: "Imóvel bem cuidado e igual às fotos. Só achei o chuveiro do banheiro social um pouco fraco, mas foi resolvido na mesma semana." },
  ],
  "ube-002": [
    { autor: "Eduardo L.", nota: 5, titulo: "Estadia de 2 meses", mes: "2026-05", texto: "Studio prático no Centro, deu para fazer tudo a pé. Valor mensal claro desde o anúncio, sem surpresa no contrato.", resposta: "Valeu, Eduardo! Boa sorte no novo projeto." },
    { autor: "Camila F.", nota: 5, titulo: "Estadia de 3 meses", mes: "2026-02", texto: "Silencioso para o Centro e muito limpo. A Caução ficou registrada no contrato e foi devolvida logo depois da conferência de saída." },
  ],
  "ube-003": [
    { autor: "Renata G.", nota: 5, titulo: "Estadia de 5 meses", mes: "2026-03", texto: "Mudamos de cidade com dois filhos e a casa já estava pronta para o primeiro dia. Quintal ótimo para as crianças.", resposta: "Que bom que a mudança foi tranquila, Renata. Abraço para a família!" },
    { autor: "Jorge A.", nota: 4, titulo: "Estadia de 6 meses", mes: "2025-10", texto: "Casa espaçosa e bem equipada. A garagem é um pouco apertada para carro grande, de resto tudo certo." },
  ],
  "ube-004": [
    { autor: "Beatriz N.", nota: 5, titulo: "Estadia de 2 meses", mes: "2026-06", texto: "Fiquei durante a residência e o Hospital de Clínicas fica literalmente ao lado. Cama confortável depois de plantão faz diferença." , resposta: "Obrigado, Beatriz! Boa residência." },
    { autor: "Lucas P.", nota: 5, titulo: "Estadia de 3 meses", mes: "2026-01", texto: "Studio compacto, mas muito bem pensado. O Rafael explicou tudo pelo chat antes de eu chegar." },
    { autor: "Fernanda O.", nota: 4, titulo: "Estadia de 1 mês", mes: "2025-11", texto: "Localização imbatível para quem trabalha no hospital. A rua tem movimento de dia, mas à noite é calma." },
  ],
  "ube-005": [
    { autor: "Sônia V.", nota: 5, titulo: "Estadia de 2 meses", mes: "2026-05", texto: "Acompanhei minha mãe no tratamento e o imóvel ajudou muito: dois quartos, tudo no térreo e farmácia na esquina. Internet fibra funcionou bem para eu trabalhar.", resposta: "Sônia, desejo saúde para sua mãe. Foi um prazer receber vocês." },
    { autor: "Marcos D.", nota: 5, titulo: "Estadia de 1 mês", mes: "2026-02", texto: "Perto dos hospitais e com cozinha completa. O contrato foi simples de ler e assinar pela plataforma." },
  ],
  "ube-006": [
    { autor: "Patrícia H.", nota: 5, titulo: "Estadia de 4 meses", mes: "2026-04", texto: "Executivo de verdade: mobília boa, roupa de cama de qualidade e mesa de trabalho. Recomendo para quem vem a trabalho.", resposta: "Obrigada, Patrícia! Volte sempre que vier a Uberlândia." },
    { autor: "André K.", nota: 4, titulo: "Estadia de 2 meses", mes: "2025-12", texto: "Imóvel ótimo. O barulho da avenida aparece um pouco no quarto da frente, então preferi o de trás." },
  ],
  "ube-007": [
    { autor: "Gustavo E.", nota: 5, titulo: "Estadia de 6 meses", mes: "2026-03", texto: "Fiquei seis meses em um projeto e o studio deu conta de tudo. Bairro com padaria, academia e ônibus para o Centro.", resposta: "Valeu, Gustavo! Sucesso no próximo projeto." },
    { autor: "Larissa M.", nota: 5, titulo: "Estadia de 3 meses", mes: "2025-11", texto: "Limpo, organizado e exatamente como no anúncio. Conferência de entrada rápida e bem documentada." },
  ],
  "ube-008": [
    { autor: "Cláudio S.", nota: 5, titulo: "Estadia de 6 meses", mes: "2026-05", texto: "Casa grande para a família toda, com quintal e churrasqueira. A Lúcia deixou a cozinha completa, não precisamos comprar nada.", resposta: "Obrigada, Cláudio! Foi um prazer receber vocês." },
    { autor: "Vanessa T.", nota: 5, titulo: "Estadia de 4 meses", mes: "2026-01", texto: "Bairro tranquilo e seguro para as crianças brincarem. Comunicação sempre pelo chat, muito atenciosa." },
    { autor: "Rodrigo J.", nota: 4, titulo: "Estadia de 5 meses", mes: "2025-08", texto: "Casa muito boa. O portão da garagem precisou de ajuste no segundo mês e foi resolvido em dois dias." },
  ],
  "ube-009": [
    { autor: "Isabela R.", nota: 5, titulo: "Estadia de 6 meses", mes: "2026-06", texto: "Perfeito para o doutorado: perto do campus Santa Mônica, silencioso e com mesa boa para estudar.", resposta: "Isabela, boa sorte na defesa! Foi ótimo receber você." },
    { autor: "Felipe C.", nota: 5, titulo: "Estadia de 4 meses", mes: "2025-12", texto: "Pesquisador visitante aqui. Tudo funcionou desde o primeiro dia e o valor mensal cabe na bolsa." },
  ],
  "ube-010": [
    { autor: "Juliana A.", nota: 5, titulo: "Estadia de 3 meses", mes: "2026-04", texto: "Dois quartos bem distribuídos, um virou escritório. Supermercado e farmácia perto.", resposta: "Obrigada, Juliana! Que bom que o escritório funcionou." },
    { autor: "Diego F.", nota: 4, titulo: "Estadia de 2 meses", mes: "2025-10", texto: "Imóvel confortável e limpo. O estacionamento é na rua, mas sempre achei vaga." },
  ],
  "ube-011": [
    { autor: "Mariana L.", nota: 5, titulo: "Estadia de 6 meses", mes: "2026-02", texto: "A UFU fica a poucos minutos a pé. Studio novo, com tudo o que precisei para o semestre.", resposta: "Obrigado, Mariana! Bom semestre." },
    { autor: "Pedro H.", nota: 5, titulo: "Estadia de 5 meses", mes: "2025-09", texto: "Ótimo custo-benefício para estudante. Rafael sempre respondeu no mesmo dia." },
  ],
  "ube-012": [
    { autor: "Aline B.", nota: 5, titulo: "Estadia de 4 meses", mes: "2026-05", texto: "Um quarto confortável no Saraiva, perto de tudo. Contrato claro e Caução documentada.", resposta: "Obrigado, Aline! Foi um prazer." },
    { autor: "Ricardo N.", nota: 4, titulo: "Estadia de 2 meses", mes: "2026-01", texto: "Bom imóvel para quem trabalha fora o dia todo. A sala é pequena, mas bem aproveitada." },
  ],
  "ube-013": [
    { autor: "Simone P.", nota: 5, titulo: "Estadia de 6 meses", mes: "2026-03", texto: "Casa com quintal, perfeita para nosso cachorro. Bairro residencial e calmo.", resposta: "Simone, mande um abraço para o Thor! Foi ótimo receber vocês." },
    { autor: "Bruno W.", nota: 5, titulo: "Estadia de 3 meses", mes: "2025-11", texto: "Igual às fotos e muito bem cuidada. A conferência de saída foi rápida e a Caução voltou sem desconto." },
  ],
  "ube-014": [
    { autor: "Carolina S.", nota: 5, titulo: "Estadia de 6 meses", mes: "2026-06", texto: "Imóvel amplo e de alto padrão, ideal para a família durante a transferência do trabalho. Tudo impecável.", resposta: "Obrigada, Carolina! Boa adaptação na cidade." },
    { autor: "Henrique V.", nota: 5, titulo: "Estadia de 4 meses", mes: "2026-02", texto: "Três quartos com camas ótimas e cozinha equipada. Comunicação sempre clara pela plataforma." },
    { autor: "Mônica E.", nota: 4, titulo: "Estadia de 2 meses", mes: "2025-09", texto: "Muito bom. O ar-condicionado de um dos quartos fazia barulho, a Lúcia mandou revisar na mesma semana." },
  ],
  "ube-015": [
    { autor: "Natália G.", nota: 5, titulo: "Estadia de 3 meses", mes: "2026-04", texto: "Studio charmoso no Fundinho, com cafés e o centro histórico na porta. Compacto, mas não faltou nada.", resposta: "Obrigada, Natália! Volte para o festival de inverno." },
    { autor: "Otávio R.", nota: 4, titulo: "Estadia de 1 mês", mes: "2025-12", texto: "Ótima localização. Para quem tem muita bagagem, o espaço é justo." },
  ],
};

/** Proprietário de exemplo de um anúncio de EXEMPLO. Anúncio real → null, sempre. */
export function proprietarioDoExemplo(imovelId: string): ProprietarioExemplo | null {
  if (!isExemplo(imovelId)) return null;
  return PROPRIETARIOS_EXEMPLO.find((p) => p.imoveis.includes(imovelId)) ?? null;
}

/** Proprietário de exemplo pela rota (/proprietario/exemplo-1). Qualquer outro id → null. */
export function proprietarioExemploPorId(id: string): ProprietarioExemplo | null {
  return PROPRIETARIOS_EXEMPLO.find((p) => p.id === id) ?? null;
}

/** Avaliações ilustrativas de um anúncio de EXEMPLO. Anúncio real → [], sempre. */
export function avaliacoesDoExemplo(imovelId: string): AvaliacaoExemplo[] {
  if (!isExemplo(imovelId)) return [];
  return AVALIACOES[imovelId] ?? [];
}

/** Média e contagem das avaliações ilustrativas (para as estrelas ao lado do título do exemplo). */
export function resumoAvaliacoesExemplo(imovelId: string): { media: number; n: number } | null {
  const a = avaliacoesDoExemplo(imovelId);
  if (a.length === 0) return null;
  return { media: Math.round((a.reduce((s, r) => s + r.nota, 0) / a.length) * 10) / 10, n: a.length };
}

/** Todas as avaliações ilustrativas dos imóveis de um proprietário de exemplo (página /proprietario/exemplo-N). */
export function avaliacoesDoProprietarioExemplo(p: ProprietarioExemplo): (AvaliacaoExemplo & { imovelId: string })[] {
  return p.imoveis.flatMap((id) => (AVALIACOES[id] ?? []).map((a) => ({ ...a, imovelId: id })));
}

/** "Costuma responder em até 8 horas". */
export function respostaExemploLabel(horas: number): string {
  return `Costuma responder em até ${horas} ${horas === 1 ? "hora" : "horas"}`;
}

/** "Na Viva há 7 meses" / "Na Viva há 1 ano e 2 meses" a partir de AAAA-MM e da data de hoje (AAAA-MM-DD). */
export function tempoNaVivaLabel(desde: string, hoje: string): string {
  const [ay, am] = desde.split("-").map(Number);
  const [by, bm] = hoje.split("-").map(Number);
  const meses = Math.max(1, (by - ay) * 12 + (bm - am));
  if (meses < 12) return `Na Viva há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const a = `${anos} ${anos === 1 ? "ano" : "anos"}`;
  return resto ? `Na Viva há ${a} e ${resto} ${resto === 1 ? "mês" : "meses"}` : `Na Viva há ${a}`;
}

/** Para testes: os ids de exemplo com avaliações. */
export const IMOVEIS_COM_AVALIACAO_EXEMPLO = Object.keys(AVALIACOES);
