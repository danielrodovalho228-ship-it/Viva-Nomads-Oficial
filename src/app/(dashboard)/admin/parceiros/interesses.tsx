"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SeloEstado } from "@/components/admin/numeros";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { atualizarStatusInteresse } from "@/lib/parceiros/admin-actions";
import { ROTULO_SITUACAO, ROTULO_TIPO_INTERESSE, botoesDoInteresse, type InteresseParceria, type SituacaoInteresse } from "@/lib/admin/interesse-parceria";

export interface InteresseNaTela extends InteresseParceria {
  /** O mesmo interesse já copiado para Pedidos de parceria (0190), com a situação de lá. */
  pedidoStatus: string | null;
  dias: number;
}

const TOM: Record<SituacaoInteresse, "atencao" | "ok" | "neutro"> = { novo: "atencao", contatado: "ok", arquivado: "neutro" };
const ROTULO_PEDIDO: Record<string, string> = { pendente: "pendente", aguardando_email: "aguardando o e-mail", aprovada: "aprovado", ativada: "ativo", recusada: "recusado" };

/** E223 — uma linha por interesse: situação visível e os botões da situação, pela ação que já existe. */
function LinhaInteresse({ i }: { i: InteresseNaTela }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const mudar = (para: SituacaoInteresse) => {
    setErro(null);
    iniciar(async () => {
      const r = await atualizarStatusInteresse(i.id, para).catch(() => ({ ok: false, erro: "Sem conexão. Tente de novo." }));
      if (!r.ok) return setErro(r.erro ?? "Não foi possível atualizar.");
      router.refresh();
    });
  };
  return (
    <li className="py-3" data-testid="interesse-parceria" data-id={i.id} data-status={i.status}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-ink">
            {i.nome}{" "}
            <SeloEstado tom={TOM[i.status]} data-testid="interesse-status">
              {ROTULO_SITUACAO[i.status]}
            </SeloEstado>
          </p>
          <p className="text-muted">
            {ROTULO_TIPO_INTERESSE[i.tipo] ?? "Parceiro"} · {i.cidade}/{i.uf} · enviado em {dataHoraBRT(i.criado_em, { tabela: true })}
            {i.status === "novo" && ` · há ${i.dias} ${i.dias === 1 ? "dia" : "dias"}`}
          </p>
          <p className="text-muted">
            {i.telefone && <span>Telefone {i.telefone}</span>}
            {i.telefone && i.email && " · "}
            {i.email && (
              <a href={`mailto:${i.email}`} className="text-forest underline">
                {i.email}
              </a>
            )}
          </p>
          {i.pedidoStatus && (
            <p className="text-xs text-muted" data-testid="interesse-pedido">
              Também está em{" "}
              <Link href="/admin/parceiros?aba=pendentes" className="font-semibold text-forest underline">
                Pedidos de parceria
              </Link>{" "}
              ({ROTULO_PEDIDO[i.pedidoStatus] ?? i.pedidoStatus}).
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {botoesDoInteresse(i.status).map((b) => (
            <Button key={b.para} variant={b.para === "contatado" ? "primary" : "secondary"} size="sm" disabled={pendente} onClick={() => mudar(b.para)} data-testid={`interesse-para-${b.para}`}>
              {b.rotulo}
            </Button>
          ))}
        </div>
      </div>
      {erro && (
        <p className="mt-2 text-sm text-red-700" role="alert" data-testid="interesse-erro">
          {erro}
        </p>
      )}
    </li>
  );
}

export function ListaInteresses({ itens }: { itens: InteresseNaTela[] }) {
  return (
    <ul className="divide-y divide-line" data-testid="interesses-parceria">
      {itens.map((i) => (
        <LinhaInteresse key={i.id} i={i} />
      ))}
    </ul>
  );
}
