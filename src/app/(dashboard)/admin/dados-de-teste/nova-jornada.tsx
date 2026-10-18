"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { novaJornadaDeTeste, type ResultadoJornada } from "@/lib/data/jornada-teste-actions";

type Opcao = { id: string; rotulo: string };

/** Padrão: o inquilino1 e um anúncio [TESTE QA] do proprietario1, quando existirem. */
function padrao(opcoes: Opcao[], trecho: string): string {
  return (opcoes.find((o) => o.rotulo.toLowerCase().includes(trecho)) ?? opcoes[0])?.id ?? "";
}

export function NovaJornadaTeste({ inquilinos, anuncios }: { inquilinos: Opcao[]; anuncios: (Opcao & { donoId: string })[] }) {
  const [tenantId, setTenantId] = useState(() => padrao(inquilinos, "inquilino1"));
  const [propertyId, setPropertyId] = useState(() => padrao(anuncios, "proprietario1"));
  const [ocupado, setOcupado] = useState(false);
  const [r, setR] = useState<ResultadoJornada | null>(null);

  async function criar() {
    if (!window.confirm("Criar uma nova jornada de teste (candidatura aceita, pronta para o Fechamento)? A candidatura e o contrato antigos ficam como histórico.")) return;
    setOcupado(true);
    setR(await novaJornadaDeTeste({ tenantId, propertyId }).catch(() => ({ ok: false as const, error: "Não foi possível agora." })));
    setOcupado(false);
  }

  return (
    <div className="space-y-3" data-testid="nova-jornada-teste">
      <label className="flex flex-col gap-1 text-sm text-ink">
        Inquilino de teste
        <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="min-w-0 rounded-lg border border-sage-200 bg-white px-2 py-2" data-testid="jornada-inquilino">
          {inquilinos.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Anúncio [TESTE QA]
        <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="min-w-0 rounded-lg border border-sage-200 bg-white px-2 py-2" data-testid="jornada-anuncio">
          {anuncios.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </label>
      <Button variant="primary" onClick={criar} disabled={ocupado || !tenantId || !propertyId} data-testid="jornada-criar">
        {ocupado ? "Criando..." : "Nova jornada de teste"}
      </Button>
      {r && !r.ok && (
        <p role="alert" className="text-sm text-red-600" data-testid="jornada-erro">
          {r.error}
        </p>
      )}
      {r && r.ok && (
        <p className="text-sm text-forest" data-testid="jornada-ok">
          {r.reaproveitada ? "Já havia uma jornada aberta (não assinada) — use esta: " : "Jornada criada: "}
          <Link href={r.link} className="font-medium underline" data-testid="jornada-link">
            abrir o Fechamento
          </Link>
          {" "}(entre como o proprietário de teste).
        </p>
      )}
    </div>
  );
}
