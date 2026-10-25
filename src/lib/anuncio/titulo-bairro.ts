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
