/*
  Massa de teste (ordem 7436a29a, item 6): o inventário do que o seed cria.
  Códigos fixos = o QA sempre acha o mesmo item. Tudo aqui é de conta is_teste,
  então chamado nasce com simulacao = true (não avisa equipe nem dispara SLA).
  A tabela de docs/massa-de-teste.md é conferida contra este arquivo por teste unitário.
*/

export const PROD_HOST = "vivanomads.com.br";

/** Contas lidas do ambiente (TESTES_<CHAVE>_EMAIL/_SENHA/_NOME); o e-mail nunca fica no código. */
export const CONTAS = [
  { chave: "INQUILINO", papel: "tenant", obrigatoria: true },
  { chave: "INQUILINO2", papel: "tenant", obrigatoria: false },
  { chave: "PROPRIETARIO", papel: "owner", obrigatoria: true },
  { chave: "ADMIN", papel: "admin", obrigatoria: true },
];

export const IMOVEIS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    dono: "PROPRIETARIO",
    titulo: "Studio mobiliado — conta de teste (E2E)",
    preco: 3200,
  },
  {
    id: "11111111-1111-4111-8111-111111111112",
    dono: "PROPRIETARIO",
    titulo: "Apartamento mobiliado — conta de teste (QA)",
    preco: 4500,
  },
];

/** Chamados de teste, cada um com um estado diferente para o QA conferir lista, filtro e prazo. */
export const CHAMADOS = [
  { id: "22222222-2222-4222-8222-222222222201", autor: "INQUILINO", assunto: "[Teste] Chamado aberto, sem resposta", status: "aberto", prioridade: "p3" },
  { id: "22222222-2222-4222-8222-222222222202", autor: "INQUILINO", assunto: "[Teste] Chamado em andamento", status: "em_andamento", prioridade: "p2" },
  { id: "22222222-2222-4222-8222-222222222203", autor: "PROPRIETARIO", assunto: "[Teste] Chamado resolvido", status: "resolvido", prioridade: "p4" },
];

/**
  Contratos de teste (ordem 7436a29a, item 6, parte 2): um por estado, todos do INQUILINO. Os dois "ativo" ficam em
  imóveis diferentes (a trava de sobreposição não deixa dois ativos no mesmo período). Datas relativas a hoje.
  dias = deslocamento do início em relação a hoje; assinado = quem já assinou.
*/
export const CONTRATOS = [
  { id: "33333333-3333-4333-8333-333333333301", imovel: "11111111-1111-4111-8111-111111111111", estado: "aguardando assinatura", status: "ativo", dias: 30, meses: 2, assinado: [] },
  { id: "33333333-3333-4333-8333-333333333302", imovel: "11111111-1111-4111-8111-111111111112", estado: "assinado pelas duas partes", status: "ativo", dias: 7, meses: 2, assinado: ["proprietario", "inquilino"] },
  { id: "33333333-3333-4333-8333-333333333303", imovel: "11111111-1111-4111-8111-111111111111", estado: "concluído", status: "concluido", dias: -120, meses: 2, assinado: ["proprietario", "inquilino"] },
];

/** O seed só roda em projeto de teste. */
export function hostProibido(url) {
  return String(url ?? "").includes(PROD_HOST);
}
