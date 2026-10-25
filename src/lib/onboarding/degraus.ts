/*
  Perfil progressivo em 4 degraus (Prompt 43, adendo de onboarding, item 1) — PURO.
  Cada degrau é pedido só quando é usado, com uma linha de "para que serve":
    1. e-mail (entrada);
    2. nome + foto + intenção (primeiro momento de valor);
    3. telefone (primeiro contato real; sem SMS e sem travar nada);
    4. identidade (só na transação: depois do pré-aceite, antes do contrato — fluxo vigente da verificação).
  O Perfil mostra os 4 em lista com o estado ("Feito", "Pedido quando você fechar um contrato"), sem barra de progresso.
  Roda: node --test src/lib/onboarding/degraus.test.ts
*/

export interface FatosDegraus {
  emailConfirmado: boolean;
  temNome: boolean;
  temFoto: boolean;
  temTelefone: boolean;
  identidadeConfirmada: boolean;
}

export interface Degrau {
  id: "email" | "basico" | "telefone" | "identidade";
  titulo: string;
  paraQue: string;
  feito: boolean;
  /** "Feito" ou quando ele é pedido. */
  estado: string;
  acao: { rotulo: string; href: string } | null;
}

export function degrausPerfil(f: FatosDegraus): Degrau[] {
  const basico = f.temNome && f.temFoto;
  return [
    {
      id: "email",
      titulo: "E-mail",
      paraQue: "Para entrar e receber os avisos.",
      feito: f.emailConfirmado,
      estado: f.emailConfirmado ? "Feito" : "Confirme pelo link que enviamos",
      acao: null,
    },
    {
      id: "basico",
      titulo: "Nome e foto",
      paraQue: "Para quem recebe seu pedido ou sua proposta saber quem é você.",
      feito: basico,
      estado: basico ? "Feito" : "Pedido no seu primeiro pedido ou anúncio",
      acao: basico ? null : { rotulo: "Completar agora", href: "/dashboard/conta/perfil" },
    },
    {
      id: "telefone",
      titulo: "Telefone",
      paraQue: "Para o primeiro contato real com a outra parte. Não trava nada.",
      feito: f.temTelefone,
      estado: f.temTelefone ? "Feito" : "Pedido no primeiro contato",
      acao: f.temTelefone ? null : { rotulo: "Informar agora", href: "/dashboard/conta/dados" },
    },
    {
      id: "identidade",
      titulo: "Identidade",
      paraQue: "Para assinar o contrato. Só depois do pré-aceite.",
      feito: f.identidadeConfirmada,
      estado: f.identidadeConfirmada ? "Feito" : "Pedido quando você fechar um contrato",
      acao: null,
    },
  ];
}
