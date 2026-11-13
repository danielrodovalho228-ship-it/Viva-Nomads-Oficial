# Auditoria de erros e estados vazios dos fluxos logados (09/11/2026)

Varredura das 108 páginas de `src/app/(dashboard)`:
- **Telas de erro:** existem em `dashboard`, `admin`, `(public)` e na raiz, todas com "Tentar de novo" (guardado por teste).
- **Listas sem estado vazio:** a busca por `.map(` sem texto de vazio achou 7 arquivos; todos são listas fixas (critérios, selos, ferramentas, funil), não dados do usuário. Nada a corrigir.
- **Falha de consulta tratada como "não encontrado" (corrigido):** duas páginas faziam `const { data } = ...; if (!data) notFound()`, o que mostra 404 quando o banco falha.
  - `/dashboard/parceiro/avaliacao/[pedido]` e `/dashboard/avaliacao-imovel/[id]`: agora o erro da consulta é lançado e cai na tela de erro, com "Tentar de novo". Teste: `src/lib/erros/e-erros-consulta-nao-e-404.test.ts`.
- Sem prova ao vivo.
