/**
 * FinFunnel by Plotkai - Storage & Data Management Engine
 */

const STORAGE_KEY = 'finfunnel_state_v1';

export const DEFAULT_STATE = {
  currency: '₹',
  viewMode: 'monthly', // 'monthly' | 'annual'
  theme: 'dark',
  earnings: [
    {
      id: 'earn_1',
      name: 'Primary Salary',
      amount: 125000,
      cycle: 'monthly',
      tags: ['#salary', '#active']
    },
    {
      id: 'earn_2',
      name: 'Freelance & Consulting',
      amount: 35000,
      cycle: 'monthly',
      tags: ['#freelance', '#sidehustle']
    },
    {
      id: 'earn_3',
      name: 'Stock Dividends',
      amount: 48000,
      cycle: 'annual',
      tags: ['#passive', '#investments']
    }
  ],
  spendings: [
    {
      id: 'spend_1',
      name: 'House Rent & Maintenance',
      type: 'fixed',
      amount: 32000,
      cycle: 'monthly',
      tags: ['#housing', '#essentials']
    },
    {
      id: 'spend_2',
      name: 'SIP & Mutual Funds',
      type: 'percentage',
      percentage: 25,
      amount: 0, // dynamically computed
      cycle: 'monthly',
      tags: ['#investments', '#wealth']
    },
    {
      id: 'spend_3',
      name: 'Groceries & Household',
      type: 'fixed',
      amount: 14000,
      cycle: 'monthly',
      tags: ['#food', '#essentials']
    },
    {
      id: 'spend_4',
      name: 'Term & Health Insurance',
      type: 'fixed',
      amount: 28000,
      cycle: 'annual',
      tags: ['#insurance', '#security']
    },
    {
      id: 'spend_5',
      name: 'Dining & Entertainment',
      type: 'percentage',
      percentage: 8,
      amount: 0,
      cycle: 'monthly',
      tags: ['#lifestyle', '#fun']
    }
  ]
};

export const Storage = {
  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return DEFAULT_STATE;
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_STATE,
        ...parsed,
        earnings: Array.isArray(parsed.earnings) ? parsed.earnings : DEFAULT_STATE.earnings,
        spendings: Array.isArray(parsed.spendings) ? parsed.spendings : DEFAULT_STATE.spendings
      };
    } catch (e) {
      console.error('Error loading state from localStorage:', e);
      return DEFAULT_STATE;
    }
  },

  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error saving state to localStorage:', e);
    }
  },

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Error clearing localStorage:', e);
    }
  },

  exportJSON(state) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `finfunnel_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  exportCSV(state, normalizedTotals) {
    const rows = [
      ['Category', 'Type', 'Name', 'Amount/Value', 'Value Type', 'Frequency Cycle', 'Tags', 'Monthly Amount', 'Annual Amount']
    ];

    state.earnings.forEach(item => {
      const norm = normalizedTotals.earningsMap[item.id] || { monthly: item.amount, annual: item.amount * 12 };
      rows.push([
        'Earning',
        'Inflow',
        `"${(item.name || '').replace(/"/g, '""')}"`,
        item.amount,
        'Fixed',
        item.cycle,
        `"${(item.tags || []).join(' ')}"`,
        norm.monthly.toFixed(2),
        norm.annual.toFixed(2)
      ]);
    });

    state.spendings.forEach(item => {
      const norm = normalizedTotals.spendingsMap[item.id] || { monthly: 0, annual: 0 };
      const val = item.type === 'percentage' ? `${item.percentage}%` : item.amount;
      rows.push([
        'Spending',
        'Outflow',
        `"${(item.name || '').replace(/"/g, '""')}"`,
        val,
        item.type === 'percentage' ? 'Percentage' : 'Fixed',
        item.cycle,
        `"${(item.tags || []).join(' ')}"`,
        norm.monthly.toFixed(2),
        norm.annual.toFixed(2)
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `finfunnel_plan_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || (typeof parsed !== 'object')) throw new Error('Invalid JSON');
      return {
        currency: parsed.currency || '₹',
        viewMode: parsed.viewMode || 'monthly',
        theme: parsed.theme || 'dark',
        earnings: Array.isArray(parsed.earnings) ? parsed.earnings : [],
        spendings: Array.isArray(parsed.spendings) ? parsed.spendings : []
      };
    } catch (e) {
      throw new Error('Failed to parse file: ' + e.message);
    }
  }
};
