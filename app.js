let database = null;
let currentFilter = 'all';

function formatNumber(value, decimals=2){ return Number(value).toFixed(decimals); }
function money(value){ if(value===null||value===undefined) return '<span class="mono">base</span>'; const sign=value>0?'+':''; return `${sign}€${formatNumber(value)}`; }
function pct(value){ if(value===null||value===undefined) return '<span class="mono">base</span>'; const sign=value>0?'+':''; return `${sign}${formatNumber(value)}%`; }
function tone(value){ if(value>0) return 'green'; if(value<0) return 'red'; return ''; }

function latestSnapshots(){
  const rows = database.snapshots.filter(x => x.date === database.meta.latestDate);
  if(currentFilter === 'winners') return rows.filter(x => x.plPct > 0);
  if(currentFilter === 'losers') return rows.filter(x => x.plPct < 0);
  return rows;
}
function latestSummary(){ return database.dailySummary.find(x => x.date === database.meta.latestDate); }

function decisionModel(item){
  if(item.plPct >= 10) return { state:'Forte', action:'Manter', priority:'Alta', read:'líder da carteira' };
  if(item.plPct >= 4) return { state:'Forte', action:'Manter/Aumentar', priority:'Alta', read:'estrutura favorável' };
  if(item.plPct > 0) return { state:'Neutro+', action:'Manter', priority:'Média', read:'ganho moderado' };
  if(item.plPct > -2) return { state:'Neutro', action:'Vigiar', priority:'Média', read:'perda controlada' };
  return { state:'Fraco', action:'Rever/Reduzir', priority:'Alta', read:'maior fragilidade atual' };
}

function renderHeader(){
  document.getElementById('badgePortfolio').textContent = `Carteira: ${database.meta.portfolioName}`;
  document.getElementById('badgeDate').textContent = `Último fecho: ${database.meta.latestDate}`;
  document.getElementById('pillOverview').textContent = `Fecho atual: ${database.meta.latestDate}`;
  document.getElementById('pillToday').textContent = `Snapshot: ${database.meta.latestDate}`;
}

function renderCards(){
  const rows = latestSnapshots();
  const sum = latestSummary();
  const best = [...rows].sort((a,b)=>b.plPct-a.plPct)[0] || {ticker:'-',plPct:0,plTotal:0};
  const worst = [...rows].sort((a,b)=>a.plPct-b.plPct)[0] || {ticker:'-',plPct:0,plTotal:0};
  const positives = rows.filter(x=>x.plPct>0).length;
  const negatives = rows.filter(x=>x.plPct<0).length;
  const totalAssets = sum.valueTotal + sum.cash;
  const week = database.periodSummary.find(x=>x.period==='Semana atual');
  const month = database.periodSummary.find(x=>x.period==='Mês atual');
  const cards = [
    { label:'Valor em posições', value:`€${formatNumber(sum.valueTotal)}`, sub:'Capital atualmente aberto', cls:'' },
    { label:'Valor em caixa', value:`€${formatNumber(sum.cash)}`, sub:'Confirmado: caixa a zero', cls:'cyan' },
    { label:'Total carteira', value:`€${formatNumber(totalAssets)}`, sub:'Posições abertas + caixa', cls:'' },
    { label:'P/L aberto €', value:money(sum.plOpen), sub:'Resultado total aberto', cls:tone(sum.plOpen) },
    { label:'P/L diário €', value:money(sum.plDay), sub:'Fecho vs. fecho anterior', cls:tone(sum.plDay||0) },
    { label:'P/L semanal €', value:money(week.plPeriod), sub:pct(week.plPeriodPct), cls:tone(week.plPeriod||0) },
    { label:'P/L mensal €', value:money(month.plPeriod), sub:pct(month.plPeriodPct), cls:tone(month.plPeriod||0) },
    { label:'Melhor ativo', value:best.ticker, sub:`${pct(best.plPct)} | ${money(best.plTotal)}`, cls:'green' },
    { label:'Pior ativo', value:worst.ticker, sub:`${pct(worst.plPct)} | ${money(worst.plTotal)}`, cls:'red' },
    { label:'Posições', value:`${rows.length}`, sub:`${positives} verdes | ${negatives} vermelhas`, cls:'' }
  ];
  document.getElementById('cardsResumo').innerHTML = cards.map(card => `
    <div class="card">
      <div class="label">${card.label}</div>
      <div class="value ${card.cls}">${card.value}</div>
      <div class="sub">${card.sub}</div>
    </div>
  `).join('');
}

function renderQuickAndQuality(){
  const rows = latestSnapshots();
  const positives = rows.filter(x=>x.plPct>0);
  const negatives = rows.filter(x=>x.plPct<0);
  const top3Weight = [...rows].sort((a,b)=>b.weightPct-a.weightPct).slice(0,3).reduce((s,x)=>s+x.weightPct,0);
  const totalProfit = positives.reduce((s,x)=>s+x.plTotal,0);
  const totalLoss = negatives.reduce((s,x)=>s+Math.abs(x.plTotal),0);
  const avgGain = positives.length ? positives.reduce((s,x)=>s+x.plPct,0)/positives.length : 0;
  const avgLoss = negatives.length ? negatives.reduce((s,x)=>s+x.plPct,0)/negatives.length : 0;
  const avgRisk = rows.length ? rows.reduce((s,x)=>s+(x.riskPct||0),0)/rows.length : 0;
  const quality = [
    `Posições em lucro: <strong>${positives.length}</strong> de <strong>${rows.length}</strong>.`,
    `Posições em perda: <strong>${negatives.length}</strong> de <strong>${rows.length}</strong>.`,
    `Concentração dos 3 maiores pesos: <strong>${formatNumber(top3Weight)}%</strong>.`,
    `Lucro total dos vencedores: <strong>€${formatNumber(totalProfit)}</strong>.`,
    `Perda total dos perdedores: <strong>€${formatNumber(totalLoss)}</strong>.`,
    `Ganho médio das posições vencedoras: <strong>${formatNumber(avgGain)}%</strong>.`,
    `Perda média das posições perdedoras: <strong>${formatNumber(avgLoss)}%</strong>.`,
    `Risco médio por posição: <strong>${formatNumber(avgRisk)}%</strong>.`
  ];
  document.getElementById('qualityMetrics').innerHTML = quality.map(x=>`<li>${x}</li>`).join('');
  const quick = [
    `Total em carteira: <strong>€${formatNumber(latestSummary().valueTotal + latestSummary().cash)}</strong>.`,
    `P/L diário: <strong>${money(latestSummary().plDay)}</strong>.`,
    `P/L semanal: <strong>${money(database.periodSummary[0].plPeriod)}</strong>.`,
    `Ativo mais forte: <strong>${[...rows].sort((a,b)=>b.plPct-a.plPct)[0]?.ticker || '-'}</strong>.`,
    `Ativo a rever: <strong>${[...rows].sort((a,b)=>a.plPct-b.plPct)[0]?.ticker || '-'}</strong>.`,
    `Risco médio atual da carteira: <strong>${formatNumber(avgRisk)}%</strong>.`
  ];
  document.getElementById('quickSummary').innerHTML = quick.map(x=>`<li>${x}</li>`).join('');
}

function renderRankings(){
  const rows = latestSnapshots();
  const ranked = [
    ['Top ganho %',[...rows].sort((a,b)=>b.plPct-a.plPct)[0],x=>pct(x.plPct),'melhor retorno aberto'],
    ['Top perda %',[...rows].sort((a,b)=>a.plPct-b.plPct)[0],x=>pct(x.plPct),'maior perda aberta'],
    ['Melhor dia %',[...rows].sort((a,b)=>b.plDayPct-a.plDayPct)[0],x=>pct(x.plDayPct),'melhor evolução diária'],
    ['Pior dia %',[...rows].sort((a,b)=>a.plDayPct-b.plDayPct)[0],x=>pct(x.plDayPct),'maior deterioração diária'],
    ['Maior peso',[...rows].sort((a,b)=>b.weightPct-a.weightPct)[0],x=>`${formatNumber(x.weightPct)}%`,'maior concentração'],
    ['Maior contribuição €',[...rows].sort((a,b)=>b.plTotal-a.plTotal)[0],x=>money(x.plTotal),'maior lucro absoluto']
  ];
  document.getElementById('tbodyRankings').innerHTML = ranked.map(([name,item,formatter,read]) => item ? `<tr><td>${name}</td><td>${item.ticker}</td><td>${formatter(item)}</td><td>${read}</td></tr>` : '').join('');
}

function renderToday(){
  document.getElementById('tbodyToday').innerHTML = latestSnapshots().map(item => `
    <tr>
      <td><span class="ticker">${item.ticker}</span><span class="name">${item.name}</span></td>
      <td>${item.qty}</td>
      <td>${formatNumber(item.avgPrice)}</td>
      <td>${formatNumber(item.currentPrice)}</td>
      <td>${formatNumber(item.value)}</td>
      <td class="${tone(item.plTotal)}">${formatNumber(item.plTotal)}</td>
      <td class="${tone(item.plPct)}">${pct(item.plPct)}</td>
      <td class="${tone(item.plDay||0)}">${item.plDay===null?'<span class="mono">base</span>':formatNumber(item.plDay)}</td>
      <td class="${tone(item.plDayPct||0)}">${pct(item.plDayPct)}</td>
      <td>${formatNumber(item.weightPct)}%</td>
      <td>${item.setup}</td>
      <td>${item.stage}</td>
      <td>${formatNumber(item.stop)}</td>
      <td>${formatNumber(item.target1)}</td>
      <td>${formatNumber(item.riskPct)}%</td>
      <td>${item.daysOpen}</td>
      <td>${item.status}</td>
    </tr>
  `).join('');
}

function renderDecision(){
  document.getElementById('tbodyDecision').innerHTML = latestSnapshots().map(item => {
    const d = decisionModel(item);
    return `<tr><td>${item.ticker}</td><td>${d.state}</td><td class="${tone(item.plPct)}">${pct(item.plPct)}</td><td>${formatNumber(item.weightPct)}%</td><td>${formatNumber(item.riskPct)}%</td><td>${d.read}</td><td>${d.action}</td><td>${d.priority}</td></tr>`;
  }).join('');
}

function renderPeriods(){
  document.getElementById('tbodyPeriodSummary').innerHTML = database.periodSummary.map(item => `
    <tr>
      <td>${item.period}</td>
      <td>${formatNumber(item.valueFinal)}</td>
      <td class="${tone(item.plOpen)}">${money(item.plOpen)}</td>
      <td class="${tone(item.plOpenPct)}">${pct(item.plOpenPct)}</td>
      <td class="${tone(item.plPeriod)}">${money(item.plPeriod)}</td>
      <td class="${tone(item.plPeriodPct)}">${pct(item.plPeriodPct)}</td>
      <td>${item.bestTicker}</td>
      <td>${item.worstTicker}</td>
    </tr>
  `).join('');
}

function renderEvents(){
  document.getElementById('tbodyEvents').innerHTML = database.events.map(item => `
    <tr><td>${item.date}</td><td>${item.ticker}</td><td>${item.type}</td><td>${item.qty}</td><td>${item.value}</td><td>${item.note}</td></tr>
  `).join('');
}

function renderHistoryMatrix(){
  const dates = [...new Set(database.snapshots.map(x=>x.date))];
  const tickers = [...new Set(database.snapshots.map(x=>x.ticker))];
  let html = '<thead><tr><th class="sticky-left header-cell" rowspan="2">Ativo</th><th class="sticky-left header-cell" rowspan="2" style="left:140px;">Nome</th>' +
    dates.map(d => `<th class="date-group" colspan="3">${d}</th>`).join('') +
    '</tr><tr>' + dates.map(()=>'<th>Valor</th><th>P/L %</th><th>P/L dia %</th>').join('') + '</tr></thead><tbody>';
  tickers.forEach(ticker => {
    const rows = database.snapshots.filter(x=>x.ticker===ticker);
    html += `<tr><td class="sticky-left">${ticker}</td><td class="sticky-left" style="left:140px;">${rows[0].name}</td>`;
    dates.forEach(date => {
      const item = rows.find(x=>x.date===date);
      html += item ? `<td>${formatNumber(item.value)}</td><td class="${tone(item.plPct)}">${pct(item.plPct)}</td><td class="${tone(item.plDayPct||0)}">${pct(item.plDayPct)}</td>` : '<td class="mono">-</td><td class="mono">-</td><td class="mono">-</td>';
    });
    html += '</tr>';
  });
  html += '</tbody>';
  document.getElementById('historyMatrix').innerHTML = html;
}

function renderDataTables(){
  document.getElementById('tbodySnapshots').innerHTML = database.snapshots.map(item => `
    <tr>
      <td>${item.date}</td><td>${item.portfolio}</td><td>${item.ticker}</td><td>${item.qty}</td>
      <td>${formatNumber(item.currentPrice)}</td><td>${formatNumber(item.value)}</td>
      <td class="${tone(item.plTotal)}">${formatNumber(item.plTotal)}</td>
      <td class="${tone(item.plPct)}">${pct(item.plPct)}</td>
      <td class="${tone(item.plDay||0)}">${item.plDay===null?'<span class="mono">base</span>':formatNumber(item.plDay)}</td>
      <td class="${tone(item.plDayPct||0)}">${pct(item.plDayPct)}</td>
      <td>${formatNumber(item.weightPct)}%</td>
    </tr>
  `).join('');
  document.getElementById('tbodyDailySummary').innerHTML = database.dailySummary.map(item => `
    <tr>
      <td>${item.date}</td><td>${formatNumber(item.valueTotal)}</td><td>${formatNumber(item.cash)}</td>
      <td class="${tone(item.plOpen)}">${money(item.plOpen)}</td>
      <td class="${tone(item.plDay||0)}">${money(item.plDay)}</td>
      <td class="${tone(item.plDayPct||0)}">${pct(item.plDayPct)}</td>
    </tr>
  `).join('');
}

function renderCharts(){
  const daily = database.dailySummary;
  const eq = document.getElementById('equityChart');
  const al = document.getElementById('allocationChart');
  const pl = document.getElementById('dailyPLChart');
  const eqCtx = eq.getContext('2d');
  const alCtx = al.getContext('2d');
  const plCtx = pl.getContext('2d');
  [eqCtx, alCtx, plCtx].forEach(ctx => ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height));
  const pad = 32;

  const equityValues = daily.map(x => x.valueTotal + x.cash);
  const eqMax = Math.max(...equityValues,1), eqMin = Math.min(...equityValues,0);
  eqCtx.strokeStyle = '#60a5fa'; eqCtx.lineWidth = 2; eqCtx.beginPath();
  equityValues.forEach((v,i) => {
    const x = pad + i*((eq.width-pad*2)/Math.max(equityValues.length-1,1));
    const y = eq.height-pad-((v-eqMin)/Math.max(eqMax-eqMin,1))*(eq.height-pad*2);
    i===0 ? eqCtx.moveTo(x,y) : eqCtx.lineTo(x,y);
  });
  eqCtx.stroke(); eqCtx.fillStyle = '#9bb0d3';
  daily.forEach((d,i) => {
    const x = pad + i*((eq.width-pad*2)/Math.max(equityValues.length-1,1));
    eqCtx.fillText(d.date.slice(5), x-16, eq.height-8);
  });

  const rows = database.snapshots.filter(x => x.date === database.meta.latestDate);
  const maxWeight = Math.max(...rows.map(x=>x.weightPct),1);
  rows.forEach((r,i) => {
    const y = 18 + i*26;
    const barW = ((al.width-180)*r.weightPct)/maxWeight;
    alCtx.fillStyle = '#60a5fa'; alCtx.fillRect(120,y,barW,14);
    alCtx.fillStyle = '#9bb0d3'; alCtx.fillText(r.ticker,12,y+12); alCtx.fillText(r.weightPct.toFixed(2)+'%',128+barW,y+12);
  });

  const plValues = daily.map(x => x.plDay || 0);
  const plMax = Math.max(...plValues,0.01), plMin = Math.min(...plValues,-0.01);
  const zeroY = pl.height-pad-((0-plMin)/Math.max(plMax-plMin,1))*(pl.height-pad*2);
  plCtx.strokeStyle = '#64748b'; plCtx.beginPath(); plCtx.moveTo(pad,zeroY); plCtx.lineTo(pl.width-pad,zeroY); plCtx.stroke();
  plValues.forEach((v,i) => {
    const slotW = (pl.width-pad*2)/Math.max(plValues.length,1);
    const x = pad + i*slotW + 18;
    const h = Math.abs(v/Math.max(Math.abs(plMax),Math.abs(plMin),0.01))*((pl.height-pad*2)/2);
    const y = v>=0 ? zeroY-h : zeroY;
    plCtx.fillStyle = v>=0 ? '#22c55e' : '#ef4444';
    plCtx.fillRect(x,y,Math.max(slotW-36,24),h);
    plCtx.fillStyle = '#9bb0d3';
    plCtx.fillText(daily[i].date.slice(5), x-4, pl.height-8);
    plCtx.fillText(v.toFixed(2), x-2, v>=0 ? y-6 : y+h+14);
  });
}

function setupTabs(){
  const buttons = document.querySelectorAll('.tab-btn');
  const views = document.querySelectorAll('.tab-view');
  buttons.forEach(btn => btn.addEventListener('click', () => {
    buttons.forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.tab;
    views.forEach(view => view.classList.toggle('hidden', view.dataset.tabContent !== target));
  }));
}

function rerenderFilteredViews(){
  renderCards();
  renderQuickAndQuality();
  renderRankings();
  renderToday();
  renderDecision();
}

function setupFilters(){
  document.getElementById('filterAllBtn').addEventListener('click', ()=>{ currentFilter='all'; rerenderFilteredViews(); });
  document.getElementById('filterWinnersBtn').addEventListener('click', ()=>{ currentFilter='winners'; rerenderFilteredViews(); });
  document.getElementById('filterLosersBtn').addEventListener('click', ()=>{ currentFilter='losers'; rerenderFilteredViews(); });
}

function setupExport(){
  document.getElementById('exportJsonBtn').addEventListener('click', ()=>{
    const payload = JSON.stringify(database, null, 2);
    const blob = new Blob([payload], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vidanova-carteira-eur-${database.meta.latestDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

async function loadData(){
  const res = await fetch('data.json', { cache: 'no-store' });
  if(!res.ok) throw new Error('Falha ao carregar data.json');
  database = await res.json();
}

async function init(){
  try{
    await loadData();
    renderHeader();
    renderCards();
    renderQuickAndQuality();
    renderRankings();
    renderToday();
    renderDecision();
    renderPeriods();
    renderEvents();
    renderHistoryMatrix();
    renderDataTables();
    renderCharts();
    setupTabs();
    setupFilters();
    setupExport();
  }catch(err){
    document.body.innerHTML = `<div style="padding:24px;color:white;font-family:Arial">Erro ao carregar a aplicação: ${err.message}</div>`;
  }
}
init();
