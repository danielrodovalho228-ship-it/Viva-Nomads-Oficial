# Achado 178 — leitura do motivo no perfil (candidatura)

`requestLead` (candidatura sem motivo escolhido) lia `profiles.motivo_estadia` sem olhar o `error`. Se a leitura falhasse,
a candidatura seguia sem motivo, em silêncio. Agora para antes de gravar o lead e responde
"Não foi possível enviar agora. Tente de novo em instantes." (a mesma mensagem das outras leituras da ação).

Teste: `src/lib/data/achado178-leitura-motivo-perfil.test.ts` (escrito antes, visto vermelho). Sem migração, sem chave, sem prova ao vivo.
Fecha o ponto que restava na varredura em `actions.ts`.
