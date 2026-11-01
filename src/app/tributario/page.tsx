import { permanentRedirect } from "next/navigation";

/**
 * E292-bis (correção validada pelo coordenador, relay 32): a Viva não calcula imposto com regra própria. A memória de
 * cálculo PF × PJ dos sócios também saiu — o endereço antigo leva para Ferramentas, como /dashboard/tributacao. O
 * acesso de sócios (proxy) continua na frente desta rota, como antes.
 */
export default function TributarioPage() {
  permanentRedirect("/dashboard/ferramentas");
}
