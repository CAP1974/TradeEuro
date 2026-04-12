# Institutional Trading Control Center

Dashboard estático de trading profissional, modular e preparado para GitHub Pages, desenhado para operação diária assistida por IA a partir de screenshots do fecho da XTB.

## Estrutura do projeto

- `index.html` interface principal
- `style.css` design system, layout e tabelas
- `app.js` lógica de carregamento, renderização, métricas, filtros e gráficos
- `data/eur.json` dados da conta EUR
- `data/usd.json` dados da conta USD
- `data/consolidated.json` camada master e regras de consolidação

## Como a app lê os JSONs

O front-end lê sempre estes três ficheiros por `fetch`:

- `data/eur.json`
- `data/usd.json`
- `data/consolidated.json`

Depois disso:

1. `app.js` monta o modelo da conta EUR.
2. `app.js` monta o modelo da conta USD.
3. `app.js` aplica filtros, cálculos e alertas.
4. a visão consolidada apresenta os dois books sem misturar moedas

## Como publicar no GitHub Pages

1. criar um repositório no GitHub
2. colocar todos os ficheiros na raiz do repositório
3. fazer upload ou push do conteúdo
4. ir a `Settings > Pages`
5. em `Build and deployment`, escolher `Deploy from a branch`
6. selecionar o branch principal e a pasta `/root`
7. guardar

O site ficará disponível no URL do GitHub Pages desse repositório.

## Fluxo operacional diário com screenshots da XTB

Este projeto foi desenhado para este processo:

1. no fim da sessão, tirar ou guardar os screenshots do fecho da XTB
2. enviar os screenshots no chat
3. pedir à IA para atualizar os dados do dia
4. a IA gera novo conteúdo para:
   - `data/eur.json`
   - `data/usd.json`
   - `data/consolidated.json`
5. substituir apenas esses ficheiros
6. fazer commit
7. aguardar o deploy do GitHub Pages

## Quais ficheiros mudar todos os dias

Normalmente só precisas de mexer em:

- `data/eur.json`
- `data/usd.json`
- `data/consolidated.json`

Não precisas de editar `index.html`, `style.css` ou `app.js` para cada novo fecho.

## Como atualizar os dados todos os dias

### Conta EUR

Em `data/eur.json`, atualiza:

- `meta.latestDate`
- `cashBalance` se mudou
- `snapshots` com o snapshot do novo fecho
- `dailySummary` com uma nova linha do dia
- `periodSummary` se a semana ou mês mudou
- `events` se houve nova entrada, reforço, parcial, saída, depósito ou levantamento

### Conta USD

Em `data/usd.json`, atualiza:

- `meta.latestDate`
- `cashBalance` se mudou
- `snapshots`
- `dailySummary`
- `periodSummary`
- `events`

### Consolidated

Em `data/consolidated.json`, atualiza:

- `meta.latestDate`
- `meta.nonConvertedTotals`
- `totals`
- `alerts` se necessário

## Como adicionar novos dias

Para adicionar um novo dia:

1. mudar `meta.latestDate` para a nova data na conta correta
2. substituir os `snapshots` dessa data pelo fecho mais recente
3. acrescentar uma nova linha em `dailySummary`
4. confirmar que o primeiro dia histórico dessa conta mantém `plDay = 0` e `plDayPct = 0`
5. atualizar a camada consolidada

## Como adicionar eventos operacionais

Cada evento novo entra no array `events` da conta respetiva.

Tipos já previstos:

- `new entry`
- `reinforcement`
- `partial sale`
- `full exit`
- `deposit`
- `withdrawal`

Campos:

- `date`
- `ticker`
- `type`
- `qty`
- `value`
- `note`

## Como manter separadas a conta EUR e a conta USD

Regras do projeto:

- EUR vive apenas em `data/eur.json`
- USD vive apenas em `data/usd.json`
- caixa EUR nunca entra em `data/usd.json`
- caixa USD nunca entra em `data/eur.json`
- a visão master mostra as duas contas em paralelo, sem tratar moedas como equivalentes

## Como funciona a visão consolidada

`data/consolidated.json` é uma camada de controlo.

Serve para:

- dizer qual a data mais recente global
- guardar totais rápidos por conta
- mostrar alertas master
- deixar explícito que a consolidação atual não usa FX automático

Importante:

- o total consolidado é uma visão agregada não convertida
- EUR e USD não devem ser somados como se fossem a mesma moeda

## Como fazer commit

### Opção simples pelo site do GitHub

1. abrir o repositório
2. entrar na pasta `data`
3. substituir os ficheiros JSON
4. carregar em `Commit changes...`
5. escrever algo como `update close 2026-04-10`
6. confirmar

### Opção pelo Git local

```powershell
git add .
git commit -m "update close 2026-04-10"
git push
```

## Como confirmar que o site atualizou

1. abrir o separador `Actions` no GitHub e confirmar que o deploy terminou
2. abrir o URL do GitHub Pages
3. confirmar a data no topo do dashboard
4. validar os números principais da conta EUR e da conta USD

## Como um utilizador sem experiência técnica deve proceder

Fluxo recomendado:

1. guardar os screenshots da XTB
2. enviar os screenshots no chat e pedir atualização diária
3. copiar os novos conteúdos JSON gerados pela IA
4. substituir os três ficheiros da pasta `data`
5. usar o botão `Commit changes...` no GitHub
6. esperar 1 a 2 minutos
7. abrir o site e confirmar a nova data

## Desenvolvimento local

Como a app usa `fetch`, é melhor abrir com um servidor local:

```powershell
python -m http.server 8000
```

ou

```powershell
npx serve .
```

Depois abrir `http://localhost:8000`.

## Notas de arquitetura

- o front-end é estável e não depende do conteúdo diário
- a manutenção normal acontece apenas na pasta `data`
- a lógica suporta crescimento para mais contas
- a camada master já prepara futura conversão cambial
- a base foi desenhada para fluxo diário com apoio de IA
