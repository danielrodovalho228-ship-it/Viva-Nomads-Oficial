"use client";

import { dataHoraBRT } from "@/lib/datas-brasilia";
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
  // Confirmação NA PÁGINA, em dois passos (adendo ao prompt 28): o window.confirm era cancelado no navegador
  // automatizado do QA e o clique terminava sem nada na tela.
  const [confirmando, setConfirmando] = useState(false);

  async function criar() {
    setConfirmando(false);
    setOcupado(true);
    setR(null);
    setR(
      await novaJornadaDeTeste({ tenantId, propertyId }).catch((e: unknown) => ({
        ok: false as const,
        error: `Não foi possível agora: ${e instanceof Error ? e.message : String(e)}`,
      })),
    );
    setOcupado(false);
  }

  return (
    <div className="space-y-3" data-testid="nova-jornada-teste">
      <label className="flex flex-col gap-1 text-sm text-ink">
        Inquilino de teste
        <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="w-full min-w-0 max-w-full rounded-lg border border-sage-200 bg-white px-2 py-2" data-testid="jornada-inquilino">
          {inquilinos.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Anúncio [TESTE QA]
        <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-full min-w-0 max-w-full rounded-lg border border-sage-200 bg-white px-2 py-2" data-testid="jornada-anuncio">
          {anuncios.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </label>
      <Button variant="secondary" onClick={() => setConfirmando(true)} disabled={ocupado || !tenantId || !propertyId} data-testid="jornada-criar">
        {ocupado ? "Criando..." : "Nova jornada de teste"}
      </Button>
      {confirmando && (
        <div className="rounded-lg border border-line bg-white p-3 text-sm text-amber-900" role="alertdialog" data-testid="jornada-confirmacao">
          <p>
            Cria uma candidatura nova do inquilino de teste, já aceita e pronta para o Fechamento, no anúncio [TESTE QA] escolhido. A candidatura e
            o contrato antigos ficam como histórico.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => void criar()} data-testid="jornada-confirmar">
              Confirmar e criar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmando(false)} data-testid="jornada-cancelar">
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {ocupado && (
        <p className="text-sm text-muted" role="status" data-testid="jornada-criando">
          Criando a jornada…
        </p>
      )}
      {r && !r.ok && (
        <p role="alert" className="border border-line rounded-lg bg-white px-3 py-2 text-sm text-red-700" data-testid="jornada-erro">
          Erro: {r.error}
        </p>
      )}
      {r && r.ok && (
        <div className="break-words rounded-lg border border-sage-200 bg-sage-50 p-3 text-sm text-ink" role="status" data-testid="jornada-ok" data-reaproveitada={r.reaproveitada ? "1" : "0"}>
          <p className="font-semibold text-forest">
            {r.reaproveitada ? "Jornada reaproveitada" : "Jornada criada"} · candidatura <span data-testid="jornada-numero">{r.numero}</span>
          </p>
          {r.reaproveitada && (
            <p className="mt-1" data-testid="jornada-motivo">
              Já havia uma jornada aberta: a candidatura {r.numero}, aceita em {r.aceitaEm ? dataHoraBRT(r.aceitaEm) : "data não registrada"}. Foi
              reaproveitada porque {r.motivo}.
            </p>
          )}
          {!!r.contratosEncerrados && (
            <p className="mt-1" data-testid="jornada-encerrados">
              {r.contratosEncerrados === 1 ? "O contrato de teste anterior deste anúncio foi encerrado" : `${r.contratosEncerrados} contratos de teste anteriores deste anúncio foram encerrados`}, para a nova jornada não cruzar as datas dele.
            </p>
          )}
          <p className="mt-1 break-words text-muted">
            Anúncio: {r.anuncio} · Inquilino: {r.inquilino}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <li>
              <Link href={r.links.fechamento} className="font-semibold text-forest underline" data-testid="jornada-link">
                Abrir o Fechamento
              </Link>{" "}
              <span className="text-xs text-muted">(entre como o proprietário)</span>
            </li>
            <li>
              <Link href={r.links.candidaturas} className="font-semibold text-forest underline" data-testid="jornada-link-candidaturas">
                Ver em Candidaturas
              </Link>{" "}
              <span className="text-xs text-muted">(inquilino)</span>
            </li>
            <li>
              <Link href={r.links.leads} className="font-semibold text-forest underline" data-testid="jornada-link-leads">
                Ver em Leads
              </Link>{" "}
              <span className="text-xs text-muted">(proprietário)</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
