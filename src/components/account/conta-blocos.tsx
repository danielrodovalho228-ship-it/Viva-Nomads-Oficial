"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Clock, Eye, KeyRound, Briefcase, Mail, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { useViewMode } from "@/lib/roles";
import { useDisplayUser } from "@/lib/demo/demo-mode";
import { createClient } from "@/lib/supabase/client";
import { getMeusDados } from "@/lib/data/perfil-actions";
import { getTelefoneEstado } from "@/lib/data/telefone-actions";
import { CategoriaProfissional } from "./categoria-profissional";
import { cn } from "@/lib/utils";

/**
 * Conta em 4 blocos (prompt 18): 1. Perfil público · 2. Dados da conta · 3. Confiança e segurança · 4. Preferências.
 * Cada assunto aparece UMA vez; o que já tem tela própria (senha e duas etapas) vira uma linha com link.
 */
export function BlocoConta({ id, numero, titulo, subtitulo, children }: { id: string; numero: number; titulo: string; subtitulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24 first:mt-6" data-testid={`bloco-${id}`} aria-labelledby={`${id}-titulo`}>
      <div className="flex items-baseline gap-2 border-b border-sage-200 pb-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest text-xs font-bold text-white" aria-hidden>
          {numero}
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-titulo`} className="font-title text-xl font-bold text-ink">
            {titulo}
          </h2>
          <p className="text-sm text-muted">{subtitulo}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Inquilino: profissão (sinal que o proprietário vê no cartão do candidato). */
export function PerfilProfissional() {
  const { mode } = useViewMode();
  if (mode !== "tenant") return null;
  return (
    <Panel title="Perfil profissional" className="mt-6">
      <p className="text-sm text-muted">Ajuda o proprietário a conhecer você. Complementa a verificação de identidade, não a substitui.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CategoriaProfissional />
      </div>
    </Panel>
  );
}

/** "Ver como os outros veem": proprietário abre a página pública; inquilino vê o cartão de candidato. */
export function VerComoOutrosVeem() {
  const user = useDisplayUser();
  const { mode } = useViewMode();
  const [aberto, setAberto] = useState(false);
  if (!user) return null;
  if (mode !== "tenant") {
    return (
      <Link
        href={`/proprietario/${user.id}`}
        target="_blank"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest underline underline-offset-2"
        data-testid="ver-como-outros-veem"
      >
        <Eye className="h-4 w-4" aria-hidden /> Ver como os outros veem
      </Link>
    );
  }
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-forest underline underline-offset-2"
        data-testid="ver-como-outros-veem"
      >
        <Eye className="h-4 w-4" aria-hidden /> Ver como os outros veem
      </button>
      {aberto && (
        <div className="mt-3 rounded-xl border border-sage-200 bg-surface-2 p-4 text-sm text-ink" data-testid="previa-candidato">
          <p>
            <strong>Antes do aceite</strong>, o proprietário vê &quot;Candidato(a)&quot;, sem nome nem foto: só a sua profissão, o motivo da
            estadia e os selos de confiança.
          </p>
          <p className="mt-2">
            <strong>Depois do aceite</strong>, ele vê o seu primeiro nome, a inicial do sobrenome e a foto. Telefone e e-mail nunca aparecem.
          </p>
        </div>
      )}
    </div>
  );
}

type Situacao = "ok" | "falta" | "em_breve";
interface ItemConfianca {
  chave: string;
  icone: React.ComponentType<{ className?: string }>;
  rotulo: string;
  situacao: Situacao;
  detalhe: string;
  acao?: { texto: string; href: string };
}

/**
 * Lista ÚNICA de confiança e segurança (prompt 18): e-mail, celular, identidade, LinkedIn, duas etapas e senha —
 * cada item uma vez. O item "Verificação" do menu aponta para cá (#confianca).
 */
export function ConfiancaLista() {
  const { mode } = useViewMode();
  const [emailOk, setEmailOk] = useState<boolean | null>(null);
  const [celular, setCelular] = useState<{ disponivel: boolean; verificado: boolean } | null>(null);
  const [linkedin, setLinkedin] = useState<boolean | null>(null);
  const [duasEtapas, setDuasEtapas] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    const sb = createClient();
    if (sb) {
      void sb.auth.getUser().then(({ data }) => vivo && setEmailOk(Boolean(data.user?.email_confirmed_at)));
      void sb.auth.mfa
        .listFactors()
        .then(({ data }) => vivo && setDuasEtapas(Boolean(data?.totp?.some((f) => f.status === "verified"))))
        .catch(() => {});
    }
    getTelefoneEstado()
      .then((e) => vivo && e && setCelular({ disponivel: e.disponivel, verificado: e.verificado }))
      .catch(() => {});
    getMeusDados()
      .then((d) => vivo && d && setLinkedin(Boolean(d.linkedin)))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const itens: ItemConfianca[] = [
    {
      chave: "email",
      icone: Mail,
      rotulo: "E-mail",
      situacao: emailOk ? "ok" : "falta",
      detalhe: emailOk ? "Confirmado" : "Confirme pelo link que enviamos",
    },
    {
      chave: "celular",
      icone: Smartphone,
      rotulo: "Celular",
      situacao: celular?.verificado ? "ok" : celular && !celular.disponivel ? "em_breve" : "falta",
      detalhe: celular?.verificado ? "Verificado por SMS" : celular && !celular.disponivel ? "Em breve" : "Não verificado (opcional)",
      acao: celular?.verificado || (celular && !celular.disponivel) ? undefined : { texto: "Verificar", href: "#celular" },
    },
    {
      chave: "identidade",
      icone: UserCheck,
      rotulo: "Identidade",
      situacao: "em_breve",
      detalhe: "Em breve, por meio de um parceiro",
      acao: { texto: "Saber mais", href: "/dashboard/verificacao" },
    },
    ...(mode === "tenant"
      ? [
          {
            chave: "linkedin",
            icone: Briefcase,
            rotulo: "LinkedIn",
            situacao: (linkedin ? "ok" : "falta") as Situacao,
            detalhe: linkedin ? "Informado" : "Opcional",
            acao: linkedin ? undefined : { texto: "Adicionar", href: "#dados" },
          },
        ]
      : []),
    {
      chave: "duas-etapas",
      icone: ShieldCheck,
      rotulo: "Verificação em duas etapas",
      situacao: duasEtapas ? "ok" : "falta",
      detalhe: duasEtapas ? "Ativa" : "Desativada",
      acao: { texto: duasEtapas ? "Gerenciar" : "Ativar", href: "/dashboard/conta/seguranca" },
    },
    {
      chave: "senha",
      icone: KeyRound,
      rotulo: "Senha",
      situacao: "ok",
      detalhe: "Troque quando quiser",
      acao: { texto: "Alterar senha", href: "/dashboard/conta/seguranca" },
    },
  ];

  return (
    <Panel className="mt-6" data-testid="confianca-lista">
      <ul className="divide-y divide-sage-200">
        {itens.map((i) => (
          <li key={i.chave} className="flex items-center gap-3 py-3" data-testid={`confianca-${i.chave}`} data-situacao={i.situacao}>
            <i.icone className="h-5 w-5 shrink-0 text-sage" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{i.rotulo}</p>
              <p className={cn("flex items-center gap-1 text-xs", i.situacao === "ok" ? "text-forest" : "text-muted")}>
                {i.situacao === "ok" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                ) : i.situacao === "em_breve" ? (
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Circle className="h-3.5 w-3.5" aria-hidden />
                )}
                {i.detalhe}
              </p>
            </div>
            {i.acao && (
              <Link href={i.acao.href} className="shrink-0 text-sm font-medium text-forest underline underline-offset-2">
                {i.acao.texto}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
