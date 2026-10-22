"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { limparCarteiraDeTeste, semearCarteiraDeTeste } from "@/lib/data/carteira-teste-actions";

type Opcao = { id: string; rotulo: string };

function padrao(opcoes: Opcao[], trecho: string): string {
  return (opcoes.find((o) => o.rotulo.toLowerCase().includes(trecho)) ?? opcoes[0])?.id ?? "";
}

/**
 * Prompt 27, item 8: "Semear carteira de teste" (3 imóveis [TESTE QA] Carteira publicados + 2 contratos encerrados e
 * 1 ativo) e "Limpar carteira de teste". Só contas is_teste; as duas ações pedem confirmação.
 */
export function SemearCarteiraTeste({ proprietarios, inquilinos }: { proprietarios: Opcao[]; inquilinos: Opcao[] }) {
  const [ownerId, setOwnerId] = useState(() => padrao(proprietarios, "proprietario1"));
  const [tenantId, setTenantId] = useState(() => padrao(inquilinos, "inquilino1"));
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  // Confirmação NA PÁGINA, em dois passos (o window.confirm era cancelado no navegador automatizado do QA).
  const [confirmando, setConfirmando] = useState<"semear" | "limpar" | null>(null);

  async function semear() {
    setConfirmando(null);
    setOcupado(true);
    const r = await semearCarteiraDeTeste({ ownerId, tenantId }).catch(() => ({ ok: false as const, error: "Não foi possível agora." }));
    setMsg(
      r.ok
        ? { ok: true, texto: `Carteira pronta: ${r.imoveis} imóveis ativos e ${r.contratos} contratos (${r.imoveisCriados} imóveis e ${r.contratosCriados} contratos criados agora).` }
        : { ok: false, texto: r.error },
    );
    setOcupado(false);
  }

  async function limpar() {
    setConfirmando(null);
    setOcupado(true);
    const r = await limparCarteiraDeTeste({ ownerId }).catch(() => ({ ok: false as const, error: "Não foi possível agora." }));
    setMsg(r.ok ? { ok: true, texto: `Carteira limpa: ${r.imoveis} imóveis e ${r.contratos} contratos apagados.` } : { ok: false, texto: r.error });
    setOcupado(false);
  }

  return (
    <div className="space-y-3" data-testid="semear-carteira">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-ink">
          Proprietário de teste
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full min-w-0 max-w-full rounded-lg border border-sage-200 bg-white px-2 py-2" data-testid="carteira-proprietario">
            {proprietarios.map((o) => (
              <option key={o.id} value={o.id}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Inquilino dos contratos simulados
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="w-full min-w-0 max-w-full rounded-lg border border-sage-200 bg-white px-2 py-2" data-testid="carteira-inquilino">
            {inquilinos.map((o) => (
              <option key={o.id} value={o.id}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setConfirmando("semear")} disabled={ocupado || !ownerId || !tenantId} data-testid="carteira-semear">
          {ocupado ? "Aguarde…" : "Semear carteira de teste"}
        </Button>
        <Button variant="outline" onClick={() => setConfirmando("limpar")} disabled={ocupado || !ownerId} data-testid="carteira-limpar">
          Limpar carteira de teste
        </Button>
      </div>
      {confirmando && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alertdialog" data-testid="carteira-confirmacao">
          <p>
            {confirmando === "semear"
              ? "Semear a carteira de teste: 3 imóveis [TESTE QA] Carteira publicados, 2 contratos encerrados e 1 ativo. O que já existe não é recriado."
              : "Limpar a carteira de teste: apaga só os imóveis [TESTE QA] Carteira e os contratos deles."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={confirmando === "semear" ? semear : limpar} data-testid="carteira-confirmar">
              {confirmando === "semear" ? "Confirmar e semear" : "Confirmar e limpar"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmando(null)} data-testid="carteira-cancelar">
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-forest" : "text-sm text-red-600"} data-testid={msg.ok ? "carteira-ok" : "carteira-erro"}>
          {msg.texto}
          {msg.ok && (
            <>
              {" "}
              <Link href="/dashboard/carteira" className="font-medium underline">
                Abrir a Análise da carteira
              </Link>{" "}
              (entre como o proprietário de teste).
            </>
          )}
        </p>
      )}
    </div>
  );
}
