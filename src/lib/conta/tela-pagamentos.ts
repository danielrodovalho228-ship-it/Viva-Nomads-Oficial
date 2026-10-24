/*
  A7 — Conta › Pagamentos (mockup perfil-07): os textos dos dois cartões.
  A plataforma não toca em dinheiro: o proprietário recebe o valor mensal direto na chave Pix dele, e o morador paga
  direto ao proprietário. "Adicionar cartão" aparece como no desenho, mas não há cadastro nem cobrança de cartão
  (decisão de 24/10: Pagamentos segue o mockup, nenhuma cobrança é ativada).
*/
export const TITULO_RECEBE = "Como você recebe (proprietário)";
export const NOTA_RECEBE = "O pagamento do morador vai direto para você — a Viva não fica com o seu dinheiro.";
export const TITULO_MORADOR = "Para suas estadias (morador)";
export const SEM_CARTAO = "Nenhum cartão cadastrado";
export const NOTA_MORADOR =
  "Você paga o valor mensal direto ao proprietário, nos dados que estão no contrato. A Viva não recebe esse valor e ainda não guarda cartão.";

/* E70 (QA 24/10): o cartão não é cadastrado nem cobrado — estado honesto, sem botão morto. */
export const CARTAO_EM_BREVE = "Pagamento com cartão: em breve.";
export const AVISE_CARTAO = "Avise-me quando estiver disponível";
export const AVISO_CARTAO_GRAVADO = "Avisaremos você quando abrir.";

/* E70: o terceiro cartão, do parceiro. Enquanto o pagamento de parceiros pela plataforma está desligado, é informativo. */
export const TITULO_PARCEIRO = "Como você recebe (parceiro)";
export const NOTA_PARCEIRO =
  "Os serviços são pagos direto a você: 90% ficam com você e 10% são a taxa de serviço da Viva. O recibo ou a nota é emitido por você.";
export const CONVITE_PARCEIRO = "Ofereça serviços para moradores e proprietários e receba direto.";
export const BOTAO_PARCEIRO = "Cadastrar meu serviço";
export const BOTAO_PARCEIRO_ATIVO = "Abrir meu painel de parceiro";

/* Extra do E70 (aprovado 24/10): a dica do "Salvar chave" enquanto o campo está vazio. */
export const DICA_SALVAR_CHAVE = "Preencha a chave para salvar.";
