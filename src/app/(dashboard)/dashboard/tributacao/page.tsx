import { permanentRedirect } from "next/navigation";

/**
 * E292-bis ("a Viva só conecta", diretriz do Daniel de 31/10, validada pelo coordenador): a Viva não calcula imposto com
 * regra própria. O simulador PF × PJ saiu do painel, do menu e do hub; o endereço antigo leva para Ferramentas.
 * (A memória de cálculo interna dos sócios, /tributario, fica atrás do acesso de sócios e não é tela do dono.)
 */
export default function TributacaoPage() {
  permanentRedirect("/dashboard/ferramentas");
}
