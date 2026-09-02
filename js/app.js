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
    this.activeEditItem = null; // { type: 'earning'|'spending', isNew: boolean, data: item }
    
    this.initPWA();
    this.initDOM();
    this.initEvents();
    this.render();
  }

  initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('FinFunnel SW registered:', reg.scope))
          .catch(err => console.log('FinFunnel SW failed:', err));
      });
    }

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
    // Containers
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

    // View Mode Toggles (Carousel vs Vertical List)
    this.btnEarningsViewToggle = document.getElementById('btn-earnings-view-toggle');
    this.btnSpendingsViewToggle = document.getElementById('btn-spendings-view-toggle');

    // Theme Switcher Elements
    this.btnThemeToggle = document.getElementById('btn-theme-toggle');
    this.themeIconSun = this.btnThemeToggle?.querySelector('.theme-icon-sun');
    this.themeIconMoon = this.btnThemeToggle?.querySelector('.theme-icon-moon');

    // Period Selector
    this.btnPeriodDropdown = document.getElementById('btn-period-dropdown');
    this.periodDropdownMenu = document.getElementById('period-dropdown-menu');
    this.headerPeriodBadge = document.getElementById('header-period-badge');

    // Controls
    this.currencySelect = document.getElementById('currency-select');
    
    // Drawers & Modals
    this.menuDrawer = document.getElementById('menu-drawer');
    this.menuOverlay = document.getElementById('drawer-overlay');
    this.analyticsModal = document.getElementById('analytics-modal');
    this.modalOverlay = document.getElementById('modal-overlay');
    
    // Edit Modal Elements
    this.editModal = document.getElementById('edit-block-modal');
    this.editModalOverlay = document.getElementById('edit-modal-overlay');
    this.editModalTitle = document.getElementById('edit-modal-title');
    this.editModalSubtitle = document.getElementById('edit-modal-subtitle');
    this.modalInputName = document.getElementById('modal-input-name');
    this.modalSpendTypeRow = document.getElementById('modal-spend-type-row');
    this.modalTypeFixed = document.getElementById('modal-type-fixed');
    this.modalTypePercentage = document.getElementById('modal-type-percentage');
    this.modalAmountContainer = document.getElementById('modal-amount-container');
    this.modalPercentageContainer = document.getElementById('modal-percentage-container');
    this.modalCycleContainer = document.getElementById('modal-cycle-container');
    this.modalInputAmount = document.getElementById('modal-input-amount');
    this.modalInputPercentage = document.getElementById('modal-input-percentage');
    this.modalSelectCycle = document.getElementById('modal-select-cycle');
    this.modalInputTags = document.getElementById('modal-input-tags');
    this.modalPreviewImpact = document.getElementById('modal-preview-impact');
    this.btnModalDelete = document.getElementById('btn-modal-delete');
    this.btnModalDuplicate = document.getElementById('btn-modal-duplicate');
    this.btnModalSave = document.getElementById('btn-modal-save');
    this.btnCloseEditModal = document.getElementById('btn-close-edit-modal');
    
    this.fileImportInput = document.getElementById('file-import-input');
    
    // Currency labels in modal
    this.currencySymbolLabels = document.querySelectorAll('.currency-symbol-label');
    
    if (this.currencySelect) {
      this.currencySelect.value = this.state.currency || '₹';
    }

    // Apply saved theme
    this.applyTheme(this.state.theme || 'dark');
  }

  applyTheme(theme) {
    this.state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';
    if (this.themeIconSun) this.themeIconSun.classList.toggle('hidden', !isDark);
    if (this.themeIconMoon) this.themeIconMoon.classList.toggle('hidden', isDark);
  }

  initEvents() {
    // Theme Switcher Button
    if (this.btnThemeToggle) {
      this.btnThemeToggle.addEventListener('click', () => {
        const nextTheme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(nextTheme);
        this.saveAndRender();
        this.showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Theme`);
      });
    }

    // Section View Toggles (Carousel vs Vertical List)
    if (this.btnEarningsViewToggle) {
      this.btnEarningsViewToggle.addEventListener('click', () => {
        this.state.earningsView = (this.state.earningsView === 'list') ? 'carousel' : 'list';
        this.saveAndRender();
      });
    }

    if (this.btnSpendingsViewToggle) {
      this.btnSpendingsViewToggle.addEventListener('click', () => {
        this.state.spendingsView = (this.state.spendingsView === 'list') ? 'carousel' : 'list';
        this.saveAndRender();
      });
    }
    // Period Dropdown Toggle
    if (this.btnPeriodDropdown && this.periodDropdownMenu) {
      this.btnPeriodDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.periodDropdownMenu.classList.toggle('open');
      });

      document.querySelectorAll('.period-option-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const mode = btn.dataset.period;
          this.state.viewMode = mode;
          this.periodDropdownMenu.classList.remove('open');
          this.saveAndRender();
        });
      });

      // Close dropdown on click outside
      document.addEventListener('click', (e) => {
        if (!this.periodDropdownMenu.contains(e.target) && e.target !== this.btnPeriodDropdown) {
          this.periodDropdownMenu.classList.remove('open');
        }
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

    // Close Analytics Modal
    const closeModalBtn = document.getElementById('btn-close-modal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => this.closeAnalyticsModal());
    if (this.modalOverlay) this.modalOverlay.addEventListener('click', () => this.closeAnalyticsModal());

    // Edit Modal Events
    if (this.btnCloseEditModal) {
      this.btnCloseEditModal.addEventListener('click', () => this.closeEditModal());
    }
    if (this.editModalOverlay) {
      this.editModalOverlay.addEventListener('click', () => this.closeEditModal());
    }

    // Edit Modal Spend Type Toggle (Fixed vs %)
    if (this.modalTypeFixed && this.modalTypePercentage) {
      this.modalTypeFixed.addEventListener('click', () => {
        if (this.activeEditItem) {
          this.activeEditItem.data.type = 'fixed';
          this.updateEditModalUI();
        }
      });
      this.modalTypePercentage.addEventListener('click', () => {
        if (this.activeEditItem) {
          this.activeEditItem.data.type = 'percentage';
          if (!this.activeEditItem.data.percentage) this.activeEditItem.data.percentage = 10;
          this.updateEditModalUI();
        }
      });
    }

    // Live Impact Preview in Edit Modal on form input
    const formFields = [this.modalInputAmount, this.modalInputPercentage, this.modalSelectCycle];
    formFields.forEach(f => {
      f?.addEventListener('input', () => this.updateModalLivePreview());
      f?.addEventListener('change', () => this.updateModalLivePreview());
    });

    // Save Block
    if (this.btnModalSave) {
      this.btnModalSave.addEventListener('click', () => this.saveEditModal());
    }

    // Duplicate Block from Modal
    if (this.btnModalDuplicate) {
      this.btnModalDuplicate.addEventListener('click', () => {
        if (!this.activeEditItem) return;
        this.duplicateItemFromModal();
      });
    }

    // Delete Block from Modal with smooth inline confirmation
    if (this.btnModalDelete) {
      this.btnModalDelete.addEventListener('click', () => {
        if (!this.activeEditItem) return;
        this.handleModalDelete();
      });
    }

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
        this.closeAnalyticsModal();
        this.closeEditModal();
        this.periodDropdownMenu?.classList.remove('open');
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

  // Normalization logic
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

    this.state.earnings.forEach(earn => {
      const norm = this.normalizeFrequency(earn.amount, earn.cycle);
      earningsMap[earn.id] = norm;
      totalEarningsMonthly += norm.monthly;
      totalEarningsAnnual += norm.annual;
    });

    let totalSpendingsMonthly = 0;
    let totalSpendingsAnnual = 0;
    const spendingsMap = {};

    this.state.spendings.forEach(spend => {
      let monthlyVal = 0;
      let annualVal = 0;

      if (spend.type === 'percentage') {
        const pct = (parseFloat(spend.percentage) || 0) / 100;
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

    // 1. Update Header Period Selector Badge & Options
    if (this.headerPeriodBadge) {
      this.headerPeriodBadge.textContent = isAnnual ? 'A' : 'M';
    }
    document.querySelectorAll('.period-option-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === this.state.viewMode);
    });

    // 2. Update Currency Labels in Modals
    this.currencySymbolLabels.forEach(lbl => {
      lbl.textContent = currency;
    });

    // 3. Update Section Headers & Totals
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

    // 4. Update Net Settlement Node
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

    // 5. Render Summary Block Cards (Earnings)
    this.renderEarningsCards(totals, isAnnual, currency);

    // 6. Render Summary Block Cards (Spendings)
    this.renderSpendingsCards(totals, isAnnual, currency);

    // 7. Update Active Analytics Modal if open
    if (this.activeAnalyticsModal) {
      this.renderAnalyticsContent(this.activeAnalyticsModal, totals);
    }
  }

  renderEarningsCards(totals, isAnnual, currency) {
    if (!this.earningsListEl) return;
    this.earningsListEl.innerHTML = '';

    const isList = this.state.earningsView === 'list';
    this.earningsListEl.className = isList ? 'cards-vertical-scroll' : 'cards-horizontal-scroll';

    // Update View Toggle Icon
    if (this.btnEarningsViewToggle) {
      this.btnEarningsViewToggle.querySelector('.view-icon-cards')?.classList.toggle('hidden', isList);
      this.btnEarningsViewToggle.querySelector('.view-icon-list')?.classList.toggle('hidden', !isList);
      this.btnEarningsViewToggle.title = isList ? 'Switch to Cards View' : 'Switch to Vertical List View';
    }

    if (isList) {
      // Render Vertical List Rows
      this.state.earnings.forEach((earn, index) => {
        const norm = totals.earningsMap[earn.id] || { monthly: 0, annual: 0 };
        const mainAmount = isAnnual ? norm.annual : norm.monthly;
        const subAmount = isAnnual ? `${formatMoney(norm.monthly, currency)}/mo` : `${formatMoney(norm.annual, currency)}/yr`;

        const row = document.createElement('div');
        row.className = 'finance-list-row earning-list-row';
        row.dataset.id = earn.id;

        row.innerHTML = `
          <div class="list-row-left">
            <div class="list-row-edit-icon" title="Edit Earning">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </div>
            <div class="list-row-info">
              <span class="list-row-title">${this.escapeHTML(earn.name || 'Untitled Earning')}</span>
              <span class="list-row-tags">${(earn.tags && earn.tags.length > 0) ? earn.tags.map(t => this.escapeHTML(t)).join(' ') : `#inflow`} • ${earn.cycle || 'monthly'}</span>
            </div>
          </div>
          <div class="list-row-right">
            <span class="list-row-amount">${formatMoney(mainAmount, currency)}</span>
            <span class="list-row-sub">${subAmount}</span>
          </div>
        `;

        row.addEventListener('click', () => {
          this.openEditModal('earning', earn);
        });

        this.earningsListEl.appendChild(row);
      });

      // Add Earning Row in List Mode
      const addRow = document.createElement('div');
      addRow.className = 'finance-list-row add-list-row';
      addRow.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        <span class="add-list-label">+ Add Earning</span>
      `;
      addRow.addEventListener('click', () => this.openNewItemModal('earning'));
      this.earningsListEl.appendChild(addRow);

    } else {
      // Render Horizontal Cards
      this.state.earnings.forEach((earn, index) => {
        const norm = totals.earningsMap[earn.id] || { monthly: 0, annual: 0 };
        const mainAmount = isAnnual ? norm.annual : norm.monthly;
        const subAmount = isAnnual ? `${formatMoney(norm.monthly, currency)}/mo` : `${formatMoney(norm.annual, currency)}/yr`;

        const card = document.createElement('div');
        card.className = 'finance-card earning-card';
        card.dataset.id = earn.id;

        card.innerHTML = `
          <div class="card-top-row">
            <span class="card-badge">#${index + 1} Inflow</span>
            <span class="card-cycle-pill">${earn.cycle || 'monthly'}</span>
            <button type="button" class="btn-icon btn-card-edit" title="Edit Earning" aria-label="Edit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
          </div>

          <div class="card-title-text" title="${this.escapeHTML(earn.name || 'Untitled')}">
            ${this.escapeHTML(earn.name || 'Untitled Earning')}
          </div>

          <div class="card-main-amount">
            ${formatMoney(mainAmount, currency)}
          </div>

          <div class="card-bottom-row">
            <div class="card-tag-pills">
              ${(earn.tags || []).map(t => `<span class="tag-pill">${this.escapeHTML(t)}</span>`).join('')}
            </div>
            <span class="card-norm-sub">${subAmount}</span>
          </div>
        `;

        card.addEventListener('click', () => {
          this.openEditModal('earning', earn);
        });

        this.earningsListEl.appendChild(card);
      });

      // Add Earning Block Card
      const addCard = document.createElement('div');
      addCard.className = 'finance-card add-card-block';
      addCard.innerHTML = `
        <div class="add-card-content">
          <div class="add-icon-circle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </div>
          <span class="add-card-title">+ Add Earning</span>
          <span class="add-card-sub">Salary, Dividend</span>
        </div>
      `;
      addCard.addEventListener('click', () => this.openNewItemModal('earning'));
      this.earningsListEl.appendChild(addCard);
    }
  }

  renderSpendingsCards(totals, isAnnual, currency) {
    if (!this.spendingsListEl) return;
    this.spendingsListEl.innerHTML = '';

    const isList = this.state.spendingsView === 'list';
    this.spendingsListEl.className = isList ? 'cards-vertical-scroll' : 'cards-horizontal-scroll';

    // Update View Toggle Icon
    if (this.btnSpendingsViewToggle) {
      this.btnSpendingsViewToggle.querySelector('.view-icon-cards')?.classList.toggle('hidden', isList);
      this.btnSpendingsViewToggle.querySelector('.view-icon-list')?.classList.toggle('hidden', !isList);
      this.btnSpendingsViewToggle.title = isList ? 'Switch to Cards View' : 'Switch to Vertical List View';
    }

    if (isList) {
      // Render Vertical List Rows
      this.state.spendings.forEach((spend, index) => {
        const norm = totals.spendingsMap[spend.id] || { monthly: 0, annual: 0 };
        const mainAmount = isAnnual ? norm.annual : norm.monthly;
        const subAmount = isAnnual ? `${formatMoney(norm.monthly, currency)}/mo` : `${formatMoney(norm.annual, currency)}/yr`;
        const isPercentage = spend.type === 'percentage';
        const cycleBadgeText = isPercentage ? `${spend.percentage || 0}% of Income` : (spend.cycle || 'monthly');

        const row = document.createElement('div');
        row.className = 'finance-list-row spending-list-row';
        row.dataset.id = spend.id;

        row.innerHTML = `
          <div class="list-row-left">
            <div class="list-row-edit-icon" title="Edit Spending">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </div>
            <div class="list-row-info">
              <span class="list-row-title">${this.escapeHTML(spend.name || 'Untitled Spending')}</span>
              <span class="list-row-tags">${(spend.tags && spend.tags.length > 0) ? spend.tags.map(t => this.escapeHTML(t)).join(' ') : `#outflow`} • ${cycleBadgeText}</span>
            </div>
          </div>
          <div class="list-row-right">
            <span class="list-row-amount">${formatMoney(mainAmount, currency)}</span>
            <span class="list-row-sub">${subAmount}</span>
          </div>
        `;

        row.addEventListener('click', () => {
          this.openEditModal('spending', spend);
        });

        this.spendingsListEl.appendChild(row);
      });

      // Add Spending Row in List Mode
      const addRow = document.createElement('div');
      addRow.className = 'finance-list-row add-list-row spend-add-list-row';
      addRow.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        <span class="add-list-label">+ Add Spending</span>
      `;
      addRow.addEventListener('click', () => this.openNewItemModal('spending'));
      this.spendingsListEl.appendChild(addRow);

    } else {
      // Render Horizontal Cards
      this.state.spendings.forEach((spend, index) => {
        const norm = totals.spendingsMap[spend.id] || { monthly: 0, annual: 0 };
        const mainAmount = isAnnual ? norm.annual : norm.monthly;
        const subAmount = isAnnual ? `${formatMoney(norm.monthly, currency)}/mo` : `${formatMoney(norm.annual, currency)}/yr`;

        const isPercentage = spend.type === 'percentage';
        const cycleBadgeText = isPercentage ? `${spend.percentage || 0}% of Income` : (spend.cycle || 'monthly');

        const card = document.createElement('div');
        card.className = 'finance-card spending-card';
        card.dataset.id = spend.id;

        card.innerHTML = `
          <div class="card-top-row">
            <span class="card-badge spend-badge">#${index + 1} Outflow</span>
            <span class="card-cycle-pill ${isPercentage ? 'pct-pill' : ''}">${cycleBadgeText}</span>
            <button type="button" class="btn-icon btn-card-edit" title="Edit Spending" aria-label="Edit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
          </div>

          <div class="card-title-text" title="${this.escapeHTML(spend.name || 'Untitled')}">
            ${this.escapeHTML(spend.name || 'Untitled Spending')}
          </div>

          <div class="card-main-amount">
            ${formatMoney(mainAmount, currency)}
          </div>

          <div class="card-bottom-row">
            <div class="card-tag-pills">
              ${(spend.tags || []).map(t => `<span class="tag-pill spend-tag-pill">${this.escapeHTML(t)}</span>`).join('')}
            </div>
            <span class="card-norm-sub">${subAmount}</span>
          </div>
        `;

        card.addEventListener('click', () => {
          this.openEditModal('spending', spend);
        });

        this.spendingsListEl.appendChild(card);
      });

      // Add Spending Block Card
      const addCard = document.createElement('div');
      addCard.className = 'finance-card add-card-block spend-add-block';
      addCard.innerHTML = `
        <div class="add-card-content">
          <div class="add-icon-circle spend-add-circle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </div>
          <span class="add-card-title">+ Add Spending</span>
          <span class="add-card-sub">Fixed or % of income</span>
        </div>
      `;
      addCard.addEventListener('click', () => this.openNewItemModal('spending'));
      this.spendingsListEl.appendChild(addCard);
    }
  }

  // Edit / Add Modal Management
  openNewItemModal(type) {
    const isEarning = type === 'earning';
    const newItem = isEarning ? {
      id: 'earn_' + Date.now(),
      name: '',
      amount: 0,
      cycle: 'monthly',
      tags: ['#income']
    } : {
      id: 'spend_' + Date.now(),
      name: '',
      type: 'fixed',
      amount: 0,
      percentage: 10,
      cycle: 'monthly',
      tags: ['#spend']
    };

    this.openEditModal(type, newItem, true);
  }

  openEditModal(type, item, isNew = false) {
    this.activeEditItem = {
      type,
      isNew,
      deleteConfirming: false,
      data: JSON.parse(JSON.stringify(item))
    };

    const isEarning = type === 'earning';
    this.editModalTitle.textContent = isNew 
      ? (isEarning ? 'Add New Earning' : 'Add New Spending')
      : (isEarning ? 'Edit Earning' : 'Edit Spending');
    
    this.editModalSubtitle.textContent = isEarning 
      ? 'Define income source parameters' 
      : 'Define spending or allocation parameters';

    // Reset delete button label
    this.resetDeleteButton();

    // Populate Fields
    this.modalInputName.value = this.activeEditItem.data.name || '';
    this.modalInputAmount.value = this.activeEditItem.data.amount !== undefined ? this.activeEditItem.data.amount : 0;
    this.modalInputPercentage.value = this.activeEditItem.data.percentage !== undefined ? this.activeEditItem.data.percentage : 10;
    this.modalSelectCycle.value = this.activeEditItem.data.cycle || 'monthly';
    this.modalInputTags.value = (this.activeEditItem.data.tags || []).join(' ');

    // Hide/show delete & duplicate for newly created items
    if (this.btnModalDelete) this.btnModalDelete.style.display = isNew ? 'none' : 'inline-flex';
    if (this.btnModalDuplicate) this.btnModalDuplicate.style.display = isNew ? 'none' : 'inline-flex';

    this.updateEditModalUI();

    if (this.editModal && this.editModalOverlay) {
      this.editModal.classList.add('open');
      this.editModalOverlay.classList.add('open');
      setTimeout(() => this.modalInputName.focus(), 150);
    }
  }

  resetDeleteButton() {
    if (this.btnModalDelete) {
      this.btnModalDelete.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        <span>Delete</span>
      `;
      this.btnModalDelete.classList.remove('btn-confirm-delete');
    }
  }

  handleModalDelete() {
    if (!this.activeEditItem) return;

    if (!this.activeEditItem.deleteConfirming) {
      // First click: Ask for confirmation on button
      this.activeEditItem.deleteConfirming = true;
      this.btnModalDelete.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>Confirm?</span>
      `;
      this.btnModalDelete.classList.add('btn-confirm-delete');
      return;
    }

    // Second click: perform deletion
    const { type, data } = this.activeEditItem;

    if (type === 'earning') {
      this.state.earnings = this.state.earnings.filter(e => e.id !== data.id);
    } else {
      this.state.spendings = this.state.spendings.filter(s => s.id !== data.id);
    }

    this.closeEditModal();
    this.saveAndRender();
    this.showToast('Block deleted');
  }

  updateEditModalUI() {
    if (!this.activeEditItem) return;
    const isEarning = this.activeEditItem.type === 'earning';
    const isPercentage = !isEarning && this.activeEditItem.data.type === 'percentage';

    if (isEarning) {
      this.modalSpendTypeRow.classList.add('hidden');
      this.modalAmountContainer.classList.remove('hidden');
      this.modalPercentageContainer.classList.add('hidden');
      this.modalCycleContainer.classList.remove('hidden');
    } else {
      this.modalSpendTypeRow.classList.remove('hidden');
      this.modalTypeFixed.classList.toggle('active', !isPercentage);
      this.modalTypePercentage.classList.toggle('active', isPercentage);

      if (isPercentage) {
        this.modalAmountContainer.classList.add('hidden');
        this.modalPercentageContainer.classList.remove('hidden');
        this.modalCycleContainer.classList.add('hidden');
      } else {
        this.modalAmountContainer.classList.remove('hidden');
        this.modalPercentageContainer.classList.add('hidden');
        this.modalCycleContainer.classList.remove('hidden');
      }
    }

    this.updateModalLivePreview();
  }

  updateModalLivePreview() {
    if (!this.activeEditItem) return;
    const currency = this.state.currency || '₹';
    const isEarning = this.activeEditItem.type === 'earning';
    const isPercentage = !isEarning && this.activeEditItem.data.type === 'percentage';
    const totals = this.calculateTotals();

    let monthly = 0;
    let annual = 0;

    if (isPercentage) {
      const pct = (parseFloat(this.modalInputPercentage.value) || 0) / 100;
      monthly = totals.totalEarningsMonthly * pct;
      annual = totals.totalEarningsAnnual * pct;
    } else {
      const amt = parseFloat(this.modalInputAmount.value) || 0;
      const cycle = this.modalSelectCycle.value || 'monthly';
      const norm = this.normalizeFrequency(amt, cycle);
      monthly = norm.monthly;
      annual = norm.annual;
    }

    this.modalPreviewImpact.textContent = `${formatMoney(monthly, currency)} /mo • ${formatMoney(annual, currency)} /yr`;
  }

  saveEditModal() {
    if (!this.activeEditItem) return;

    const { type, isNew, data } = this.activeEditItem;
    data.name = this.modalInputName.value.trim() || (type === 'earning' ? 'Income' : 'Spend');
    data.amount = parseFloat(this.modalInputAmount.value) || 0;
    data.cycle = this.modalSelectCycle.value || 'monthly';
    
    if (type === 'spending') {
      if (data.type === 'percentage') {
        data.percentage = parseFloat(this.modalInputPercentage.value) || 0;
      }
    }

    const tagRaw = this.modalInputTags.value.trim();
    data.tags = tagRaw ? tagRaw.split(/\s+/).map(t => t.startsWith('#') ? t : `#${t}`) : [];

    if (type === 'earning') {
      if (isNew) {
        this.state.earnings.push(data);
      } else {
        const idx = this.state.earnings.findIndex(e => e.id === data.id);
        if (idx !== -1) this.state.earnings[idx] = data;
      }
    } else {
      if (isNew) {
        this.state.spendings.push(data);
      } else {
        const idx = this.state.spendings.findIndex(s => s.id === data.id);
        if (idx !== -1) this.state.spendings[idx] = data;
      }
    }

    this.closeEditModal();
    this.saveAndRender();
    this.showToast(isNew ? 'New block added' : 'Changes saved');
  }

  duplicateItemFromModal() {
    if (!this.activeEditItem) return;
    const { type, data } = this.activeEditItem;
    const copy = {
      ...JSON.parse(JSON.stringify(data)),
      id: (type === 'earning' ? 'earn_' : 'spend_') + Date.now(),
      name: `${data.name || 'Item'} (Copy)`
    };

    if (type === 'earning') {
      this.state.earnings.push(copy);
    } else {
      this.state.spendings.push(copy);
    }

    this.closeEditModal();
    this.saveAndRender();
    this.showToast('Block duplicated');
  }

  deleteItemFromModal() {
    if (!this.activeEditItem) return;
    const { type, data } = this.activeEditItem;

    if (confirm(`Delete "${data.name || 'this block'}"?`)) {
      if (type === 'earning') {
        this.state.earnings = this.state.earnings.filter(e => e.id !== data.id);
      } else {
        this.state.spendings = this.state.spendings.filter(s => s.id !== data.id);
      }

      this.closeEditModal();
      this.saveAndRender();
      this.showToast('Block deleted');
    }
  }

  closeEditModal() {
    this.activeEditItem = null;
    if (this.editModal && this.editModalOverlay) {
      this.editModal.classList.remove('open');
      this.editModalOverlay.classList.remove('open');
    }
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

  closeAnalyticsModal() {
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
