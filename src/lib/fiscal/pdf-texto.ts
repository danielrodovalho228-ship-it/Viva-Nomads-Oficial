/*
  Leitor do TEXTO dos PDFs que a própria plataforma gera (gerarPdf, pdf-lib + Helvetica padrão). Serve aos testes
  (node --test e laboratório) para provar que uma linha está DENTRO do PDF, e não desenhada fora da folha.
  Não é um leitor de PDF genérico: entende o que o pdf-lib escreve (cada linha um "<hex> Tj", fonte WinAnsi).
*/
import { PDFArray, PDFDocument, PDFRawStream, PDFRef, decodePDFRawStream, type PDFObject } from "pdf-lib";

function bytesDoConteudo(doc: PDFDocument, obj: PDFObject | undefined): Uint8Array[] {
  if (!obj) return [];
  const alvo = obj instanceof PDFRef ? doc.context.lookup(obj) : obj;
  if (alvo instanceof PDFArray) return alvo.asArray().flatMap((o) => bytesDoConteudo(doc, o));
  if (alvo instanceof PDFRawStream) return [decodePDFRawStream(alvo).decode()];
  return [];
}

/*
  WinAnsi (windows-1252) à mão: o TextDecoder("windows-1252") do Node trata o rótulo como latin1 e devolve
  0x80–0x9F como caracteres de controle (o "—" 0x97 sumia do texto extraído). Fora dessa faixa é latin1.
*/
const WIN_ANSI_80_9F =
  "\u20ac\u0081\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u008d\u017d\u008f" +
  "\u0090\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u009d\u017e\u0178";
const winAnsi = {
  decode: (b: Uint8Array) =>
    Array.from(b, (c) => (c >= 0x80 && c <= 0x9f ? WIN_ANSI_80_9F[c - 0x80] : String.fromCharCode(c))).join(""),
};

/** Texto de cada página (uma string por página; uma linha desenhada = uma linha do texto). */
export async function textoDasPaginas(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((pg) => {
    const fonte = bytesDoConteudo(doc, pg.node.Contents())
      .map((b) => Buffer.from(b).toString("latin1"))
      .join("\n");
    const linhas: string[] = [];
    for (const m of fonte.matchAll(/<([0-9A-Fa-f\s]*)>\s*Tj/g)) {
      const hex = m[1].replace(/\s+/g, "");
      linhas.push(winAnsi.decode(Buffer.from(hex, "hex")));
    }
    return linhas.join("\n");
  });
}

/** Texto do PDF inteiro, páginas separadas por linha em branco. */
export async function textoDoPdf(bytes: Uint8Array): Promise<string> {
  return (await textoDasPaginas(bytes)).join("\n\n");
}
