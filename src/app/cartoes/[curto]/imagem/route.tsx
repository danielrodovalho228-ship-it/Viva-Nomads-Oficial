/* eslint-disable @next/next/no-img-element -- ImageResponse (satori) só desenha <img>; next/image não se aplica aqui. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { cartaoPeloCurto, dadosDoCartao, urlAssinada } from "@/lib/data/cartoes-servidor";
import { curtoValido, FORMATOS, mesAno, nomeNoCartao, TEXTOS, textoValorPeriodo, type FormatoCartao } from "@/lib/cartoes/compartilhar";

/*
  Imagem do cartão compartilhável (Fase 1), desenhada no servidor a partir dos dados do anúncio:
  1080×1350 (formato=retrato) ou 1080×1080 (formato=quadrado). Modelo travado: só campos aprovados. Sem foto (ou
  foto lenta) → fundo da marca, nunca erro. O QR leva à URL assinada do próprio domínio.
*/
export const runtime = "nodejs";

const VERDE = "#1c6b3a";
const VERDE_CLARO = "#8FD63A";
const AZUL = "#0A4FD6";

/** Foto em data URI, com limite de tempo: sem foto em 1,2 s, o cartão sai com o fundo da marca. */
async function fotoComoDataUri(url: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(1200) });
    if (!r.ok) return null;
    const tipo = r.headers.get("content-type") ?? "";
    if (!/^image\/(jpeg|png|webp)/.test(tipo)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 6_000_000) return null;
    return `data:${tipo.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ curto: string }> }) {
  const { curto } = await params;
  const formato = (new URL(request.url).searchParams.get("formato") === "quadrado" ? "quadrado" : "retrato") as FormatoCartao;
  const admin = createAdminClient();
  if (!admin || !curtoValido(curto)) return new Response("Cartão não encontrado.", { status: 404 });
  const cartao = await cartaoPeloCurto(admin, curto);
  if (!cartao) return new Response("Cartão não encontrado.", { status: 404 });

  const [d, urlQr, mark] = await Promise.all([
    dadosDoCartao(admin, cartao),
    urlAssinada(admin, cartao, "qr"),
    readFile(join(process.cwd(), "public/brand/novo/vn-mark-128.png")),
  ]);
  if (!d) return new Response("Cartão não encontrado.", { status: 404 });
  const [foto, qrSvg] = await Promise.all([
    fotoComoDataUri(d.fotoUrl),
    QRCode.toString(urlQr, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#0f1722", light: "#ffffff" } }),
  ]);
  const qrSrc = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString("base64")}`;
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;

  const { largura, altura } = FORMATOS[formato];
  const altoFoto = formato === "retrato" ? 760 : 560;
  const postal = d.tipo === "poststay";
  const nome = postal ? nomeNoCartao(d.nomeCompleto, d.mostrarNome) : "";
  const lugar = postal ? d.cidade : [d.bairro, d.cidade].filter(Boolean).join(" · ");
  const linhaInfo = postal ? mesAno(d.inicioEstadia) : textoValorPeriodo(d.valorMensal, d.minDias);
  const frase = postal ? TEXTOS.poststay.frase : TEXTOS.ownercard.frase;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f6f8f7", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", position: "relative", width: largura, height: altoFoto }}>
          {foto ? (
            <img src={foto} width={largura} height={altoFoto} style={{ objectFit: "cover", width: largura, height: altoFoto }} alt="" />
          ) : (
            <div style={{ display: "flex", width: largura, height: altoFoto, background: `linear-gradient(135deg, ${VERDE} 0%, #2f8f4e 55%, ${VERDE_CLARO} 100%)` }} />
          )}
          <div style={{ position: "absolute", top: 40, left: 40, display: "flex", alignItems: "center", gap: 14, padding: "12px 22px", borderRadius: 999, background: "rgba(255,255,255,0.94)" }}>
            <img src={markSrc} width={40} height={40} alt="" />
            <div style={{ display: "flex", fontSize: 32, fontWeight: 800 }}>
              <span style={{ color: AZUL }}>Viva</span>
              <span style={{ color: "#5DBB1E" }}>Nomads</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, padding: "44px 56px", gap: 40, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 14 }}>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: VERDE, letterSpacing: 1 }}>{frase.toUpperCase()}</div>
            <div style={{ display: "flex", fontSize: postal ? 64 : 52, fontWeight: 800, color: "#0f1722", lineHeight: 1.08 }}>
              {postal ? lugar : d.titulo.slice(0, 60)}
            </div>
            {!postal && lugar ? <div style={{ display: "flex", fontSize: 34, color: "#334155" }}>{lugar}</div> : null}
            {linhaInfo ? <div style={{ display: "flex", fontSize: 34, color: "#334155" }}>{postal ? `Estadia em ${linhaInfo}` : linhaInfo}</div> : null}
            {nome ? <div style={{ display: "flex", fontSize: 32, color: "#334155" }}>{`— ${nome}`}</div> : null}
            <div style={{ display: "flex", fontSize: 24, color: "#64748b", marginTop: 6 }}>{TEXTOS.poststay.rodape}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", padding: 18, background: "#ffffff", borderRadius: 24, border: "2px solid #dbe7df" }}>
              <img src={qrSrc} width={formato === "retrato" ? 260 : 230} height={formato === "retrato" ? 260 : 230} alt="" />
            </div>
            <div style={{ display: "flex", fontSize: 20, color: "#475569", maxWidth: 280, textAlign: "center" }}>{TEXTOS.qr}</div>
          </div>
        </div>
      </div>
    ),
    {
      width: largura,
      height: altura,
      headers: { "Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex" },
    },
  );
}
