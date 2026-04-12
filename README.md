# Centro de Controlo de Trading Institucional V11

Dashboard estático de trading profissional para GitHub Pages, desenhado para operação diária assistida por IA a partir de screenshots do fecho da XTB.

## Estrutura do projeto

- `index.html` interface principal
- `style.css` sistema visual, layout e tabelas
- `app.js` lógica de carregamento, renderização, métricas e gráficos
- `data/eur.json` dados da conta EUR
- `data/usd.json` dados da conta USD
- `data/consolidated.json` camada master

## Como a app lê os JSONs

O front-end lê sempre por `fetch`:

- `data/eur.json`
- `data/usd.json`
- `data/consolidated.json`

Depois disso:

1. o dashboard monta a conta EUR
2. monta a conta USD
3. calcula métricas, risco, fluxo de capital, processo e alertas
4. apresenta a visão consolidada sem aplicar FX

## O que mudou na V11

- interface totalmente em português
- novo `Risk Dashboard`
- novo `Alerts Center`
- novo bloco `Capital Flow`
- novo bloco `Process / Compliance`
- barra lateral com estado do sistema, validação, última atualização e próxima ação
- visão consolidada mais explícita, com separação forte entre EUR e USD
- novos campos de metadata, integridade, processo e fluxo nos JSONs

## Publicação no GitHub Pages

1. criar um repositório no GitHub
2. colocar estes ficheiros na raiz do repositório
3. fazer upload ou push
4. abrir `Settings > Pages`
5. escolher `Deploy from a branch`
6. selecionar o branch principal e `/root`
7. guardar

## Fluxo diário com screenshots da XTB

Fluxo recomendado:

1. guardar os screenshots do fecho da XTB
2. enviar os screenshots no chat
3. pedir à IA a atualização diária da V11
4. a IA devolve novo conteúdo para:
   - `data/eur.json`
   - `data/usd.json`
   - `data/consolidated.json`
5. substituir apenas esses ficheiros
6. fazer commit
7. aguardar o deploy do GitHub Pages

## Ficheiros que mudam todos os dias

Normalmente só precisas de atualizar:

- `data/eur.json`
- `data/usd.json`
- `data/consolidated.json`

Não precisas de editar `index.html`, `style.css` ou `app.js` no fluxo normal.

## Novos campos de dados V11

### Em `data/eur.json` e `data/usd.json`

Campos novos adicionados:

- `meta.lastUpdatedAt`
- `meta.dataSource`
- `meta.updateMethod`
- `meta.updateSessionId`
- `integrity`
- `capitalFlow.realizedPl`
- `process.planCompliance`
- `process.executionQuality`
- `process.thesisStatus`
- novos campos em `dailySummary`

Campos novos em `dailySummary`:

- `openExposure`
- `positionCount`
- `winnerCount`
- `loserCount`
- `riskAvgPct`
- `riskAggregatePct`
- `top3ConcentrationPct`
- `bestTicker`
- `worstTicker`

### Em `data/consolidated.json`

Campos novos adicionados:

- `meta.lastUpdatedAt`
- `meta.updateMethod`
- `accounts.*.reviewStatus`
- `accounts.*.lastUpdatedAt`
- métricas de risco master
- métricas de capital flow master

## Campos com valor neutro na V11

Alguns campos foram preparados para evolução futura e por isso estão com valor neutro:

- `capitalFlow.realizedPl`
- `totals.realizedPlEUR`
- `totals.realizedPlUSD`

Enquanto não existir uma camada formal de P/L realizado, estes campos podem manter `0`.

## Como atualizar os dados diariamente

### Conta EUR

Em `data/eur.json`, atualiza:

- `meta.latestDate`
- `meta.lastUpdatedAt`
- `meta.updateSessionId`
- `cashBalance`
- `snapshots`
- `dailySummary`
- `periodSummary`
- `events`
- `integrity` se houver warnings ou revisão pendente

### Conta USD

Em `data/usd.json`, atualiza:

- `meta.latestDate`
- `meta.lastUpdatedAt`
- `meta.updateSessionId`
- `cashBalance`
- `snapshots`
- `dailySummary`
- `periodSummary`
- `events`
- `integrity`

### Camada consolidada

Em `data/consolidated.json`, atualiza:

- `meta.latestDate`
- `meta.lastUpdatedAt`
- `meta.nonConvertedTotals`
- `totals`
- `alerts`
- `accounts.EUR.lastUpdatedAt`
- `accounts.USD.lastUpdatedAt`

## Como adicionar novos dias

1. mudar `meta.latestDate` para a nova data
2. atualizar `meta.lastUpdatedAt`
3. substituir os `snapshots` do fecho mais recente
4. acrescentar nova linha em `dailySummary`
5. manter o primeiro dia histórico com `plDay = 0` e `plDayPct = 0`
6. atualizar a camada consolidada

## Como adicionar eventos operacionais

Cada evento novo entra em `events` da conta respetiva.

Tipos já suportados:

- `new entry`
- `reinforcement`
- `partial sale`
- `full exit`
- `deposit`
- `withdrawal`

Campos mínimos:

- `date`
- `ticker`
- `type`
- `qty`
- `value`
- `note`

## Separação entre EUR e USD

Regras mantidas:

- EUR vive apenas em `data/eur.json`
- USD vive apenas em `data/usd.json`
- caixa EUR não entra em `data/usd.json`
- caixa USD não entra em `data/eur.json`
- a visão consolidada mostra as duas contas em paralelo
- não existe soma monetária real entre EUR e USD sem FX

## Como fazer commit

### Pelo site do GitHub

1. abrir o repositório
2. entrar na pasta `data`
3. substituir os ficheiros
4. carregar em `Commit changes...`
5. escrever uma mensagem como `update close 2026-04-10`
6. confirmar

### Pelo Git local

```powershell
git add .
git commit -m "update close 2026-04-10"
git push
```

## Como confirmar que o site atualizou

1. abrir `Actions` no GitHub
2. confirmar que o deploy terminou
3. abrir o URL do GitHub Pages
4. verificar a data no topo do dashboard
5. confirmar o estado do sistema na barra lateral
6. validar os números principais de EUR e USD

## Desenvolvimento local

Como a app usa `fetch`, abre com um servidor local:

```powershell
python -m http.server 8000
```

ou

```powershell
npx serve .
```

Depois abrir `http://localhost:8000`.

## Compatibilidade

- compatível com GitHub Pages
- compatível com a arquitetura atual
- compatível com atualização data-first
- compatível com validadores simples porque os campos antigos foram mantidos e os novos são aditivos

