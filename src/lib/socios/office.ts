/**
 * Texto de .docx e .xlsx sem dependências: lê o ZIP (diretório central) com o zlib do Node.
 * Usado só no servidor, para a Caixa dos Sócios. Limita tamanho para não estourar memória.
 */
import { inflateRawSync } from "node:zlib";

const MAX_DESCOMPACTADO = 20 * 1024 * 1024;

function entradas(buf: Buffer): Map<string, Buffer> {
  const saida = new Map<string, Buffer>();
  // Fim do diretório central: assinatura 0x06054b50 nos últimos ~64 KB.
  let fim = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error("zip inválido");
  const total = buf.readUInt16LE(fim + 10);
  let p = buf.readUInt32LE(fim + 16);
  let usado = 0;
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("zip inválido");
    const metodo = buf.readUInt16LE(p + 10);
    const comp = buf.readUInt32LE(p + 20);
    const tamNome = buf.readUInt16LE(p + 28);
    const tamExtra = buf.readUInt16LE(p + 30);
    const tamCom = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nome = buf.subarray(p + 46, p + 46 + tamNome).toString("utf8");
    p += 46 + tamNome + tamExtra + tamCom;
    if (!/^(word\/document\.xml|xl\/sharedStrings\.xml|xl\/worksheets\/sheet\d+\.xml)$/.test(nome)) continue;
    const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const bruto = buf.subarray(ini, ini + comp);
    const dados = metodo === 0 ? bruto : metodo === 8 ? inflateRawSync(bruto, { maxOutputLength: MAX_DESCOMPACTADO }) : null;
    if (!dados) continue;
    usado += dados.length;
    if (usado > MAX_DESCOMPACTADO) break;
    saida.set(nome, dados);
  }
  return saida;
}

const desescapar = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

export function textoDocx(buf: Buffer): string {
  const xml = entradas(buf).get("word/document.xml")?.toString("utf8") ?? "";
  return desescapar(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function textoXlsx(buf: Buffer): string {
  const arq = entradas(buf);
  const compartilhadas = [...(arq.get("xl/sharedStrings.xml")?.toString("utf8") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    desescapar(m[1].replace(/<[^>]+>/g, "")),
  );
  const linhas: string[] = [];
  const planilhas = [...arq.keys()].filter((k) => k.startsWith("xl/worksheets/")).sort();
  for (const k of planilhas) {
    linhas.push(`# ${k.replace("xl/worksheets/", "").replace(".xml", "")}`);
    const xml = arq.get(k)!.toString("utf8");
    for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const celulas: string[] = [];
      for (const c of row[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const v = /<v>([\s\S]*?)<\/v>/.exec(c[2])?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[2])?.[1] ?? "";
        celulas.push(/t="s"/.test(c[1]) ? (compartilhadas[Number(v)] ?? "") : desescapar(v));
      }
      if (celulas.some((x) => x !== "")) linhas.push(celulas.join("\t"));
    }
  }
  return linhas.join("\n").trim();
}
