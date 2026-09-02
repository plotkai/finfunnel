/**
 * FinFunnel by Plotkai - Self-Contained SVG Charting & Analytics Engine
 * 100% offline, zero external dependencies.
 */

const PALETTE = [
  '#38bdf8', '#818cf8', '#c084fc', '#f472b6', 
  '#34d399', '#fbbf24', '#f87171', '#2dd4bf', 
  '#a78bfa', '#fb923c', '#4ade80', '#e879f9'
];

export function formatMoney(val, currency = '₹', compact = false) {
  if (val === null || val === undefined || isNaN(val)) val = 0;
  const num = Number(val);
  
  if (compact) {
    if (Math.abs(num) >= 10000000) {
      return `${currency}${(num / 10000000).toFixed(2)}Cr`;
    }
    if (Math.abs(num) >= 100000) {
      return `${currency}${(num / 100000).toFixed(2)}L`;
    }
    if (Math.abs(num) >= 1000) {
      return `${currency}${(num / 1000).toFixed(1)}k`;
    }
  }

  // Format with standard locale number formatting
  return `${currency}${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function renderDonutChart(containerId, items, total, currency = '₹') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items || items.length === 0 || total <= 0) {
    container.innerHTML = `
      <div class="chart-empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" stroke-dasharray="4 4"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
        <p>No data recorded for this category yet</p>
      </div>
    `;
    return;
  }

  const size = 220;
  const center = size / 2;
  const radius = 78;
  const innerRadius = 52;
  const strokeWidth = radius - innerRadius;

  let currentAngle = -90; // Start at top
  const paths = [];
  const legendItems = [];

  items.forEach((item, idx) => {
    const color = item.color || PALETTE[idx % PALETTE.length];
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;

    // SVG donut path via stroke-dasharray on circle
    const circumference = 2 * Math.PI * ((radius + innerRadius) / 2);
    const dashLength = (circumference * angle) / 360;
    const gapLength = circumference - dashLength;
    const rotation = currentAngle;

    paths.push(`
      <circle 
        cx="${center}" 
        cy="${center}" 
        r="${(radius + innerRadius) / 2}" 
        fill="transparent" 
        stroke="${color}" 
        stroke-width="${strokeWidth}" 
        stroke-dasharray="${dashLength} ${gapLength}" 
        transform="rotate(${rotation} ${center} ${center})" 
        class="donut-segment"
        data-tag="${item.label}"
        data-value="${formatMoney(item.value, currency)}"
        data-percent="${percentage.toFixed(1)}%"
      >
        <title>${item.label}: ${formatMoney(item.value, currency)} (${percentage.toFixed(1)}%)</title>
      </circle>
    `);

    legendItems.push(`
      <div class="chart-legend-row" style="--tag-color: ${color}">
        <div class="legend-left">
          <span class="legend-dot" style="background: ${color}"></span>
          <span class="legend-label">${item.label}</span>
        </div>
        <div class="legend-right">
          <span class="legend-val">${formatMoney(item.value, currency)}</span>
          <span class="legend-pct">${percentage.toFixed(1)}%</span>
        </div>
      </div>
    `);

    currentAngle += angle;
  });

  container.innerHTML = `
    <div class="donut-chart-wrapper">
      <div class="donut-svg-container">
        <svg viewBox="0 0 ${size} ${size}" class="donut-svg" width="${size}" height="${size}">
          <circle cx="${center}" cy="${center}" r="${(radius + innerRadius) / 2}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${strokeWidth}" />
          ${paths.join('')}
        </svg>
        <div class="donut-center-info">
          <div class="center-sub">Total</div>
          <div class="center-main">${formatMoney(total, currency, true)}</div>
        </div>
      </div>
      <div class="chart-legend-list">
        ${legendItems.join('')}
      </div>
    </div>
  `;
}

export function renderBarChart(containerId, items, currency = '₹') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = '<div class="chart-empty-state"><p>No items to compare</p></div>';
    return;
  }

  const maxVal = Math.max(...items.map(i => i.value), 1);

  const bars = items.map((item, idx) => {
    const color = item.color || PALETTE[idx % PALETTE.length];
    const widthPct = Math.max(3, (item.value / maxVal) * 100);
    return `
      <div class="bar-chart-row">
        <div class="bar-info-row">
          <span class="bar-label">${item.label}</span>
          <span class="bar-value">${formatMoney(item.value, currency)}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${widthPct}%; background: ${color}"></div>
        </div>
      </div>
    `;
  });

  container.innerHTML = `<div class="bar-chart-container">${bars.join('')}</div>`;
}
