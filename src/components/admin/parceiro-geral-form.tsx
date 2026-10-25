"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { definirParceiroGeral } from "@/lib/parceiros/admin-actions";
import type { ParceiroGeral } from "@/lib/parceiros/regras";

/**
 * Chave PARCEIRO_GERAL_FALLBACK (Prompt 31a): o cartão do parceiro geral na busca vazia. ADMIN-3: mora em
 * /admin/sistema; ligar ou desligar pede confirmação na página. Grava pela ação que já existia (definirParceiroGeral).
 */
export function ParceiroGeralForm({ inicial }: { inicial: ParceiroGeral }) {
  const router = useRouter();
  const [g, setG] = useState(inicial);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const salvar = () =>
    iniciar(async () => {
      const r = await definirParceiroGeral({ ligada: g.ligado, nome: g.nome, cidade: g.cidade, descricao: g.descricao }).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
      setMsg(r.ok ? { ok: true, texto: "Salvo." } : { ok: false, texto: r.erro });
      if (r.ok) router.refresh();
    });
  const trocaChave = g.ligado !== inicial.ligado;
  return (
    <div className="space-y-2" data-testid="parceiro-geral-admin">
      <p className="text-sm text-muted">Aparece só quando a busca não acha ninguém. Sem logo de terceiros. Desligado por padrão.</p>
      <input aria-label="Nome" value={g.nome} onChange={(e) => setG({ ...g, nome: e.target.value })} placeholder="Nome do parceiro geral" className="w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
      <input aria-label="Cidade" value={g.cidade} onChange={(e) => setG({ ...g, cidade: e.target.value })} placeholder="Cidade" className="w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
      <textarea aria-label="Descrição" rows={2} value={g.descricao} onChange={(e) => setG({ ...g, descricao: e.target.value })} placeholder="Descrição" className="w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
      <label className="flex items-center gap-3 text-sm text-ink">
        <Switch checked={g.ligado} onChange={(v) => setG({ ...g, ligado: v })} label="Mostrar o cartão na busca vazia" />
        Mostrar o cartão na busca vazia
      </label>
      {trocaChave ? (
        <ConfirmarNaPagina
          aviso={g.ligado ? "Ligar o cartão do parceiro geral para todos na busca vazia?" : "Desligar o cartão do parceiro geral?"}
          confirmar={g.ligado ? "Ligar" : "Desligar"}
          onConfirmar={salvar}
          disabled={pendente}
          size="sm"
          variant="secondary"
          testid="parceiro-geral-salvar"
        >
          Salvar cartão
        </ConfirmarNaPagina>
      ) : (
        <Button size="sm" variant="secondary" disabled={pendente} onClick={salvar} data-testid="parceiro-geral-salvar">
          Salvar cartão
        </Button>
      )}
      {msg && (
        <p className={`mt-2 text-sm ${msg.ok ? "text-forest" : "text-red-700"}`} role={msg.ok ? "status" : "alert"} data-testid="admin-parceria-msg">
          {msg.texto}
        </p>
      )}
    </div>
  );
}
