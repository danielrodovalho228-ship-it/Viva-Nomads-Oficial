# E74 — Central de Agentes "Ao vivo" zerada: investigação (24/10/2026)

Leituras feitas em produção (projeto `esezeutgtycekfosxplk`), todas de leitura, por volta das 10:30–11:00 UTC de 24/10. Nada da frota foi desligado, apagado ou alterado.

## 1. A tabela está vazia? A 0078 foi aplicada?
**Não está vazia, e a 0078 está aplicada.**
- `schema_migrations` tem `0078_central_agentes`, `0082`, `0085`, `0087` e `0092`.
- `agentes`: 19 linhas, 15 com status `ativo`.
- `agentes_rondas`: 1.727 no total, **89 nas últimas 24 h**; a última às 10:54 UTC de 24/10.

**Por que a tela mostrou zero.** A página da Central abre pelo portão do admin. Os três contadores do topo (185 pendentes, 150 lidas) leem com a **chave de serviço**. A Central em si (`carregarCentral`) lê pela **sessão**, e a RLS da 0078 só libera essas linhas se `is_admin()` for verdadeiro.

Desde a 0199, `is_admin()` exige uma sessão `aal2`, isto é, com o código do app autenticador, para quem tem fator verificado.
- A conta admin com fator verificado tem **4 sessões, todas `aal1`** (só senha). A última atividade foi às 10:31 UTC.
- A variável `ADMIN_2FA_OBRIGATORIA` existe em produção. O valor não foi lido; essa variável é a válvula que deixa o portão do `/admin` abrir sem o código.

Resultado: a página abre, a RLS devolve **zero linhas sem erro**, e a tela concluía "tabela vazia ou 0078 não aplicada". O selo "Ao vivo" era fixo.

## 2. Onde a frota registra presença e ordens; o registro parou?
- **Onde registra:** no mesmo banco de produção. Cada rotina (tarefa agendada do Claude) chama `registrar_ronda(...)` e `ordens_pendentes(...)` com a chave de serviço. O registro não mudou de banco nem de ambiente.
- **Quem parou:** as rotinas dos agentes estão **pausadas à mão desde 17/10**. Todas estão com `enabled = false`, sem motivo de fim e sem suspensão; as últimas execuções terminaram com sucesso.
  - A maioria foi pausada por volta das 18:05 UTC de 17/10; Moacir, Paula e Igor às 23:35 UTC.
  - Pausadas: Moacir, Otávio, Helena, Carla, Bruno, Marina, Luana, Thiago, Paula, Sérgio, Viva (plantão), Fernanda e Igor.
- **Quem continua:**
  - os quatro **Renatos** (A, B, C e D, de hora em hora), que respondem pelas 89 rondas das últimas 24 h e pelas 600 ordens concluídas em 7 dias;
  - o **Rafael** (domingos).

Última ronda de cada agente pausado: Otávio, Helena, Carla, Bruno, Marina, Luana, Thiago, Paula, Sérgio e Fernanda em 17/10; Moacir e Rafael em 18/10; Igor em 13/10; Viva em 07/10.

## 3. As 185 ordens pendentes estão sendo executadas?
**Não. Estão órfãs.**

| Destino | Pendentes | Origem | Mais antiga |
|---|---|---|---|
| Moacir | 138 | Renato (98 pedidos e 40 retornos "PR aberto"), criadas até 09:53 de hoje | 18/10 19:09 |
| Otávio | 31 | Renato (23) e achados de 17/10 de Bruno, Marina, Fernanda, Carla, Helena e Paula | 17/10 |
| Sérgio | 7 | Renato (4) e Moacir (3) | 17/10 |
| Viva | 5 | 3 com erro de disparo, de 08 a 11/10 | 08/10 |
| Luana | 4 | Moacir (3) e sem origem (1) | 17/10 |

- Nenhuma dessas ordens foi disparada (`disparada_em` nulo). O agente de destino está pausado, então ninguém as lê.
- As **150 "lidas não concluídas"** se dividem em Moacir 79, Otávio 33, Renato 33, Luana 3 e Sérgio 2. São ordens lidas antes da pausa e nunca fechadas. As do Moacir vêm desde 08/10.
- **A fila cresce sozinha.** Os Renatos continuam mandando revisão e retorno ao Moacir e ao Otávio, que não rodam desde 17–18/10.

**Decisão da coordenação (não tomada aqui):**
- religar Moacir e Otávio;
- ou mandar os Renatos pararem de endereçar a eles;
- ou cancelar as ordens órfãs.

## Correção neste PR (tela)
- **Selo:** "Ao vivo" só aparece quando a sessão consegue ler os dados **e** há ronda nas últimas 2 h. Fora disso, o selo mostra um destes textos:
  - "Última ronda há N…";
  - "Nenhuma ronda registrada";
  - "Sem acesso aos dados";
  - "Sem agentes".
- **Sessão sem o código:** em vez de "tabela vazia", a tela diz "Confirme o código para ver a equipe" e traz o botão "Digitar o código" (volta para `/admin/agentes`). Os números do topo da Central ficam "–" em vez de 0.
- **Vazio de verdade:** "Nenhum agente cadastrado. Quando a equipe de agentes for cadastrada, ela aparece aqui…". Sem número de migração nem nome de tabela.
- **Segurança:** a leitura continua pela sessão, com a RLS e a regra da 0199 intactas. A Central só pergunta `is_admin()` para saber se pode ler.
