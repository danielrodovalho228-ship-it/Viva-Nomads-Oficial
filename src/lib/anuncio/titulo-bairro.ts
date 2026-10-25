/*
  F17 (ordem 63c50a8c): avisa — sem bloquear — quando o título do anúncio cita um bairro
  diferente do cadastrado. Módulo puro. Só conhece bairros da lista abaixo (curados + os mais
  comuns de Uberlândia); bairro desconhecido nunca gera aviso.
*/
import { chaveCidade } from "../cidades.ts";
import { BAIRROS_CURADOS } from "../bairros.ts";

const COMUNS = ["Centro", "Tibery", "Santa Mônica", "Umuarama", "Martins", "Fundinho", "Osvaldo Rezende", "Karaíba", "Lídice", "Brasil", "Saraiva", "Jardim Karaíba", "Morada da Colina", "Pampulha", "Patrimônio", "Cazeca"];

const CONHECIDOS = [...new Set([...Object.values(BAIRROS_CURADOS).flat(), ...COMUNS])];

function cita(titulo: string, nome: string): boolean {
  const t = ` ${chaveCidade(titulo)} `;
  return t.includes(` ${chaveCidade(nome)} `);
}

/** Bairro conhecido citado no título que NÃO é o cadastrado; null se não há, ou se o cadastrado também é citado. */
export function bairroCitadoNoTitulo(titulo: string, bairro: string): string | null {
  if (!titulo.trim() || !bairro.trim() || cita(titulo, bairro)) return null;
  const chave = chaveCidade(bairro);
  return CONHECIDOS.find((b) => chaveCidade(b) !== chave && cita(titulo, b)) ?? null;
}

export function avisoTituloBairro(titulo: string, bairro: string): string | null {
  const outro = bairroCitadoNoTitulo(titulo, bairro);
  return outro ? `O título cita ${outro}, mas o bairro cadastrado é ${bairro.trim()}. Confira se está certo (você pode manter).` : null;
}

/*
  E150 — a consistência do título vai além do bairro: TIPO e NÚMEROS do anúncio. Aviso que o dono pode manter (nunca
  trava). "Studio com 2 quartos" num anúncio de 3 quartos → avisa os quartos; "Casa ..." num anúncio de apartamento →
  avisa o tipo.
*/
const PALAVRAS_TIPO: { tipo: string; rotulo: string; palavras: string[] }[] = [
  { tipo: "apartamento", rotulo: "apartamento", palavras: ["apartamento", "apto", "ap"] },
  { tipo: "studio", rotulo: "studio/kitnet", palavras: ["studio", "estudio", "kitnet", "kitinete", "quitinete"] },
  { tipo: "loft", rotulo: "loft", palavras: ["loft"] },
  { tipo: "cobertura", rotulo: "cobertura", palavras: ["cobertura"] },
  { tipo: "casa", rotulo: "casa", palavras: ["casa", "sobrado"] },
  { tipo: "flat", rotulo: "flat", palavras: ["flat", "apart hotel"] },
  { tipo: "quarto", rotulo: "quarto privativo", palavras: ["quarto privativo", "suite privativa"] },
  { tipo: "chacara", rotulo: "chácara/sítio", palavras: ["chacara", "sitio"] },
];

/** Tipos que o título cita, por palavra inteira. */
function tiposCitados(titulo: string): string[] {
  const t = ` ${chaveCidade(titulo)} `;
  return PALAVRAS_TIPO.filter((p) => p.palavras.some((w) => t.includes(` ${chaveCidade(w)} `))).map((p) => p.tipo);
}

const NUMEROS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5 };

/** "2 quartos", "dois quartos", "3 dormitórios" → o número; null se o título não diz. */
export function quartosCitados(titulo: string): number | null {
  const t = chaveCidade(titulo);
  const m = t.match(/\b(\d{1,2}|um|uma|dois|duas|tres|quatro|cinco)\s+(quartos?|dormitorios?|dorms?)\b/);
  if (!m) return null;
  return /^\d+$/.test(m[1]) ? Number(m[1]) : NUMEROS[m[1]] ?? null;
}

export function avisosConsistenciaTitulo(titulo: string, a: { bairro?: string; tipo?: string; quartos?: number | string }): string[] {
  const avisos: string[] = [];
  const bairro = avisoTituloBairro(titulo, a.bairro ?? "");
  if (bairro) avisos.push(bairro);
  const citados = tiposCitados(titulo);
  // "Casa de condomínio" é casa; "apartamento" cita "ap": só avisa quando o tipo do anúncio NÃO está entre os citados.
  const tipoBase = a.tipo === "casa_condominio" ? "casa" : a.tipo;
  if (tipoBase && citados.length && !citados.includes(tipoBase)) {
    const doTitulo = PALAVRAS_TIPO.find((p) => p.tipo === citados[0])!.rotulo;
    const doAnuncio = PALAVRAS_TIPO.find((p) => p.tipo === tipoBase)?.rotulo ?? tipoBase;
    avisos.push(`O título diz ${doTitulo}, mas o tipo do anúncio é ${doAnuncio}. Confira se está certo (você pode manter).`);
  }
  const q = quartosCitados(titulo);
  const cadastrados = Number(a.quartos);
  if (q !== null && Number.isFinite(cadastrados) && String(a.quartos ?? "") !== "" && q !== cadastrados) {
    avisos.push(`O título diz ${q} ${q === 1 ? "quarto" : "quartos"}, mas o anúncio tem ${cadastrados} ${cadastrados === 1 ? "quarto" : "quartos"}. Confira se está certo (você pode manter).`);
  }
  return avisos;
}
