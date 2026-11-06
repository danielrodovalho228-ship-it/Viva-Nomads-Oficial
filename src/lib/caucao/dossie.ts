import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { SAIDAS_DA_DISPUTA, TEXTO_VIVA_NAO_DECIDE, prazosDaSaida } from "./prazos.ts";

/*
  E637 (b) — o DOSSIÊ em PDF da caução. A Viva NUNCA decide a disputa: entrega este dossiê às duas partes (fotos de entrada e
  saída lado a lado, valores, comprovantes, contestações) e oferece as saídas: acordo, vistoriador parceiro ou Juizado.
*/
export interface ItemDossie {
  id: string;
  categoria: string;
  comodo: string;
  valor: number;
  status: "proposto" | "aceito" | "contestado";
  contestacao: string | null;
}

/** E640 (3): dado do SERVIDOR sobre a foto (nunca do aparelho): quando o arquivo chegou e quem o enviou. */
export interface MetaFoto {
  registradaEm: string | null;
  por: string | null;
}

/** Legenda de cada foto no dossiê: hora do servidor (Brasília), quem enviou e o local (o imóvel do contrato). Dado ausente diz que não há. */
export function legendaDaFoto(meta: MetaFoto | null, local: string): string {
  const t = meta?.registradaEm ? Date.parse(meta.registradaEm) : NaN;
  const quando = Number.isFinite(t)
    ? `Registrada em ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(t)).replace(", ", " ")} (Brasília, hora do servidor)`
    : "Hora de registro não disponível";
  const por = meta?.por ? `enviada por ${meta.por}` : "autor não identificado";
  return `${quando} · ${por} · Local: ${local}`;
}

const BRL = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const br = (iso: string) => iso.split("-").reverse().join("/");
const ROTULO_CATEGORIA: Record<string, string> = { dano: "Dano", sujeira_excessiva: "Sujeira excessiva", item_faltando: "Item faltando" };
const ROTULO_STATUS: Record<ItemDossie["status"], string> = { proposto: "Proposto pelo proprietário", aceito: "Aceito pelo morador", contestado: "Contestado pelo morador" };

export function linhasDoDossie(d: { numero: string; imovel: string; proprietario: string; inquilino: string; saida: string; parecerEm: string | null; itens: readonly ItemDossie[] }): string[] {
  const p = prazosDaSaida(d.saida);
  const l = [
    "Dossiê da caução",
    `Contrato ${d.numero} · ${d.imovel}`,
    `Proprietário: ${d.proprietario} · Inquilino: ${d.inquilino}`,
    `Check-out: ${br(d.saida)} · Parecer até ${br(p.parecerAte)} · Devolução até ${br(p.devolucaoAte)}`,
    d.parecerEm ? `Parecer do proprietário: ${br(d.parecerEm.slice(0, 10))}` : "Parecer do proprietário: não dado (liberação integral)",
    `Itens do desconto: ${d.itens.length}`,
  ];
  for (const i of d.itens) {
    l.push(`• ${i.comodo} — ${ROTULO_CATEGORIA[i.categoria] ?? i.categoria} — ${BRL(i.valor)} — ${ROTULO_STATUS[i.status]}`);
    if (i.contestacao) l.push(`  Contestação do morador: ${i.contestacao}`);
  }
  l.push("", TEXTO_VIVA_NAO_DECIDE, "Saídas: " + SAIDAS_DA_DISPUTA.map((s) => s.rotulo).join(" · "));
  return l;
}

function quebrar(texto: string, fonte: PDFFont, tam: number, largura: number): string[] {
  const out: string[] = [];
  for (const par of texto.split("\n")) {
    let atual = "";
    for (const palavra of par.split(/\s+/)) {
      const tenta = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(tenta, tam) > largura && atual) {
        out.push(atual);
        atual = palavra;
      } else atual = tenta;
    }
    out.push(atual);
  }
  return out;
}
const limpo = (s: string) => s.normalize("NFC").replace(/[^\x20-\x7E -ÿ]/g, "?");

async function embutir(doc: PDFDocument, bytes: Uint8Array | null) {
  if (!bytes) return null;
  try {
    const jpg = await sharp(bytes, { limitInputPixels: 100_000_000 }).rotate().resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    return await doc.embedJpg(jpg);
  } catch {
    return null;
  }
}

export async function montarDossiePdf(d: { resumo: string[]; local?: string; itens: readonly (ItemDossie & { fotoEntrada: Uint8Array | null; fotoSaida: Uint8Array | null; comprovante: string | null; metaEntrada?: MetaFoto | null; metaSaida?: MetaFoto | null })[] }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 40;
  const resumo = doc.addPage([595, 842]);
  let y = 800;
  d.resumo.forEach((linha, idx) => {
    for (const parte of quebrar(limpo(linha), idx === 0 ? negrito : fonte, idx === 0 ? 16 : 10, 515)) {
      resumo.drawText(parte, { x: M, y, size: idx === 0 ? 16 : 10, font: idx === 0 ? negrito : fonte, color: rgb(0.1, 0.1, 0.1) });
      y -= idx === 0 ? 24 : 14;
      if (y < 60) break;
    }
  });
  for (const i of d.itens) {
    const pg: PDFPage = doc.addPage([595, 842]);
    pg.drawText(limpo(`${i.comodo} — ${ROTULO_CATEGORIA[i.categoria] ?? i.categoria} — ${BRL(i.valor)}`), { x: M, y: 800, size: 14, font: negrito });
    pg.drawText(limpo(ROTULO_STATUS[i.status]), { x: M, y: 782, size: 10, font: fonte });
    const [entrada, saida] = await Promise.all([embutir(doc, i.fotoEntrada), embutir(doc, i.fotoSaida)]);
    const caixa = { w: 250, h: 330, y: 420 };
    for (const [idx, [rotulo, img]] of ([["Entrada", entrada], ["Saída", saida]] as const).entries()) {
      const x = M + idx * (caixa.w + 15);
      pg.drawText(rotulo, { x, y: caixa.y + caixa.h + 8, size: 11, font: negrito });
      pg.drawRectangle({ x, y: caixa.y, width: caixa.w, height: caixa.h, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
      if (img) {
        const esc = Math.min(caixa.w / img.width, caixa.h / img.height);
        pg.drawImage(img, { x: x + (caixa.w - img.width * esc) / 2, y: caixa.y + (caixa.h - img.height * esc) / 2, width: img.width * esc, height: img.height * esc });
      } else pg.drawText("Foto não pôde ser lida", { x: x + 12, y: caixa.y + caixa.h / 2, size: 10, font: fonte, color: rgb(0.5, 0.2, 0.2) });
      // E640 (3): hora do servidor, quem enviou e o local, sob cada foto (o EXIF do aparelho não entra).
      const legenda = legendaDaFoto((idx === 0 ? i.metaEntrada : i.metaSaida) ?? null, d.local ?? "Imóvel do contrato");
      quebrar(limpo(legenda), fonte, 7, caixa.w).slice(0, 4).forEach((parte, n) => pg.drawText(parte, { x, y: caixa.y - 10 - n * 9, size: 7, font: fonte, color: rgb(0.35, 0.35, 0.35) }));
    }
    let yy = 375;
    pg.drawText(limpo(`Comprovante: ${i.comprovante ?? "não anexado"}`), { x: M, y: yy, size: 10, font: fonte });
    if (i.contestacao) {
      yy -= 22;
      pg.drawText("Contestação do morador:", { x: M, y: yy, size: 10, font: negrito });
      for (const parte of quebrar(limpo(i.contestacao), fonte, 10, 515)) {
        yy -= 14;
        pg.drawText(parte, { x: M, y: yy, size: 10, font: fonte });
      }
    }
  }
  return await doc.save();
}
