const ACCOUNT_TABS = [
  { id: "MASTER", label: "Visão Consolidada" },
  { id: "EUR", label: "Conta EUR" },
  { id: "USD", label: "Conta USD" }
];

const SECTION_TABS = [
  { id: "overview", label: "Visão geral" },
  { id: "table", label: "Tabela do dia" },
  { id: "history", label: "Histórico" },
  { id: "decision", label: "Decisão" },
  { id: "periods", label: "Semana / Mês" },
  { id: "charts", label: "Gráficos" },
  { id: "events", label: "Eventos" },
  { id: "database", label: "Base de dados" }
];

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "winners", label: "Vencedores" },
  { id: "losers", label: "Perdedores" }
];

const state = {
  rawData: null,
  accountView: "MASTER",
  sectionView: "overview",
  filter: "all"
};

const mount = document.getElementById("contentMount");
const alertsMount = document.getElementById("alertsMount");
const accountTabsMount = document.getElementById("accountTabs");
const sectionTabsMount = document.getElementById("sectionTabs");
const filterMount = document.getElementById("statusFilters");
const subtitleMount = document.getElementById("appSubtitle");
const liveStatusMount = document.getElementById("liveStatus");
const viewTitleMount = document.getElementById("viewTitle");
const heroMetaMount = document.getElementById("heroMeta");
const governanceMount = document.getElementById("sidebarGovernance");
const exportButton = document.getElementById("exportButton");

document.addEventListener("DOMContentLoaded", init);

async function init() {
  buildStaticNavigation();
  bindEvents();

  try {
    const source = await loadSource();
    state.rawData = enrichData(source);
    render();
  } catch (error) {
    console.error(error);
    renderError(error);
  }
}

async function loadSource() {
  const endpoints = {
    eur: "./data/eur.json",
    usd: "./data/usd.json",
    consolidated: "./data/consolidated.json"
  };

  const responses = await Promise.all(
    Object.entries(endpoints).map(async ([key, url]) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Falha a carregar ${url} com status ${response.status}`);
      }
      const json = await response.json();
      return [key, json];
    })
  );

  return Object.fromEntries(responses);
}

function bindEvents() {
  exportButton.addEventListener("click", () => {
    if (!state.rawData) return;
    const blob = new Blob([JSON.stringify(state.rawData.source, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trading-dashboard-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function buildStaticNavigation() {
  accountTabsMount.innerHTML = ACCOUNT_TABS.map((tab) => `
    <button type="button" data-account="${tab.id}" class="${tab.id === state.accountView ? "active" : ""}">
      ${tab.label}
    </button>
  `).join("");

  sectionTabsMount.innerHTML = SECTION_TABS.map((tab) => `
    <button type="button" data-section="${tab.id}" class="${tab.id === state.sectionView ? "active" : ""}">
      ${tab.label}
    </button>
  `).join("");

  filterMount.innerHTML = FILTERS.map((tab) => `
    <button type="button" data-filter="${tab.id}" class="${tab.id === state.filter ? "active" : ""}">
      ${tab.label}
    </button>
  `).join("");

  accountTabsMount.addEventListener("click", handleNavClick);
  sectionTabsMount.addEventListener("click", handleNavClick);
  filterMount.addEventListener("click", handleNavClick);
}

function handleNavClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.account) {
    state.accountView = button.dataset.account;
    if (state.accountView === "MASTER") state.filter = "all";
  }

  if (button.dataset.section) state.sectionView = button.dataset.section;
  if (button.dataset.filter) state.filter = button.dataset.filter;

  syncTabStates();
  if (state.rawData) state.rawData = enrichData(state.rawData.source);
  render();
}

function syncTabStates() {
  accountTabsMount.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.account === state.accountView);
  });
  sectionTabsMount.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === state.sectionView);
  });
  filterMount.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
}

function render() {
  if (!state.rawData) return;

  syncTabStates();
  renderTopMeta();
  renderGovernancePanel();

  if (state.accountView === "MASTER") {
    renderMasterView();
    return;
  }

  const account = state.rawData.accounts[state.accountView];
  alertsMount.innerHTML = renderAlerts(account.metrics.alerts);

  switch (state.sectionView) {
    case "overview":
      mount.innerHTML = renderAccountOverview(account);
      break;
    case "table":
      mount.innerHTML = renderDayTable(account);
      break;
    case "history":
      mount.innerHTML = renderHistory(account);
      break;
    case "decision":
      mount.innerHTML = renderDecision(account);
      break;
    case "periods":
      mount.innerHTML = renderPeriods(account);
      break;
    case "charts":
      mount.innerHTML = renderChartsSection(account);
      break;
    case "events":
      mount.innerHTML = renderEvents(account);
      break;
    case "database":
      mount.innerHTML = renderDatabase(account);
      break;
    default:
      mount.innerHTML = document.getElementById("emptyStateTemplate").innerHTML;
  }

  requestAnimationFrame(() => drawVisibleCharts(account));
}

function renderMasterView() {
  const consolidated = state.rawData.consolidated;
  alertsMount.innerHTML = renderAlerts(consolidated.alerts);

  switch (state.sectionView) {
    case "overview":
      mount.innerHTML = renderMasterOverview(consolidated);
      break;
    case "table":
      mount.innerHTML = renderMasterTable(consolidated);
      break;
    case "history":
      mount.innerHTML = renderMasterHistory(consolidated);
      break;
    case "decision":
      mount.innerHTML = renderMasterDecision(consolidated);
      break;
    case "periods":
      mount.innerHTML = renderMasterPeriods(consolidated);
      break;
    case "charts":
      mount.innerHTML = renderMasterChartsSection();
      break;
    case "events":
      mount.innerHTML = renderMasterEvents(consolidated);
      break;
    case "database":
      mount.innerHTML = renderMasterDatabase();
      break;
    default:
      mount.innerHTML = document.getElementById("emptyStateTemplate").innerHTML;
  }

  requestAnimationFrame(() => drawMasterCharts(consolidated));
}

function renderTopMeta() {
  const latestDate = state.rawData.source.consolidated.meta.latestDate;
  subtitleMount.textContent = "Front-end estável | Dados em JSON por conta | Atualização diária assistida por IA";
  liveStatusMount.textContent = `Data folder linked | ${formatDateLong(latestDate)}`;

  if (state.accountView === "MASTER") {
    viewTitleMount.textContent = "Master Overview";
    heroMetaMount.innerHTML = [
      heroPill("3 JSONs", "manutenção diária"),
      heroPill("EUR + USD", "contas isoladas"),
      heroPill(formatDateLong(latestDate), "último fecho")
    ].join("");
    return;
  }

  const account = state.rawData.accounts[state.accountView];
  viewTitleMount.textContent = `${account.meta.portfolioName} | ${account.meta.currency} / ${account.meta.market}`;
  heroMetaMount.innerHTML = [
    heroPill(formatCurrency(account.metrics.latest.valueTotal, account.meta.currency), "valor total"),
    heroPill(`${account.metrics.latest.positionsCount} posições`, "livro aberto"),
    heroPill(formatDateLong(account.meta.latestDate), "último fecho")
  ].join("");
}

function renderGovernancePanel() {
  if (state.accountView === "MASTER") {
    const meta = state.rawData.source.consolidated.meta;
    governanceMount.innerHTML = `
      <div class="section-label">Fluxo diário</div>
      <h3>Operação assistida por IA</h3>
      <ul>
        <li>Receber screenshots do fecho da XTB.</li>
        <li>A IA atualiza apenas data/eur.json, data/usd.json e data/consolidated.json.</li>
        <li>Commit simples no GitHub para atualizar o site.</li>
        <li>Última consolidação: ${formatDateLong(meta.latestDate)}.</li>
      </ul>
    `;
    return;
  }

  const account = state.rawData.accounts[state.accountView];
  governanceMount.innerHTML = `
    <div class="section-label">Governança</div>
    <h3>${account.meta.accountId}</h3>
    <ul>
      <li>Perda máxima diária: ${formatCurrency(account.governance.dailyLossLimit, account.meta.currency)}</li>
      <li>Perda máxima semanal: ${formatCurrency(account.governance.weeklyLossLimit, account.meta.currency)}</li>
      <li>Risco máximo por posição: ${formatPercent(account.governance.maxPositionRiskPct)}</li>
      <li>Risco agregado: ${formatPercent(account.metrics.aggregatedRiskPct)}</li>
    </ul>
  `;
}

function renderAlerts(alerts) {
  if (!alerts.length) return "";
  return alerts.map((alert) => `
    <article class="alert-card ${alert.severity}">
      <div class="section-label">${alert.type}</div>
      <h3>${alert.title}</h3>
      <p>${alert.message}</p>
    </article>
  `).join("");
}

function renderAccountOverview(account) {
  const latest = account.metrics.latest;
  return `
    <section class="panel">
      <div class="section-label">Dashboard Executivo</div>
      <div class="grid-kpis">
        ${renderMetricCard("Posições abertas", formatCurrency(latest.openValue, account.meta.currency), `${latest.positionsCount} posições ativas`)}
        ${renderMetricCard("Caixa", formatCurrency(latest.cash, account.meta.currency), "liquidez disponível")}
        ${renderMetricCard("Valor total", formatCurrency(latest.valueTotal, account.meta.currency), account.meta.market)}
        ${renderMetricCard("P/L aberto", signedCurrency(latest.plOpen, account.meta.currency), signedPercent(latest.plOpenPct))}
        ${renderMetricCard("P/L diário", signedCurrency(latest.plDay, account.meta.currency), signedPercent(latest.plDayPct))}
        ${renderMetricCard("P/L semanal", signedCurrency(account.metrics.weekly.plPeriod, account.meta.currency), signedPercent(account.metrics.weekly.plPeriodPct))}
        ${renderMetricCard("P/L mensal", signedCurrency(account.metrics.monthly.plPeriod, account.meta.currency), signedPercent(account.metrics.monthly.plPeriodPct))}
        ${renderMetricCard("Melhor ativo", latest.bestTicker, signedPercent(latest.bestPct))}
        ${renderMetricCard("Pior ativo", latest.worstTicker, signedPercent(latest.worstPct))}
        ${renderMetricCard("Posições", `${latest.positionsCount}`, `${latest.winners} vencedoras / ${latest.losers} perdedoras`)}
        ${renderMetricCard("Risco médio", formatPercent(account.metrics.averageRiskPct), "média das posições")}
        ${renderMetricCard("Exposição", formatPercent(account.metrics.exposurePct), `top 3 ${formatPercent(account.metrics.concentrationTop3)}`)}
      </div>
    </section>

    <section class="summary-grid">
      <article class="summary-card today-card">
        <div class="section-label">Hoje em 20 segundos</div>
        <h3>${account.meta.portfolioName}</h3>
        <ul>
          <li><span>Total da conta</span><strong>${formatCurrency(latest.valueTotal, account.meta.currency)}</strong></li>
          <li><span>P/L diário</span><strong class="${valueClass(latest.plDay)}">${signedCurrency(latest.plDay, account.meta.currency)}</strong></li>
          <li><span>P/L semanal</span><strong class="${valueClass(account.metrics.weekly.plPeriod)}">${signedCurrency(account.metrics.weekly.plPeriod, account.meta.currency)}</strong></li>
          <li><span>Ativo mais forte</span><strong>${latest.bestTicker}</strong></li>
          <li><span>Ativo a rever</span><strong>${latest.worstTicker}</strong></li>
          <li><span>Risco médio</span><strong>${formatPercent(account.metrics.averageRiskPct)}</strong></li>
        </ul>
      </article>

      <article class="summary-card">
        <div class="section-label">Camada operacional</div>
        <h3>Resumo de manutenção</h3>
        <ul class="compact-list">
          <li><span>Lucro total vencedores</span><strong class="positive">${signedCurrency(account.metrics.winnerProfit, account.meta.currency)}</strong></li>
          <li><span>Perda total perdedores</span><strong class="negative">${signedCurrency(account.metrics.loserLoss, account.meta.currency)}</strong></li>
          <li><span>Duração média</span><strong>${account.metrics.averageDaysOpen.toFixed(1)} dias</strong></li>
          <li><span>Maior peso</span><strong>${account.metrics.maxWeightTicker} (${formatPercent(account.metrics.maxWeightPct)})</strong></li>
          <li><span>Setup dominante</span><strong>${account.metrics.dominantSetup}</strong></li>
          <li><span>Status governança</span><strong>${account.metrics.governanceStatus}</strong></li>
        </ul>
      </article>
    </section>

    <section class="two-column-grid">
      <article class="table-card">
        <div class="section-label">Tabela rápida</div>
        <h3>Top posições de hoje</h3>
        ${renderSnapshotTable(account, true)}
      </article>
      <article class="summary-card">
        <div class="section-label">Workflow diário</div>
        <h3>Passos práticos</h3>
        <ul class="compact-list">
          <li><span>1. Receber screenshots</span><strong>XTB close</strong></li>
          <li><span>2. Atualizar dados</span><strong>${account.meta.currency === "EUR" ? "data/eur.json" : "data/usd.json"}</strong></li>
          <li><span>3. Rever alertas</span><strong>${account.metrics.alerts.length} alertas</strong></li>
          <li><span>4. Commit</span><strong>GitHub Pages</strong></li>
        </ul>
      </article>
    </section>
  `;
}

function renderDayTable(account) {
  return `
    <section class="table-card">
      <div class="section-label">Tabela operacional do dia</div>
      <h3>Posições abertas e leitura tática</h3>
      ${renderSnapshotTable(account, false)}
    </section>
  `;
}

function renderHistory(account) {
  return `
    <section class="table-card">
      <div class="section-label">Matriz histórica diária</div>
      <h3>Leitura multi-dia por data</h3>
      <p class="muted small">Cada coluna acrescenta valor, P/L aberto % e P/L diário % do mesmo book.</p>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Métrica</th>
              ${account.dailySummary.map((row) => `<th>${formatDateShort(row.date)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Valor</td>
              ${account.dailySummary.map((row) => `<td>${formatCurrency(row.valueTotal, account.meta.currency)}</td>`).join("")}
            </tr>
            <tr>
              <td>P/L aberto %</td>
              ${account.dailySummary.map((row) => `<td class="${valueClass(row.plOpenPct)}">${signedPercent(row.plOpenPct)}</td>`).join("")}
            </tr>
            <tr>
              <td>P/L dia %</td>
              ${account.dailySummary.map((row) => `<td class="${valueClass(row.plDayPct)}">${signedPercent(row.plDayPct)}</td>`).join("")}
            </tr>
            <tr>
              <td>Caixa</td>
              ${account.dailySummary.map((row) => `<td>${formatCurrency(row.cash, account.meta.currency)}</td>`).join("")}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDecision(account) {
  return `
    <section class="table-card">
      <div class="section-label">Quadro de decisão</div>
      <h3>Prioridades da sessão</h3>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Ativo</th>
              <th>Estado</th>
              <th>Ganho %</th>
              <th>Peso %</th>
              <th>Risk %</th>
              <th>Leitura</th>
              <th>Ação</th>
              <th>Prioridade</th>
            </tr>
          </thead>
          <tbody>
            ${account.metrics.filteredSnapshots.map((position) => {
              const decision = buildDecision(position, account);
              return `
                <tr>
                  <td>${position.ticker}</td>
                  <td><span class="tag">${position.status}</span></td>
                  <td class="${valueClass(position.plPct)}">${signedPercent(position.plPct)}</td>
                  <td>${formatPercent(position.weightPct)}</td>
                  <td>${formatPercent(position.riskPct)}</td>
                  <td>${decision.reading}</td>
                  <td>${decision.action}</td>
                  <td>${decision.priority}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderPeriods(account) {
  return `
    <section class="table-card">
      <div class="section-label">Resumo semanal e mensal</div>
      <h3>Performance por período</h3>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Período</th>
              <th>Valor final</th>
              <th>P/L aberto</th>
              <th>P/L aberto %</th>
              <th>P/L período</th>
              <th>P/L período %</th>
              <th>Melhor ativo</th>
              <th>Pior ativo</th>
            </tr>
          </thead>
          <tbody>
            ${account.periodSummary.map((row) => `
              <tr>
                <td>${row.period}</td>
                <td>${formatCurrency(row.valueFinal, account.meta.currency)}</td>
                <td class="${valueClass(row.plOpen)}">${signedCurrency(row.plOpen, account.meta.currency)}</td>
                <td class="${valueClass(row.plOpenPct)}">${signedPercent(row.plOpenPct)}</td>
                <td class="${valueClass(row.plPeriod)}">${signedCurrency(row.plPeriod, account.meta.currency)}</td>
                <td class="${valueClass(row.plPeriodPct)}">${signedPercent(row.plPeriodPct)}</td>
                <td>${row.bestTicker}</td>
                <td>${row.worstTicker}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderChartsSection(account) {
  return `
    <section class="chart-grid">
      <article class="chart-card">
        <div class="section-label">Valor total</div>
        <h3>Evolução do valor total</h3>
        <div class="canvas-wrap"><canvas id="valueChart"></canvas></div>
      </article>
      <article class="chart-card">
        <div class="section-label">Alocação</div>
        <h3>Peso por ativo</h3>
        <div class="canvas-wrap"><canvas id="allocationChart"></canvas></div>
        <div class="legend-row">
          ${account.metrics.latestSnapshots.map((item, index) => `
            <span><i class="legend-dot" style="background:${palette(index)}"></i>${item.ticker}</span>
          `).join("")}
        </div>
      </article>
      <article class="chart-card">
        <div class="section-label">P/L diário</div>
        <h3>Tração diária do projeto</h3>
        <div class="canvas-wrap"><canvas id="dailyPlChart"></canvas></div>
      </article>
    </section>
  `;
}

function renderEvents(account) {
  return `
    <section class="table-card">
      <div class="section-label">Eventos operacionais</div>
      <h3>Entradas, reforços, parciais, saídas e movimentos de caixa</h3>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Ticker</th>
              <th>Tipo</th>
              <th>Quantidade</th>
              <th>Valor</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            ${account.events.map((event) => `
              <tr>
                <td>${formatDateShort(event.date)}</td>
                <td>${event.ticker || "CASH"}</td>
                <td>${event.type}</td>
                <td>${event.qty ?? "-"}</td>
                <td class="${valueClass(event.value)}">${signedCurrency(event.value, account.meta.currency)}</td>
                <td>${event.note}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDatabase(account) {
  return `
    <section class="db-grid">
      <article class="panel">
        <div class="section-label">Snapshots</div>
        <h3>${account.meta.currency} raw data</h3>
        <pre class="json-box">${escapeHtml(JSON.stringify(account.snapshots, null, 2))}</pre>
      </article>
      <article class="panel">
        <div class="section-label">Resumo diário</div>
        <h3>Daily summary</h3>
        <pre class="json-box">${escapeHtml(JSON.stringify(account.dailySummary, null, 2))}</pre>
      </article>
      <article class="panel">
        <div class="section-label">Eventos</div>
        <h3>Operations log</h3>
        <pre class="json-box">${escapeHtml(JSON.stringify(account.events, null, 2))}</pre>
      </article>
    </section>
  `;
}

function renderMasterOverview(consolidated) {
  return `
    <section class="panel">
      <div class="section-label">Visão Consolidada</div>
      <div class="consolidated-grid">
        ${Object.values(consolidated.accounts).map((account) => `
          <article class="summary-card">
            <div class="card-kicker">${account.meta.currency} | ${account.meta.market}</div>
            <h3>${account.meta.portfolioName}</h3>
            <ul class="compact-list">
              <li><span>Valor total</span><strong>${formatCurrency(account.metrics.latest.valueTotal, account.meta.currency)}</strong></li>
              <li><span>Caixa</span><strong>${formatCurrency(account.metrics.latest.cash, account.meta.currency)}</strong></li>
              <li><span>P/L diário</span><strong class="${valueClass(account.metrics.latest.plDay)}">${signedCurrency(account.metrics.latest.plDay, account.meta.currency)}</strong></li>
              <li><span>P/L aberto</span><strong class="${valueClass(account.metrics.latest.plOpen)}">${signedCurrency(account.metrics.latest.plOpen, account.meta.currency)}</strong></li>
              <li><span>Posições</span><strong>${account.metrics.latest.positionsCount}</strong></li>
              <li><span>Melhor / pior</span><strong>${account.metrics.latest.bestTicker} / ${account.metrics.latest.worstTicker}</strong></li>
              <li><span>Alertas</span><strong>${account.metrics.alerts.length}</strong></li>
            </ul>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="two-column-grid">
      <article class="summary-card">
        <div class="section-label">Totais</div>
        <h3>Agregado não convertido</h3>
        <ul class="compact-list">
          <li><span>Total EUR</span><strong>${formatCurrency(consolidated.meta.nonConvertedTotals.EUR, "EUR")}</strong></li>
          <li><span>Total USD</span><strong>${formatCurrency(consolidated.meta.nonConvertedTotals.USD, "USD")}</strong></li>
          <li><span>Posições EUR</span><strong>${consolidated.accounts.EUR.metrics.latest.positionsCount}</strong></li>
          <li><span>Posições USD</span><strong>${consolidated.accounts.USD.metrics.latest.positionsCount}</strong></li>
          <li><span>Fluxo diário</span><strong>screenshots → JSON → commit</strong></li>
        </ul>
      </article>
      <article class="summary-card">
        <div class="section-label">Nota</div>
        <h3>Consolidação consciente</h3>
        <p class="muted">${consolidated.meta.consolidationNote}</p>
      </article>
    </section>
  `;
}

function renderMasterTable(consolidated) {
  const rows = Object.values(consolidated.accounts).flatMap((account) =>
    account.metrics.filteredSnapshots.map((row) => ({ ...row, currency: account.meta.currency, portfolioName: account.meta.portfolioName }))
  );

  return `
    <section class="table-card">
      <div class="section-label">Tabela consolidada controlada</div>
      <h3>Posições com moeda explícita</h3>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Conta</th>
              <th>Moeda</th>
              <th>Ativo</th>
              <th>Valor</th>
              <th>P/L total</th>
              <th>P/L dia</th>
              <th>Peso %</th>
              <th>Risk %</th>
              <th>Stage</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${row.portfolioName}</td>
                <td>${row.currency}</td>
                <td>${row.ticker}</td>
                <td>${formatCurrency(row.value, row.currency)}</td>
                <td class="${valueClass(row.plTotal)}">${signedCurrency(row.plTotal, row.currency)}</td>
                <td class="${valueClass(row.plDay)}">${signedCurrency(row.plDay, row.currency)}</td>
                <td>${formatPercent(row.weightPct)}</td>
                <td>${formatPercent(row.riskPct)}</td>
                <td>${row.stage}</td>
                <td>${row.status}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMasterHistory(consolidated) {
  return `
    <section class="table-card">
      <div class="section-label">Histórico consolidado</div>
      <h3>Matriz por conta sem misturar moeda</h3>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Conta</th>
              <th>Moeda</th>
              ${consolidated.accounts.EUR.dailySummary.map((row) => `<th>${formatDateShort(row.date)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${Object.values(consolidated.accounts).map((account) => `
              <tr>
                <td>${account.meta.portfolioName}</td>
                <td>${account.meta.currency}</td>
                ${account.dailySummary.map((row) => `<td>${formatCurrency(row.valueTotal, account.meta.currency)} | ${signedPercent(row.plDayPct)}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMasterDecision(consolidated) {
  const rows = Object.values(consolidated.accounts).map((account) => {
    const topRisk = [...account.metrics.latestSnapshots].sort((a, b) => b.riskPct - a.riskPct)[0];
    return `
      <tr>
        <td>${account.meta.portfolioName}</td>
        <td>${account.meta.currency}</td>
        <td>${account.metrics.latest.bestTicker}</td>
        <td>${account.metrics.latest.worstTicker}</td>
        <td>${topRisk ? topRisk.ticker : "-"}</td>
        <td>${account.metrics.governanceStatus}</td>
        <td>${account.metrics.alerts.length ? "Rever" : "Em linha"}</td>
      </tr>
    `;
  }).join("");

  return `
    <section class="table-card">
      <div class="section-label">Decisão consolidada</div>
      <h3>Alertas por conta</h3>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Conta</th>
              <th>Moeda</th>
              <th>Mais forte</th>
              <th>A rever</th>
              <th>Maior risco</th>
              <th>Governança</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMasterPeriods(consolidated) {
  return `
    <section class="table-card">
      <div class="section-label">Períodos por conta</div>
      <h3>Semana e mês separados por moeda</h3>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Conta</th>
              <th>Moeda</th>
              <th>Período</th>
              <th>Valor final</th>
              <th>P/L período</th>
              <th>P/L período %</th>
              <th>Melhor ativo</th>
              <th>Pior ativo</th>
            </tr>
          </thead>
          <tbody>
            ${Object.values(consolidated.accounts).flatMap((account) =>
              account.periodSummary.map((row) => `
                <tr>
                  <td>${account.meta.portfolioName}</td>
                  <td>${account.meta.currency}</td>
                  <td>${row.period}</td>
                  <td>${formatCurrency(row.valueFinal, account.meta.currency)}</td>
                  <td class="${valueClass(row.plPeriod)}">${signedCurrency(row.plPeriod, account.meta.currency)}</td>
                  <td class="${valueClass(row.plPeriodPct)}">${signedPercent(row.plPeriodPct)}</td>
                  <td>${row.bestTicker}</td>
                  <td>${row.worstTicker}</td>
                </tr>
              `)
            ).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMasterChartsSection() {
  return `
    <section class="chart-grid">
      <article class="chart-card">
        <div class="section-label">EUR</div>
        <h3>Evolução da conta EUR</h3>
        <div class="canvas-wrap"><canvas id="eurValueChart"></canvas></div>
      </article>
      <article class="chart-card">
        <div class="section-label">USD</div>
        <h3>Evolução da conta USD</h3>
        <div class="canvas-wrap"><canvas id="usdValueChart"></canvas></div>
      </article>
      <article class="chart-card">
        <div class="section-label">Risco</div>
        <h3>Exposição por conta</h3>
        <div class="canvas-wrap"><canvas id="riskBarChart"></canvas></div>
      </article>
    </section>
  `;
}

function renderMasterEvents(consolidated) {
  const rows = Object.values(consolidated.accounts).flatMap((account) =>
    account.events.map((event) => ({ ...event, portfolioName: account.meta.portfolioName, currency: account.meta.currency }))
  ).sort((a, b) => b.date.localeCompare(a.date));

  return `
    <section class="table-card">
      <div class="section-label">Eventos consolidados</div>
      <h3>Log operacional multi-conta</h3>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Conta</th>
              <th>Data</th>
              <th>Ticker</th>
              <th>Tipo</th>
              <th>Quantidade</th>
              <th>Valor</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((event) => `
              <tr>
                <td>${event.portfolioName}</td>
                <td>${formatDateShort(event.date)}</td>
                <td>${event.ticker || "CASH"}</td>
                <td>${event.type}</td>
                <td>${event.qty ?? "-"}</td>
                <td class="${valueClass(event.value)}">${signedCurrency(event.value, event.currency)}</td>
                <td>${event.note}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMasterDatabase() {
  return `
    <section class="db-grid">
      <article class="panel">
        <div class="section-label">data/eur.json</div>
        <h3>Conta EUR</h3>
        <pre class="json-box">${escapeHtml(JSON.stringify(state.rawData.source.eur, null, 2))}</pre>
      </article>
      <article class="panel">
        <div class="section-label">data/usd.json</div>
        <h3>Conta USD</h3>
        <pre class="json-box">${escapeHtml(JSON.stringify(state.rawData.source.usd, null, 2))}</pre>
      </article>
      <article class="panel">
        <div class="section-label">data/consolidated.json</div>
        <h3>Visão consolidada</h3>
        <pre class="json-box">${escapeHtml(JSON.stringify(state.rawData.source.consolidated, null, 2))}</pre>
      </article>
    </section>
  `;
}

function renderSnapshotTable(account, compact) {
  const rows = compact ? account.metrics.filteredSnapshots.slice(0, 5) : account.metrics.filteredSnapshots;
  return `
    <div class="table-shell">
      <table>
        <thead>
          <tr>
            <th>Ativo</th>
            <th>Quantidade</th>
            <th>Preço médio</th>
            <th>Preço atual</th>
            <th>Valor</th>
            <th>P/L total</th>
            <th>P/L total %</th>
            <th>P/L dia</th>
            <th>P/L dia %</th>
            <th>Peso %</th>
            <th>Setup</th>
            <th>Stage</th>
            <th>Stop</th>
            <th>Target 1</th>
            <th>Risk %</th>
            <th>Dias aberto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((position) => `
            <tr>
              <td>${position.ticker}</td>
              <td>${position.qty}</td>
              <td>${formatNumber(position.avgPrice, account.meta.currency)}</td>
              <td>${formatNumber(position.currentPrice, account.meta.currency)}</td>
              <td>${formatCurrency(position.value, account.meta.currency)}</td>
              <td class="${valueClass(position.plTotal)}">${signedCurrency(position.plTotal, account.meta.currency)}</td>
              <td class="${valueClass(position.plPct)}">${signedPercent(position.plPct)}</td>
              <td class="${valueClass(position.plDay)}">${signedCurrency(position.plDay, account.meta.currency)}</td>
              <td class="${valueClass(position.plDayPct)}">${signedPercent(position.plDayPct)}</td>
              <td>${formatPercent(position.weightPct)}</td>
              <td>${position.setup}</td>
              <td><span class="tag ${stageClass(position.stage)}">${position.stage}</span></td>
              <td>${formatNumber(position.stop, account.meta.currency)}</td>
              <td>${formatNumber(position.target1, account.meta.currency)}</td>
              <td>${formatPercent(position.riskPct)}</td>
              <td>${position.daysOpen}</td>
              <td>${position.status}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMetricCard(label, value, detail) {
  return `
    <article class="metric-card">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
      <div class="metric-detail">${detail}</div>
    </article>
  `;
}

function heroPill(value, label) {
  return `<div class="hero-pill"><strong>${value}</strong> · ${label}</div>`;
}

function enrichData(source) {
  const accounts = {
    EUR: buildAccountModel(source.eur),
    USD: buildAccountModel(source.usd)
  };

  return {
    source,
    accounts,
    consolidated: {
      ...source.consolidated,
      accounts,
      alerts: buildMasterAlerts(source.consolidated, accounts)
    }
  };
}

function buildAccountModel(accountData) {
  const cloned = structuredClone(accountData);
  const latestSnapshots = cloned.snapshots.filter((row) => row.date === cloned.meta.latestDate);
  const latest = cloned.dailySummary.find((row) => row.date === cloned.meta.latestDate);
  const filteredSnapshots = applyFilter(latestSnapshots, state.filter);
  const winnerRows = latestSnapshots.filter((row) => row.plTotal >= 0);
  const loserRows = latestSnapshots.filter((row) => row.plTotal < 0);
  const best = [...latestSnapshots].sort((a, b) => b.plPct - a.plPct)[0];
  const worst = [...latestSnapshots].sort((a, b) => a.plPct - b.plPct)[0];
  const maxWeightRow = [...latestSnapshots].sort((a, b) => b.weightPct - a.weightPct)[0];
  const averageRiskPct = average(latestSnapshots.map((row) => row.riskPct));
  const averageDaysOpen = average(latestSnapshots.map((row) => row.daysOpen));
  const concentrationTop3 = latestSnapshots.map((row) => row.weightPct).sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0);
  const exposurePct = latest.valueTotal ? ((latest.valueTotal - latest.cash) / latest.valueTotal) * 100 : 0;
  const aggregatedRiskPct = latestSnapshots.reduce((sum, row) => sum + (row.weightPct * row.riskPct) / 100, 0);
  const weekly = cloned.periodSummary.find((row) => row.period.toLowerCase().includes("week")) || cloned.periodSummary[0];
  const monthly = cloned.periodSummary.find((row) => row.period.toLowerCase().includes("month")) || cloned.periodSummary[1] || cloned.periodSummary[0];
  const alerts = buildAccountAlerts(cloned, latestSnapshots, latest, concentrationTop3, averageRiskPct, aggregatedRiskPct);

  return {
    ...cloned,
    metrics: {
      latest: {
        ...latest,
        openValue: latest.valueTotal - latest.cash,
        positionsCount: latestSnapshots.length,
        winners: winnerRows.length,
        losers: loserRows.length,
        bestTicker: best ? best.ticker : "-",
        bestPct: best ? best.plPct : 0,
        worstTicker: worst ? worst.ticker : "-",
        worstPct: worst ? worst.plPct : 0
      },
      latestSnapshots,
      filteredSnapshots,
      averageRiskPct,
      concentrationTop3,
      exposurePct,
      aggregatedRiskPct,
      winnerProfit: sum(winnerRows.map((row) => row.plTotal)),
      loserLoss: sum(loserRows.map((row) => row.plTotal)),
      averageDaysOpen,
      maxWeightTicker: maxWeightRow ? maxWeightRow.ticker : "-",
      maxWeightPct: maxWeightRow ? maxWeightRow.weightPct : 0,
      dominantSetup: mode(latestSnapshots.map((row) => row.setup)),
      weekly,
      monthly,
      alerts,
      governanceStatus: alerts.some((alert) => alert.severity === "critical") ? "Attention required" : "Within controls"
    }
  };
}

function buildAccountAlerts(account, latestSnapshots, latest, concentrationTop3, averageRiskPct, aggregatedRiskPct) {
  const alerts = [];
  const highRisk = latestSnapshots.filter((row) => row.riskPct > account.governance.maxPositionRiskPct);
  const weakToday = latestSnapshots.filter((row) => row.plDayPct <= -2);

  if (latest.plDay < 0 && Math.abs(latest.plDay) >= account.governance.dailyLossLimit * 0.75) {
    alerts.push({
      type: "Risk threshold",
      title: "Perda diária perto do limite",
      message: `${account.meta.accountId} aproxima-se de 75% do limite diário.`,
      severity: "critical"
    });
  }

  if (highRisk.length) {
    alerts.push({
      type: "Position risk",
      title: `${highRisk.length} posição(ões) acima do risco máximo`,
      message: `Rever ${highRisk.map((row) => row.ticker).join(", ")} face ao limite de ${formatPercent(account.governance.maxPositionRiskPct)}.`,
      severity: "warning"
    });
  }

  if (concentrationTop3 > 65) {
    alerts.push({
      type: "Concentration",
      title: "Concentração elevada",
      message: `As 3 maiores posições representam ${formatPercent(concentrationTop3)} da conta.`,
      severity: "warning"
    });
  }

  if (weakToday.length) {
    alerts.push({
      type: "Review",
      title: "Ativos a rever",
      message: `Hoje pedem revisão: ${weakToday.map((row) => row.ticker).join(", ")}.`,
      severity: "warning"
    });
  }

  if (averageRiskPct <= account.governance.maxPositionRiskPct * 0.7) {
    alerts.push({
      type: "Governance",
      title: "Risco médio controlado",
      message: `Risco médio em ${formatPercent(averageRiskPct)} e risco agregado em ${formatPercent(aggregatedRiskPct)}.`,
      severity: "good"
    });
  }

  return alerts.slice(0, 4);
}

function buildMasterAlerts(consolidated, accounts) {
  return [
    {
      type: "Consolidated view",
      title: "Sem conversão cambial automática",
      message: consolidated.meta.consolidationNote,
      severity: "warning"
    },
    ...(consolidated.alerts || []).map((alert) => ({
      ...alert,
      severity: alert.severity || "warning"
    })),
    ...Object.values(accounts).flatMap((account) =>
      account.metrics.alerts.slice(0, 1).map((alert) => ({
        ...alert,
        title: `${account.meta.currency}: ${alert.title}`
      }))
    )
  ].slice(0, 4);
}

function applyFilter(rows, filterId) {
  if (filterId === "winners") return rows.filter((row) => row.plTotal >= 0);
  if (filterId === "losers") return rows.filter((row) => row.plTotal < 0);
  return rows;
}

function buildDecision(position, account) {
  const overRisk = position.riskPct > account.governance.maxPositionRiskPct;
  const weak = position.plDayPct < -1.5;
  const strong = position.plPct > 8;

  if (overRisk && weak) return { reading: "Risco elevado com deterioração", action: "Reduzir ou reancorar stop", priority: "Alta" };
  if (strong && position.weightPct > 18) return { reading: "Vencedor relevante", action: "Avaliar parcial", priority: "Média" };
  if (position.status.toLowerCase().includes("watch")) return { reading: "Setup em observação", action: "Esperar confirmação", priority: "Baixa" };
  return { reading: "Estrutura controlada", action: "Manter plano", priority: "Média" };
}

function drawVisibleCharts(account) {
  if (state.sectionView !== "charts") return;

  drawLineChart("valueChart", {
    labels: account.dailySummary.map((row) => formatDateShort(row.date)),
    values: account.dailySummary.map((row) => row.valueTotal),
    stroke: "#8fd0ff",
    fill: "rgba(143, 208, 255, 0.16)"
  });

  drawDonutChart("allocationChart", account.metrics.latestSnapshots.map((row) => ({
    label: row.ticker,
    value: row.weightPct
  })));

  drawBarChart("dailyPlChart", account.dailySummary.map((row) => ({
    label: formatDateShort(row.date),
    value: row.plDay
  })), account.meta.currency);
}

function drawMasterCharts(consolidated) {
  if (state.sectionView !== "charts") return;

  drawLineChart("eurValueChart", {
    labels: consolidated.accounts.EUR.dailySummary.map((row) => formatDateShort(row.date)),
    values: consolidated.accounts.EUR.dailySummary.map((row) => row.valueTotal),
    stroke: "#57c8b0",
    fill: "rgba(87, 200, 176, 0.16)"
  });

  drawLineChart("usdValueChart", {
    labels: consolidated.accounts.USD.dailySummary.map((row) => formatDateShort(row.date)),
    values: consolidated.accounts.USD.dailySummary.map((row) => row.valueTotal),
    stroke: "#66b6ff",
    fill: "rgba(102, 182, 255, 0.16)"
  });

  drawGroupedBars("riskBarChart", [
    { label: "EUR", value: consolidated.accounts.EUR.metrics.exposurePct, color: "#57c8b0" },
    { label: "USD", value: consolidated.accounts.USD.metrics.exposurePct, color: "#66b6ff" }
  ]);
}

function drawLineChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = prepareCanvas(canvas);
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 24, right: 24, bottom: 32, left: 44 };
  const min = Math.min(...config.values);
  const max = Math.max(...config.values);
  const range = max - min || 1;

  ctx.clearRect(0, 0, width, height);
  drawChartFrame(ctx, width, height, padding);

  const points = config.values.map((value, index) => {
    const x = padding.left + ((width - padding.left - padding.right) / Math.max(config.values.length - 1, 1)) * index;
    const y = height - padding.bottom - ((value - min) / range) * (height - padding.top - padding.bottom);
    return { x, y };
  });

  ctx.beginPath();
  ctx.moveTo(points[0].x, height - padding.bottom);
  points.forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = config.fill;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.strokeStyle = config.stroke;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#dbe8f8";
  ctx.font = "12px Manrope";
  config.labels.forEach((label, index) => {
    ctx.fillText(label, points[index].x - 12, height - 12);
  });
}

function drawDonutChart(canvasId, series) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = prepareCanvas(canvas);
  if (!ctx) return;

  const total = sum(series.map((item) => item.value)) || 1;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(canvas.width, canvas.height) * 0.28;
  const inner = radius * 0.58;
  let start = -Math.PI / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  series.forEach((item, index) => {
    const angle = (item.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, start, start + angle);
    ctx.arc(centerX, centerY, inner, start + angle, start, true);
    ctx.closePath();
    ctx.fillStyle = palette(index);
    ctx.fill();
    start += angle;
  });

  ctx.fillStyle = "#eef4ff";
  ctx.font = "700 28px Space Grotesk";
  ctx.textAlign = "center";
  ctx.fillText("100%", centerX, centerY + 8);
  ctx.font = "12px Manrope";
  ctx.fillStyle = "#9db0c8";
  ctx.fillText("portfolio weight", centerX, centerY + 28);
}

function drawBarChart(canvasId, series, currency) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = prepareCanvas(canvas);
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawChartFrame(ctx, canvas.width, canvas.height, { top: 24, right: 20, bottom: 34, left: 38 });

  const max = Math.max(...series.map((item) => Math.abs(item.value))) || 1;
  const baseline = canvas.height / 2 + 12;
  const barWidth = Math.max(18, (canvas.width - 90) / series.length - 10);

  series.forEach((item, index) => {
    const height = (Math.abs(item.value) / max) * (canvas.height * 0.3);
    const x = 48 + index * (barWidth + 10);
    const y = item.value >= 0 ? baseline - height : baseline;
    ctx.fillStyle = item.value >= 0 ? "rgba(77, 212, 168, 0.88)" : "rgba(255, 111, 125, 0.88)";
    ctx.fillRect(x, y, barWidth, height);
    ctx.fillStyle = "#9db0c8";
    ctx.font = "11px Manrope";
    ctx.save();
    ctx.translate(x + 4, canvas.height - 10);
    ctx.rotate(-0.4);
    ctx.fillText(item.label, 0, 0);
    ctx.restore();
  });

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.moveTo(38, baseline);
  ctx.lineTo(canvas.width - 18, baseline);
  ctx.stroke();

  ctx.fillStyle = "#9db0c8";
  ctx.font = "12px Manrope";
  ctx.fillText(currency, 18, 20);
}

function drawGroupedBars(canvasId, series) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = prepareCanvas(canvas);
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawChartFrame(ctx, canvas.width, canvas.height, { top: 24, right: 20, bottom: 30, left: 36 });

  const max = Math.max(...series.map((item) => item.value), 100);
  const chartHeight = canvas.height - 70;
  const baseline = canvas.height - 34;
  const slotWidth = (canvas.width - 80) / series.length;

  series.forEach((item, index) => {
    const barHeight = (item.value / max) * chartHeight;
    const x = 50 + index * slotWidth;
    const width = Math.min(88, slotWidth * 0.5);
    const y = baseline - barHeight;
    ctx.fillStyle = item.color;
    ctx.fillRect(x, y, width, barHeight);
    ctx.fillStyle = "#eef4ff";
    ctx.font = "700 14px Manrope";
    ctx.fillText(`${item.value.toFixed(1)}%`, x, y - 8);
    ctx.fillStyle = "#9db0c8";
    ctx.fillText(item.label, x, baseline + 18);
  });
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  return canvas.getContext("2d");
}

function drawChartFrame(ctx, width, height, padding) {
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = padding.top + ((height - padding.top - padding.bottom) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }
}

function renderError(error) {
  subtitleMount.textContent = "Não foi possível carregar os ficheiros JSON";
  liveStatusMount.textContent = "Fetch error";
  alertsMount.innerHTML = `
    <article class="alert-card critical">
      <div class="section-label">Erro</div>
      <h3>Falha a ler a pasta data</h3>
      <p>${error.message}. Em GitHub Pages funciona por HTTP; localmente use um servidor estático.</p>
    </article>
  `;
  mount.innerHTML = document.getElementById("emptyStateTemplate").innerHTML;
}

function formatCurrency(value, currency) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

function formatNumber(value, currency) {
  return `${new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)} ${currency}`;
}

function signedCurrency(value, currency) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCurrency(value, currency)}`;
}

function formatPercent(value) {
  return `${Number(value).toFixed(2)}%`;
}

function signedPercent(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPercent(value)}`;
}

function formatDateShort(value) {
  return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

function formatDateLong(value) {
  return new Date(value).toLocaleDateString("pt-PT", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function stageClass(stage) {
  return `stage-${stage.toLowerCase().replace(/\s+/g, "-")}`;
}

function valueClass(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function average(values) {
  return values.length ? sum(values) / values.length : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function mode(values) {
  const count = new Map();
  values.forEach((value) => count.set(value, (count.get(value) || 0) + 1));
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
}

function palette(index) {
  const colors = ["#66b6ff", "#57c8b0", "#f6c35b", "#ff8aa1", "#9b8cff", "#7dd3fc"];
  return colors[index % colors.length];
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
