import { redirect } from "next/navigation";
import QualificarClient from "./qualificar-client";

/**
 * A qualificação é a pendência da etapa Revisão de UM imóvel (`?imovel=<id>`).
 * Sem o parâmetro, quem chega aqui (link antigo, favorito, botão esquecido)
 * começa pelo cadastro pelas Fotos — o dono novo nunca abre o questionário antes.
 */
export default async function QualificarPage({
  searchParams,
}: {
  searchParams: Promise<{ imovel?: string | string[] }>;
}) {
  const { imovel } = await searchParams;
  const id = Array.isArray(imovel) ? imovel[0] : imovel;
  if (!id) redirect("/dashboard/imoveis/novo");
  return <QualificarClient />;
}
