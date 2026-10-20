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

const winAnsi = new TextDecoder("windows-1252");

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
