import { redirect } from "next/navigation";
import { destinoQualificarSemImovel } from "@/lib/destino-login";
import { destinoDaQualificacao } from "@/lib/qualificar-link";
import { resumoImovelDoDono } from "@/lib/data/actions";

/**
 * E196: uma "Qualificação" só. A antiga página longa ("Antes de anunciar" / "Requisitos e selo") foi absorvida pelo
 * assistente: os requisitos legais moram no cartão "Antes de publicar" da Revisão (Passo 10, E132-A) e o documento num
 * lugar só (E153). Esta rota fica só para links antigos (e-mail, favorito):
 *  • sem ?imovel → o cadastro novo (E132-A, item 10: abre a Qualificação; com rascunho em andamento, oferece retomá-lo);
 *  • com ?imovel → a Revisão daquele rascunho (publicado: o editor; não é do dono: Meus imóveis).
 */
export default async function QualificarPage({
  searchParams,
}: {
  searchParams: Promise<{ imovel?: string | string[] }>;
}) {
  const { imovel } = await searchParams;
  const id = Array.isArray(imovel) ? imovel[0] : imovel;
  if (!id) redirect(destinoQualificarSemImovel());
  redirect(destinoDaQualificacao(await resumoImovelDoDono(id)));
}
