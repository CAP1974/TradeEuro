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

const STALE_DAYS_LIMIT = 1;
const CONCENTRATION_LIMIT = 65;

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
      if (!response.ok) throw new Error(`Falha a carregar ${url} com status ${response.status}`);
      return [key, await response.json()];
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
    link.download = `trading-dashboard-v11-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function buildStaticNavigation() {
  accountTabsMount.innerHTML = ACCOUNT_TABS.map((tab) => navButton("account", tab.id, tab.label, tab.id === state.accountView)).join("");
  sectionTabsMount.innerHTML = SECTION_TABS.map((tab) => navButton("section", tab.id, tab.label, tab.id === state.sectionView)).join("");
  filterMount.innerHTML = FILTERS.map((tab) => navButton("filter", tab.id, tab.label, tab.id === state.filter)).join("");

  accountTabsMount.addEventListener("click", handleNavClick);
  sectionTabsMount.addEventListener("click", handleNavClick);
  filterMount.addEventListener("click", handleNavClick);
}

function navButton(type, value, label, active) {
  return `<button type="button" data-${type}="${value}" class="${active ? "active" : ""}">${label}</button>`;
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

  if (state.rawData) state.rawData = enrichData(state.rawData.source);
  syncTabStates();
  render();
}

function syncTabStates() {
  toggleTabState(accountTabsMount, "account", state.accountView);
  toggleTabState(sectionTabsMount, "section", state.sectionView);
  toggleTabState(filterMount, "filter", state.filter);
}

function toggleTabState(container, key, value) {
  container.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset[key] === value);
  });
}

function render() {
  if (!state.rawData) return;

  syncTabStates();
  renderTopMeta();
  renderSidebarStatus();

  if (state.accountView === "MASTER") {
    renderMasterView();
    return;
  }

  const account = state.rawData.accounts[state.accountView];
  alertsMount.innerHTML = renderAlertsCenter(account.metrics.alerts, `${account.meta.portfolioName} | Centro de Alertas`);
  mount.innerHTML = renderAccountSection(account);
  requestAnimationFrame(() => drawVisibleCharts(account));
}

function renderMasterView() {
  const consolidated = state.rawData.consolidated;
  alertsMount.innerHTML = renderAlertsCenter(consolidated.alerts, "Centro de Alertas Consolidado");
  mount.innerHTML = renderMasterSection(consolidated);
  requestAnimationFrame(() => drawMasterCharts(consolidated));
}

function renderTopMeta() {
  const latestDate = state.rawData.source.consolidated.meta.latestDate;
  subtitleMount.textContent = "Dashboard institucional V11 | risco, processo, governança e manutenção diária assistida por IA";
  liveStatusMount.textContent = `Dados sincronizados | ${formatDateLong(latestDate)}`;

  if (state.accountView === "MASTER") {
    viewTitleMount.textContent = "Visão Consolidada";
    heroMetaMount.innerHTML = [
      heroPill("3 JSONs", "fonte operacional"),
      heroPill("EUR e USD", "isolamento total"),
      heroPill(formatDateLong(latestDate), "último fecho")
    ].join("");
    return;
  }

  const account = state.rawData.accounts[state.accountView];
  viewTitleMount.textContent = `${account.meta.portfolioName} | ${account.meta.currency} / ${account.meta.market}`;
  heroMetaMount.innerHTML = [
    heroPill(formatCurrency(account.metrics.latest.valueTotal, account.meta.currency), "valor total"),
    heroPill(`${account.metrics.latest.positionsCount} posições`, "livro aberto"),
    heroPill(account.integrity.reviewStatusLabel, "estado de revisão")
  ].join("");
}

function renderSidebarStatus() {
  if (state.accountView === "MASTER") {
    const consolidated = state.rawData.consolidated;
    governanceMount.innerHTML = `
      <div class="section-label">Estado do Sistema</div>
      <h3>Monitorização Master</h3>
      <div class="status-list">
        ${renderStatusCard("Sistema", consolidated.systemStatus.label, consolidated.systemStatus.detail)}
        ${renderStatusCard("Validação", consolidated.validationStatus.label, consolidated.validationStatus.detail)}
        ${renderStatusCard("Última atualização", formatDateTime(consolidated.meta.lastUpdatedAt), consolidated.meta.updateMethod)}
        ${renderStatusCard("Próxima ação", consolidated.nextAction.label, consolidated.nextAction.detail)}
      </div>
    `;
    return;
  }

  const account = state.rawData.accounts[state.accountView];
  governanceMount.innerHTML = `
    <div class="section-label">Estado do Sistema</div>
    <h3>${account.meta.accountId}</h3>
    <div class="status-list">
      ${renderStatusCard("Sistema", account.systemStatus.label, account.systemStatus.detail)}
      ${renderStatusCard("Validação", account.validationStatus.label, account.validationStatus.detail)}
      ${renderStatusCard("Última atualização", formatDateTime(account.meta.lastUpdatedAt), account.meta.updateMethod)}
      ${renderStatusCard("Próxima ação", account.nextAction.label, account.nextAction.detail)}
    </div>
  `;
}

function renderStatusCard(title, value, detail) {
  return `
    <article class="status-card">
      <div class="section-label">${title}</div>
      <strong>${value}</strong>
      <div class="muted small">${detail}</div>
    </article>
  `;
}

function renderAlertsCenter(alerts, title) {
  return alerts.map((alert) => `
    <article class="alert-card ${alert.severity}">
      <div class="section-label">${title}</div>
      <h3>${alert.title}</h3>
      <p>${alert.message}</p>
    </article>
  `).join("");
}

function renderAccountSection(account) {
  switch (state.sectionView) {
    case "overview":
      return renderAccountOverview(account);
    case "table":
      return renderDayTable(account);
    case "history":
      return renderHistory(account);
    case "decision":
      return renderDecision(account);
    case "periods":
      return renderPeriods(account);
    case "charts":
      return renderChartsSection(account);
    case "events":
      return renderEvents(account);
    case "database":
      return renderDatabase(account);
    default:
      return document.getElementById("emptyStateTemplate").innerHTML;
  }
}

function renderMasterSection(consolidated) {
  switch (state.sectionView) {
    case "overview":
      return renderMasterOverview(consolidated);
    case "table":
      return renderMasterTable(consolidated);
    case "history":
      return renderMasterHistory(consolidated);
    case "decision":
      return renderMasterDecision(consolidated);
    case "periods":
      return renderMasterPeriods(consolidated);
    case "charts":
      return renderMasterChartsSection();
    case "events":
      return renderMasterEvents(consolidated);
    case "database":
      return renderMasterDatabase();
    default:
      return document.getElementById("emptyStateTemplate").innerHTML;
  }
}

function renderAccountOverview(account) {
  const latest = account.metrics.latest;
  return `
    <section class="stack-gap">
      <section class="panel">
        <div class="section-label">Dashboard Executivo</div>
        <div class="kpi-grid">
          ${renderMetricCard("Posições abertas", formatCurrency(latest.openValue, account.meta.currency), `${latest.positionsCount} posições ativas`)}
          ${renderMetricCard("Caixa", formatCurrency(latest.cash, account.meta.currency), "liquidez disponível")}
          ${renderMetricCard("Valor total", formatCurrency(latest.valueTotal, account.meta.currency), account.meta.market)}
          ${renderMetricCard("P/L aberto", signedCurrency(latest.plOpen, account.meta.currency), signedPercent(latest.plOpenPct))}
          ${renderMetricCard("P/L diário", signedCurrency(latest.plDay, account.meta.currency), signedPercent(latest.plDayPct))}
          ${renderMetricCard("P/L semanal", signedCurrency(account.metrics.weekly.plPeriod, account.meta.currency), signedPercent(account.metrics.weekly.plPeriodPct))}
          ${renderMetricCard("P/L mensal", signedCurrency(account.metrics.monthly.plPeriod, account.meta.currency), signedPercent(account.metrics.monthly.plPeriodPct))}
          ${renderMetricCard("Melhor ativo", latest.bestTicker, signedPercent(latest.bestPct))}
          ${renderMetricCard("Pior ativo", latest.worstTicker, signedPercent(latest.worstPct))}
          ${renderMetricCard("Vencedoras", `${latest.winners}`, `${latest.losers} perdedoras`)}
          ${renderMetricCard("Risco médio", formatPercent(account.metrics.averageRiskPct), "média por posição")}
          ${renderMetricCard("Exposição", formatPercent(account.metrics.exposurePct), `top 3: ${formatPercent(account.metrics.concentrationTop3)}`)}
        </div>
      </section>

      <section class="summary-grid">
        <article class="summary-card">
          <div class="section-label">Hoje em 20 segundos</div>
          <h3>${account.meta.portfolioName}</h3>
          <ul class="today-list">
            <li><span>Total da conta</span><strong>${formatCurrency(latest.valueTotal, account.meta.currency)}</strong></li>
            <li><span>P/L diário</span><strong class="${valueClass(latest.plDay)}">${signedCurrency(latest.plDay, account.meta.currency)}</strong></li>
            <li><span>P/L semanal</span><strong class="${valueClass(account.metrics.weekly.plPeriod)}">${signedCurrency(account.metrics.weekly.plPeriod, account.meta.currency)}</strong></li>
            <li><span>Ativo mais forte</span><strong>${latest.bestTicker}</strong></li>
            <li><span>Ativo a rever</span><strong>${latest.worstTicker}</strong></li>
            <li><span>Risco médio</span><strong>${formatPercent(account.metrics.averageRiskPct)}</strong></li>
          </ul>
        </article>

        <article class="summary-card">
          <div class="section-label">Conformidade Operacional</div>
          <h3>Leitura institucional</h3>
          <ul class="compact-list">
            <li><span>Lucro total vencedores</span><strong class="positive">${signedCurrency(account.metrics.winnerProfit, account.meta.currency)}</strong></li>
            <li><span>Perda total perdedores</span><strong class="negative">${signedCurrency(account.metrics.loserLoss, account.meta.currency)}</strong></li>
            <li><span>Duração média</span><strong>${account.metrics.averageDaysOpen.toFixed(1)} dias</strong></li>
            <li><span>Qualidade da execução</span><strong>${account.process.executionQuality}</strong></li>
            <li><span>Estado da tese</span><strong>${account.process.thesisStatus}</strong></li>
            <li><span>Compliance com plano</span><strong>${account.process.planCompliance}</strong></li>
          </ul>
        </article>
      </section>

      ${renderRiskDashboard(account)}
      ${renderCapitalFlow(account)}
      ${renderProcessCompliance(account)}

      <section class="two-column-grid">
        <article class="table-card">
          <div class="section-label">Tabela rápida</div>
          <h3>Principais posições do dia</h3>
          ${renderSnapshotTable(account, true)}
        </article>
        <article class="summary-card">
          <div class="section-label">Integridade do Fecho</div>
          <h3>Controlo do update diário</h3>
          <ul class="compact-list">
            <li><span>Fonte</span><strong>${account.meta.dataSource}</strong></li>
            <li><span>Método</span><strong>${account.meta.updateMethod}</strong></li>
            <li><span>Sessão</span><strong>${account.meta.updateSessionId}</strong></li>
            <li><span>Validação</span><strong>${account.integrity.validationStatusLabel}</strong></li>
            <li><span>Warnings</span><strong>${account.integrity.warnings.length}</strong></li>
            <li><span>Próxima ação</span><strong>${account.nextAction.label}</strong></li>
          </ul>
        </article>
      </section>
    </section>
  `;
}

function renderRiskDashboard(account) {
  return `
    <section class="panel">
      <div class="section-label">Risk Dashboard</div>
      <h3>Painel de risco da conta ${account.meta.currency}</h3>
      <div class="risk-grid">
        ${renderMetricCard("Risco total", formatPercent(account.metrics.aggregatedRiskPct), "ponderado pelo peso")}
        ${renderMetricCard("Risco médio", formatPercent(account.metrics.averageRiskPct), "por posição")}
        ${renderMetricCard("Posição mais arriscada", account.metrics.mostRiskyTicker, formatPercent(account.metrics.mostRiskyRiskPct))}
        ${renderMetricCard("Top 3 pesos", formatPercent(account.metrics.concentrationTop3), "concentração")}
        ${renderMetricCard("Drawdown atual", signedPercent(account.metrics.currentDrawdownPct), signedCurrency(account.metrics.currentDrawdownValue, account.meta.currency))}
        ${renderMetricCard("Limite diário", formatCurrency(account.governance.dailyLossLimit, account.meta.currency), "governança")}
        ${renderMetricCard("Limite semanal", formatCurrency(account.governance.weeklyLossLimit, account.meta.currency), "governança")}
        ${renderMetricCard("Exposição aberta", formatCurrency(account.metrics.latest.openValue, account.meta.currency), formatPercent(account.metrics.exposurePct))}
      </div>
    </section>
  `;
}

function renderCapitalFlow(account) {
  return `
    <section class="panel">
      <div class="section-label">Capital Flow</div>
      <h3>Fluxo de capital</h3>
      <div class="flow-grid">
        ${renderMetricCard("Caixa atual", formatCurrency(account.metrics.latest.cash, account.meta.currency), "liquidez")}
        ${renderMetricCard("Depósitos", formatCurrency(account.capitalFlow.deposits, account.meta.currency), "capital injetado")}
        ${renderMetricCard("Levantamentos", formatCurrency(account.capitalFlow.withdrawals, account.meta.currency), "capital removido")}
        ${renderMetricCard("Lucro aberto", signedCurrency(account.metrics.latest.plOpen, account.meta.currency), signedPercent(account.metrics.latest.plOpenPct))}
        ${renderMetricCard("Lucro realizado", signedCurrency(account.capitalFlow.realizedPl, account.meta.currency), "valor compatível V11")}
        ${renderMetricCard("Fluxo líquido", signedCurrency(account.capitalFlow.netFlow, account.meta.currency), "depósitos - levantamentos")}
      </div>
    </section>
  `;
}

function renderProcessCompliance(account) {
  return `
    <section class="panel">
      <div class="section-label">Process / Compliance</div>
      <h3>Processo e governança operacional</h3>
      <div class="process-grid">
        ${renderMetricCard("VCP", `${account.process.setupCounts.VCP}`, "posições por setup")}
        ${renderMetricCard("Clean Trend", `${account.process.setupCounts["Clean Trend"]}`, "posições por setup")}
        ${renderMetricCard("Pullback", `${account.process.setupCounts.Pullback}`, "posições por setup")}
        ${renderMetricCard("Compliance com plano", account.process.planCompliance, "estado do processo")}
        ${renderMetricCard("Qualidade da execução", account.process.executionQuality, "disciplina do dia")}
        ${renderMetricCard("Estado da tese", account.process.thesisStatus, "leitura dominante")}
        ${renderMetricCard("Eventos do dia", `${account.process.eventsToday}`, "movimentos operacionais")}
        ${renderMetricCard("Posições por setup", `${account.process.activeSetupCount}`, "setups ativos")}
      </div>
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
            <tr><td>Valor</td>${account.dailySummary.map((row) => `<td>${formatCurrency(row.valueTotal, account.meta.currency)}</td>`).join("")}</tr>
            <tr><td>P/L aberto %</td>${account.dailySummary.map((row) => `<td class="${valueClass(row.plOpenPct)}">${signedPercent(row.plOpenPct)}</td>`).join("")}</tr>
            <tr><td>P/L dia %</td>${account.dailySummary.map((row) => `<td class="${valueClass(row.plDayPct)}">${signedPercent(row.plDayPct)}</td>`).join("")}</tr>
            <tr><td>Caixa</td>${account.dailySummary.map((row) => `<td>${formatCurrency(row.cash, account.meta.currency)}</td>`).join("")}</tr>
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
          ${account.metrics.latestSnapshots.map((item, index) => `<span><i class="legend-dot" style="background:${palette(index)}"></i>${item.ticker}</span>`).join("")}
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
      <h3>Entradas, reforços, saídas parciais, saídas totais e caixa</h3>
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
        <h3>${account.meta.currency} | posições</h3>
        <pre class="json-box">${escapeHtml(JSON.stringify(account.snapshots, null, 2))}</pre>
      </article>
      <article class="panel">
        <div class="section-label">Resumo diário</div>
        <h3>${account.meta.currency} | histórico</h3>
        <pre class="json-box">${escapeHtml(JSON.stringify(account.dailySummary, null, 2))}</pre>
      </article>
      <article class="panel">
        <div class="section-label">Eventos</div>
        <h3>${account.meta.currency} | operações</h3>
        <pre class="json-box">${escapeHtml(JSON.stringify(account.events, null, 2))}</pre>
      </article>
    </section>
  `;
}

function renderMasterOverview(consolidated) {
  return `
    <section class="stack-gap">
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
                <li><span>Melhor ativo</span><strong>${account.metrics.latest.bestTicker}</strong></li>
                <li><span>Pior ativo</span><strong>${account.metrics.latest.worstTicker}</strong></li>
                <li><span>Posições</span><strong>${account.metrics.latest.positionsCount}</strong></li>
              </ul>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="summary-grid">
        <article class="summary-card">
          <div class="section-label">Consolidado informacional</div>
          <h3>Leitura sem mistura monetária</h3>
          <ul class="compact-list">
            <li><span>Total EUR</span><strong>${formatCurrency(consolidated.meta.nonConvertedTotals.EUR, "EUR")}</strong></li>
            <li><span>Total USD</span><strong>${formatCurrency(consolidated.meta.nonConvertedTotals.USD, "USD")}</strong></li>
            <li><span>Caixa EUR</span><strong>${formatCurrency(consolidated.totals.cashEUR, "EUR")}</strong></li>
            <li><span>Caixa USD</span><strong>${formatCurrency(consolidated.totals.cashUSD, "USD")}</strong></li>
            <li><span>Risco total EUR</span><strong>${formatPercent(consolidated.totals.riskAggregateEUR)}</strong></li>
            <li><span>Risco total USD</span><strong>${formatPercent(consolidated.totals.riskAggregateUSD)}</strong></li>
          </ul>
        </article>

        <article class="summary-card">
          <div class="section-label">Sem FX aplicado</div>
          <h3>Nota de interpretação</h3>
          <p class="muted">${consolidated.meta.consolidationNote}</p>
        </article>
      </section>

      <section class="panel">
        <div class="section-label">Risk Dashboard</div>
        <h3>Painel master de risco</h3>
        <div class="risk-grid">
          ${renderMetricCard("Risco total EUR", formatPercent(consolidated.totals.riskAggregateEUR), "risk dashboard")}
          ${renderMetricCard("Risco total USD", formatPercent(consolidated.totals.riskAggregateUSD), "risk dashboard")}
          ${renderMetricCard("Risco médio EUR", formatPercent(consolidated.totals.riskAverageEUR), "por posição")}
          ${renderMetricCard("Risco médio USD", formatPercent(consolidated.totals.riskAverageUSD), "por posição")}
          ${renderMetricCard("Maior risco EUR", consolidated.totals.highestRiskTickerEUR, formatPercent(consolidated.totals.highestRiskPctEUR))}
          ${renderMetricCard("Maior risco USD", consolidated.totals.highestRiskTickerUSD, formatPercent(consolidated.totals.highestRiskPctUSD))}
          ${renderMetricCard("Top 3 EUR", formatPercent(consolidated.totals.top3ConcentrationEUR), "concentração")}
          ${renderMetricCard("Top 3 USD", formatPercent(consolidated.totals.top3ConcentrationUSD), "concentração")}
        </div>
      </section>

      <section class="panel">
        <div class="section-label">Capital Flow</div>
        <h3>Fluxo de capital por conta</h3>
        <div class="flow-grid">
          ${renderMetricCard("Depósitos EUR", formatCurrency(consolidated.totals.depositsEUR, "EUR"), "capital injetado")}
          ${renderMetricCard("Depósitos USD", formatCurrency(consolidated.totals.depositsUSD, "USD"), "capital injetado")}
          ${renderMetricCard("Levantamentos EUR", formatCurrency(consolidated.totals.withdrawalsEUR, "EUR"), "capital removido")}
          ${renderMetricCard("Levantamentos USD", formatCurrency(consolidated.totals.withdrawalsUSD, "USD"), "capital removido")}
          ${renderMetricCard("Lucro realizado EUR", signedCurrency(consolidated.totals.realizedPlEUR, "EUR"), "compatível V11")}
          ${renderMetricCard("Lucro realizado USD", signedCurrency(consolidated.totals.realizedPlUSD, "USD"), "compatível V11")}
        </div>
      </section>
    </section>
  `;
}

function renderMasterTable(consolidated) {
  const rows = Object.values(consolidated.accounts).flatMap((account) =>
    account.metrics.filteredSnapshots.map((row) => ({ ...row, portfolioName: account.meta.portfolioName, currency: account.meta.currency }))
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
        <td>${account.nextAction.label}</td>
      </tr>
    `;
  }).join("");

  return `
    <section class="table-card">
      <div class="section-label">Decisão consolidada</div>
      <h3>Alertas e ação sugerida por conta</h3>
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
              <th>Próxima ação</th>
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
    <article class="kpi-card">
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
    consolidated: buildConsolidatedModel(source.consolidated, accounts)
  };
}

function buildAccountModel(accountData) {
  const cloned = structuredClone(accountData);
  const latestSnapshots = cloned.snapshots.filter((row) => row.date === cloned.meta.latestDate);
  const latest = cloned.dailySummary.find((row) => row.date === cloned.meta.latestDate);
  const filteredSnapshots = applyFilter(latestSnapshots, state.filter);
  const winnerRows = latestSnapshots.filter((row) => row.plTotal >= 0);
  const loserRows = latestSnapshots.filter((row) => row.plTotal < 0);
  const sortedByPct = [...latestSnapshots].sort((a, b) => b.plPct - a.plPct);
  const sortedByRisk = [...latestSnapshots].sort((a, b) => b.riskPct - a.riskPct);
  const best = sortedByPct[0];
  const worst = [...sortedByPct].reverse()[0];
  const mostRisky = sortedByRisk[0];
  const averageRiskPct = average(latestSnapshots.map((row) => row.riskPct));
  const averageDaysOpen = average(latestSnapshots.map((row) => row.daysOpen));
  const concentrationTop3 = latestSnapshots.map((row) => row.weightPct).sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0);
  const exposurePct = latest.valueTotal ? ((latest.valueTotal - latest.cash) / latest.valueTotal) * 100 : 0;
  const aggregatedRiskPct = latestSnapshots.reduce((sum, row) => sum + (row.weightPct * row.riskPct) / 100, 0);
  const weekly = cloned.periodSummary.find((row) => row.period.toLowerCase().includes("week")) || cloned.periodSummary[0];
  const monthly = cloned.periodSummary.find((row) => row.period.toLowerCase().includes("month")) || cloned.periodSummary[1] || cloned.periodSummary[0];
  const currentDrawdownValue = latest.valueTotal - max(cloned.dailySummary.map((row) => row.valueTotal));
  const currentDrawdownPct = max(cloned.dailySummary.map((row) => row.valueTotal)) ? (currentDrawdownValue / max(cloned.dailySummary.map((row) => row.valueTotal))) * 100 : 0;
  const capitalFlow = buildCapitalFlow(cloned);
  const process = buildProcessModel(cloned, latestSnapshots);
  const integrity = buildIntegrityModel(cloned, latestSnapshots);
  const validationStatus = integrity.validationStatus === "valid" ? "Válido" : "A rever";
  const alerts = buildAccountAlerts(cloned, latestSnapshots, latest, integrity, capitalFlow, concentrationTop3);
  const staleDays = diffDays(cloned.meta.latestDate, isoToday());

  return {
    ...cloned,
    capitalFlow,
    process,
    integrity: {
      ...integrity,
      validationStatusLabel: validationStatus,
      reviewStatusLabel: integrity.reviewStatus === "confirmed" ? "Confirmado" : "Pendente"
    },
    systemStatus: {
      label: staleDays > STALE_DAYS_LIMIT ? "Atenção" : "Em linha",
      detail: staleDays > STALE_DAYS_LIMIT ? "Conta sem fecho recente." : "Conta atualizada dentro da janela."
    },
    validationStatus: {
      label: validationStatus,
      detail: integrity.warnings.length ? integrity.warnings.join(" | ") : "Sem erros críticos."
    },
    nextAction: {
      label: alerts[0]?.action || "Manter monitorização",
      detail: alerts[0]?.title || "Sem ação urgente."
    },
    metrics: {
      latest: {
        ...latest,
        openValue: latest.valueTotal - latest.cash,
        positionsCount: latestSnapshots.length,
        winners: winnerRows.length,
        losers: loserRows.length,
        bestTicker: best?.ticker || "-",
        bestPct: best?.plPct || 0,
        worstTicker: worst?.ticker || "-",
        worstPct: worst?.plPct || 0
      },
      latestSnapshots,
      filteredSnapshots,
      averageRiskPct,
      averageDaysOpen,
      concentrationTop3,
      exposurePct,
      aggregatedRiskPct,
      mostRiskyTicker: mostRisky?.ticker || "-",
      mostRiskyRiskPct: mostRisky?.riskPct || 0,
      winnerProfit: sum(winnerRows.map((row) => row.plTotal)),
      loserLoss: sum(loserRows.map((row) => row.plTotal)),
      weekly,
      monthly,
      currentDrawdownValue,
      currentDrawdownPct,
      maxWeightTicker: latestSnapshots.sort((a, b) => b.weightPct - a.weightPct)[0]?.ticker || "-",
      maxWeightPct: [...latestSnapshots].sort((a, b) => b.weightPct - a.weightPct)[0]?.weightPct || 0,
      alerts,
      governanceStatus: alerts.some((alert) => alert.severity === "critical") ? "Atenção requerida" : "Dentro do plano"
    }
  };
}

function buildCapitalFlow(account) {
  const deposits = sum(account.events.filter((event) => event.type === "deposit").map((event) => Math.max(event.value, 0)));
  const withdrawals = sum(account.events.filter((event) => event.type === "withdrawal").map((event) => Math.abs(event.value)));
  return {
    deposits,
    withdrawals,
    realizedPl: account.capitalFlow?.realizedPl ?? 0,
    netFlow: deposits - withdrawals
  };
}

function buildProcessModel(account, latestSnapshots) {
  const setupCounts = {
    VCP: countSetup(latestSnapshots, "VCP"),
    "Clean Trend": countSetup(latestSnapshots, "Clean Trend"),
    Pullback: countSetup(latestSnapshots, "Pullback")
  };
  const eventsToday = account.events.filter((event) => event.date === account.meta.latestDate).length;
  return {
    setupCounts,
    activeSetupCount: Object.values(setupCounts).filter((value) => value > 0).length,
    planCompliance: account.process?.planCompliance || "Conforme",
    executionQuality: account.process?.executionQuality || "Sólida",
    thesisStatus: account.process?.thesisStatus || "Válida",
    eventsToday
  };
}

function buildIntegrityModel(account, latestSnapshots) {
  const warnings = [...(account.integrity?.warnings || [])];
  const snapshotCount = account.integrity?.snapshotCount ?? latestSnapshots.length;
  const hasFreshData = diffDays(account.meta.latestDate, isoToday()) <= STALE_DAYS_LIMIT;

  if (!hasFreshData) warnings.push("Falta atualização diária.");
  if (!latestSnapshots.length) warnings.push("Conta sem snapshots no último fecho.");
  if ((account.cashBalance ?? 0) !== (account.dailySummary.find((row) => row.date === account.meta.latestDate)?.cash ?? 0)) {
    warnings.push("Cash balance e dailySummary.cash divergem.");
  }

  return {
    snapshotCount,
    hasCashMatch: account.integrity?.hasCashMatch ?? true,
    hasPositionValueMatch: account.integrity?.hasPositionValueMatch ?? true,
    reviewStatus: account.integrity?.reviewStatus ?? "pending",
    validationStatus: account.integrity?.validationStatus ?? (warnings.length ? "review" : "valid"),
    warnings: unique(warnings)
  };
}

function buildConsolidatedModel(consolidatedSource, accounts) {
  const alerts = buildMasterAlerts(consolidatedSource, accounts);
  const validationStatus = alerts.some((alert) => alert.type === "Erro de validação") ? "A rever" : "Válido";

  return {
    ...structuredClone(consolidatedSource),
    accounts,
    alerts,
    systemStatus: {
      label: alerts.some((alert) => alert.severity === "critical") ? "Atenção" : "Em linha",
      detail: "Monitorização consolidada sem FX automático."
    },
    validationStatus: {
      label: validationStatus,
      detail: alerts.length ? `${alerts.length} alertas ativos.` : "Sem alertas críticos."
    },
    nextAction: {
      label: alerts[0]?.action || "Rever alertas e confirmar fecho",
      detail: alerts[0]?.title || "Sem ação urgente."
    }
  };
}

function buildAccountAlerts(account, latestSnapshots, latest, integrity, capitalFlow, concentrationTop3) {
  const alerts = [];
  const belowStop = latestSnapshots.filter((row) => row.currentPrice <= row.stop);
  const overRisk = latestSnapshots.filter((row) => row.riskPct > account.governance.maxPositionRiskPct);
  const relevantEvents = account.events.filter((event) => event.date === account.meta.latestDate);

  if (belowStop.length) {
    alerts.push(alertCardData("critical", "Ativo abaixo do stop", `Abaixo do stop: ${belowStop.map((row) => row.ticker).join(", ")}.`, "Rever execução"));
  }

  if (overRisk.length) {
    alerts.push(alertCardData("warning", "Risco acima do limite", `Acima do limite: ${overRisk.map((row) => row.ticker).join(", ")}.`, "Reduzir risco"));
  }

  if (concentrationTop3 > CONCENTRATION_LIMIT) {
    alerts.push(alertCardData("warning", "Concentração excessiva", `Top 3 pesos em ${formatPercent(concentrationTop3)}.`, "Avaliar diversificação"));
  }

  if (diffDays(account.meta.latestDate, isoToday()) > STALE_DAYS_LIMIT) {
    alerts.push(alertCardData("critical", "Falta de atualização diária", "A conta não foi atualizada dentro da janela esperada.", "Atualizar JSON diário"));
  }

  if (integrity.validationStatus !== "valid") {
    alerts.push(alertCardData("critical", "Erro de validação", integrity.warnings.join(" | "), "Validar dados"));
  }

  if (relevantEvents.length) {
    alerts.push(alertCardData("info", "Evento operacional relevante", `${relevantEvents.length} evento(s) no fecho do dia.`, "Rever eventos"));
  }

  if (!latestSnapshots.length) {
    alerts.push(alertCardData("critical", "Conta sem dados recentes", "Não existem posições no último fecho registado.", "Confirmar captura"));
  }

  if (latest.plDay < 0 && Math.abs(latest.plDay) > account.governance.dailyLossLimit * 0.75) {
    alerts.push(alertCardData("warning", "Perda diária perto do limite", `P/L diário em ${signedCurrency(latest.plDay, account.meta.currency)}.`, "Rever exposição"));
  }

  if (capitalFlow.netFlow !== 0 && relevantEvents.some((event) => event.type === "deposit" || event.type === "withdrawal")) {
    alerts.push(alertCardData("info", "Fluxo de capital relevante", `Fluxo líquido acumulado: ${signedCurrency(capitalFlow.netFlow, account.meta.currency)}.`, "Confirmar caixa"));
  }

  return alerts.slice(0, 6);
}

function buildMasterAlerts(consolidated, accounts) {
  const alerts = [
    alertCardData("warning", "Sem FX aplicado", consolidated.meta.consolidationNote, "Usar leitura informacional")
  ];

  Object.values(accounts).forEach((account) => {
    if (diffDays(account.meta.latestDate, isoToday()) > STALE_DAYS_LIMIT) {
      alerts.push(alertCardData("critical", `Conta sem dados recentes: ${account.meta.currency}`, "Falta atualização diária ou o fecho está desfasado.", "Atualizar ficheiro da conta"));
    }
    account.metrics.alerts.slice(0, 2).forEach((alert) => {
      alerts.push({ ...alert, title: `${account.meta.currency} | ${alert.title}` });
    });
  });

  (consolidated.alerts || []).forEach((alert) => {
    alerts.push(alertCardData(alert.severity || "info", alert.title, alert.message, "Rever nota master"));
  });

  return alerts.slice(0, 6);
}

function alertCardData(severity, title, message, action) {
  return { severity, title, message, action, type: title };
}

function applyFilter(rows, filterId) {
  if (filterId === "winners") return rows.filter((row) => row.plTotal >= 0);
  if (filterId === "losers") return rows.filter((row) => row.plTotal < 0);
  return rows;
}

function buildDecision(position, account) {
  if (position.currentPrice <= position.stop) {
    return { reading: "Stop comprometido", action: "Decidir saída", priority: "Alta" };
  }
  if (position.riskPct > account.governance.maxPositionRiskPct) {
    return { reading: "Risco acima do plano", action: "Reduzir tamanho", priority: "Alta" };
  }
  if (position.plPct > 8 && position.weightPct > 18) {
    return { reading: "Vencedor relevante", action: "Avaliar parcial", priority: "Média" };
  }
  if (position.status.toLowerCase().includes("watch")) {
    return { reading: "Em observação", action: "Esperar confirmação", priority: "Baixa" };
  }
  return { reading: "Estrutura controlada", action: "Manter plano", priority: "Média" };
}

function drawVisibleCharts(account) {
  if (state.sectionView !== "charts") return;
  drawLineChart("valueChart", account.dailySummary.map((row) => ({ label: formatDateShort(row.date), value: row.valueTotal })), "#8fd0ff", "rgba(143, 208, 255, 0.16)");
  drawDonutChart("allocationChart", account.metrics.latestSnapshots.map((row) => ({ label: row.ticker, value: row.weightPct })));
  drawBarChart("dailyPlChart", account.dailySummary.map((row) => ({ label: formatDateShort(row.date), value: row.plDay })), account.meta.currency);
}

function drawMasterCharts(consolidated) {
  if (state.sectionView !== "charts") return;
  drawLineChart("eurValueChart", consolidated.accounts.EUR.dailySummary.map((row) => ({ label: formatDateShort(row.date), value: row.valueTotal })), "#57c8b0", "rgba(87, 200, 176, 0.16)");
  drawLineChart("usdValueChart", consolidated.accounts.USD.dailySummary.map((row) => ({ label: formatDateShort(row.date), value: row.valueTotal })), "#66b6ff", "rgba(102, 182, 255, 0.16)");
  drawGroupedBars("riskBarChart", [
    { label: "EUR", value: consolidated.totals.riskAggregateEUR, color: "#57c8b0" },
    { label: "USD", value: consolidated.totals.riskAggregateUSD, color: "#66b6ff" }
  ]);
}

function drawLineChart(canvasId, pointsData, stroke, fill) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = prepareCanvas(canvas);
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 24, right: 24, bottom: 32, left: 44 };
  const values = pointsData.map((item) => item.value);
  const min = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - min || 1;

  ctx.clearRect(0, 0, width, height);
  drawChartFrame(ctx, width, height, padding);

  const points = pointsData.map((item, index) => ({
    x: padding.left + ((width - padding.left - padding.right) / Math.max(pointsData.length - 1, 1)) * index,
    y: height - padding.bottom - ((item.value - min) / range) * (height - padding.top - padding.bottom),
    label: item.label
  }));

  ctx.beginPath();
  ctx.moveTo(points[0].x, height - padding.bottom);
  points.forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#dbe8f8";
  ctx.font = "12px Manrope";
  points.forEach((point) => ctx.fillText(point.label, point.x - 12, height - 12));
}

function drawDonutChart(canvasId, series) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = prepareCanvas(canvas);
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
  ctx.fillText("peso da carteira", centerX, centerY + 28);
}

function drawBarChart(canvasId, series, currency) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = prepareCanvas(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawChartFrame(ctx, canvas.width, canvas.height, { top: 24, right: 20, bottom: 34, left: 38 });

  const maxValue = Math.max(...series.map((item) => Math.abs(item.value))) || 1;
  const baseline = canvas.height / 2 + 12;
  const barWidth = Math.max(18, (canvas.width - 90) / series.length - 10);

  series.forEach((item, index) => {
    const barHeight = (Math.abs(item.value) / maxValue) * (canvas.height * 0.3);
    const x = 48 + index * (barWidth + 10);
    const y = item.value >= 0 ? baseline - barHeight : baseline;
    ctx.fillStyle = item.value >= 0 ? "rgba(77, 212, 168, 0.88)" : "rgba(255, 111, 125, 0.88)";
    ctx.fillRect(x, y, barWidth, barHeight);
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawChartFrame(ctx, canvas.width, canvas.height, { top: 24, right: 20, bottom: 30, left: 36 });

  const maxValue = Math.max(...series.map((item) => item.value), 100);
  const chartHeight = canvas.height - 70;
  const baseline = canvas.height - 34;
  const slotWidth = (canvas.width - 80) / series.length;

  series.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = 50 + index * slotWidth;
    const width = Math.min(88, slotWidth * 0.5);
    const y = baseline - barHeight;
    ctx.fillStyle = item.color;
    ctx.fillRect(x, y, width, barHeight);
    ctx.fillStyle = "#eef4ff";
    ctx.font = "700 14px Manrope";
    ctx.fillText(`${item.value.toFixed(2)}%`, x, y - 8);
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
  liveStatusMount.textContent = "Erro de fetch";
  alertsMount.innerHTML = `
    <article class="alert-card critical">
      <div class="section-label">Erro</div>
      <h3>Falha a ler a pasta data</h3>
      <p>${error.message}. Em GitHub Pages funciona por HTTP; localmente usa um servidor estático.</p>
    </article>
  `;
  mount.innerHTML = document.getElementById("emptyStateTemplate").innerHTML;
}

function formatCurrency(value, currency) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value, currency) {
  return `${new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

function signedCurrency(value, currency) {
  return `${value > 0 ? "+" : ""}${formatCurrency(value, currency)}`;
}

function formatPercent(value) {
  return `${Number(value).toFixed(2)}%`;
}

function signedPercent(value) {
  return `${value > 0 ? "+" : ""}${formatPercent(value)}`;
}

function formatDateShort(value) {
  return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

function formatDateLong(value) {
  return new Date(value).toLocaleDateString("pt-PT", { year: "numeric", month: "short", day: "2-digit" });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("pt-PT", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
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

function max(values) {
  return values.length ? Math.max(...values) : 0;
}

function countSetup(rows, setupName) {
  return rows.filter((row) => row.setup === setupName).length;
}

function diffDays(dateA, dateB) {
  const start = new Date(dateA);
  const end = new Date(dateB);
  return Math.floor((end - start) / 86400000);
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function unique(values) {
  return [...new Set(values)];
}

function palette(index) {
  const colors = ["#66b6ff", "#57c8b0", "#f6c35b", "#ff8aa1", "#9b8cff", "#7dd3fc"];
  return colors[index % colors.length];
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

