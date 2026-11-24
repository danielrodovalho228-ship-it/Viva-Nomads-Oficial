"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { imovelDoCorpo } from "@/lib/notifications/caixa-teste";
import {
  CAIXA_DEMORA_MS,
  CAIXA_LIMITE_MS,
  TEXTO_CAIXA_CARREGANDO,
  TEXTO_CAIXA_DEMORADA,
  TEXTO_CAIXA_NAO_LIDA,
  contaDeTesteSabida,
  leituraDaResposta,
  vistaDaCaixa,
  type LeituraDaCaixa,
} from "@/lib/notifications/caixa-teste-estados";
import { useAuthStore } from "@/lib/store";
import { useContaDeTesteDoServidor } from "@/components/account/conta-de-teste-do-servidor";
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

/**
 * Conta → Caixa de e-mails de teste. Só aparece para conta is_teste (a rota responde sem e-mails às demais).
 * E1134: enquanto busca e quando a busca falha, a conta de teste vê isso escrito ("não li" não é "não tem"). A conta
 * real não vê nada em nenhum estado.
 * E1136: (1) a página diz, do servidor, se a conta é de teste (contexto ContaDeTesteDoServidor); a sessão do navegador só
 * decide quando o servidor não leu. (2) A busca tem limite: aos CAIXA_DEMORA_MS o carregamento avisa da demora e
 * oferece o botão de tentar outra vez; aos CAIXA_LIMITE_MS o pedido é cortado e vira "não li".
 */
export function CaixaEmailsTeste() {
  const contaDeTesteNoServidor = useContaDeTesteDoServidor();
  const contaDeTesteNaSessao = useAuthStore((s) => s.user?.isTeste);
  const [leitura, setLeitura] = useState<LeituraDaCaixa<Email>>({ fase: "buscando" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    const corte = new AbortController();
    const demora = setTimeout(() => {
      if (vivo) setLeitura((atual) => (atual.fase === "buscando" ? { fase: "buscando", demorada: true } : atual));
    }, CAIXA_DEMORA_MS);
    const limite = setTimeout(() => corte.abort(), CAIXA_LIMITE_MS);
    fetch("/api/conta/caixa-teste", { cache: "no-store", signal: corte.signal })
      .then(async (r): Promise<LeituraDaCaixa<Email>> => leituraDaResposta(r.ok, await r.json().catch(() => null)))
      .catch((): LeituraDaCaixa<Email> => ({ fase: "falhou" }))
      .then((lida) => {
        clearTimeout(demora);
        clearTimeout(limite);
        if (vivo) setLeitura(lida);
      });
    return () => {
      vivo = false;
      clearTimeout(demora);
      clearTimeout(limite);
      corte.abort();
    };
  }, [tentativa]);

  const tentarDeNovo = () => {
    setLeitura({ fase: "buscando" });
    setTentativa((n) => n + 1);
  };
  const vista = vistaDaCaixa(contaDeTesteSabida(contaDeTesteNoServidor, contaDeTesteNaSessao), leitura);
  if (vista.tipo === "nada") return null;
  if (vista.tipo === "carregando")
    return (
      <Panel title="Caixa de e-mails de teste" className="mt-6">
        <div id="caixa-emails-teste" className="scroll-mt-24" data-testid="caixa-emails-teste-carregando">
          <p role="status" className="text-sm text-muted">
            {TEXTO_CAIXA_CARREGANDO}
            {vista.demorada && <span data-testid="caixa-emails-teste-demorada"> {TEXTO_CAIXA_DEMORADA}</span>}
          </p>
          {vista.demorada && (
            <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={tentarDeNovo}>
              Tentar de novo
            </Button>
          )}
        </div>
      </Panel>
    );
  if (vista.tipo === "erro")
    return (
      <Panel title="Caixa de e-mails de teste" className="mt-6">
        <div id="caixa-emails-teste" className="scroll-mt-24" data-testid="caixa-emails-teste-erro">
          <p role="alert" className="text-sm text-amber-900">{TEXTO_CAIXA_NAO_LIDA}</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={tentarDeNovo}>
            Tentar de novo
          </Button>
        </div>
      </Panel>
    );
  const emails = vista.emails;
  return (
    <Panel title="Caixa de e-mails de teste" className="mt-6">
      <div id="caixa-emails-teste" className="scroll-mt-24" data-testid="caixa-emails-teste">
        <p className="mb-3 text-sm text-muted">Os e-mails que o sistema enviou a esta conta de teste. Só você os vê.</p>
        {emails.length === 0 ? (
          <EmptyState icon={Mail} title="Nenhum e-mail ainda" text="Quando o sistema enviar um e-mail a esta conta, ele aparece aqui." action={<ButtonLink href="/dashboard/notificacoes" variant="secondary" size="sm">Ver as notificações</ButtonLink>} />
        ) : (
          <ul className="space-y-3">
            {emails.map((e) => (
              <li key={e.id} className="min-w-0 rounded-xl border border-sage-200 p-3">
                <p className="text-xs text-muted">{quando(e.criado_em)}</p>
                <p className="mt-1 break-words font-medium text-ink" data-testid="caixa-email-assunto">{e.assunto}</p>
                {/* E322 (01/11): o assunto encurta o título do imóvel (regra do e-mail); aqui vai o nome inteiro, na linha. */}
                {imovelDoCorpo(e.corpo) && (
                  <p className="mt-1 break-words text-sm text-ink" data-testid="caixa-email-imovel">
                    Imóvel: {imovelDoCorpo(e.corpo)}
                  </p>
                )}
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
