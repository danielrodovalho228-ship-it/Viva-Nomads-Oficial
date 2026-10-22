"use client";

import { useEffect, useState } from "react";
import { meusPapeis } from "@/lib/data/papeis-actions";

/**
 * Configurações → Pagamentos (Prompt 43, item 3). Para quem anuncia: como o morador paga você. O dado de recebimento
 * (Pix ou conta, informado pelo próprio dono para o contrato) ainda não existe no cadastro — por isso o grupo mostra só
 * o texto; o dado entra num prompt funcional.
 */
export function PagamentosConta() {
  const [dono, setDono] = useState(false);
  useEffect(() => {
    let vivo = true;
    meusPapeis()
      .then((p) => vivo && setDono(!!p?.find((x) => x.papel === "proprietario")?.ativo))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  return (
    <section className="rounded-xl border border-line bg-white p-4 sm:p-6" data-testid="conta-pagamentos">
      <h2 className="font-title text-lg font-semibold text-ink">{dono ? "Como o morador paga você" : "Como você paga"}</h2>
      {dono ? (
        <p className="mt-2 text-sm text-ink">
          O morador paga o valor mensal direto para a sua conta, nos dados que você informa no contrato. A Viva não recebe esse valor.
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink">Você paga o valor mensal direto ao proprietário, nos dados que estão no contrato. A Viva não recebe esse valor.</p>
      )}
    </section>
  );
}
