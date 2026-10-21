/* eslint-disable @next/next/no-img-element -- ImageResponse (satori) só desenha <img>; next/image não se aplica aqui. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { cartaoPeloCurto, dadosDoCartao, dadosDoCartaoParceiro, urlAssinada, type CartaoLinha } from "@/lib/data/cartoes-servidor";
import { fotoParaCartao } from "@/lib/cartoes/foto-cartao";
import { curtoValido, FORMATOS, mesAno, nomeNoCartao, TEXTOS, TEXTOS_PARCEIRO, textoValorPeriodo, type FormatoCartao } from "@/lib/cartoes/compartilhar";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
  Imagem do cartão compartilhável (Fase 1), desenhada no servidor a partir dos dados do anúncio:
  1080×1350 (formato=retrato) ou 1080×1080 (formato=quadrado). Modelo travado: só campos aprovados. Sem foto (ou
  foto lenta) → fundo da marca, nunca erro. O QR leva à URL assinada do próprio domínio.
  A foto vai ao satori sempre como JPEG ou PNG (fotoParaCartao converte WebP). Rede de segurança: se a renderização
  falhar mesmo assim, o cartão é desenhado de novo sem foto; se falhar outra vez, 503 (nunca 500).
  Cartão do parceiro (partnercard, 31c): desenha SÓ os campos de camposCartaoParceiro (página pública publicada).
*/
export const runtime = "nodejs";

const VERDE = "#1c6b3a";
const VERDE_CLARO = "#8FD63A";
const AZUL = "#0A4FD6";

/** Foto em data URI, com limite de tempo: sem foto em 1,2 s, o cartão sai com o fundo da marca. */
async function qrComoDataUri(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#0f1722", light: "#ffffff" } });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** Cartão do parceiro: foto (perfil ou capa recortada), título (nome público com o opt-in, senão a categoria),
 *  categoria + até 2 cidades, nota real ou "Novo na Viva", selo "Parceiro Viva Nomads", QR e o endereço curto. */
async function imagemDoParceiro(admin: SupabaseClient, cartao: CartaoLinha, formato: FormatoCartao): Promise<Response> {
  const dp = await dadosDoCartaoParceiro(admin, cartao);
  if (!dp) return new Response("Cartão não encontrado.", { status: 404 });
  const c = dp.campos;
  const [urlQr, mark] = await Promise.all([urlAssinada(admin, cartao, "qr"), readFile(join(process.cwd(), "public/brand/novo/vn-mark-128.png"))]);
  const [foto, qrSrc] = await Promise.all([fotoComoDataUri(c.fotoUrl), qrComoDataUri(urlQr)]);
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;
  const enderecoCurto = new URL(urlQr).host + `/c/${cartao.curto}`;
  const { largura, altura } = FORMATOS[formato];
  const altoFoto = formato === "retrato" ? 700 : 500;
  const ladoQr = formato === "retrato" ? 250 : 220;
  return respostaSegura(foto, (foto) => new ImageResponse(
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
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: VERDE }}>{c.selo}</div>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, padding: "40px 56px", gap: 40, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 14 }}>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: VERDE, letterSpacing: 1 }}>{c.categoria.toUpperCase()}</div>
            <div style={{ display: "flex", fontSize: 58, fontWeight: 800, color: "#0f1722", lineHeight: 1.08 }}>{c.titulo}</div>
            {c.cidades ? <div style={{ display: "flex", fontSize: 34, color: "#334155" }}>{c.cidades}</div> : null}
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: c.nota === TEXTOS_PARCEIRO.novo ? VERDE : "#b45309" }}>{c.nota}</div>
            <div style={{ display: "flex", fontSize: 24, color: "#64748b", marginTop: 6 }}>{TEXTOS_PARCEIRO.rodape}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", padding: 18, background: "#ffffff", borderRadius: 24, border: "2px solid #dbe7df" }}>
              <img src={qrSrc} width={ladoQr} height={ladoQr} alt="" />
            </div>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: "#0f1722" }}>{enderecoCurto}</div>
            <div style={{ display: "flex", fontSize: 18, color: "#475569", maxWidth: 280, textAlign: "center" }}>{TEXTOS_PARCEIRO.qr}</div>
          </div>
        </div>
      </div>
    ),
    {
      width: largura,
      height: altura,
      headers: { "Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex" },
    },
  ));
}

/**
 * Renderiza o cartão consumindo o corpo (é aí que o satori falha), para pegar o erro ainda dentro da rota. Falhou com
 * foto → desenha de novo sem foto (fundo da marca). Falhou sem foto → 503 limpo. O log não leva dado pessoal.
 */
async function respostaSegura(foto: string | null, desenhar: (foto: string | null) => ImageResponse): Promise<Response> {
  for (const tentativa of foto ? [foto, null] : [null]) {
    try {
      const r = desenhar(tentativa);
      const corpo = await r.arrayBuffer();
      return new Response(corpo, { status: 200, headers: r.headers });
    } catch (e) {
      console.error(`[cartoes/imagem] falha ao desenhar ${tentativa ? "com" : "sem"} foto:`, e instanceof Error ? e.message : "erro");
    }
  }
  return new Response("Não foi possível gerar a imagem agora. Tente de novo.", { status: 503, headers: { "Retry-After": "30" } });
}

async function fotoComoDataUri(url: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(1200) });
    if (!r.ok) return null;
    const tipo = r.headers.get("content-type") ?? "";
    if (!/^image\//.test(tipo)) return null;
    return await fotoParaCartao(new Uint8Array(await r.arrayBuffer()), tipo);
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
  if (cartao.tipo === "partnercard") return imagemDoParceiro(admin, cartao, formato);

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

  return respostaSegura(foto, (foto) => new ImageResponse(
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
  ));
}
