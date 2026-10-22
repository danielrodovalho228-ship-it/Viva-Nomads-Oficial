import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { avisoSemLeitura, tituloDecisoesAdmin, type DecisoesAdmin } from "@/lib/admin/decisoes-admin";

/*
  Anatomia "decisões primeiro" do admin (Prompt 46, D5): no topo o que espera decisão, depois UM número-herói por tela
  e o resto em listas com divisores finos. Nada de cartão de indicador, faixa colorida ou número sem ação: todo número
  é link para a lista que ele conta (regra de 13/10).
*/

/** "Hoje você tem N decisões": uma linha por fila com decisão esperando, cada uma com o botão da decisão. */
export function DecisoesHoje({ decisoes }: { decisoes: DecisoesAdmin | null }) {
  const total = decisoes?.total ?? 0;
  return (
    <section aria-labelledby="decisoes-titulo" className="mb-8" data-testid="admin-decisoes" data-total={total}>
      <h1 id="decisoes-titulo" className="font-title text-2xl font-semibold text-ink sm:text-[28px]">
        {tituloDecisoesAdmin(total)}
      </h1>
      {decisoes === null ? (
        <p className="mt-2 text-sm text-muted">Sem conexão com o banco: nenhuma fila para ler agora.</p>
      ) : decisoes.linhas.length === 0 ? (
        <p className="mt-2 text-sm text-muted">As filas estão em dia. Os números da plataforma seguem abaixo.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {decisoes.linhas.map((l) => (
            <li key={l.chave} className="flex flex-wrap items-center justify-between gap-3 py-3" data-precisa={l.chave} data-decisao={l.chave}>
              <span className="min-w-0">
                <Link href={l.href} className="font-semibold text-ink underline-offset-4 hover:text-forest hover:underline" data-href={l.href} data-valor={l.n}>
                  {l.texto}
                </Link>
                {l.detalhe && <span className="block text-sm text-muted">{l.detalhe}</span>}
              </span>
              <ButtonLink href={l.href} variant="secondary" size="sm" data-testid={`decisao-${l.chave}`}>
                {l.acao}
              </ButtonLink>
            </li>
          ))}
        </ul>
      )}
      {decisoes && avisoSemLeitura(decisoes.semLeitura) && (
        <p className="mt-2 text-xs text-muted" data-testid="admin-decisoes-sem-leitura">
          {avisoSemLeitura(decisoes.semLeitura)}
        </p>
      )}
    </section>
  );
}

/** O número-herói da tela: um só, grande (28 px, o teto), com o rótulo e o link para a lista. */
export function NumeroHeroi({
  rotulo,
  valor,
  href,
  nota,
  testId,
}: {
  rotulo: string;
  valor: string | number;
  href?: string | null;
  nota?: string | null;
  testId?: string;
}) {
  return (
    <div className="mb-6" data-testid={testId ?? "numero-heroi"}>
      <p className="text-sm text-muted">{rotulo}</p>
      {href ? (
        <Link href={href} className="font-title text-[28px] font-semibold leading-tight text-ink tabular-nums underline-offset-4 hover:text-forest hover:underline" data-valor data-href={href}>
          {valor}
        </Link>
      ) : (
        <p className="font-title text-[28px] font-semibold leading-tight text-ink tabular-nums" data-valor>
          {valor}
        </p>
      )}
      {nota && <p className="mt-1 text-xs text-muted">{nota}</p>}
    </div>
  );
}

export interface ItemNumero {
  rotulo: string;
  valor: string | number;
  href?: string | null;
  nota?: string | null;
  /** Atributos de teste/âncora da linha (ex.: data-indicador). */
  atributos?: Record<`data-${string}`, string | number | undefined>;
}

/** Números secundários em lista com divisores finos: rótulo à esquerda, número (link) à direita. */
export function ListaNumeros({ itens, className, testId }: { itens: ItemNumero[]; className?: string; testId?: string }) {
  return (
    <dl className={cn("divide-y divide-line border-y border-line", className)} data-testid={testId}>
      {itens.map((i) => (
        <div key={i.rotulo} className="flex items-baseline justify-between gap-4 py-3" {...i.atributos}>
          <dt className="min-w-0 text-sm text-ink">
            {i.rotulo}
            {i.nota && <span className="block text-xs text-muted">{i.nota}</span>}
          </dt>
          <dd className="shrink-0 font-semibold text-ink tabular-nums">
            {i.href ? (
              <Link href={i.href} className="underline-offset-4 hover:text-forest hover:underline" data-valor data-href={i.href}>
                {i.valor}
              </Link>
            ) : (
              <span data-valor>{i.valor}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Selo de estado: pill branca com texto (nunca bloco colorido). O tom só muda a cor do texto. */
export function SeloEstado({
  children,
  tom = "neutro",
  className,
  ...resto
}: {
  children: React.ReactNode;
  tom?: "neutro" | "ok" | "atencao" | "erro";
  className?: string;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, "children" | "className">) {
  const cor = { neutro: "text-ink", ok: "text-forest", atencao: "text-amber-800", erro: "text-red-700" }[tom];
  return (
    <span {...resto} className={cn("inline-flex items-center rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold", cor, className)}>
      {children}
    </span>
  );
}

/** Aviso da tela (sem conexão, migração pendente, confirmação): caixa branca com borda fina e um ícone. */
export function AvisoAdmin({
  children,
  tom = "atencao",
  className,
  ...resto
}: {
  children: React.ReactNode;
  tom?: "atencao" | "erro";
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className">) {
  return (
    <div {...resto} className={cn("flex items-start gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink", className)}>
      <AlertTriangle className={cn("mt-1 h-4 w-4 shrink-0", tom === "erro" ? "text-red-700" : "text-amber-700")} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
