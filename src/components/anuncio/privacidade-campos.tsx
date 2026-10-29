"use client";

import { useState } from "react";
import { CartaoEscolha } from "@/components/anuncio/escolha-assistente";
import {
  MAX_CAMERAS_EXTERNAS,
  TEXTO_DECLARACAO_CAMERAS,
  TIPOS_ACESSO,
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

      {/* E193: escolha única em cartões (antes, lista suspensa). */}
      <fieldset data-testid="tipo-acesso">
        <legend className="mb-2 block text-sm font-medium text-ink">Tipo de acesso ao imóvel</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de acesso ao imóvel">
          {[{ valor: null, rotulo: "Não informar" }, ...TIPOS_ACESSO].map((t) => (
            <CartaoEscolha
              key={t.valor ?? "nenhum"}
              on={(valor.tipoAcesso ?? null) === t.valor}
              onClick={() => {
                const novo = t.valor as Privacidade["tipoAcesso"];
                set({ tipoAcesso: novo, senhaTrocadaEstadia: novo === "fechadura_senha" ? valor.senhaTrocadaEstadia : false });
              }}
              rotulo={t.rotulo}
              testid={`tipo-acesso-${t.valor ?? "nenhum"}`}
            />
          ))}
        </div>
      </fieldset>
      {valor.tipoAcesso === "fechadura_senha" && (
        <CartaoEscolha
          papel="checkbox"
          on={valor.senhaTrocadaEstadia}
          onClick={() => set({ senhaTrocadaEstadia: !valor.senhaTrocadaEstadia })}
          testid="senha-trocada"
          rotulo="A senha é trocada antes de cada nova estadia"
        />
      )}
    </div>
  );
}
