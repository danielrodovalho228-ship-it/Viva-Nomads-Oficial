import { CascaConta } from "@/components/account/casca-conta";
import { SairDaViva } from "@/components/account/sair-da-viva";
import { FalarComAViva } from "@/components/ajuda/falar-com-a-viva";

export const metadata = { title: "Sair da Viva", robots: { index: false } };

/**
 * Conta › Privacidade › Sair da Viva (A8): pausar a conta, apagar os dados ou ver as pendências. Abre por "Excluir
 * minha conta" na tela Privacidade (mockup perfil-05); o endereço é o mesmo de antes (links salvos e e-mails).
 */
export default function SairDaVivaPage() {
  return (
    <CascaConta ativo="privacidade" titulo="Sair da Viva" subtitulo="Pausar a conta, apagar seus dados ou ver as pendências.">
      <SairDaViva />
      <FalarComAViva className="mt-4" />
    </CascaConta>
  );
}
