"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ativarParceria, type EstadoAtivacao } from "@/lib/parceiros/ativacao-actions";
import { pedirNovoLink } from "@/lib/parceiros/solicitacao-actions";

export function AtivarParceria({ token, estado }: { token: string; estado: EstadoAtivacao }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const volta = `/parceiros/ativar?t=${encodeURIComponent(token)}`;

  if (estado.situacao !== "valido") {
    const texto =
      estado.situacao === "usado" ? "Este link já foi usado." : estado.situacao === "vencido" ? "Este link venceu (vale por 7 dias)." : "Este link não é válido.";
    return (
      <div data-testid="ativar-invalido" data-situacao={estado.situacao}>
        <p className="font-semibold text-ink">{texto}</p>
        {estado.situacao === "usado" ? (
          <ButtonLink href="/dashboard/parceiro" className="mt-4">
            Abrir o painel de parceiro
          </ButtonLink>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">Peça um novo link: a equipe recebe o aviso e manda outro e-mail.</p>
            {msg?.ok ? (
              <p className="mt-4 text-sm text-forest" role="status" data-testid="ativar-novo-link-ok">
                {msg.texto}
              </p>
            ) : (
              <Button
                className="mt-4"
                disabled={pendente || estado.situacao === "invalido"}
                data-testid="ativar-novo-link"
                onClick={() =>
                  iniciar(async () => {
                    const r = await pedirNovoLink(token);
                    setMsg(r.ok ? { ok: true, texto: "Pedido enviado. A equipe manda um novo link para o seu e-mail." } : { ok: false, texto: r.erro });
                  })
                }
              >
                Peça um novo link
              </Button>
            )}
          </>
        )}
        {msg && !msg.ok && (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {msg.texto}
          </p>
        )}
      </div>
    );
  }

  if (!estado.logado) {
    return (
      <div data-testid="ativar-entrar">
        <p className="text-ink">
          Sua parceria foi aprovada. Para ativar, entre (ou crie a conta) com o <strong>mesmo e-mail</strong> do pedido: {estado.emailDica}.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href={`/auth?redirect=${encodeURIComponent(volta)}`}>Entrar</ButtonLink>
          <ButtonLink href={`/auth?cadastro=1&redirect=${encodeURIComponent(volta)}`} variant="secondary">
            Criar conta
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (!estado.emailCerto) {
    return (
      <div data-testid="ativar-outro-email">
        <p className="font-semibold text-ink">Esta conta não é a do pedido.</p>
        <p className="mt-1 text-sm text-muted">
          Saia e entre com a conta do e-mail {estado.emailDica} para ativar. Nada foi alterado nesta conta.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="ativar-pronto">
      <p className="text-ink">
        Tudo certo{estado.nome ? `, ${estado.nome.split(" ")[0]}` : ""}. Ao ativar, criamos a sua página (ainda fora do ar) e você completa o cadastro: foto, capa, descrição, serviços e
        cidades. Publique quando estiver pronta.
      </p>
      <Button
        className="mt-4 w-full sm:w-auto"
        disabled={pendente}
        data-testid="ativar-confirmar"
        onClick={() =>
          iniciar(async () => {
            const r = await ativarParceria(token);
            if (r.ok) router.push("/dashboard/parceiro?ativada=1");
            else setMsg({ ok: false, texto: r.erro });
          })
        }
      >
        {pendente && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Ativar minha página
      </Button>
      {msg && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {msg.texto}
        </p>
      )}
    </div>
  );
}
