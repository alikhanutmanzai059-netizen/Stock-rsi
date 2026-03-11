const blueChipStocks = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "JPM", name: "JPMorgan Chase" },
  { symbol: "PG", name: "Procter & Gamble" },
  { symbol: "KO", name: "Coca-Cola" },
  { symbol: "HD", name: "Home Depot" },
  { symbol: "V", name: "Visa" },
  { symbol: "WMT", name: "Walmart" },
  { symbol: "XOM", name: "Exxon Mobil" }
];

const resultsBody = document.getElementById("resultsBody");
const statusText = document.getElementById("statusText");
const updatedAt = document.getElementById("updatedAt");
const refreshBtn = document.getElementById("refreshBtn");

refreshBtn.addEventListener("click", runScan);

async function fetchHistory(symbol) {
  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?timeseries=120&apikey=demo`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${symbol}`);
  }
  const data = await res.json();
  const prices = (data?.historical || []).map((d) => Number(d.close)).filter(Boolean).reverse();
  if (prices.length < 30) {
    throw new Error(`Not enough data for ${symbol}`);
  }
  return prices;
}

function calculateRSI(closes, period = 14) {
  if (closes.length <= period) return [];

  const changes = [];
  for (let i = 1; i < closes.length; i += 1) {
    changes.push(closes[i] - closes[i - 1]);
  }

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 0; i < period; i += 1) {
    const c = changes[i];
    if (c >= 0) gainSum += c;
    else lossSum += Math.abs(c);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  const rsi = [];

  const firstRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push(100 - 100 / (1 + firstRs));

  for (let i = period; i < changes.length; i += 1) {
    const c = changes[i];
    const gain = c > 0 ? c : 0;
    const loss = c < 0 ? Math.abs(c) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }

  return rsi;
}

function detectBounce(rsiSeries) {
  if (rsiSeries.length < 6) return null;

  const current = rsiSeries[rsiSeries.length - 1];
  const prev = rsiSeries[rsiSeries.length - 2];
  const recentWindow = rsiSeries.slice(-5);
  const low5 = Math.min(...recentWindow);

  const crossedNow = prev <= 30 && current > 30;
  const touchedAndRising = low5 <= 30 && current > 30 && current > prev;

  if (!(crossedNow || touchedAndRising)) return null;

  return {
    current,
    prev,
    low5,
    crossedNow
  };
}

function rowHtml(item) {
  return `
    <tr>
      <td>${item.symbol}</td>
      <td>${item.name}</td>
      <td>$${item.price.toFixed(2)}</td>
      <td>${item.rsi.toFixed(2)}</td>
      <td>${item.prevRsi.toFixed(2)}</td>
      <td>${item.low5.toFixed(2)}</td>
      <td><span class="badge">${item.signal}</span></td>
    </tr>
  `;
}

async function runScan() {
  resultsBody.innerHTML = "";
  statusText.textContent = "Scanning blue chip stocks…";
  refreshBtn.disabled = true;

  const candidates = [];
  const failures = [];

  for (const stock of blueChipStocks) {
    try {
      const closes = await fetchHistory(stock.symbol);
      const rsiSeries = calculateRSI(closes);
      const bounce = detectBounce(rsiSeries);

      if (bounce) {
        candidates.push({
          symbol: stock.symbol,
          name: stock.name,
          price: closes[closes.length - 1],
          rsi: bounce.current,
          prevRsi: bounce.prev,
          low5: bounce.low5,
          signal: bounce.crossedNow ? "Fresh cross > 30" : "Bounce underway"
        });
      }
    } catch (err) {
      failures.push(`${stock.symbol}: ${err.message}`);
    }
  }

  candidates.sort((a, b) => a.rsi - b.rsi);

  if (candidates.length === 0) {
    resultsBody.innerHTML = `<tr><td colspan="7" class="empty">No current bounce candidates found.</td></tr>`;
  } else {
    resultsBody.innerHTML = candidates.map(rowHtml).join("");
  }

  statusText.textContent = `Scan complete. Found ${candidates.length} candidate(s). ${
    failures.length ? `Data issues: ${failures.length} symbol(s).` : ""
  }`;
  updatedAt.textContent = `Updated: ${new Date().toLocaleString()}`;
  refreshBtn.disabled = false;
}

runScan();
