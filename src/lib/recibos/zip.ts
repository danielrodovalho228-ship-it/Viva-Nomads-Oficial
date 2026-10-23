/*
  ZIP mínimo, sem compressão (método "stored"), para o "Baixar o ano" de Recibos e notas: os PDFs já vêm
  comprimidos, então guardar como estão não aumenta o arquivo. Puro (node:zlib só para o CRC-32).
*/
import { crc32 } from "node:zlib";

export interface ArquivoZip {
  nome: string;
  dados: Uint8Array;
}

const enc = new TextEncoder();

function dataDos(d: Date): { hora: number; dia: number } {
  const hora = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2);
  const dia = ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
  return { hora, dia };
}

/** Nome seguro dentro do ZIP: sem barra, sem "..", só caracteres comuns. */
export function nomeNoZip(nome: string): string {
  return nome.replace(/[\\/]+/g, "-").replace(/\.\.+/g, ".").replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "arquivo";
}

export function montarZip(arquivos: readonly ArquivoZip[], quando = new Date()): Uint8Array {
  const { hora, dia } = dataDos(quando);
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  const usados = new Set<string>();
  let offset = 0;
  for (const a of arquivos) {
    let nome = nomeNoZip(a.nome);
    for (let i = 2; usados.has(nome); i++) nome = nomeNoZip(a.nome).replace(/(\.[^.]+)?$/, `-${i}$1`);
    usados.add(nome);
    const n = enc.encode(nome);
    const crc = crc32(a.dados) >>> 0;
    const tam = a.dados.length;
    const local = new Uint8Array(30 + n.length);
    const v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x0800, true); // nome em UTF-8
    v.setUint16(8, 0, true); // stored
    v.setUint16(10, hora, true);
    v.setUint16(12, dia, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, tam, true);
    v.setUint32(22, tam, true);
    v.setUint16(26, n.length, true);
    v.setUint16(28, 0, true);
    local.set(n, 30);
    const central = new Uint8Array(46 + n.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, hora, true);
    c.setUint16(14, dia, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, tam, true);
    c.setUint32(24, tam, true);
    c.setUint16(28, n.length, true);
    c.setUint32(42, offset, true);
    central.set(n, 46);
    locais.push(local, a.dados);
    centrais.push(central);
    offset += local.length + tam;
  }
  const tamCentral = centrais.reduce((s, x) => s + x.length, 0);
  const fim = new Uint8Array(22);
  const f = new DataView(fim.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, centrais.length, true);
  f.setUint16(10, centrais.length, true);
  f.setUint32(12, tamCentral, true);
  f.setUint32(16, offset, true);
  const partes = [...locais, ...centrais, fim];
  const saida = new Uint8Array(partes.reduce((s, x) => s + x.length, 0));
  let p = 0;
  for (const x of partes) {
    saida.set(x, p);
    p += x.length;
  }
  return saida;
}
