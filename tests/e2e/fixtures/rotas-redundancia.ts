import { readFileSync } from "node:fs";
import type { Massa } from "./varredura";

/*
  Rotas da varredura de redundância (t337), por persona: as páginas fixas do mapa de cobertura mais as rotas com id da
  massa da varredura.

  E744 (15/11/2026): a LISTA DE TESTES (quantidade e títulos) não pode depender da massa. O job `construir` da noturna
  lista os testes do commit sem tests/laboratorio/saida/varredura.json (o arquivo só nasce no seed de cada fatia); quando o
  t337 montava os grupos com esse arquivo, a listagem tinha 24 testes e a fatia rodava 27, com títulos diferentes: 4 "não
  executados" falsos em toda rodada. Por isso o spec monta os grupos com MASSA_DE_LISTAGEM (ids fictícios, mesma quantidade
  de rotas) e só troca pelos ids de verdade dentro do teste. Guarda: tests/laboratorio/e744-infra-da-suite.test.ts.
*/
export type PersonaDaRedundancia = "publico" | "inquilino" | "proprietario" | "admin" | "parceiro";
export const PERSONAS_DA_REDUNDANCIA: PersonaDaRedundancia[] = ["publico", "inquilino", "proprietario", "admin", "parceiro"];

/** Telas por teste (cada teste abre o grupo inteiro a 390 e 1280 px). */
export const TELAS_POR_TESTE = 8;

const SECOES_CONTA = ["perfil", "seguranca", "notificacoes", "ajuda", "perfil-publico", "pagamentos", "excluir"];
const COM_ID: Record<PersonaDaRedundancia, (m: Massa) => string[]> = {
  publico: (m) => [`/imoveis/${m.imovel17}`, `/proprietario/${m.ids.DONO17}`, "/cidades/uberlandia"],
  inquilino: (m) => [`/dashboard/estadia/${m.contrato}`, ...SECOES_CONTA.map((s) => `/dashboard/conta/${s}`)],
  proprietario: (m) => [
    "/dashboard/imoveis/novo",
    `/dashboard/imoveis/${m.imovel17}/editar`,
    `/dashboard/imoveis/${m.imovel17}/nivel`,
    `/dashboard/imoveis/${m.imovel17}/conforto`,
    `/dashboard/imoveis/${m.imovel17}/desempenho`,
    `/dashboard/estadia/${m.contrato}`,
    `/dashboard/estadia/${m.contrato}/mensagens`,
    ...SECOES_CONTA.map((s) => `/dashboard/conta/${s}`),
  ],
  admin: (m) => [`/admin/contratos/${m.contrato}`],
  parceiro: () => [],
};

/** Ids fictícios, todos diferentes, só para LISTAR: dão a mesma quantidade de rotas que a massa de verdade. */
export const MASSA_DE_LISTAGEM: Massa = {
  ids: { DONO17: ":dono17", DONO0: ":dono0", INQUILINA: ":inquilina", PARCEIRO: ":parceiro", TRES: ":tres" },
  imovel17: ":imovel17",
  rascunho1: ":rascunho1",
  rascunho0: ":rascunho0",
  imovelTres: ":imovel-tres",
  contrato: ":contrato",
  contratoTres: ":contrato-tres",
  parceiro: ":parceiro-id",
  parceiroTres: ":parceiro-tres",
};

/** Rota montada com a massa de listagem (não dá para abrir: precisa do id de verdade). */
export const ehRotaDeListagem = (rota: string) => rota.includes("/:");

/** Todas as rotas da persona: as fixas do mapa de cobertura (sem "[id]") e, depois, as rotas com id da massa. */
export function rotasDaRedundancia(persona: PersonaDaRedundancia, m: Massa): string[] {
  const c = JSON.parse(readFileSync("tests/e2e/cobertura.json", "utf8")) as { paginas: Record<string, { personas: string[] }> };
  const fixas = Object.entries(c.paginas)
    .filter(([r, v]) => v.personas.includes(persona) && !r.includes("["))
    .map(([r]) => r);
  return [...new Set([...fixas, ...COM_ID[persona](m)])];
}

/** As rotas da persona em grupos de TELAS_POR_TESTE: um grupo = um teste. */
export function gruposDaRedundancia(persona: PersonaDaRedundancia, m: Massa): string[][] {
  const rotas = rotasDaRedundancia(persona, m);
  const grupos: string[][] = [];
  for (let g = 0; g * TELAS_POR_TESTE < rotas.length; g++) grupos.push(rotas.slice(g * TELAS_POR_TESTE, (g + 1) * TELAS_POR_TESTE));
  return grupos;
}

/** Título do teste do grupo `g` (base 0). É a chave do teste na conferência de completude: não muda com a massa. */
export const tituloDoGrupo = (persona: PersonaDaRedundancia, g: number, telas: number) => `${persona} ${g + 1}: ${telas} telas`;
