# E782 — tela de Avaliações no padrão das outras telas (09/11/2026)

Achado do Daniel (prints 19:38–19:39): Avaliações "não ficou padrão". Alinhado, elemento por elemento (referência: tela "Como você usa a Viva"):
1. **Voltar:** era o "← Voltar" em texto do painel; agora a seta (`VoltarCelular`) junto do título, no celular (título centralizado) e no computador. `painelMostraVoltar` não mostra mais o voltar de texto em `/dashboard/avaliacoes`.
2. **Título:** era verde e grande; agora em tinta, no tamanho padrão do painel (`text-2xl`/`28px`).
3. **Títulos duplicados:** "Para avaliar" e "Feitas" saíram do corpo (a aba ativa já diz); viram `region` com `aria-label`. "Recebidas recentes" fica (é outra lista).
4. **Abas:** de pílulas preenchidas para abas sublinhadas, como Favoritos & comparações.
- **Irmãs do fluxo:** `/dashboard/conta/avaliacoes` só redireciona para cá; a lista "Recebidas" não tem título próprio duplicado; "Avaliar agora" leva a Locações/Contratos (outras telas, já com o cabeçalho padrão).
- **Prova em 390 px:** a tela exige login e o ambiente local não tem conta; fica para o QA/lab (lado a lado com o print de referência e o mockup `avaliacoes-painel`, que não está no repositório).

## Adendo aprovado pelo Daniel: "Uberlandia" → "Uberlândia"
- **Causa:** a cidade do perfil é texto livre e foi salva sem acento; a tela de papéis (os dois cartões e o chip de local) mostrava o texto como veio.
- **Correção:** `grafiaDaCidade` (em `lib/cidades.ts`) mostra a grafia oficial das cidades conhecidas (hoje Uberlândia); outras cidades saem como foram digitadas. Aplicada nos três textos de `tela-papeis.ts`, no "Seu perfil público" e no cartão do proprietário do anúncio.
- **Irmãs:** nenhum texto fixo do código tem "Uberlandia" sem acento; o dado salvo no banco não foi alterado (Pista A não migra).
