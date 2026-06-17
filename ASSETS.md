# Plano de imagens — Viva Nomads

Lista de todas as imagens do produto: onde entram, tamanho, `alt` e **prompt pronto**
para gerar (ChatGPT/DALL·E, Manus, Midjourney, etc.). Identidade: azul `#1E63D0` +
verde-limão `#6CBE2A` + preto `#0A0A0A`.

## Como usar (fluxo de geração → site)

1. Gere a imagem com o prompt da tabela (adicione o **sufixo de estilo** abaixo).
2. Exporte em **WebP/AVIF**, com o **tamanho** indicado, e salve com o **nome do arquivo**.
3. Coloque em `public/images/<superfície>/<nome>` (crie as pastas) **ou arraste aqui no chat**.
4. Avise — eu troco a referência interina (Unsplash) pelo arquivo real em `src/lib/media.ts`.

> Estado atual: os slots usam **fotos Unsplash interinas** (carregam no deploy da Vercel).
> Ilustrações de estado vazio/404, avatares, favicon e OG são gerados **em código** (definitivos).

### Sufixo de estilo (cole no fim de todo prompt fotográfico)
> Fotografia editorial realista, luz natural suave e difusa, contexto brasileiro
> contemporâneo, profundidade de campo natural, detalhes da cena em harmonia com azul
> (#1E63D0) e verde-limão (#6CBE2A), color grading sutil puxando para o azul, aparência
> autêntica (não banco de imagem), alta resolução, **sem texto, sem logos, sem marca d'água**.

## Especificações por formato

| Uso | Proporção | Export | Nome |
|---|---|---|---|
| Herói full-bleed | 16:9 (+4:5 mobile) | 2400×1350 / 1080×1350 | `home-hero-chegada.webp` |
| Banner horizontal | 3:1 | 2400×800 | `busca-hero.webp` |
| Bloco editorial | 3:2 | 1600×1067 | `home-diferencial-homeoffice.webp` |
| Card de persona | 4:5 | 1000×1250 | `home-persona-*.webp` |
| Card/galeria de imóvel | 4:3 / 3:2 | 1200×900 | `imovel-{slug}-{n}.webp` |
| Painel de auth | 4:5 / 3:4 | 1200×1500 | `auth-login-side.webp` / `auth-signup-side.webp` |
| Open Graph | 1.91:1 | 1200×630 | gerado em código (`next/og`) |
| Favicon / app icon | 1:1 | 512/180/32 | gerado em código (símbolo "N") |

## A — Home (`public/images/home/`)

| Slot | Arquivo | alt | Prompt |
|---|---|---|---|
| Herói | `home-hero-chegada.webp` | "Profissional chega a um apartamento mobiliado com mala e notebook" | Um profissional de ~35 anos chega a um apartamento mobiliado e iluminado segurando uma mala e um notebook, expressão tranquila, sala contemporânea com sofá e mesa de trabalho ao fundo, grandes janelas com luz natural, planta verde no canto, almofada azul. Enquadramento amplo, sensação de recomeço. |
| Persona executivo | `home-persona-executivo.webp` | "Executiva em transferência entrando em prédio residencial ao amanhecer" | Executiva em transferência, blazer, com mala de rodinhas, entrando em prédio residencial moderno ao amanhecer, postura confiante. |
| Persona saúde | `home-persona-saude.webp` | "Médico estudando exames no notebook em casa após o plantão" | Médico com jaleco e crachá, em casa estudando exames no notebook na mesa de jantar mobiliada, xícara de café, fim de plantão, luz suave. |
| Persona família | `home-persona-familia.webp` | "Casal jovem com criança entre caixas de mudança numa sala mobiliada" | Casal jovem com uma criança pequena entre caixas de mudança numa sala mobiliada e clara, clima leve de recomeço, sorrisos naturais. |
| Persona nômade | `home-persona-nomade.webp` | "Pessoa jovem trabalhando em notebook num studio mobiliado" | Pessoa jovem trabalhando em notebook num apartamento studio mobiliado, fones no pescoço, mochila ao lado, plantas, ambiente descontraído e produtivo. |
| Diferencial | `home-diferencial-homeoffice.webp` | "Home office bem montado em apartamento mobiliado" | Home office bem montado: mesa de madeira clara, cadeira ergonômica, monitor externo e notebook, roteador de fibra visível, caderno, caneca, planta e prateleira; luz natural lateral. |
| Comparativo (apoio) | `home-condominio-tranquilo.webp` | "Fachada de condomínio residencial tranquilo ao fim de tarde" | Hall e fachada de condomínio residencial brasileiro tranquilo e bem cuidado, jardim, sem turistas, sensação de segurança, fim de tarde. |
| Proprietários | `home-proprietarios-chaves.webp` | "Proprietária sorrindo com molho de chaves em apartamento pronto para alugar" | Proprietário(a) ~45 anos sorrindo naturalmente na sala de um apartamento mobiliado pronto para alugar, segurando chaves, ambiente claro e valorizado. |

## B — Busca / Imóvel (`public/images/busca/`, fotos reais em `public/images/imoveis/`)

| Slot | Arquivo | alt | Prompt |
|---|---|---|---|
| Banner busca | `busca-hero.webp` | "Bairro residencial arborizado de Uberlândia ao entardecer" | Vista de bairro residencial arborizado de Uberlândia ao entardecer, prédios e casas, céu limpo, sensação de morar bem por uma temporada. |
| Fotos do imóvel | `imovel-{slug}-{sala\|quarto\|cozinha\|banheiro\|homeoffice\|fachada}.webp` | descritivo por ambiente | **REAIS** do próprio imóvel. Interino: Apartamento mobiliado brasileiro contemporâneo, ambiente arrumado, luz natural, foto de anúncio imobiliário profissional. Gerar variações (sala, quarto, cozinha, banheiro, home office, fachada). |

## C — Auth (`public/images/auth/`)

| Slot | Arquivo | alt | Prompt |
|---|---|---|---|
| Login | `auth-login-side.webp` | "Profissional trabalhando concentrado em apartamento mobiliado ao anoitecer" | Profissional trabalhando concentrado em notebook num apartamento mobiliado e iluminado ao anoitecer, luz de luminária + luz azulada da janela, clima calmo de fim de dia produtivo. |
| Cadastro | `auth-signup-side.webp` | "Pessoa abrindo a porta de um novo apartamento mobiliado, mala ao lado" | Pessoa abrindo a porta de um apartamento mobiliado novo, mala ao lado, luz natural entrando, expressão de expectativa positiva, primeiro dia na nova moradia. |

## D/E — Dashboards (`public/images/dashboard/`)

| Slot | Arquivo | alt | Prompt |
|---|---|---|---|
| Boas-vindas inquilino | `dash-inquilino-welcome.webp` | "Canto aconchegante de apartamento mobiliado com luz da manhã" | Detalhe aconchegante de apartamento mobiliado (canto de leitura, planta, luz da manhã), desfocado o suficiente para fundo de banner com texto por cima. |
| Onboarding proprietário | `dash-prop-onboarding.webp` | "Sala de apartamento mobiliado preparada para anúncio" | Sala de apartamento mobiliado bem-arrumado sendo preparado para anúncio, luz natural, ambiente valorizado; espaço lateral limpo para texto. |

## Gerados em código (definitivos — não precisa gerar)

- **Favicon / app icons** — `src/app/icon.svg`, `src/app/apple-icon.svg` (símbolo "N" com gradiente).
- **Open Graph** — `next/og` (default + por imóvel).
- **Estados vazios / 404** — ilustrações SVG em azul + verde-limão.
- **Avatares** — iniciais sobre gradiente azul→verde.
- **Logo p/ fundo claro** — variante no componente `Logo`.

## Pendências do cliente (substituir interinos)

- [ ] Fotos **reais** de cada imóvel (5–8 por anúncio).
- [ ] Logos de parceiros (seguradoras) e depoimentos.
- [ ] (Opcional) Fotos de lifestyle próprias no lugar das Unsplash interinas.
