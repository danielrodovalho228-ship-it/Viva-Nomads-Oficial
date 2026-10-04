import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Viva Nomads — locação mobiliada por temporada, de 30 a 180 dias";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  // Símbolo oficial (PNG transparente) embutido como data URL.
  const mark = await readFile(join(process.cwd(), "public/brand/novo/vn-mark-128.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A0A0A",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        {/* brilho gradiente */}
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: 520,
            background: "linear-gradient(135deg, #123b26, #1c6b3a, #6CBE2A)",
            opacity: 0.5,
            filter: "blur(40px)",
          }}
        />
        {/* wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Fundo escuro: placa branca atrás do símbolo (o azul fica legível). */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "#FFFFFF",
            }}
          >
            <img src={markSrc} width={52} height={52} alt="" />
          </div>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 800 }}>
            <span style={{ color: "#FFFFFF" }}>Viva</span>
            <span style={{ color: "#8FD63A" }}>Nomads</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "white", fontSize: 68, fontWeight: 800, lineHeight: 1.05, maxWidth: 920 }}>
            Moradia mobiliada para a sua nova fase
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 30, marginTop: 20 }}>
            Imóveis mobiliados de 30 a 180 dias · contrato de verdade
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["Pronto para Morar", "Contrato formal", "Conversa registrada"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                color: "white",
                fontSize: 22,
                padding: "10px 20px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
