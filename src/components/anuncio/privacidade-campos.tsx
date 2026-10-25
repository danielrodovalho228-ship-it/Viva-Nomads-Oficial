"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
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
      <button
        type="button"
        role="checkbox"
        aria-checked={valor.semCamerasInterior}
        data-testid="declaracao-sem-cameras"
        onClick={() => set({ semCamerasInterior: !valor.semCamerasInterior })}
        className={cn(
          "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
          valor.semCamerasInterior ? "border-forest bg-sage-100" : "border-sage-200 hover:border-sage"
        )}
      >
        <span
          className={cn(
            "mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-lg border",
            valor.semCamerasInterior ? "border-forest bg-forest text-white" : "border-sage-200 bg-white"
          )}
        >
          {valor.semCamerasInterior && <Check className="h-3.5 w-3.5" />}
        </span>
        <span>
          <span className="block text-sm font-medium text-ink">{TEXTO_DECLARACAO_CAMERAS}</span>
          <span className="block text-xs text-muted">Declaração obrigatória para publicar.</span>
        </span>
      </button>

      <div className="space-y-2">
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={temExternas}
            onChange={(e) => {
              setTemExternas(e.target.checked);
              if (!e.target.checked) set({ camerasExternas: "" });
            }}
            className="h-4 w-4"
          />
          Há câmeras externas ou em áreas comuns
        </label>
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

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink">Tipo de acesso ao imóvel</span>
        <select
          value={valor.tipoAcesso ?? ""}
          onChange={(e) => {
            const t = (e.target.value || null) as Privacidade["tipoAcesso"];
            set({ tipoAcesso: t, senhaTrocadaEstadia: t === "fechadura_senha" ? valor.senhaTrocadaEstadia : false });
          }}
          className="input"
          data-testid="tipo-acesso"
        >
          <option value="">Não informar</option>
          {TIPOS_ACESSO.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </label>
      {valor.tipoAcesso === "fechadura_senha" && (
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={valor.senhaTrocadaEstadia}
            onChange={(e) => set({ senhaTrocadaEstadia: e.target.checked })}
            className="h-4 w-4"
            data-testid="senha-trocada"
          />
          A senha é trocada antes de cada nova estadia
        </label>
      )}
    </div>
  );
}
