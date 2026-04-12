const fs = require("fs");

function loadJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function almostEqual(a, b, tolerance = 0.05) {
  return Math.abs(a - b) <= tolerance;
}

function validateAccountJson(accountName, filePath) {
  const data = loadJson(filePath);

  assert(data.meta, `${accountName}: meta em falta`);
  assert(data.governance, `${accountName}: governance em falta`);
  assert(Array.isArray(data.snapshots), `${accountName}: snapshots tem de ser array`);
  assert(Array.isArray(data.dailySummary), `${accountName}: dailySummary tem de ser array`);
  assert(Array.isArray(data.periodSummary), `${accountName}: periodSummary tem de ser array`);
  assert(Array.isArray(data.events), `${accountName}: events tem de ser array`);

  assert(data.meta.accountId === accountName, `${accountName}: meta.accountId incorreto`);
  assert(data.meta.latestDate, `${accountName}: latestDate em falta`);

  const requiredSnapshotFields = [
    "date",
    "account",
    "portfolio",
    "ticker",
    "name",
    "qty",
    "avgPrice",
    "currentPrice",
    "value",
    "plTotal",
    "plPct",
    "plDay",
    "plDayPct",
    "weightPct",
    "status",
    "stage",
    "setup",
    "stop",
    "target1",
    "riskPct",
    "daysOpen"
  ];

  for (const row of data.snapshots) {
    for (const field of requiredSnapshotFields) {
      assert(
        Object.prototype.hasOwnProperty.call(row, field),
        `${accountName}: snapshot sem campo ${field}`
      );
    }

    assert(row.account === accountName, `${accountName}: snapshot com account errado em ${row.ticker} ${row.date}`);
    assert(isNumber(row.qty), `${accountName}: qty inválido em ${row.ticker} ${row.date}`);
    assert(isNumber(row.avgPrice), `${accountName}: avgPrice inválido em ${row.ticker} ${row.date}`);
    assert(isNumber(row.currentPrice), `${accountName}: currentPrice inválido em ${row.ticker} ${row.date}`);
    assert(isNumber(row.value), `${accountName}: value inválido em ${row.ticker} ${row.date}`);
    assert(isNumber(row.plTotal), `${accountName}: plTotal inválido em ${row.ticker} ${row.date}`);
    assert(isNumber(row.plPct), `${accountName}: plPct inválido em ${row.ticker} ${row.date}`);
    assert(isNumber(row.plDay), `${accountName}: plDay inválido em ${row.ticker} ${row.date}`);
    assert(isNumber(row.plDayPct), `${accountName}: plDayPct inválido em ${row.ticker} ${row.date}`);
    assert(isNumber(row.weightPct), `${accountName}: weightPct inválido em ${row.ticker} ${row.date}`);
    assert(isNumber(row.stop), `${accountName}: stop inválido em ${row.ticker} ${row.date}`);
    assert(isNumber(row.target1), `${accountName}: target1 inválido em ${row.ticker} ${row.date}`);
    assert(isNumber(row.riskPct), `${accountName}: riskPct inválido em ${row.ticker} ${row.date}`);
    assert(isNumber(row.daysOpen), `${accountName}: daysOpen inválido em ${row.ticker} ${row.date}`);
  }

  const seen = new Set();
  for (const row of data.snapshots) {
    const key = `${row.date}__${row.ticker}`;
    assert(!seen.has(key), `${accountName}: snapshot duplicado para ${row.ticker} em ${row.date}`);
    seen.add(key);
  }

  const dates = [...new Set(data.snapshots.map(x => x.date))].sort();

  for (const date of dates) {
    const rows = data.snapshots.filter(x => x.date === date);
    const sumExposure = round2(rows.reduce((s, x) => s + x.value, 0));
    const sumPlOpen = round2(rows.reduce((s, x) => s + x.plTotal, 0));
    const weightSum = round2(rows.reduce((s, x) => s + x.weightPct, 0));
    const summary = data.dailySummary.find(x => x.date === date);

    assert(summary, `${accountName}: dailySummary em falta para ${date}`);
    assert(isNumber(summary.valueTotal), `${accountName}: valueTotal inválido em dailySummary ${date}`);
    assert(isNumber(summary.cash), `${accountName}: cash inválido em dailySummary ${date}`);
    assert(isNumber(summary.plOpen), `${accountName}: plOpen inválido em dailySummary ${date}`);
    assert(isNumber(summary.plOpenPct), `${accountName}: plOpenPct inválido em dailySummary ${date}`);
    assert(isNumber(summary.plDay), `${accountName}: plDay inválido em dailySummary ${date}`);
    assert(isNumber(summary.plDayPct), `${accountName}: plDayPct inválido em dailySummary ${date}`);

    if (Object.prototype.hasOwnProperty.call(summary, "openExposure")) {
      assert(
        isNumber(summary.openExposure),
        `${accountName}: openExposure inválido em dailySummary ${date}`
      );

      assert(
        almostEqual(round2(summary.openExposure), sumExposure),
        `${accountName}: openExposure não bate em ${date}. summary=${summary.openExposure} snapshots=${sumExposure}`
      );
    } else {
      assert(
        almostEqual(round2(summary.valueTotal), sumExposure),
        `${accountName}: valueTotal não bate em ${date}. summary=${summary.valueTotal} snapshots=${sumExposure}`
      );
    }

    assert(
      almostEqual(round2(summary.plOpen), sumPlOpen),
      `${accountName}: plOpen não bate em ${date}. summary=${summary.plOpen} snapshots=${sumPlOpen}`
    );

    assert(
      weightSum >= 99 && weightSum <= 101,
      `${accountName}: soma de pesos fora do intervalo aceitável em ${date}: ${weightSum}%`
    );
  }

  const sortedDaily = [...data.dailySummary].sort((a, b) => a.date.localeCompare(b.date));

  if (sortedDaily.length > 0) {
    assert(sortedDaily[0].plDay === 0, `${accountName}: primeiro dia deve ter plDay = 0`);
    assert(sortedDaily[0].plDayPct === 0, `${accountName}: primeiro dia deve ter plDayPct = 0`);
  }

  for (let i = 1; i < sortedDaily.length; i++) {
    const prev = sortedDaily[i - 1];
    const curr = sortedDaily[i];
    const expectedDay = round2(curr.plOpen - prev.plOpen);

    assert(
      almostEqual(round2(curr.plDay), expectedDay, 0.1),
      `${accountName}: plDay incorreto em ${curr.date}. esperado=${expectedDay} atual=${curr.plDay}`
    );
  }

  const periods = new Set(data.periodSummary.map(x => x.period));

  const hasWeekly =
    periods.has("Semana atual") ||
    [...periods].some(p => typeof p === "string" && p.toLowerCase().includes("week"));

  const hasMonthly =
    periods.has("Mês atual") ||
    [...periods].some(p => typeof p === "string" && p.toLowerCase().includes("month"));

  assert(hasWeekly, `${accountName}: periodSummary sem período semanal`);
  assert(hasMonthly, `${accountName}: periodSummary sem período mensal`);

  const latestSummary = data.dailySummary.find(x => x.date === data.meta.latestDate);
  const latestPositions = data.snapshots.filter(x => x.date === data.meta.latestDate).length;

  return {
    latestDate: data.meta.latestDate,
    positions: latestPositions,
    valueTotal: latestSummary?.valueTotal ?? 0,
    cash: latestSummary?.cash ?? 0,
    plOpen: latestSummary?.plOpen ?? 0
  };
}

function validateConsolidated(eurStats, usdStats) {
  const data = loadJson("data/consolidated.json");

  assert(data.meta, `consolidated: meta em falta`);
  assert(data.accounts, `consolidated: accounts em falta`);
  assert(data.totals, `consolidated: totals em falta`);
  assert(data.accounts.EUR, `consolidated: accounts.EUR em falta`);
  assert(data.accounts.USD, `consolidated: accounts.USD em falta`);

  assert(
    almostEqual(round2(data.accounts.EUR.valueTotal), round2(eurStats.valueTotal)),
    `consolidated: EUR valueTotal não bate`
  );
  assert(
    almostEqual(round2(data.accounts.EUR.plOpen), round2(eurStats.plOpen)),
    `consolidated: EUR plOpen não bate`
  );
  assert(data.accounts.EUR.positions === eurStats.positions, `consolidated: EUR positions não bate`);

  assert(
    almostEqual(round2(data.accounts.USD.valueTotal), round2(usdStats.valueTotal)),
    `consolidated: USD valueTotal não bate`
  );
  assert(
    almostEqual(round2(data.accounts.USD.plOpen), round2(usdStats.plOpen)),
    `consolidated: USD plOpen não bate`
  );
  assert(data.accounts.USD.positions === usdStats.positions, `consolidated: USD positions não bate`);

  if (Object.prototype.hasOwnProperty.call(data.totals, "eurValueTotal")) {
    assert(
      almostEqual(round2(data.totals.eurValueTotal), round2(eurStats.valueTotal)),
      `consolidated: totals.eurValueTotal não bate`
    );
  }

  if (Object.prototype.hasOwnProperty.call(data.totals, "usdValueTotal")) {
    assert(
      almostEqual(round2(data.totals.usdValueTotal), round2(usdStats.valueTotal)),
      `consolidated: totals.usdValueTotal não bate`
    );
  }

  if (Object.prototype.hasOwnProperty.call(data.totals, "eurPositions")) {
    assert(data.totals.eurPositions === eurStats.positions, `consolidated: totals.eurPositions não bate`);
  }

  if (Object.prototype.hasOwnProperty.call(data.totals, "usdPositions")) {
    assert(data.totals.usdPositions === usdStats.positions, `consolidated: totals.usdPositions não bate`);
  }

  return true;
}

function main() {
  const eurStats = validateAccountJson("EUR", "data/eur.json");
  const usdStats = validateAccountJson("USD", "data/usd.json");
  validateConsolidated(eurStats, usdStats);
  console.log("VALIDATION OK");
}

main();
