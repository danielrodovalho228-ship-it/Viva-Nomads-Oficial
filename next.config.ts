import type { NextConfig } from "next";

// Laboratório de testes: o modo simulado (nada sai para a rede) NUNCA pode ir
// para produção. Com a chave ligada num build de produção da Vercel, o build falha.
const LABORATORIO = process.env.INTEGRACOES_SIMULADAS === "on";
const APICE = "https://vivanomads.com.br";
const WWW = { type: "host" as const, value: "www.vivanomads.com.br" };
if (LABORATORIO && process.env.VERCEL_ENV === "production") {
  throw new Error("INTEGRACOES_SIMULADAS=on é só para o laboratório de testes — nunca em produção.");
}

/**
 * E1095 (ORDEM-DUET-451) — a política de conteúdo (CSP) do site, APLICADA pelo navegador. Antes ia como
 * "Content-Security-Policy-Report-Only": o navegador só registrava o que ela bloquearia.
 *
 * Cada origem de fora está aqui porque uma tela a usa:
 *  - Supabase (a origem de NEXT_PUBLIC_SUPABASE_URL): dados, sessão, fotos, vídeos e PDFs do armazenamento. Em produção
 *    é *.supabase.co; no laboratório é o Supabase local (http://127.0.0.1…), que a política antiga não cobria — por
 *    isso ela só podia observar: aplicada como estava, o laboratório inteiro parava;
 *  - Mapbox (mapa e geocodificação), ViaCEP e BrasilAPI (CEP), Cloudflare Turnstile (captcha);
 *  - speed.cloudflare.com: a medição de internet no navegador (@cloudflare/speedtest) baixa e envia para lá;
 *  - YouTube e Vimeo: o vídeo do imóvel por link.
 * 'unsafe-inline' cobre o bootstrap do Next; endurecer com nonce é um próximo passo. 'unsafe-eval' só no
 * desenvolvimento (hot reload): em produção o Next não usa eval e o mapbox-gl roda em worker blob:.
 */
function politicaDeConteudo(): string {
  const producao = process.env.NODE_ENV === "production";
  let supabase: string | null = null;
  try {
    supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null;
  } catch {
    supabase = null;
  }
  // O armazenamento e a API do Supabase: o domínio do serviço e, se for outro (laboratório, domínio próprio), a origem configurada.
  const supabaseFora = supabase && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabase) ? ` ${supabase}` : "";
  const armazenamento = `https://*.supabase.co${supabaseFora}`;
  // Só nas prévias da Vercel: a barra de comentários da própria Vercel (vercel.live). Em produção ela não existe.
  const previa = process.env.VERCEL_ENV === "preview";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // (As linhas de img-src e connect-src começam por texto simples de propósito: a guarda do mapa lê-as assim.)
    "img-src 'self' data: blob: https:" + supabaseFora,
    `font-src 'self' data:${previa ? " https://vercel.live https://assets.vercel.com" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline' ${producao ? "" : "'unsafe-eval' "}https://challenges.cloudflare.com${previa ? " https://vercel.live" : ""}`,
    "worker-src 'self' blob:",
    "connect-src 'self' " + armazenamento + " https://api.mapbox.com https://events.mapbox.com https://viacep.com.br https://brasilapi.com.br https://speed.cloudflare.com" + (previa ? " https://vercel.live wss://ws-us3.pusher.com" : ""),
    // Vídeo e áudio: os do próprio site, a prévia local (blob:) e os arquivos do armazenamento (vídeo do imóvel, áudio da caixa dos sócios).
    `media-src 'self' blob: ${armazenamento}`,
    // Quadros: vídeo por link, captcha e o PDF do armazenamento que o admin confere (documentos e matrículas).
    `frame-src 'self' https://player.vimeo.com https://www.youtube.com https://challenges.cloudflare.com ${armazenamento}${previa ? " https://vercel.live" : ""}`,
  ].join("; ");
}

const nextConfig: NextConfig = {
  // Não anuncia o framework no header (higiene) e reduz JS: só os ícones usados
  // do lucide-react entram no bundle (tree-shaking do pacote).
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // Conferência de entrada/saída sobe laudo (até 15 MB) e foto (até 8 MB) por Server Action; o padrão do Next é 1 MB.
    serverActions: { bodySizeLimit: "16mb" },
  },
  images: {
    // WebP em todo lugar (bem menor que JPEG/PNG). E768 (reprova de 11/11): o AVIF saía da produção — a 1ª geração de cada
    // foto pelo otimizador custava ~2,7 s em AVIF contra ~0,4 s em WebP (1920 px; docs/e768-fotos-carga-fria.md), e numa
    // página com várias fotos a fila deixava fotos pendentes na carga fria (anúncio, /buscar, /empresas, catálogo).
    // O laboratório já era só WebP pelo mesmo motivo (t119/t48).
    formats: ["image/webp"],
    // Next 16 recusa (400) imagem em IP local; o laboratório guarda fotos no Supabase local (127.0.0.1).
    // Só no laboratório: o build de produção com a chave ligada já falha no topo deste arquivo.
    dangerouslyAllowLocalIP: LABORATORIO,
    remotePatterns: [
      // Fotografia interina (carrega em produção; substituir por fotos reais do cliente)
      { protocol: "https", hostname: "images.unsplash.com" },
      // Fotos reais enviadas ao Supabase Storage
      { protocol: "https", hostname: "*.supabase.co" },
      // Laboratório: fotos no Supabase local.
      ...(LABORATORIO ? [{ protocol: "http" as const, hostname: "127.0.0.1", port: "54321" }] : []),
    ],
  },
  async redirects() {
    // E563: a mesma chave de src/config/precos-visivel.ts (página de preços suspensa enquanto não for "1").
    const precosVisivel = process.env.NEXT_PUBLIC_PRECOS_VISIVEL === "1";
    return [
      // E595/E596 (ordem do Daniel, 05/11): /decisao e /socios defendiam o modelo revogado e foram eliminadas. O acesso
      // direto vai para a área interna válida (/modelodenegocio, ainda atrás da porta dos sócios) — nunca o conteúdo velho.
      { source: "/socios", destination: "/modelodenegocio", permanent: false },
      { source: "/socios/:path*", destination: "/modelodenegocio", permanent: false },
      { source: "/decisao", destination: "/modelodenegocio", permanent: false },
      { source: "/decisao/:path*", destination: "/modelodenegocio", permanent: false },
      // E766: /admin/backup e /admin/backups davam 404; o cartão completo do backup mora em Sistema.
      { source: "/admin/backup", destination: "/admin/sistema#backup", permanent: false },
      { source: "/admin/backups", destination: "/admin/sistema#backup", permanent: false },
      // E760: /dashboard/meus-imoveis (nome antigo da lista de anúncios) dava 404; a lista de hoje é /dashboard/imoveis.
      // Sem 308: o redirect permanente ficaria no cache do navegador.
      { source: "/dashboard/meus-imoveis", destination: "/dashboard/imoveis", permanent: false },
      { source: "/dashboard/meus-imoveis/:path*", destination: "/dashboard/imoveis/:path*", permanent: false },
      // www → ápice, MENOS /.well-known/*: Android (assetlinks) e Apple (AASA) não aceitam redirect nesse arquivo,
      // então os dois hosts servem /.well-known direto (200). O redirect mora aqui, não no domínio da Vercel,
      // porque o redirect de domínio da Vercel não tem exceção por caminho.
      { source: "/", has: [WWW], destination: `${APICE}/`, permanent: true },
      { source: "/:caminho((?!\\.well-known(?:/|$)).+)", has: [WWW], destination: `${APICE}/:caminho`, permanent: true },
      // UMA URL só para a home: "/" é a principal; "/home" (links antigos) faz
      // 301 para a raiz. Antes "/" redirecionava para "/home" e as duas ficavam
      // no sitemap/canonical — conteúdo duplicado.
      { source: "/home", destination: "/", permanent: true },
      // E132-A, item 10: /qualificar sem ?imovel abre o cadastro novo (que começa pela Qualificação). Aqui, e não só no
      // redirect() da página: dentro da casca do painel o redirect da página não navegava (a tela ficava vazia).
      { source: "/qualificar", missing: [{ type: "query" as const, key: "imovel" }], destination: "/dashboard/imoveis/novo", permanent: false },
      // /planos é natural de digitar e pode ter links antigos; a página canônica
      // é /precos (o rótulo "Planos" no menu/rodapé já aponta para /precos).
      // E563: com a página de preços suspensa (chave desligada), /planos vai para a home e SEM 308 — um redirect
      // permanente ficaria no cache do navegador e seguiria escondendo a página depois de religada.
      { source: "/planos", destination: precosVisivel ? "/precos" : "/", permanent: precosVisivel },
      // Link curto de bairro (só Uberlândia tem bairros curados): vai para a página da cidade.
      { source: "/bairros/:bairro", destination: "/cidades/uberlandia/:bairro", permanent: true },
      // Link antigo/intuitivo: quem procura "anunciar" cai na página do proprietário (301).
      { source: "/anunciar", destination: "/para-proprietarios", statusCode: 301 },
      // O simulador agora é uma rota React em /simulacao (URL principal divulgada).
      // Links antigos para /simulador e a página estática apontam para ela.
      { source: "/simulador", destination: "/simulacao", permanent: true },
      { source: "/simulador.html", destination: "/simulacao", permanent: true },
      // E851: /contato vai à página de contato vigente (Fale com a Viva), não à Central genérica (308).
      { source: "/contato", destination: "/ajuda/fale-com-a-viva", permanent: true },
      // E922: /ajuda/para-empresas dava 404; o conteúdo de empresas (e o "Fale com a gente") é /empresas (308).
      { source: "/ajuda/para-empresas", destination: "/empresas", permanent: true },
      // E901: /fale-com-a-viva dava 404; a página é /ajuda/fale-com-a-viva (308).
      { source: "/fale-com-a-viva", destination: "/ajuda/fale-com-a-viva", permanent: true },
      // E176 (parte 2): "Notificações" é uma página só — a do sino.
      { source: "/dashboard/conta/notificacoes", destination: "/dashboard/notificacoes", permanent: false },
      // Ordem 5a4b9146: endereços "naturais" dos itens do menu que davam 404.
      { source: "/para-empresas", destination: "/empresas", permanent: true },
      { source: "/publicar-pedido", destination: "/pedidos/novo", permanent: true },
      { source: "/pedido", destination: "/pedidos/novo", permanent: true },
      { source: "/proprietarios", destination: "/para-proprietarios", permanent: true },
      // E885: /entrar dava 404; a entrada é /auth (a query, como ?redirect=…, segue junto).
      { source: "/entrar", destination: "/auth", permanent: true },
      // Sem mensalidade (ordem 90181c57): a antiga tela de assinatura vai a /precos já na resposta HTTP.
      // Só o redirect() da página, dentro do painel com loading.tsx, saía como 200 + navegação do
      // navegador, e o lab (t48) via um 404 de recurso nesse caminho.
      { source: "/dashboard/assinatura", destination: precosVisivel ? "/precos" : "/dashboard", permanent: false },
      // Prompt 23: a agenda do proprietário mora em Ferramentas › Agenda; o endereço antigo dava 404.
      { source: "/dashboard/calendario", destination: "/dashboard/agenda", permanent: false },
      { source: "/dashboard/calendario/:resto*", destination: "/dashboard/agenda", permanent: false },
    ];
  },
  async rewrites() {
    return [
      // Apresentação (slideshow privado das telas). URL limpa /apresentacao.
      { source: "/apresentacao", destination: "/apresentacao.html" },
      // Verificação de domínio dos apps (links de e-mail abrindo o app). Rewrite,
      // não redirect: Apple e Google exigem resposta direta neste endereço.
      { source: "/.well-known/apple-app-site-association", destination: "/api/well-known/apple" },
      { source: "/.well-known/assetlinks.json", destination: "/api/well-known/android" },
    ];
  },
  async headers() {
    return [
      // Cabeçalhos de segurança em TODAS as rotas (defesa em profundidade).
      {
        source: "/:path*",
        headers: [
          // Força HTTPS no navegador (1 ano). Sem `preload` de propósito — é um
          // compromisso difícil de reverter; adicione depois se desejar.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Anti-clickjacking (F4): o site não é embarcável em iframe.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // E1095: a política de conteúdo passou de observada (Report-Only) a APLICADA.
          { key: "Content-Security-Policy", value: politicaDeConteudo() },
        ],
      },
      // Ponte do login social no app: o código PKCE vai na URL, então esta rota nunca manda
      // referrer. Vem DEPOIS da regra global para vencer o "strict-origin-when-cross-origin"
      // (o lab t47 recebia o valor global em vez de "no-referrer").
      {
        source: "/auth/app-callback",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      // Páginas e APIs: a Vercel acrescenta "Access-Control-Allow-Origin: *" em saída estática
      // (/, /precos, /como-funciona...). Fixamos a origem do próprio site em tudo que não é
      // arquivo de build (_next), para nenhum site de terceiro ler as páginas pelo navegador (#126).
      {
        source: "/((?!_next/).*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://vivanomads.com.br" },
          { key: "Vary", value: "Origin" },
        ],
      },
      // Arquivos estáticos para robôs: a Vercel acrescenta "Access-Control-Allow-Origin: *"
      // em saída estática. Fixamos a origem do próprio site (depois da regra global) para que
      // nenhum site de terceiro leia isso pelo navegador (#126).
      {
        source: "/:arquivo(llms\\.txt|llms-full\\.txt|sitemap\\.xml)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://vivanomads.com.br" },
          { key: "Vary", value: "Origin" },
        ],
      },
      // noindex/nofollow no header HTTP (independe da meta tag dentro do HTML).
      {
        source: "/simulacao",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/modelodenegocio",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/roi",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/socios",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/decisao",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/apresentacao",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/apresentacao.html",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
