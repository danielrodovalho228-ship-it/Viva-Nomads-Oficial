"use client";

import { ButtonLink } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Panel, EmptyState } from "@/components/dashboard/primitives";

interface Email {
  id: string;
  criado_em: string;
  evento: string;
  assunto: string;
  corpo: string;
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Conta → Caixa de e-mails de teste. Só aparece para conta is_teste (a rota responde sem e-mails às demais). */
export function CaixaEmailsTeste() {
  const [emails, setEmails] = useState<Email[] | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/conta/caixa-teste", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { emails?: Email[] } | null) => {
        if (vivo && j?.emails) setEmails(j.emails);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  if (!emails) return null;
  return (
    <Panel title="Caixa de e-mails de teste" className="mt-6">
      <div data-testid="caixa-emails-teste">
        <p className="mb-3 text-sm text-muted">Os e-mails que o sistema enviou a esta conta de teste. Só você os vê.</p>
        {emails.length === 0 ? (
          <EmptyState icon={Mail} title="Nenhum e-mail ainda" text="Quando o sistema enviar um e-mail a esta conta, ele aparece aqui." action={<ButtonLink href="/dashboard/conta/notificacoes" variant="secondary" size="sm">Ver as notificações</ButtonLink>} />
        ) : (
          <ul className="space-y-3">
            {emails.map((e) => (
              <li key={e.id} className="min-w-0 rounded-xl border border-sage-200 p-3">
                <p className="text-xs text-muted">{quando(e.criado_em)}</p>
                <p className="mt-1 break-words font-medium text-ink">{e.assunto}</p>
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-forest">Ler o e-mail</summary>
                  <pre className="whitespace-pre-wrap break-words text-sm text-ink">{e.corpo}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
