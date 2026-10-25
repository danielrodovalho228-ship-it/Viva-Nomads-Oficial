"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { definirChaveSms } from "@/lib/data/pedidos-admin";
import { dataPedidoBR } from "@/lib/pedidos/campos";

/**
 * Chave SMS_ATIVO (Prompt 30, item 1). Desligada: o pedido chega aos donos com o e-mail confirmado dos dois lados.
 * Ligada: volta a exigência do telefone confirmado; quem já tinha pedido publicado ganha 7 dias e recebe um aviso.
 * Ligar é decisão do Daniel (o provedor de SMS precisa estar configurado no Supabase antes). ADMIN-3: mora em
 * /admin/sistema (Chaves e integrações).
 */
export function ChaveSmsPainel({ ligada, ligadaEm, quem }: { ligada: boolean; ligadaEm: string | null; /** ADMIN-3: quem mudou a chave por último. */ quem?: string | null }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  async function trocar() {
    setOcupado(true);
    setMsg(null);
    const r = await definirChaveSms(!ligada);
    setOcupado(false);
    setConfirmando(false);
    if (!r.ok) {
      setMsg(r.error ?? "Não foi possível mudar a chave.");
      return;
    }
    setMsg(!ligada ? `Chave ligada. ${r.avisados ?? 0} ${(r.avisados ?? 0) === 1 ? "inquilino avisado" : "inquilinos avisados"} para confirmar o telefone em 7 dias.` : "Chave desligada.");
    router.refresh();
  }
  return (
    <Panel title="Telefone para os pedidos (chave SMS_ATIVO)" className="mb-6" data-testid="chave-sms">
      <p className="text-sm text-ink" data-testid="chave-sms-estado">
        <Smartphone className="mr-1 inline h-4 w-4 text-forest" aria-hidden />
        {ligada
          ? `Ligada${ligadaEm ? ` desde ${dataPedidoBR(ligadaEm)}` : ""}${quem ? ` por ${quem}` : ""}: o pedido só chega aos donos com e-mail e telefone confirmados.`
          : "Desligada: o pedido chega aos donos com o e-mail confirmado dos dois lados. O cartão mostra \"Telefone ainda não confirmado\"."}
      </p>
      <p className="mt-1 text-xs text-muted">
        Ligar só depois de o provedor de SMS estar configurado no Supabase. Os pedidos já publicados ganham 7 dias para o telefone ser confirmado,
        com aviso por e-mail ao inquilino.
      </p>
      {confirmando ? (
        <div className="border border-line mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-white p-3 text-sm text-amber-900" data-testid="chave-sms-confirmacao">
          <span>{ligada ? "Desligar a exigência do telefone?" : "Ligar a exigência do telefone para todos os pedidos?"}</span>
          <Button variant="secondary" size="sm" onClick={trocar} disabled={ocupado} data-testid="chave-sms-confirmar">
            {ligada ? "Desligar" : "Ligar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmando(false)} disabled={ocupado}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setConfirmando(true)} data-testid="chave-sms-trocar">
          {ligada ? "Desligar a chave" : "Ligar a chave"}
        </Button>
      )}
      {msg && (
        <p role="status" className="mt-2 text-sm text-forest" data-testid="chave-sms-msg">
          {msg}
        </p>
      )}
    </Panel>
  );
}
