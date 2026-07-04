import type { Metadata } from "next";
import { Decisao } from "@/components/decisao/decisao";

// Documento interno (decisão do modelo de negócio) — link direto, não indexar.
export const metadata: Metadata = {
  title: "Decisão do modelo de negócio",
  robots: { index: false, follow: false },
};

export default function DecisaoPage() {
  return <Decisao />;
}
