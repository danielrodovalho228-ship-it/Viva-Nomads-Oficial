# Viva Nomads

Plataforma de **locação de imóveis mobiliados por temporada de média duração (30 a 180 dias)**
para profissionais em transição. Locação mensal sob o art. 48 da Lei 8.245/91 — não é Airbnb,
não é QuintoAndar.

> Posicionamento: "locação mensal mobiliada para profissionais em transição, aceita em
> condomínios onde o Airbnb não é."

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (design tokens da paleta NomadeDrive)
- **Supabase** (Postgres + Auth + Storage) — `src/lib/supabase`
- **Zustand** (estado de sessão)
- **lucide-react** (ícones)
- Stripe (assinatura), Mapbox/Google Maps (mapas), ZapSign (contrato), CAF (verificação) — integrações previstas

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
| 10. Assinatura Stripe e serviços | ✅ UI (integração pendente de chaves) |
| 11. Páginas de cidade (SEO) | ✅ |
| 12. Admin | ✅ |
| Seção 8 — verificação CAF, garantia, contrato ZapSign | ⏳ próximos passos |

A plataforma é **conectadora** — não é locadora, fiadora nem garantidora, e não intermedeia
o pagamento do aluguel (vai direto ao proprietário).
