import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getProperty } from "@/lib/data/properties";
import { formatBRL } from "@/lib/utils";

export const alt = "Imóvel no Viva Nomads";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProperty(id);
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 56,
                height: 56,
                borderRadius: 12,
                background: "#FFFFFF",
              }}
            >
              <img src={markSrc} width={44} height={44} alt="" />
            </div>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>
              <span style={{ color: "#FFFFFF" }}>Viva</span>
              <span style={{ color: "#8FD63A" }}>Nomads</span>
            </div>
          </div>
          {p?.readyToLiveBadge && (
            <div
              style={{
                display: "flex",
                color: "white",
                fontSize: 22,
                fontWeight: 700,
                padding: "10px 22px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #1c6b3a, #6CBE2A)",
              }}
            >
              Pronto para Morar
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 26 }}>
            {p ? `${p.neighborhood}, ${p.city}` : "Imóvel mobiliado"}
          </div>
          <div style={{ color: "white", fontSize: 58, fontWeight: 800, lineHeight: 1.08, marginTop: 10, maxWidth: 1000 }}>
            {p?.title ?? "Imóvel mobiliado por temporada"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
          <div style={{ color: "#6CBE2A", fontSize: 52, fontWeight: 800 }}>
            {p ? `${formatBRL(p.monthlyPrice)}` : ""}
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 28, paddingBottom: 8 }}>
            {p ? `/mês · ${p.bedrooms} quartos · ${p.areaM2} m²` : ""}
          </div>
        </div>
      </div>
    ),
    size
  );
}
