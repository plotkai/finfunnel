/**
 * FinFunnel by Plotkai - Core Application Engine
 */

import { Storage, DEFAULT_STATE } from './storage.js';
import { formatMoney, renderDonutChart, renderBarChart } from './charts.js';

class FinFunnelApp {
  constructor() {
    this.state = Storage.load();
    this.deferredPrompt = null;
    this.activeAnalyticsModal = null; // 'earnings' | 'spendings' | 'global' | null
    
    this.initPWA();
    this.initDOM();
    this.initEvents();
    this.render();
  }

  initPWA() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('FinFunnel SW registered:', reg.scope))
          .catch(err => console.log('FinFunnel SW failed:', err));
      });
    }

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const installBtn = document.getElementById('menu-install-pwa');
      if (installBtn) installBtn.classList.remove('hidden');
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      const installBtn = document.getElementById('menu-install-pwa');
      if (installBtn) installBtn.classList.add('hidden');
      this.showToast('FinFunnel installed successfully!');
    });
  }

  initDOM() {
    // Main containers
    this.earningsListEl = document.getElementById('earnings-cards-container');
    this.spendingsListEl = document.getElementById('spendings-cards-container');
    
    // Totals
    this.earningsTotalEl = document.getElementById('earnings-total-amount');
    this.earningsCycleLabelEl = document.getElementById('earnings-cycle-label');
    
    this.spendingsTotalEl = document.getElementById('spendings-total-amount');
    this.spendingsCycleLabelEl = document.getElementById('spendings-cycle-label');
    
    this.netBalanceEl = document.getElementById('net-balance-amount');
    this.netStatusEl = document.getElementById('net-status-badge');
    this.netSavingsPctEl = document.getElementById('net-savings-rate');

    // Controls
    this.viewModeToggle = document.getElementById('view-mode-toggle');
    this.currencySelect = document.getElementById('currency-select');
    
    // Drawers & Modals
    this.menuDrawer = document.getElementById('menu-drawer');
    this.menuOverlay = document.getElementById('drawer-overlay');
    this.analyticsModal = document.getElementById('analytics-modal');
    this.modalOverlay = document.getElementById('modal-overlay');
    this.fileImportInput = document.getElementById('file-import-input');
    
    // Apply currency
    if (this.currencySelect) {
      this.currencySelect.value = this.state.currency || '₹';
    }
  }

  initEvents() {
    // Toggle View Mode (Monthly vs Annual)
    if (this.viewModeToggle) {
      this.viewModeToggle.addEventListener('click', () => {
        this.state.viewMode = this.state.viewMode === 'monthly' ? 'annual' : 'monthly';
        this.saveAndRender();
      });
    }

    // Hamburger Menu Open/Close
    const menuBtn = document.getElementById('btn-open-menu');
    const closeMenuBtn = document.getElementById('btn-close-menu');
    
    if (menuBtn) menuBtn.addEventListener('click', () => this.toggleDrawer(true));
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', () => this.toggleDrawer(false));
    if (this.menuOverlay) this.menuOverlay.addEventListener('click', () => this.toggleDrawer(false));

    // Global Analytics Modal
    const globalAnalyticsBtn = document.getElementById('btn-global-analytics');
    if (globalAnalyticsBtn) {
      globalAnalyticsBtn.addEventListener('click', () => this.openAnalyticsModal('global'));
    }

    // Section Analytics Modals
    const earnAnalyticsBtn = document.getElementById('btn-earnings-analytics');
    if (earnAnalyticsBtn) {
      earnAnalyticsBtn.addEventListener('click', () => this.openAnalyticsModal('earnings'));
    }

    const spendAnalyticsBtn = document.getElementById('btn-spendings-analytics');
    if (spendAnalyticsBtn) {
      spendAnalyticsBtn.addEventListener('click', () => this.openAnalyticsModal('spendings'));
    }

    // Close Modal
    const closeModalBtn = document.getElementById('btn-close-modal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => this.closeModal());
    if (this.modalOverlay) this.modalOverlay.addEventListener('click', () => this.closeModal());

    // Add Block Buttons
    const addEarnBtn = document.getElementById('btn-add-earning');
    if (addEarnBtn) addEarnBtn.addEventListener('click', () => this.addEarningBlock());

    const addSpendBtn = document.getElementById('btn-add-spending');
    if (addSpendBtn) addSpendBtn.addEventListener('click', () => this.addSpendingBlock());

    // Currency Selector
    if (this.currencySelect) {
      this.currencySelect.addEventListener('change', (e) => {
        this.state.currency = e.target.value;
        this.saveAndRender();
        this.showToast(`Currency changed to ${this.state.currency}`);
      });
    }

    // Menu Actions
    document.getElementById('menu-export-json')?.addEventListener('click', () => {
      Storage.exportJSON(this.state);
      this.toggleDrawer(false);
      this.showToast('JSON Backup downloaded');
    });

    document.getElementById('menu-export-csv')?.addEventListener('click', () => {
      const totals = this.calculateTotals();
      Storage.exportCSV(this.state, totals);
      this.toggleDrawer(false);
      this.showToast('CSV Report downloaded');
    });

    document.getElementById('menu-import-data')?.addEventListener('click', () => {
      this.fileImportInput?.click();
    });

    this.fileImportInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = Storage.importJSON(event.target.result);
          this.state = imported;
          this.saveAndRender();
          this.toggleDrawer(false);
          this.showToast('Data imported successfully!');
        } catch (err) {
          alert('Import failed: ' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('menu-sample-data')?.addEventListener('click', () => {
      if (confirm('Load sample finance data? Current data will be replaced.')) {
        this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        this.saveAndRender();
        this.toggleDrawer(false);
        this.showToast('Sample data loaded');
      }
    });

    document.getElementById('menu-clean-data')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clean and wipe all financial data?')) {
        this.state.earnings = [];
        this.state.spendings = [];
        this.saveAndRender();
        this.toggleDrawer(false);
        this.showToast('All financial blocks cleared');
      }
    });

    document.getElementById('menu-install-pwa')?.addEventListener('click', async () => {
      if (!this.deferredPrompt) {
        alert('To install FinFunnel, use your browser\'s "Add to Home Screen" or "Install App" option.');
        return;
      }
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        this.showToast('Installing FinFunnel...');
      }
      this.deferredPrompt = null;
      this.toggleDrawer(false);
    });

    // Keyboard navigation / escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.toggleDrawer(false);
        this.closeModal();
      }
    });
  }

  toggleDrawer(open) {
    if (this.menuDrawer && this.menuOverlay) {
      if (open) {
        this.menuDrawer.classList.add('open');
        this.menuOverlay.classList.add('open');
      } else {
        this.menuDrawer.classList.remove('open');
        this.menuOverlay.classList.remove('open');
      }
    }
  }

  showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // Frequency normalization to monthly and annual values
  normalizeFrequency(amount, cycle) {
    const val = parseFloat(amount) || 0;
    switch (cycle) {
      case 'daily':
        return { monthly: val * (365 / 12), annual: val * 365 };
      case 'weekly':
        return { monthly: val * 4.3333, annual: val * 52 };
      case 'quarterly':
        return { monthly: val / 3, annual: val * 4 };
      case 'biannual':
        return { monthly: val / 6, annual: val * 2 };
      case 'annual':
        return { monthly: val / 12, annual: val };
      case 'onetime':
        // Amortized over 1 year
        return { monthly: val / 12, annual: val };
      case 'monthly':
      default:
        return { monthly: val, annual: val * 12 };
    }
  }

  calculateTotals() {
    let totalEarningsMonthly = 0;
    let totalEarningsAnnual = 0;
    const earningsMap = {};

    // 1. Calculate Earnings Totals
    this.state.earnings.forEach(earn => {
      const norm = this.normalizeFrequency(earn.amount, earn.cycle);
      earningsMap[earn.id] = norm;
      totalEarningsMonthly += norm.monthly;
      totalEarningsAnnual += norm.annual;
    });

    let totalSpendingsMonthly = 0;
    let totalSpendingsAnnual = 0;
    const spendingsMap = {};

    // 2. Calculate Spendings Totals (handling fixed & dynamic percentage of income)
    this.state.spendings.forEach(spend => {
      let monthlyVal = 0;
      let annualVal = 0;

      if (spend.type === 'percentage') {
        const pct = (parseFloat(spend.percentage) || 0) / 100;
        // Percentage of total earnings
        monthlyVal = totalEarningsMonthly * pct;
        annualVal = totalEarningsAnnual * pct;
      } else {
        const norm = this.normalizeFrequency(spend.amount, spend.cycle);
        monthlyVal = norm.monthly;
        annualVal = norm.annual;
      }

      spendingsMap[spend.id] = { monthly: monthlyVal, annual: annualVal };
      totalSpendingsMonthly += monthlyVal;
      totalSpendingsAnnual += annualVal;
    });

    const netMonthly = totalEarningsMonthly - totalSpendingsMonthly;
    const netAnnual = totalEarningsAnnual - totalSpendingsAnnual;
    const savingsRate = totalEarningsMonthly > 0 ? (netMonthly / totalEarningsMonthly) * 100 : 0;

    return {
      totalEarningsMonthly,
      totalEarningsAnnual,
      totalSpendingsMonthly,
      totalSpendingsAnnual,
      netMonthly,
      netAnnual,
      savingsRate,
      earningsMap,
      spendingsMap
    };
  }

  saveAndRender() {
    Storage.save(this.state);
    this.render();
  }

  render() {
    const isAnnual = this.state.viewMode === 'annual';
    const currency = this.state.currency || '₹';
    const totals = this.calculateTotals();

    // 1. Update View Toggle Button
    if (this.viewModeToggle) {
      const labelEl = this.viewModeToggle.querySelector('.toggle-active-label');
      if (labelEl) labelEl.textContent = isAnnual ? 'Annual' : 'Monthly';
      this.viewModeToggle.setAttribute('aria-pressed', isAnnual ? 'true' : 'false');
    }

    // 2. Update Section Headers & Totals
    const currentEarnTotal = isAnnual ? totals.totalEarningsAnnual : totals.totalEarningsMonthly;
    const currentSpendTotal = isAnnual ? totals.totalSpendingsAnnual : totals.totalSpendingsMonthly;
    const currentNetTotal = isAnnual ? totals.netAnnual : totals.netMonthly;

    if (this.earningsTotalEl) {
      this.earningsTotalEl.textContent = formatMoney(currentEarnTotal, currency);
    }
    if (this.earningsCycleLabelEl) {
      this.earningsCycleLabelEl.textContent = isAnnual ? 'Total Annual Earning' : 'Total Monthly Earning';
    }

    if (this.spendingsTotalEl) {
      this.spendingsTotalEl.textContent = formatMoney(currentSpendTotal, currency);
    }
    if (this.spendingsCycleLabelEl) {
      this.spendingsCycleLabelEl.textContent = isAnnual ? 'Total Annual Spending' : 'Total Monthly Spending';
    }

    // 3. Update Net Settlement Node
    if (this.netBalanceEl) {
      this.netBalanceEl.textContent = formatMoney(currentNetTotal, currency);
      this.netBalanceEl.classList.toggle('negative', currentNetTotal < 0);
    }
    if (this.netStatusEl) {
      if (currentNetTotal > 0) {
        this.netStatusEl.textContent = 'Surplus (Savings)';
        this.netStatusEl.className = 'status-badge surplus';
      } else if (currentNetTotal === 0) {
        this.netStatusEl.textContent = 'Break-Even';
        this.netStatusEl.className = 'status-badge neutral';
      } else {
        this.netStatusEl.textContent = 'Deficit (Overspending)';
        this.netStatusEl.className = 'status-badge deficit';
      }
    }
    if (this.netSavingsPctEl) {
      const sign = totals.savingsRate > 0 ? '+' : '';
      this.netSavingsPctEl.textContent = `${sign}${totals.savingsRate.toFixed(1)}% savings rate`;
      this.netSavingsPctEl.classList.toggle('negative', totals.savingsRate < 0);
    }

    // 4. Render Earnings Blocks (Horizontal Scroll Row)
    this.renderEarningsBlocks(totals, isAnnual, currency);

    // 5. Render Spendings Blocks (Horizontal Scroll Row)
    this.renderSpendingsBlocks(totals, isAnnual, currency);

    // 6. Update Active Modal if open
    if (this.activeAnalyticsModal) {
      this.renderAnalyticsContent(this.activeAnalyticsModal, totals);
    }
  }

  renderEarningsBlocks(totals, isAnnual, currency) {
    if (!this.earningsListEl) return;
    this.earningsListEl.innerHTML = '';

    this.state.earnings.forEach((earn, index) => {
      const norm = totals.earningsMap[earn.id] || { monthly: 0, annual: 0 };
      const normalizedDisplay = isAnnual 
        ? `${formatMoney(norm.monthly, currency)}/mo` 
        : `${formatMoney(norm.annual, currency)}/yr`;

      const card = document.createElement('div');
      card.className = 'finance-card earning-card';
      card.dataset.id = earn.id;

      card.innerHTML = `
        <div class="card-header">
          <div class="card-badge">#${index + 1} Inflow</div>
          <div class="card-actions">
            <button type="button" class="btn-icon btn-card-action" data-action="duplicate-earn" title="Duplicate">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button type="button" class="btn-icon btn-card-action text-danger" data-action="delete-earn" title="Delete">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>

        <div class="card-body">
          <div class="form-group">
            <label class="field-label">Earning Name</label>
            <input type="text" class="card-input input-name" placeholder="e.g. Salary, Dividend" value="${this.escapeHTML(earn.name || '')}">
          </div>

          <div class="form-row">
            <div class="form-group flex-2">
              <label class="field-label">Amount (${currency})</label>
              <input type="number" step="any" min="0" class="card-input input-amount" placeholder="0" value="${earn.amount !== undefined ? earn.amount : ''}">
            </div>
            <div class="form-group flex-2">
              <label class="field-label">Cycle</label>
              <select class="card-select select-cycle">
                <option value="daily" ${earn.cycle === 'daily' ? 'selected' : ''}>Daily</option>
                <option value="weekly" ${earn.cycle === 'weekly' ? 'selected' : ''}>Weekly</option>
                <option value="monthly" ${earn.cycle === 'monthly' ? 'selected' : ''}>Monthly</option>
                <option value="quarterly" ${earn.cycle === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                <option value="biannual" ${earn.cycle === 'biannual' ? 'selected' : ''}>Bi-Annual</option>
                <option value="annual" ${earn.cycle === 'annual' ? 'selected' : ''}>Annual</option>
                <option value="onetime" ${earn.cycle === 'onetime' ? 'selected' : ''}>One-Time</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="field-label">Hashtags <span class="subtext">(space separated)</span></label>
            <input type="text" class="card-input input-tags" placeholder="#salary #active" value="${(earn.tags || []).join(' ')}">
          </div>

          <div class="card-tag-pills">
            ${(earn.tags || []).map(t => `<span class="tag-pill">${this.escapeHTML(t)}</span>`).join('')}
          </div>
        </div>

        <div class="card-footer">
          <span class="norm-label">Normalized:</span>
          <span class="norm-value">${normalizedDisplay}</span>
        </div>
      `;

      // Event listeners for immediate reactive update on inputs
      const nameInput = card.querySelector('.input-name');
      const amountInput = card.querySelector('.input-amount');
      const cycleSelect = card.querySelector('.select-cycle');
      const tagsInput = card.querySelector('.input-tags');

      nameInput.addEventListener('input', (e) => {
        earn.name = e.target.value;
        Storage.save(this.state);
      });

      amountInput.addEventListener('input', (e) => {
        earn.amount = parseFloat(e.target.value) || 0;
        this.saveAndRender();
      });

      cycleSelect.addEventListener('change', (e) => {
        earn.cycle = e.target.value;
        this.saveAndRender();
      });

      tagsInput.addEventListener('blur', (e) => {
        const raw = e.target.value.trim();
        earn.tags = raw ? raw.split(/\s+/).map(t => t.startsWith('#') ? t : `#${t}`) : [];
        this.saveAndRender();
      });

      // Actions
      card.querySelector('[data-action="duplicate-earn"]').addEventListener('click', () => {
        this.duplicateEarning(earn);
      });

      card.querySelector('[data-action="delete-earn"]').addEventListener('click', () => {
        this.deleteEarning(earn.id);
      });

      this.earningsListEl.appendChild(card);
    });

    // Add Block Card at the end of horizontal row
    const addCard = document.createElement('div');
    addCard.className = 'finance-card add-card-block';
    addCard.innerHTML = `
      <div class="add-card-content">
        <div class="add-icon-circle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <span class="add-card-title">+ Add Earning</span>
        <span class="add-card-sub">Income, Salary, Dividend</span>
      </div>
    `;
    addCard.addEventListener('click', () => this.addEarningBlock());
    this.earningsListEl.appendChild(addCard);
  }

  renderSpendingsBlocks(totals, isAnnual, currency) {
    if (!this.spendingsListEl) return;
    this.spendingsListEl.innerHTML = '';

    this.state.spendings.forEach((spend, index) => {
      const norm = totals.spendingsMap[spend.id] || { monthly: 0, annual: 0 };
      const normalizedDisplay = isAnnual 
        ? `${formatMoney(norm.monthly, currency)}/mo` 
        : `${formatMoney(norm.annual, currency)}/yr`;

      const isPercentage = spend.type === 'percentage';

      const card = document.createElement('div');
      card.className = 'finance-card spending-card';
      card.dataset.id = spend.id;

      card.innerHTML = `
        <div class="card-header">
          <div class="card-badge spend-badge">#${index + 1} Outflow</div>
          <div class="card-actions">
            <button type="button" class="btn-icon btn-card-action" data-action="duplicate-spend" title="Duplicate">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button type="button" class="btn-icon btn-card-action text-danger" data-action="delete-spend" title="Delete">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>

        <div class="card-body">
          <div class="form-group">
            <label class="field-label">Spending Name</label>
            <input type="text" class="card-input input-name" placeholder="e.g. Rent, SIP, Groceries" value="${this.escapeHTML(spend.name || '')}">
          </div>

          <!-- Type Switcher (Fixed Amount vs % of Income) -->
          <div class="type-toggle-row">
            <button type="button" class="type-toggle-btn ${!isPercentage ? 'active' : ''}" data-type="fixed">
              Amount (${currency})
            </button>
            <button type="button" class="type-toggle-btn ${isPercentage ? 'active' : ''}" data-type="percentage">
              % of Income
            </button>
          </div>

          <div class="form-row">
            <div class="form-group flex-2">
              <label class="field-label">${isPercentage ? 'Percentage (%)' : `Amount (${currency})`}</label>
              ${isPercentage 
                ? `<input type="number" step="0.5" min="0" max="100" class="card-input input-percentage" placeholder="20" value="${spend.percentage !== undefined ? spend.percentage : 10}">`
                : `<input type="number" step="any" min="0" class="card-input input-amount" placeholder="0" value="${spend.amount !== undefined ? spend.amount : ''}">`
              }
            </div>
            
            <div class="form-group flex-2 ${isPercentage ? 'hidden' : ''}">
              <label class="field-label">Cycle</label>
              <select class="card-select select-cycle">
                <option value="daily" ${spend.cycle === 'daily' ? 'selected' : ''}>Daily</option>
                <option value="weekly" ${spend.cycle === 'weekly' ? 'selected' : ''}>Weekly</option>
                <option value="monthly" ${spend.cycle === 'monthly' ? 'selected' : ''}>Monthly</option>
                <option value="quarterly" ${spend.cycle === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                <option value="biannual" ${spend.cycle === 'biannual' ? 'selected' : ''}>Bi-Annual</option>
                <option value="annual" ${spend.cycle === 'annual' ? 'selected' : ''}>Annual</option>
                <option value="onetime" ${spend.cycle === 'onetime' ? 'selected' : ''}>One-Time</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="field-label">Hashtags <span class="subtext">(space separated)</span></label>
            <input type="text" class="card-input input-tags" placeholder="#rent #essentials" value="${(spend.tags || []).join(' ')}">
          </div>

          <div class="card-tag-pills">
            ${(spend.tags || []).map(t => `<span class="tag-pill spend-tag-pill">${this.escapeHTML(t)}</span>`).join('')}
          </div>
        </div>

        <div class="card-footer">
          <span class="norm-label">${isPercentage ? `Calculated (${spend.percentage || 0}%):` : 'Normalized:'}</span>
          <span class="norm-value spend-val">${formatMoney(isAnnual ? norm.annual : norm.monthly, currency)} <small class="text-sub">(${normalizedDisplay})</small></span>
        </div>
      `;

      // Event listeners
      const nameInput = card.querySelector('.input-name');
      const amountInput = card.querySelector('.input-amount');
      const percentageInput = card.querySelector('.input-percentage');
      const cycleSelect = card.querySelector('.select-cycle');
      const tagsInput = card.querySelector('.input-tags');

      nameInput.addEventListener('input', (e) => {
        spend.name = e.target.value;
        Storage.save(this.state);
      });

      if (amountInput) {
        amountInput.addEventListener('input', (e) => {
          spend.amount = parseFloat(e.target.value) || 0;
          this.saveAndRender();
        });
      }

      if (percentageInput) {
        percentageInput.addEventListener('input', (e) => {
          spend.percentage = parseFloat(e.target.value) || 0;
          this.saveAndRender();
        });
      }

      if (cycleSelect) {
        cycleSelect.addEventListener('change', (e) => {
          spend.cycle = e.target.value;
          this.saveAndRender();
        });
      }

      tagsInput.addEventListener('blur', (e) => {
        const raw = e.target.value.trim();
        spend.tags = raw ? raw.split(/\s+/).map(t => t.startsWith('#') ? t : `#${t}`) : [];
        this.saveAndRender();
      });

      // Toggle Type
      card.querySelectorAll('.type-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const type = e.target.dataset.type;
          if (spend.type !== type) {
            spend.type = type;
            if (type === 'percentage' && !spend.percentage) {
              spend.percentage = 10;
            }
            this.saveAndRender();
          }
        });
      });

      // Actions
      card.querySelector('[data-action="duplicate-spend"]').addEventListener('click', () => {
        this.duplicateSpending(spend);
      });

      card.querySelector('[data-action="delete-spend"]').addEventListener('click', () => {
        this.deleteSpending(spend.id);
      });

      this.spendingsListEl.appendChild(card);
    });

    // Add Spend Block Card at the end of horizontal row
    const addCard = document.createElement('div');
    addCard.className = 'finance-card add-card-block spend-add-block';
    addCard.innerHTML = `
      <div class="add-card-content">
        <div class="add-icon-circle spend-add-circle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <span class="add-card-title">+ Add Spending</span>
        <span class="add-card-sub">Fixed amount or % of income</span>
      </div>
    `;
    addCard.addEventListener('click', () => this.addSpendingBlock());
    this.spendingsListEl.appendChild(addCard);
  }

  // Model Operations
  addEarningBlock() {
    const newEarn = {
      id: 'earn_' + Date.now(),
      name: '',
      amount: 0,
      cycle: 'monthly',
      tags: ['#income']
    };
    this.state.earnings.push(newEarn);
    this.saveAndRender();
    
    // Scroll new block into view
    setTimeout(() => {
      const el = this.earningsListEl.querySelector(`[data-id="${newEarn.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
        el.querySelector('.input-name')?.focus();
      }
    }, 100);
  }

  duplicateEarning(earn) {
    const copy = {
      ...JSON.parse(JSON.stringify(earn)),
      id: 'earn_' + Date.now(),
      name: `${earn.name || 'Earning'} (Copy)`
    };
    this.state.earnings.push(copy);
    this.saveAndRender();
    this.showToast('Earning block duplicated');
  }

  deleteEarning(id) {
    this.state.earnings = this.state.earnings.filter(e => e.id !== id);
    this.saveAndRender();
    this.showToast('Earning block removed');
  }

  addSpendingBlock() {
    const newSpend = {
      id: 'spend_' + Date.now(),
      name: '',
      type: 'fixed',
      amount: 0,
      percentage: 10,
      cycle: 'monthly',
      tags: ['#spend']
    };
    this.state.spendings.push(newSpend);
    this.saveAndRender();

    setTimeout(() => {
      const el = this.spendingsListEl.querySelector(`[data-id="${newSpend.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
        el.querySelector('.input-name')?.focus();
      }
    }, 100);
  }

  duplicateSpending(spend) {
    const copy = {
      ...JSON.parse(JSON.stringify(spend)),
      id: 'spend_' + Date.now(),
      name: `${spend.name || 'Spending'} (Copy)`
    };
    this.state.spendings.push(copy);
    this.saveAndRender();
    this.showToast('Spending block duplicated');
  }

  deleteSpending(id) {
    this.state.spendings = this.state.spendings.filter(s => s.id !== id);
    this.saveAndRender();
    this.showToast('Spending block removed');
  }

  // Analytics Modals
  openAnalyticsModal(type) {
    this.activeAnalyticsModal = type;
    const totals = this.calculateTotals();
    this.renderAnalyticsContent(type, totals);
    
    if (this.analyticsModal && this.modalOverlay) {
      this.analyticsModal.classList.add('open');
      this.modalOverlay.classList.add('open');
    }
  }

  closeModal() {
    this.activeAnalyticsModal = null;
    if (this.analyticsModal && this.modalOverlay) {
      this.analyticsModal.classList.remove('open');
      this.modalOverlay.classList.remove('open');
    }
  }

  renderAnalyticsContent(type, totals) {
    const titleEl = document.getElementById('modal-title');
    const subtitleEl = document.getElementById('modal-subtitle');
    const bodyEl = document.getElementById('modal-content-body');
    const isAnnual = this.state.viewMode === 'annual';
    const currency = this.state.currency || '₹';
    const timeframeLabel = isAnnual ? 'Annual' : 'Monthly';

    if (!bodyEl) return;

    if (type === 'earnings') {
      titleEl.textContent = 'Earnings Analytics';
      subtitleEl.textContent = `Breakdown by tags (${timeframeLabel})`;

      const tagData = this.groupItemsByTags(this.state.earnings, totals.earningsMap, isAnnual);
      const totalVal = isAnnual ? totals.totalEarningsAnnual : totals.totalEarningsMonthly;

      bodyEl.innerHTML = `
        <div id="modal-chart-donut"></div>
        <div class="analytics-sub-section">
          <h4 class="section-subheading">Tag Comparison</h4>
          <div id="modal-chart-bar"></div>
        </div>
      `;

      renderDonutChart('modal-chart-donut', tagData, totalVal, currency);
      renderBarChart('modal-chart-bar', tagData, currency);

    } else if (type === 'spendings') {
      titleEl.textContent = 'Spendings Analytics';
      subtitleEl.textContent = `Breakdown by tags (${timeframeLabel})`;

      const tagData = this.groupItemsByTags(this.state.spendings, totals.spendingsMap, isAnnual);
      const totalVal = isAnnual ? totals.totalSpendingsAnnual : totals.totalSpendingsMonthly;

      bodyEl.innerHTML = `
        <div id="modal-chart-donut"></div>
        <div class="analytics-sub-section">
          <h4 class="section-subheading">Tag Comparison</h4>
          <div id="modal-chart-bar"></div>
        </div>
      `;

      renderDonutChart('modal-chart-donut', tagData, totalVal, currency);
      renderBarChart('modal-chart-bar', tagData, currency);

    } else if (type === 'global') {
      titleEl.textContent = 'FinFunnel Master Analytics';
      subtitleEl.textContent = `Full Cashflow & Planning Breakdown (${timeframeLabel})`;

      const earnTotal = isAnnual ? totals.totalEarningsAnnual : totals.totalEarningsMonthly;
      const spendTotal = isAnnual ? totals.totalSpendingsAnnual : totals.totalSpendingsMonthly;
      const netTotal = isAnnual ? totals.netAnnual : totals.netMonthly;

      const compareData = [
        { label: 'Total Inflow (Earnings)', value: earnTotal, color: '#38bdf8' },
        { label: 'Total Outflow (Spends)', value: spendTotal, color: '#f43f5e' },
        { label: 'Net Retained (Savings)', value: Math.max(0, netTotal), color: '#34d399' }
      ];

      const spendTagData = this.groupItemsByTags(this.state.spendings, totals.spendingsMap, isAnnual);
      const earnTagData = this.groupItemsByTags(this.state.earnings, totals.earningsMap, isAnnual);

      bodyEl.innerHTML = `
        <!-- High Level Summary Cards -->
        <div class="analytics-summary-grid">
          <div class="summary-metric-card earn-accent">
            <span class="metric-title">Total Inflow</span>
            <span class="metric-val text-cyan">${formatMoney(earnTotal, currency)}</span>
            <span class="metric-sub">${isAnnual ? 'Per Year' : 'Per Month'}</span>
          </div>

          <div class="summary-metric-card spend-accent">
            <span class="metric-title">Total Outflow</span>
            <span class="metric-val text-rose">${formatMoney(spendTotal, currency)}</span>
            <span class="metric-sub">${earnTotal > 0 ? ((spendTotal/earnTotal)*100).toFixed(1) : 0}% of Inflow</span>
          </div>

          <div class="summary-metric-card ${netTotal >= 0 ? 'surplus-accent' : 'deficit-accent'}">
            <span class="metric-title">Net Cashflow</span>
            <span class="metric-val ${netTotal >= 0 ? 'text-emerald' : 'text-danger'}">${formatMoney(netTotal, currency)}</span>
            <span class="metric-sub">${totals.savingsRate.toFixed(1)}% Savings Rate</span>
          </div>
        </div>

        <!-- Cashflow Comparison Bar Chart -->
        <div class="analytics-sub-section">
          <h4 class="section-subheading">Cash Flow Distribution</h4>
          <div id="global-compare-bar"></div>
        </div>

        <!-- Spending Tags Donut -->
        <div class="analytics-sub-section">
          <h4 class="section-subheading">Where Money Goes (Top Spending Tags)</h4>
          <div id="global-spend-donut"></div>
        </div>

        <!-- Income Sources Donut -->
        <div class="analytics-sub-section">
          <h4 class="section-subheading">Income Source Breakdown</h4>
          <div id="global-earn-donut"></div>
        </div>
      `;

      renderBarChart('global-compare-bar', compareData, currency);
      renderDonutChart('global-spend-donut', spendTagData, spendTotal, currency);
      renderDonutChart('global-earn-donut', earnTagData, earnTotal, currency);
    }
  }

  groupItemsByTags(items, normMap, isAnnual) {
    const tagMap = {};

    items.forEach(item => {
      const norm = normMap[item.id] || { monthly: 0, annual: 0 };
      const val = isAnnual ? norm.annual : norm.monthly;
      if (val <= 0) return;

      const tags = (item.tags && item.tags.length > 0) ? item.tags : ['#general'];
      
      // Distribute amount among tags evenly
      const splitVal = val / tags.length;

      tags.forEach(rawTag => {
        const tag = rawTag.startsWith('#') ? rawTag : `#${rawTag}`;
        if (!tagMap[tag]) tagMap[tag] = 0;
        tagMap[tag] += splitVal;
      });
    });

    const result = Object.keys(tagMap).map(tag => ({
      label: tag,
      value: tagMap[tag]
    }));

    // Sort descending by value
    return result.sort((a, b) => b.value - a.value);
  }

  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new FinFunnelApp();
});
