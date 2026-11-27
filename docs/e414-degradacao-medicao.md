# E414 — degradação graciosa quando a medição de internet não conclui

**Contexto:** a medição roda no navegador, direto com o servidor de teste (speed.cloudflare.com); em redes que não o alcançam
(bloqueador, firewall, proxy restrito) ela falha na 1ª fase com `E414-conexao-latencia` (diagnóstico no #2955). Decisão de
produto: a velocidade é medida, não digitada. Esta mudança trata só da degradação, sem gasto novo e sem mudar o motor.

**O que já era certo:** falha antes de qualquer rodada completa sai ANTES do POST em `/api/internet/medicoes` (nada é
gravado nem marcado no imóvel) e a mensagem já dizia "tente de novo".

**O que muda (medir-internet.tsx, medir-no-imovel.tsx, internet-motor.ts):**
- Depois da falha: o botão passa a "Tentar de novo" e aparece o texto "Nada foi registrado no imóvel. Você pode seguir com o
  cadastro e medir depois…" com o botão **Medir depois** (`onDepois`), que fecha o painel e deixa o item pendente.
- No celular, o painel do nível não tinha como fechar; agora `onDepois={() => setAberto(false)}`.

**Teste permanente:** `src/lib/internet-degradacao-e414.test.ts` (4): toda falha diz o que fazer e traz o código `E414-`;
o texto de "medir depois"; a falha sai antes de gravar; a tela oferece "Tentar de novo" e "Medir depois".
Escopo: `node --test src/lib/internet*.test.ts src/lib/niveis/*.test.ts` 95/95; `tsc` limpo.

**Fora de escopo (decisão do Daniel):** fazer a medição concluir no ambiente da QA exige liberar `speed.cloudflare.com` na
rede deles ou medir contra o servidor da Viva (gasto novo) — ver #2955.

## Complemento (re-prova de 06/11 23:31): "Medir depois" como botão em toda tela
Na re-prova, a tela de falha tinha "Tentar de novo" e o texto "Nada foi registrado no imóvel…", mas o "Medir depois" só aparecia **dentro da frase**, sem controle. Causa: o botão só era desenhado quando a tela chamadora passava `onDepois` — e só o painel do nível no celular passa. O cadastro (`blocos-cadastro`), a edição e a conferência de entrada chamam `MedirInternet` sem ele.
**Correção:** o botão "Medir depois" é desenhado sempre, ao lado de "Tentar de novo". Ele dispensa a falha (`resultado` volta a vazio), mostra "Medição adiada: nada foi registrado no imóvel. Siga com o cadastro e meça quando quiser." e **não grava nada**; quem passa `onDepois` (nível no celular) continua fechando o painel. Medir de novo apaga o aviso. Teste: `internet-degradacao-e414.test.ts` (novo caso).
