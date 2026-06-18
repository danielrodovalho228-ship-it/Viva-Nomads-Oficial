import { ImageResponse } from "next/og";

export const alt = "Viva Nomads — locação mobiliada mensal para profissionais em transição";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
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
            background: "linear-gradient(135deg, #143C8C, #1E63D0, #6CBE2A)",
            opacity: 0.5,
            filter: "blur(40px)",
          }}
        />
        {/* wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #143C8C, #6CBE2A)",
            }}
          />
          <div style={{ display: "flex", fontSize: 38, fontWeight: 800 }}>
            <span style={{ color: "#2E8BE6" }}>Viva</span>
            <span style={{ color: "#6CBE2A" }}>Nomads</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "white", fontSize: 68, fontWeight: 800, lineHeight: 1.05, maxWidth: 920 }}>
            Moradia mobiliada para a sua nova fase
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 30, marginTop: 20 }}>
            Locação mensal de 30 a 180 dias · não é Airbnb, não é QuintoAndar
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["Pronto para Morar", "Contrato formal", "Inquilino verificado"].map((t) => (
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
