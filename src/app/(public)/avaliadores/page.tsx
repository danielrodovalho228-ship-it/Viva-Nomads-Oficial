import { permanentRedirect } from "next/navigation";
import { ROTA_RECRUTAMENTO } from "@/lib/vistoria/entrada";

/** Correção 62-B3, item 5: /avaliadores (sem número) leva à página de recrutamento em vez de 404. */
export default function AvaliadoresIndice() {
  permanentRedirect(ROTA_RECRUTAMENTO);
}
