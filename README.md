# Viva Nomads

Plataforma de **locação de imóveis mobiliados por temporada de média duração (30 a 180 dias)**
para profissionais em transição. Locação mensal sob o art. 48 da Lei 8.245/91 — não é Airbnb,
não é QuintoAndar.

> Posicionamento: "locação mensal mobiliada para profissionais em transição, aceita em
> condomínios onde o Airbnb não é."

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (design tokens da paleta NomadeDrive)
- **Supabase** (Postgres + Auth + Storage) — `src/lib/supabase`, camada de dados em `src/lib/data`
- **Asaas** — pagamento nativo BR: assinatura recorrente + PIX/boleto/cartão + split (`src/lib/payments`)
- **Mapbox GL** — mapas de imóveis e espaços de trabalho (`src/components/property-map.tsx`)
- **CAF** (verificação de inquilino) e **ZapSign** (contrato) — `src/lib/integrations`
- **Zustand** (estado de sessão) · **lucide-react** (ícones)

Todas as integrações têm **fallback de modo demonstração**: sem as chaves de ambiente, a app
roda com dados/respostas simulados e as chamadas reais só disparam quando as env existem.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # opcional — sem isso, roda em modo demonstração
npm run dev
```

Sem as variáveis do Supabase, a aplicação roda em **modo demonstração**: a autenticação
simula a sessão localmente e as telas usam dados de exemplo (`src/lib/properties.ts`).

## O coração do produto: o Checklist de Qualificação

Rota `/qualificar`. Um imóvel só pode ser publicado depois de aprovado. Tem duas camadas:

- **Camada 1 — Elegibilidade** (bloqueia/libera): mobiliado, aceita 30 dias, IPTU em dia,
  habitabilidade, proprietário/procurador, documentação, e a convenção do condomínio.
- **Camada 2 — Pontuação 0–100**: gera o selo dourado **Pronto para Trabalho** (≥ 70 pts),
  somando recursos de trabalho no imóvel, espaços próximos e conforto de estadia.

Lógica isolada e testável em `src/lib/qualification.ts`.

## Estrutura de rotas

```
(public)   → /home /buscar /imoveis/[id] /cidades/[cidade]
             /como-funciona /para-proprietarios /precos      (SSR + SEO)
/auth      → entrar / cadastrar (com seletor de perfil)
(dashboard)→ /qualificar /dashboard /dashboard/imoveis[/novo]
             /dashboard/leads /mensagens /assinatura /conta
             /dashboard/favoritos /buscas  (inquilino)
             /admin                          (admin)
```

## Banco de dados

Esquema completo com RLS em `supabase/migrations/0001_initial_schema.sql`
(seções 6 e 9 do documento mestre: imóveis, checklist, mensagens, leads, assinaturas,
contratos, garantias, cotações de seguro, verificações CAF e transações de split).

## Roadmap (fases do documento mestre)

| Fase | Estado |
|---|---|
| 1. Base, design system, layouts e rotas | ✅ |
| 2. Autenticação e perfis (demo + Supabase) | ✅ |
| 3. Homepage pública | ✅ |
| 4. ⭐ Checklist de qualificação | ✅ |
| 5. Cadastro de imóvel (multi-etapas, pós-checklist) | ✅ |
| 6. Busca + mapa | ✅ (mapa: placeholder até token Mapbox) |
| 7. Detalhe do imóvel (abas + Open Graph) | ✅ |
| 8. Dashboards (proprietário/inquilino) | ✅ |
| 9. Mensagens e leads | ✅ |
| 10. Assinatura (Asaas — PIX/boleto/cartão) e serviços | ✅ |
| 11. Páginas de cidade (SEO) | ✅ |
| 12. Admin | ✅ |
| Seção 8 — verificação CAF, garantia, contrato ZapSign | ✅ |

## Deploy

Guia completo (Vercel + Supabase + DNS de `vivanomads.com.br`) em **[DEPLOY.md](./DEPLOY.md)**.
`vercel.json` já fixa a região **gru1 (São Paulo)** e libera CORS nas rotas `/api/*`
para o futuro app. Health-check em `GET /api/health`.

## Rotas de API

| Rota | Função |
|---|---|
| `POST /api/assinatura` | Cria assinatura recorrente (Asaas) — PIX/boleto/cartão |
| `POST /api/webhooks/asaas` | Webhook de confirmação de pagamento |
| `POST /api/caf/verify` | Verificação de inquilino (CAF) → laudo de semáforo |
| `POST /api/contrato` | Geração de contrato de temporada (ZapSign) |
| `GET /auth/callback` | Troca de código OAuth/magic-link por sessão (Supabase) |
| `GET /api/health` | Health-check + status das integrações |

A plataforma é **conectadora** — não é locadora, fiadora nem garantidora, e não intermedeia
o pagamento do aluguel (vai direto ao proprietário).
