/*
  E1079 — as peças da Central → Avaliadores, como nos mockups aprovados (admin-avaliadores-novo, celular e
  computador): seção em cartão, linha de condição da chave, pílula de estado, cartão de pessoa (foto ou iniciais) e a
  tabela de preços limpa. Só apresentação; as cores e medidas do desenho vêm de @/lib/conta/visual-mockup.
*/
import type { ComponentProps, ReactNode } from "react";
import { Building2, Check, CircleDollarSign, FileText, FlaskConical, Home, House, ListChecks, SquarePen, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import type { TomPilula } from "@/lib/vistoria/central-cartoes";
import type { Porte } from "@/lib/vistoria/regras";
import {
  AVATAR_AVALIADORES,
  BOTAO_EDITAR_TABELA,
  CARTAO_AVALIADORES,
  CARTAO_PESSOA_AVALIADORES,
  FUNDO_PILULA,
  ICONE_CONDICAO,
  ICONE_TABELA_AVALIADORES,
  ICONE_TITULO_AVALIADORES,
  LINHA_TABELA_AVALIADORES,
  NOME_PESSOA_AVALIADORES,
  PILULA_ADMIN,
  PILULA_ESTADO,
  SECAO_SOLTA_AVALIADORES,
  SUBTITULO_TELA_AVALIADORES,
  TITULO_CARTAO_AVALIADORES,
  TITULO_SECAO_AVALIADORES,
  TITULO_TELA_AVALIADORES,
  VALOR_TABELA_AVALIADORES,
} from "@/lib/conta/visual-mockup";

const ICONES_TITULO = { chave: ListChecks, pessoas: Users, precos: CircleDollarSign, piloto: FlaskConical } as const;
const ICONES_PORTE: Record<Porte, typeof Home> = { estudio: Home, q1_2: House, q3_mais: Building2 };

/** Título da tela: grande, com a pílula "Admin" ao lado no celular e o subtítulo no computador. */
export function TituloCentral({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={TITULO_TELA_AVALIADORES}>{titulo}</h1>
        <span className={PILULA_ADMIN}>Admin</span>
      </div>
      {subtitulo && <p className={SUBTITULO_TELA_AVALIADORES}>{subtitulo}</p>}
    </div>
  );
}

/** Seção em cartão, com o título dentro. `solta`: no celular fica só o título e os cartões dos itens (Credenciamento). */
export function Secao({ titulo, icone, solta = false, className, children, ...resto }: { titulo: string; icone: keyof typeof ICONES_TITULO; solta?: boolean } & Omit<ComponentProps<"section">, "title">) {
  const Icone = ICONES_TITULO[icone];
  return (
    <section className={cn("min-w-0", solta ? SECAO_SOLTA_AVALIADORES : CARTAO_AVALIADORES, className)} {...resto}>
      <div className="mb-4 flex items-center gap-3">
        <span className={ICONE_TITULO_AVALIADORES} aria-hidden>
          <Icone className="h-6 w-6" />
        </span>
        <h2 className={solta ? cn(TITULO_SECAO_AVALIADORES, "lg:text-xl 2xl:text-2xl") : TITULO_CARTAO_AVALIADORES}>{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

/** Pílula de estado com fundo de cor (só nesta área, pelo desenho). */
export function PilulaEstado({ tom, className, children, ...resto }: { tom: TomPilula } & ComponentProps<"span">) {
  return (
    <span className={cn(PILULA_ESTADO, FUNDO_PILULA[tom], className)} data-tom={tom} {...resto}>
      {children}
    </span>
  );
}

/** Uma condição da chave: ícone do estado, o rótulo e a pílula. O motivo segue no texto da linha (leitor de tela e travas). */
export function LinhaCondicao({ id, ok, rotulo, pilula, tom, detalhe }: { id: string; ok: boolean; rotulo: string; pilula: string; tom: TomPilula; detalhe: string }) {
  return (
    <li className="flex items-center gap-3" data-testid={`condicao-${id}`} data-ok={ok ? "sim" : "nao"}>
      <span className={ICONE_CONDICAO[tom]} aria-hidden>
        {tom === "ok" ? <Check className="h-4 w-4" strokeWidth={3} /> : tom === "atencao" ? "!" : <FileText className="h-6 w-6" />}
      </span>
      <span className="min-w-0 flex-1 text-[15px] text-ink lg:text-sm">
        {rotulo}
        <span className="sr-only">: {detalhe}</span>
      </span>
      <PilulaEstado tom={tom}>{pilula}</PilulaEstado>
    </li>
  );
}

/** Cartão de uma pessoa: a foto de perfil da conta (ou as iniciais), o nome, uma linha de apoio e a pílula do estado. */
export function CartaoPessoa({
  nome,
  linha,
  fotoUrl,
  pilula,
  tom = "pendente",
  pilulaTestid,
  className,
  children,
  ...resto
}: { nome: string; linha: ReactNode; fotoUrl?: string; pilula?: string; tom?: TomPilula; pilulaTestid?: string } & ComponentProps<"li">) {
  return (
    <li className={cn("min-w-0", CARTAO_PESSOA_AVALIADORES, className)} {...resto}>
      {/* Celular: foto, nome e a pílula à direita. Computador: a pílula desce para baixo do nome, como no desenho. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        <span className="lg:row-span-2">
          <Avatar name={nome} size={56} photoUrl={fotoUrl} className={AVATAR_AVALIADORES} />
        </span>
        <div className="min-w-0">
          <p className={NOME_PESSOA_AVALIADORES}>{nome}</p>
          <p className="mt-1 break-words text-sm text-muted">{linha}</p>
        </div>
        {pilula && (
          <PilulaEstado tom={tom} data-testid={pilulaTestid} className="lg:col-start-2 lg:mt-2 lg:justify-self-start">
            {pilula}
          </PilulaEstado>
        )}
      </div>
      {children && <div className="mt-4 min-w-0 border-t border-line pt-4 text-sm [overflow-wrap:anywhere]">{children}</div>}
    </li>
  );
}

/** A tabela de preços limpa de uma cidade: os 3 portes e o valor vigente. "Editar tabela" leva ao formulário. */
export function TabelaLimpa({ cidade, linhas, editarHref }: { cidade: string; linhas: { porte: Porte; rotulo: string; valor: string }[]; editarHref?: string }) {
  return (
    <Secao titulo={`Tabela de preços — ${cidade}`} icone="precos" data-testid="precos-limpa" data-cidade={cidade}>
      <ul>
        {linhas.map((l) => {
          const Icone = ICONES_PORTE[l.porte];
          return (
            <li key={l.porte} className={LINHA_TABELA_AVALIADORES} data-porte={l.porte}>
              <Icone className={ICONE_TABELA_AVALIADORES} aria-hidden />
              <span className="min-w-0 flex-1 text-base text-ink">{l.rotulo}</span>
              <span className={VALOR_TABELA_AVALIADORES}>{l.valor}</span>
            </li>
          );
        })}
      </ul>
      {editarHref && (
        <a href={editarHref} className={BOTAO_EDITAR_TABELA}>
          <SquarePen className="h-4 w-4" aria-hidden />
          Editar tabela
        </a>
      )}
    </Secao>
  );
}
