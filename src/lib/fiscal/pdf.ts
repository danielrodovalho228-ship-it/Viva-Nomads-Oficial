/*
  PDF dos documentos da plataforma (pdf-lib, só JavaScript; roda no servidor
  e no node --test). Desenha o ConteudoDocumento — o texto vem de documento.ts.
*/
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { ConteudoDocumento } from "./documento.ts";

const VERDE = rgb(0x0f / 255, 0x3d / 255, 0x2e / 255);
const CINZA = rgb(0.42, 0.45, 0.5);
const TINTA = rgb(0.12, 0.16, 0.2);

/** A Helvetica padrão (WinAnsi) não tem todo caractere: troca o que faltar. */
function limpar(font: PDFFont, s: string): string {
  const suportados = new Set(font.getCharacterSet());
  const trocas: Record<string, string> = { "≈": "~", "–": "-", "“": '"', "”": '"', "’": "'", " ": " " };
  return [...s].map((ch) => (suportados.has(ch.codePointAt(0)!) ? ch : trocas[ch] ?? "?")).join("");
}

/** Quebra o texto em linhas que cabem na largura. */
function quebrar(font: PDFFont, size: number, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  // "R$ 2.970,00" nunca quebra entre o símbolo e o número.
  for (const palavra of texto.replace(/R\$ /g, "R$\u00a0").split(/ +/)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (font.widthOfTextAtSize(tentativa, size) <= largura) atual = tentativa;
    else {
      if (atual) linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export async function gerarPdf(c: ConteudoDocumento): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(c.titulo);
  pdf.setProducer("Viva Nomads");
  pdf.setCreator("Viva Nomads");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const margem = 56;
  const largura = 595.28 - margem * 2;
  let y = 841.89 - margem;

  const escrever = (texto: string, opts: { font?: PDFFont; size?: number; cor?: typeof TINTA; x?: number; w?: number; gap?: number } = {}) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10.5;
    for (const linha of quebrar(font, size, limpar(font, texto), opts.w ?? largura)) {
      page.drawText(linha, { x: opts.x ?? margem, y, size, font, color: opts.cor ?? TINTA });
      y -= size * 1.45;
    }
    y -= opts.gap ?? 0;
  };

  escrever("Viva Nomads", { font: negrito, size: 12, cor: VERDE, gap: 6 });
  escrever(c.titulo, { font: negrito, size: 20, cor: VERDE });
  escrever(c.subtitulo, { size: 11, cor: CINZA, gap: 10 });
  page.drawLine({ start: { x: margem, y: y + 4 }, end: { x: margem + largura, y: y + 4 }, thickness: 0.8, color: VERDE });
  y -= 12;

  const colRotulo = 150;
  for (const [rotulo, valor] of c.quadro) {
    const yLinha = y;
    escrever(rotulo, { font: negrito, size: 10, cor: CINZA, w: colRotulo - 8 });
    const yRotulo = y;
    y = yLinha;
    escrever(valor, { size: 10.5, x: margem + colRotulo, w: largura - colRotulo });
    y = Math.min(y, yRotulo) - 3;
  }
  y -= 10;
  for (const p of c.corpo) escrever(p, { size: 11, gap: 8 });
  y -= 6;
  page.drawLine({ start: { x: margem, y: y + 4 }, end: { x: margem + largura, y: y + 4 }, thickness: 0.5, color: CINZA });
  y -= 10;
  for (const r of c.rodape) escrever(r, { size: 8.5, cor: CINZA, gap: 3 });

  return pdf.save({ useObjectStreams: false });
}

/** sha256 em hex (64) do PDF — gravado em documentos_fiscais.hash. */
export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
