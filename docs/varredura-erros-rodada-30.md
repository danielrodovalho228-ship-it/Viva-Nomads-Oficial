# Varredura de erros — rodada 30 (06/11/2026)

Alvo: leituras do cliente cujo `.catch` troca a falha por um estado "vazio" ou "padrão". Varredura por padrão (`.catch(() => set…([]|0|false|null|{…}))`) em `src/components` e `src/app`.

## Achado
- **143 — Conta › Privacidade** (`tela-privacidade.tsx` + `getPrivacidade`): se a leitura falhava, o servidor (`getUser` com erro) e o cliente (`.catch`) devolviam os valores PADRÃO como se fossem as escolhas da pessoa. Quem tinha desligado "Aparecer na busca" via o interruptor LIGADO, e o toque seguinte salvava por cima da escolha real. Agora a falha do servidor lança (sem sessão não é falha) e a tela mostra "Não foi possível carregar suas permissões agora. Seus ajustes não mudaram." com "Tentar de novo", sem interruptores.

## Examinados e deixados (de propósito)
- `denunciar-anuncio.tsx` (falha → "não logado"): pede o login, sem afirmar nada sobre a pessoa; custo baixo.
- `central-ajuda.tsx` (falha → "sem contratos"): só deixa de sugerir atalhos de contrato.
- `convite-cidade.tsx` (falha → "não fechada"): mantém o convite aberto, o padrão.
- `central-client.tsx` (admin, conversas): já coberto pelo PR do achado 21.
- `conta-blocos.tsx` (celular): já cai em "Em breve" (rodada 29 tratou e-mail e duas etapas).

## Teste
`src/lib/conta/achado143-privacidade-leitura.test.ts` (2 casos, escritos antes e vistos vermelhos).
