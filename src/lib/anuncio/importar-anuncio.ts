/*
  Ordem 4c178768 (Pacote FF 3/3) — "Importar meu anúncio".
  O dono cola o texto do anúncio que ele mesmo tem em outro site; aqui o texto é organizado em
  campos do cadastro para ele REVISAR antes de salvar. Função pura, sem rede e sem IA externa:
  o texto colado não sai do servidor da Viva e nada é buscado por URL de terceiros.
  Regra: o que não está no texto fica vazio (null / lista vazia). Nada é inventado.
*/

export const AVISO_CONTEUDO_PROPRIO =
  "Use apenas conteúdo que é seu. Cole o texto do anúncio que você mesmo escreveu; não buscamos páginas de outros sites.";

export const LIMITE_TEXTO_IMPORTAR = 4000;

export type AnuncioOrganizado = {
  titulo: string;
  descricao: string;
  tipo: string | null;
  quartos: number | null;
  banheiros: number | null;
  areaM2: number | null;
  vagas: number | null;
  comodidades: string[];
  aceitaPet: boolean | null;
  permiteFumar: boolean | null;
  avisos: string[];
};

const TIPOS: [RegExp, string][] = [
  [/\bcasa (de|em) condom[ií]nio\b/i, "casa_condominio"],
  [/\bcobertura\b/i, "cobertura"],
  [/\bloft\b/i, "loft"],
  [/\b(studio|est[uú]dio|kitnet|kitinete)\b/i, "studio"],
  [/\bflat\b|\bapart-?hotel\b/i, "flat"],
  [/\bquarto (privativo|individual)\b/i, "quarto"],
  [/\bapartamento\b|\bapto?\b\.?/i, "apartamento"],
  [/\bcasa\b/i, "casa"],
];

// Chaves de src/lib/amenities.ts (catálogo canônico).
const COMODIDADES: [string, RegExp][] = [
  ["home_office", /home ?office|escrit[oó]rio/i],
  ["internet_fibra", /fibra|internet|wi-?fi/i],
  ["mesa_trabalho", /mesa de trabalho|escrivaninha/i],
  ["cadeira_ergonomica", /cadeira ergon[oô]mica/i],
  ["ambiente_silencioso", /silencios/i],
  ["sala_reuniao", /sala de reuni[aã]o/i],
  ["coworking", /coworking/i],
  ["cabine_chamadas", /cabine/i],
  ["ar_condicionado", /ar[- ]?condicionado/i],
  ["maquina_lavar", /m[aá]quina de lavar|lava e seca/i],
  ["lava_loucas", /lava[- ]lou[cç]as/i],
  ["enxoval", /roupa de cama|enxoval/i],
  ["cozinha_equipada", /cozinha (completa|equipada)/i],
  ["tv", /\b(smart ?tv|tv|televis[aã]o)\b/i],
  ["varanda", /varanda|sacada/i],
  ["academia", /academia/i],
  ["piscina", /piscina/i],
  ["portaria_24h", /portaria 24/i],
  ["elevador", /elevador/i],
  ["salao_festas", /sal[aã]o de festas/i],
  ["churrasqueira", /churrasqueira/i],
  ["lavanderia", /lavanderia/i],
  ["bicicletario", /biciclet[aá]rio/i],
  ["vaga_garagem", /\bvagas? (de )?garagem|\bgaragem\b/i],
];

function numeroAntes(texto: string, palavra: RegExp, max: number): number | null {
  const m = texto.match(new RegExp(`(\\d{1,3})\\s*${palavra.source}`, "i"));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 0 && n <= max ? n : null;
}

/** Tira o que não deve ir para a descrição pública: contato, links, tags e endereço com número. */
function limpar(texto: string, avisos: string[]): string {
  let t = texto.replace(/<[^>]*>/g, " ");
  const antes = t;
  t = t
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "")
    .replace(/\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/g, "")
    .replace(/\b(rua|av\.?|avenida|alameda|travessa|r\.)\s+[^.\n]*?,?\s*n?[º°.]?\s*\d+[^.\n]*\.?/gi, "");
  if (t !== antes) {
    avisos.push("Removemos telefone, e-mail, link ou endereço com número do texto: contato e endereço exato não vão no anúncio público.");
  }
  return t
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function organizarAnuncio(bruto: string): AnuncioOrganizado {
  const avisos: string[] = [];
  const recortado = String(bruto ?? "").slice(0, LIMITE_TEXTO_IMPORTAR * 2);
  const texto = limpar(recortado, avisos).slice(0, LIMITE_TEXTO_IMPORTAR);
  const linhas = texto.split("\n");
  const titulo = (linhas[0] ?? "").slice(0, 100);

  const tipo = TIPOS.find(([re]) => re.test(texto))?.[1] ?? null;
  const quartos = numeroAntes(texto, /(quartos?|su[ií]tes?|dormit[oó]rios?)/, 20);
  const banheiros = numeroAntes(texto, /(banheiros?|wc)/, 20);
  const vagas = numeroAntes(texto, /vagas?/, 20);
  const area = texto.match(/(\d{1,4})(?:[.,]\d+)?\s*(?:m²|m2|metros)/i);
  const areaM2 = area && Number(area[1]) > 0 ? Number(area[1]) : null;

  const comodidades = COMODIDADES.filter(([, re]) => re.test(texto)).map(([k]) => k);

  const semPet = /\b(n[aã]o aceita|sem|n[aã]o [eé] permitido|proibido)\s+(pets?|animais|c[aã]es)/i.test(texto);
  const comPet = /\b(aceita|aceitamos|permite|permitido)\s+(pets?|animais|c[aã]es)|pet[- ]friendly/i.test(texto);
  const aceitaPet = semPet ? false : comPet ? true : null;

  const naoFuma = /(n[aã]o (é )?permitido fumar|proibido fumar|n[aã]o fumante|n[aã]o aceita fumantes|n[aã]o pode fumar)/i.test(texto);
  const fuma = /(permite|permitido|aceita) fumar|pode fumar(?!\?)/i.test(texto);
  // "Pode fumar? Não." é negativa.
  const negaPergunta = /pode fumar[^.\n]*\?\s*n[aã]o/i.test(texto);
  const permiteFumar = naoFuma || negaPergunta ? false : fuma ? true : null;

  return { titulo, descricao: texto, tipo, quartos, banheiros, areaM2, vagas, comodidades, aceitaPet, permiteFumar, avisos };
}
