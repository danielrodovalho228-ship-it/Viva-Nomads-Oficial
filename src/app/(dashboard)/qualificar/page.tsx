import { redirect } from "next/navigation";
import { destinoQualificarSemImovel } from "@/lib/destino-login";
import QualificarClient from "./qualificar-client";

/**
 * A qualificação é a pendência da etapa Revisão de UM imóvel (`?imovel=<id>`).
 * Sem o parâmetro, quem chega aqui (link antigo, favorito, botão esquecido)
 * vai ao cadastro novo, que abre a Qualificação (E132-A).
 */
export default async function QualificarPage({
  searchParams,
}: {
  searchParams: Promise<{ imovel?: string | string[] }>;
}) {
  const { imovel } = await searchParams;
  const id = Array.isArray(imovel) ? imovel[0] : imovel;
  // E132-A, item 10: sem ?imovel → o cadastro novo (abre a Qualificação; com rascunho em andamento, oferece retomá-lo).
  if (!id) redirect(destinoQualificarSemImovel());
  return <QualificarClient />;
}
