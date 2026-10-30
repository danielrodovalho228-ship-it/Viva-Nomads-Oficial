"use client";

import { useState } from "react";
import { CartaoEscolha } from "@/components/anuncio/escolha-assistente";
import {
  MAX_CAMERAS_EXTERNAS,
  TEXTO_DECLARACAO_CAMERAS,
  type Privacidade,
} from "@/lib/anuncio/privacidade";

/**
 * Campos de privacidade e acesso do anúncio (ordem f92bc582). Mesmo componente
 * no assistente de criação e no editor por seções. A declaração é obrigatória
 * para publicar (prontidão); o resto é opcional.
 */
export function PrivacidadeCampos({ valor, onChange }: { valor: Privacidade; onChange: (v: Privacidade) => void }) {
  const [temExternas, setTemExternas] = useState(valor.camerasExternas.length > 0);
  const set = (p: Partial<Privacidade>) => onChange({ ...valor, ...p });

  return (
    <div className="space-y-3" data-testid="privacidade-campos">
      <p className="text-sm font-medium text-ink">Privacidade e acesso</p>
      <CartaoEscolha
        papel="checkbox"
        on={valor.semCamerasInterior}
        onClick={() => set({ semCamerasInterior: !valor.semCamerasInterior })}
        testid="declaracao-sem-cameras"
        rotulo={TEXTO_DECLARACAO_CAMERAS}
        dica="Declaração obrigatória para publicar."
      />

      <div className="space-y-2">
        <CartaoEscolha
          papel="checkbox"
          on={temExternas}
          onClick={() => {
            setTemExternas(!temExternas);
            if (temExternas) set({ camerasExternas: "" });
          }}
          testid="cameras-externas"
          rotulo="Há câmeras externas ou em áreas comuns"
          dica="Diga onde ficam; o morador vê antes de pedir."
        />
        {temExternas && (
          <input
            value={valor.camerasExternas}
            onChange={(e) => set({ camerasExternas: e.target.value })}
            maxLength={MAX_CAMERAS_EXTERNAS}
            placeholder="Onde ficam? Ex.: portaria e garagem do prédio"
            aria-label="Onde ficam as câmeras externas"
            className="input"
          />
        )}
      </div>

      {/* E259 (2): a entrada do imóvel é perguntada uma vez só, no Passo 6 ("Como se entra no imóvel?"). */}
    </div>
  );
}
