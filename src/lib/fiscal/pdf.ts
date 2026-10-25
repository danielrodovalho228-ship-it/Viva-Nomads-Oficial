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

/**
 * Quebra o texto em linhas que cabem na largura, sempre entre palavras. Só uma palavra que sozinha não cabe na
 * linha (um hash, um endereço sem espaço) é partida — e nunca sai da folha.
 */
export function quebrar(font: PDFFont, size: number, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  const cabe = (t: string) => font.widthOfTextAtSize(t, size) <= largura;
  // "R$ 2.970,00" nunca quebra entre o símbolo e o número.
  for (const paragrafo of texto.replace(/R\$ /g, "R$\u00a0").split("\n")) {
    let atual = "";
    for (const bruta of paragrafo.split(/ +/)) {
      let palavra = bruta;
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (cabe(tentativa)) {
        atual = tentativa;
        continue;
      }
      if (atual) linhas.push(atual);
      atual = "";
      while (palavra && !cabe(palavra)) {
        let n = palavra.length - 1;
        while (n > 1 && !cabe(palavra.slice(0, n))) n--;
        linhas.push(palavra.slice(0, n));
        palavra = palavra.slice(n);
      }
      atual = palavra;
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 56;
/** Abaixo disto não se escreve: o rodapé "página X de Y" fica no espaço que sobra. */
const MARGEM_INFERIOR = 72;

/**
 * Desenha o documento com QUEBRA DE PÁGINA (Prompt 35B, F4): antes, tudo ia para uma folha só e o que passava do
 * fim era desenhado fora dela, sumindo sem erro. Agora, quando o texto chega à margem inferior, abre uma página
 * nova com o cabeçalho curto "continuação"; no fim, cada página ganha "página X de Y" no rodapé.
 */
export async function gerarPdf(c: ConteudoDocumento): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(c.titulo);
  pdf.setProducer("Viva Nomads");
  pdf.setCreator("Viva Nomads");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margem = MARGEM;
  const largura = A4[0] - margem * 2;
  const topo = A4[1] - margem;
  let page = pdf.addPage(A4);
  let y = topo;

  const novaPagina = () => {
    page = pdf.addPage(A4);
    y = topo;
    const quem = c.cabecalho?.marca === "emissor" && c.cabecalho.emissor ? c.cabecalho.emissor.nome : "Viva Nomads";
    const cab = limpar(regular, `${quem} · ${c.titulo}${c.cabecalho ? ` ${c.cabecalho.numero}` : ""} (continuação)`);
    page.drawText(cab, { x: margem, y, size: 8.5, font: regular, color: CINZA });
    page.drawLine({ start: { x: margem, y: y - 5 }, end: { x: margem + largura, y: y - 5 }, thickness: 0.5, color: CINZA });
    y -= 22;
  };
  /** Garante espaço para `altura` pontos; se não houver, continua na próxima página. */
  const garantir = (altura: number) => {
    if (y - altura < MARGEM_INFERIOR) novaPagina();
  };

  const escrever = (texto: string, opts: { font?: PDFFont; size?: number; cor?: typeof TINTA; x?: number; w?: number; gap?: number } = {}) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10.5;
    for (const linha of quebrar(font, size, limpar(font, texto), opts.w ?? largura)) {
      garantir(size);
      page.drawText(linha, { x: opts.x ?? margem, y, size, font, color: opts.cor ?? TINTA });
      y -= size * 1.45;
    }
    y -= opts.gap ?? 0;
  };
  const linhaHorizontal = (espessura: number, cor: typeof TINTA) => {
    page.drawLine({ start: { x: margem, y: y + 4 }, end: { x: margem + largura, y: y + 4 }, thickness: espessura, color: cor });
  };

  const cab = c.cabecalho;
  if (cab?.marca === "emissor" && cab.emissor) {
    // Documento do emissor gerado pela plataforma (D1-b): o emissor em destaque; a Viva numa linha discreta.
    escrever(cab.emissor.nome, { font: negrito, size: 17, cor: VERDE });
    escrever(cab.emissor.linha, { size: 10, cor: CINZA });
    escrever("Gerado pela plataforma Viva Nomads", { size: 8.5, cor: CINZA, gap: 10 });
  } else {
    escrever("Viva Nomads", { font: negrito, size: 12, cor: VERDE, gap: 6 });
  }
  escrever(c.titulo, { font: negrito, size: 20, cor: VERDE });
  if (cab) {
    // Cabeçalho comum (Prompt 56): número (+ Registro nº no legado), versão e emissão no horário de Brasília.
    escrever([cab.numero, cab.registro].filter(Boolean).join(" · "), { font: negrito, size: 11 });
    escrever(`Emitido em ${cab.emitidoEm}`, { size: 9.5, cor: CINZA });
  }
  escrever(c.subtitulo, { size: 11, cor: CINZA, gap: 10 });
  linhaHorizontal(0.8, VERDE);
  y -= 12;

  // Quadro: rótulo à esquerda e valor à direita, na mesma altura; a linha inteira muda de página junta.
  const colRotulo = 150;
  for (const [rotulo, valor] of c.quadro) {
    const lr = quebrar(negrito, 10, limpar(negrito, rotulo), colRotulo - 8);
    const lv = quebrar(regular, 10.5, limpar(regular, valor), largura - colRotulo);
    const altura = Math.max(lr.length * 10 * 1.45, lv.length * 10.5 * 1.45);
    if (altura >= topo - MARGEM_INFERIOR - 22) {
      // valor maior que uma página: rótulo em cima, valor embaixo (pode continuar na página seguinte)
      escrever(rotulo, { font: negrito, size: 10, cor: CINZA });
      escrever(valor, { size: 10.5, gap: 3 });
      continue;
    }
    garantir(altura);
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
  garantir(14);
  linhaHorizontal(0.5, CINZA);
  y -= 10;
  for (const r of c.rodape) escrever(r, { size: 8.5, cor: CINZA, gap: 3 });

  const paginas = pdf.getPages();
  paginas.forEach((pg, i) => {
    const texto = `página ${i + 1} de ${paginas.length}`;
    const w = regular.widthOfTextAtSize(texto, 8);
    pg.drawText(texto, { x: A4[0] - margem - w, y: margem / 2, size: 8, font: regular, color: CINZA });
    // Rodapé comum (Prompt 56): o caminho da conferência com o código, em toda página.
    if (c.cabecalho?.conferir) {
      const conf = limpar(regular, c.cabecalho.conferir);
      let tam = 8;
      while (tam > 6 && regular.widthOfTextAtSize(conf, tam) > largura - w - 12) tam -= 0.5;
      pg.drawText(conf, { x: margem, y: margem / 2, size: tam, font: regular, color: CINZA });
    }
  });

  return pdf.save({ useObjectStreams: false });
}

/** sha256 em hex (64) do PDF — gravado em documentos_fiscais.hash. */
export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
