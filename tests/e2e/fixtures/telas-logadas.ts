import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Telas logadas (src/app/(dashboard)/**\/page.tsx) que o t183 percorre a 390 e 1280 px.
 * Lista ESTÁTICA de propósito (a ordem e as subtelas ficam visíveis no código), com uma guarda:
 * `telasForaDaLista()` compara com o disco e acusa tela nova esquecida ou tela da lista que não existe mais.
 * Roda no `npm test` (tests/laboratorio/telas-logadas.test.ts) e no próprio t183.
 */
export const TELAS_PAINEL = [
  "/dashboard",
  "/dashboard/agenda",
  "/dashboard/assinatura",
  "/dashboard/avaliacoes",
  "/dashboard/buscas",
  "/dashboard/candidaturas",
  "/dashboard/carteira",
  "/dashboard/comparar",
  "/dashboard/conta",
  "/dashboard/conta/seguranca",
  "/dashboard/contratos",
  "/dashboard/favoritos",
  "/dashboard/fechamento",
  "/dashboard/ferramentas",
  "/dashboard/garantias",
  "/dashboard/imoveis",
  "/dashboard/imoveis/novo",
  "/dashboard/indicacoes",
  "/dashboard/leads",
  "/dashboard/locacoes",
  "/dashboard/mensagens",
  "/dashboard/notificacoes",
  "/dashboard/orcamentos",
  "/dashboard/orcamentos/nova",
  "/dashboard/pedidos",
  "/dashboard/pedidos-cidade",
  "/dashboard/propostas",
  "/dashboard/reembolsos",
  "/dashboard/roi-imovel",
  "/dashboard/simulador",
  "/dashboard/tributacao",
  "/dashboard/servicos",
  "/dashboard/parceiro",
  "/dashboard/solicitacoes",
  "/dashboard/verificacao",
  "/dashboard/viabilidade",
  "/dashboard/visitas",
  "/qualificar",
] as const;

/** Só o admin abre (os outros papéis seriam só redirecionados). */
export const TELAS_ADMIN = [
  "/admin",
  "/admin/agentes",
  "/admin/atendimento",
  "/admin/avaliacoes",
  "/admin/documentos",
  "/admin/emails-teste",
  "/admin/financeiro",
  "/admin/fotografos",
  "/admin/marketing",
  "/admin/parceiros",
  "/admin/parceiros/pedidos",
  "/admin/servicos",
  "/admin/ajuda-publicacao",
  "/admin/cidades",
  "/admin/destinos",
  "/admin/conforto",
  "/admin/pendencias",
  "/admin/retencao",
  "/admin/dados-de-teste",
  "/admin/pedidos",
  "/admin/socios",
  "/admin/usuarios",
  "/admin/imoveis",
  "/admin/contratos",
  "/admin/contratos/encerramentos",
  "/admin/solicitacoes",
  "/admin/candidaturas",
  "/admin/eventos",
] as const;

/**
 * Rotas com parâmetro: ou ficam de fora (precisam de um registro que a persona pode não ter) ou entram com os
 * valores conhecidos (subtelas da Conta no app, `conta/[secao]/page.tsx`).
 */
export const ROTAS_COM_PARAMETRO: Record<string, readonly string[]> = {
  "/admin/atendimento/[id]": [],
  "/admin/contratos/[id]": [],
  "/admin/parceiros/pedidos/[id]": [],
  "/dashboard/contratos/[id]": [],
  "/dashboard/estadia/[contratoId]": [],
  "/dashboard/estadia/[contratoId]/alteracao": [],
  "/dashboard/estadia/[contratoId]/confirmada": [],
  "/dashboard/estadia/[contratoId]/encerrar": [],
  "/dashboard/estadia/[contratoId]/ocupantes": [],
  "/dashboard/imoveis/[id]/cartao": [],
  "/dashboard/imoveis/[id]/parceiros": [],
  "/dashboard/imoveis/[id]/conforto": [],
  "/dashboard/imoveis/[id]/nivel": [],
  "/dashboard/imoveis/[id]/editar": [],
  "/dashboard/locacoes/[id]": [],
  "/dashboard/propostas/[id]": [],
  "/dashboard/servicos/pedidos/[id]": [],
  "/dashboard/conta/[secao]": ["/dashboard/conta/perfil", "/dashboard/conta/notificacoes", "/dashboard/conta/ajuda"],
};

/** Telas que cada persona visita (o admin também abre o painel comum). */
export function telasDaPersona(persona: "inquilino" | "proprietario" | "admin"): string[] {
  const comParametro = Object.values(ROTAS_COM_PARAMETRO).flat();
  const comuns = [...TELAS_PAINEL, ...comParametro];
  return persona === "admin" ? [...comuns, ...TELAS_ADMIN] : comuns;
}

function varrer(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) varrer(p, acc);
    else if (nome === "page.tsx") acc.push(p);
  }
  return acc;
}

/** Rotas do grupo (dashboard) como aparecem na URL (mesma conversão do scripts/lab/gerar-cobertura.mjs). */
export function telasDoDisco(raiz = process.cwd()): string[] {
  const app = join(raiz, "src", "app");
  return varrer(join(app, "(dashboard)"))
    .map((p) => "/" + relative(app, p).split(sep).join("/").replace(/\/?page\.tsx$/, ""))
    .map((r) => r.replace(/\/\([^)]+\)/g, "").replace(/^\(dashboard\)/, "") || "/")
    .sort();
}

/** `faltando`: tela no disco que não está na lista; `sobrando`: tela da lista que não existe mais no disco. */
export function telasForaDaLista(raiz = process.cwd()): { faltando: string[]; sobrando: string[] } {
  const disco = telasDoDisco(raiz);
  const conhecidas = new Set<string>([...TELAS_PAINEL, ...TELAS_ADMIN, ...Object.keys(ROTAS_COM_PARAMETRO)]);
  const noDisco = new Set(disco);
  return {
    faltando: disco.filter((r) => !conhecidas.has(r)),
    sobrando: [...conhecidas].filter((r) => !noDisco.has(r)),
  };
}
