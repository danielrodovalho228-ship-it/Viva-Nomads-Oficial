import { redirect } from "next/navigation";
import { PRECOS_VISIVEL } from "@/config/precos-visivel";

/**
 * A Viva cobra só comissão, sem mensalidade (ordem 90181c57, #93). A antiga tela de
 * "Plano e assinatura" foi aposentada: quem chegar aqui (link antigo, favorito, ponte do app)
 * vai para a página pública de preços. As tabelas de plano continuam no banco.
 */
export default function AssinaturaPage() {
  // E563: com a página de preços suspensa, o link antigo volta ao painel.
  redirect(PRECOS_VISIVEL ? "/precos" : "/dashboard");
}
