/**
 * ADMIN-1 — a barra-alvo do admin (mockup admin-visao-geral) e a separação admin × usuário. Fonte ÚNICA (PURA,
 * testada em menu-admin.test.ts): em /admin* a barra mostra SÓ isto; em /dashboard* o admin vê as áreas de usuário e
 * um item "Painel admin". O <title> e o <h1> de cada página do /admin usam o rótulo daqui (tituloDoAdmin).
 */
import type { ItemMenu } from "./menu-por-papel.ts";

/** /admin/sistema ("Chaves e integrações") nasceu no ADMIN-3: o item aparece na barra. */
export const SISTEMA_DISPONIVEL = true;

const folha = (id: string, rotulo: string, href: string, icone: ItemMenu["icone"]): ItemMenu => ({ id, rotulo, href, icone });
const grupo = (id: string, rotulo: string, icone: ItemMenu["icone"], filhos: ItemMenu[]): ItemMenu => ({ id, rotulo, icone, filhos });

export const BARRA_ADMIN: readonly ItemMenu[] = [
  folha("admin-painel", "Visão geral", "/admin", "visao"),
  folha("admin-pendencias", "Pendências", "/admin/pendencias", "solicitacoes"),
  grupo("admin-anuncios-pessoas", "Anúncios e pessoas", "imoveis", [
    folha("admin-imoveis", "Anúncios", "/admin/imoveis", "imoveis"),
    folha("admin-ajuda-publicacao", "Publicamos para você", "/admin/ajuda-publicacao", "documentos"),
    folha("admin-pedidos", "Pedidos de moradia", "/admin/pedidos", "pedidos"),
    folha("admin-usuarios", "Usuários", "/admin/usuarios", "conta"),
    folha("admin-documentos", "Documentos", "/admin/documentos", "documentos"),
    folha("admin-fotos-perfil", "Fotos de perfil", "/admin/fotos-perfil", "fotografos"),
  ]),
  grupo("admin-estadias", "Estadias", "estadias", [
    folha("admin-contratos", "Contratos", "/admin/contratos", "contratos"),
    folha("admin-candidaturas", "Candidaturas", "/admin/candidaturas", "candidaturas"),
    folha("admin-solicitacoes", "Manutenção", "/admin/solicitacoes", "solicitacoes"),
    folha("admin-servicos", "Serviços do morador", "/admin/servicos", "ferramentas"),
    folha("admin-atendimento", "Atendimento", "/admin/atendimento", "atendimento"),
  ]),
  grupo("admin-rede", "Rede", "rede", [
    folha("admin-parceiros", "Parceiros", "/admin/parceiros", "parceiros"),
    folha("admin-avaliadores", "Avaliações do imóvel", "/admin/avaliadores", "parceiros"),
  ]),
  grupo("admin-cidades-marketing", "Cidades e marketing", "marketing", [
    folha("admin-cidades", "Cidades", "/admin/cidades", "pedidosCidade"),
    folha("admin-destinos", "Destinos", "/admin/destinos", "pedidosCidade"),
    folha("admin-marketing", "Marketing", "/admin/marketing", "marketing"),
  ]),
  grupo("admin-numeros", "Números", "dinheiro", [
    folha("admin-financeiro", "Financeiro", "/admin/financeiro", "financeiro"),
    folha("admin-funil", "Funil e indicadores", "/admin/funil", "simulador"),
    folha("admin-eventos", "Eventos", "/admin/eventos", "operacao"),
    folha("admin-qualidade", "Qualidade", "/admin/qualidade", "verificacao"),
  ]),
  grupo("admin-equipe", "Equipe", "agentes", [
    folha("admin-agentes", "Central de Agentes", "/admin/agentes", "agentes"),
    folha("admin-socios", "Caixa dos Sócios", "/admin/socios", "socios"),
  ]),
  grupo("admin-sistema", "Sistema", "ferramentas", [
    ...(SISTEMA_DISPONIVEL ? [folha("admin-sistema-chaves", "Chaves e integrações", "/admin/sistema", "ferramentas")] : []),
    folha("admin-retencao", "Dados e retenção", "/admin/retencao", "documentos"),
    folha("admin-dados-teste", "Testes", "/admin/dados-de-teste", "ferramentas"),
  ]),
];

/**
 * E216 — o admin observador da QA (profiles.qa_admin) não vê na barra o que não pode abrir: a Caixa dos Sócios é 404 para
 * ele (página, ações e RLS já fecham). Grupo que ficar vazio sai junto.
 */
export const FORA_DA_BARRA_OBSERVADOR: readonly string[] = ["/admin/socios"];

export function barraAdminPara(o: { observadorQa: boolean }): readonly ItemMenu[] {
  if (!o.observadorQa) return BARRA_ADMIN;
  const fora = (i: ItemMenu) => !!i.href && FORA_DA_BARRA_OBSERVADOR.includes(i.href);
  return BARRA_ADMIN.flatMap((i) => {
    if (!i.filhos) return fora(i) ? [] : [i];
    const filhos = i.filhos.filter((f) => !fora(f));
    return filhos.length ? [{ ...i, filhos }] : [];
  });
}

/** O rodapé da barra do admin leva de volta às áreas de usuário. */
// E176 (D3): "Minha conta" do admin leva à Conta (não ao Início do painel).
export const MINHA_CONTA_ADMIN = { rotulo: "Minha conta →", href: "/dashboard/conta" } as const;

/** Em /dashboard*, o admin vê UM item que leva à barra do admin. */
export const ITEM_PAINEL_ADMIN: ItemMenu = { id: "admin", rotulo: "Painel admin", icone: "admin", href: "/admin" };

/**
 * Rotas do /admin que não estão na barra — cada uma com o porquê (o teste exige que toda página do /admin esteja na
 * barra ou aqui). Nenhuma página foi apagada.
 */
export const FORA_DA_BARRA_ADMIN: Readonly<Record<string, string>> = {
  "/admin/avaliacoes": "redireciona para o filtro 'Avaliações contestadas' da Central de Pendências (ADMIN-2)",
  "/admin/conforto": "redireciona para a Central de Pendências (contestações de conforto)",
  "/admin/fotografos": "redireciona para a aba 'Fotógrafos' de Parceiros (ADMIN-2)",
  "/admin/emails-teste": "redireciona para a aba 'E-mails' de Testes (ADMIN-2)",
  "/admin/atendimento/[id]": "subpágina de Atendimento",
  "/admin/contratos/[id]": "subpágina de Contratos",
  "/admin/contratos/encerramentos": "subpágina de Contratos",
  "/admin/parceiros/pedidos": "subpágina de Parceiros",
  "/admin/parceiros/pedidos/[id]": "subpágina de Parceiros",
};

function folhasDe(itens: readonly ItemMenu[]): ItemMenu[] {
  return itens.flatMap((i) => (i.filhos ? folhasDe(i.filhos) : [i]));
}

/** As páginas da barra, na ordem. */
export const PAGINAS_BARRA_ADMIN: readonly ItemMenu[] = folhasDe(BARRA_ADMIN);

/** Rótulos das rotas que ainda não aparecem na barra mas já têm nome (ADMIN-3). */
const ROTULOS_EXTRAS: Readonly<Record<string, string>> = { "/admin/sistema": "Chaves e integrações" };

/** O rótulo da barra para esta rota do /admin (também o <h1> da página). */
export function rotuloDoAdmin(href: string): string {
  const r = PAGINAS_BARRA_ADMIN.find((i) => i.href === href)?.rotulo ?? ROTULOS_EXTRAS[href];
  if (!r) throw new Error(`rotuloDoAdmin: ${href} não está na barra do admin`);
  return r;
}

/** O <title> das páginas do /admin: "Rótulo — Admin" (o layout raiz completa com " · Viva Nomads"). */
export function tituloDoAdmin(href: string): string {
  return `${rotuloDoAdmin(href)} — Admin`;
}
