/**
 * Results & Comparison Dashboard + Linux Monitor Controller
 * Powers Duel Mode, 45-Combination Ledger, SVG Charts, Dynamic Conclusion, and Terminal Telemetry.
 * Student: Sai Sparsh B | Reg. No. 25BTRPW078
 */

(function (root) {
  'use strict';

  const OSSim = root.OSSim = root.OSSim || {};

  class DashboardController {
    constructor() {
      this.engine = OSSim.Engine;
      
      // Duel Mode State
      this.stratA = { sched: 'EDF', alloc: 'Proportional', repl: 'Optimal' };
      this.stratB = { sched: 'Round Robin', alloc: 'Equal', repl: 'FIFO' };
      this.duelJobs = [];
      this.duelConfig = { totalFrames: 10, quantum: 3, faultPenalty: 2 };
      this.duelSimA = null;
      this.duelSimB = null;

      // Ledger State
      this.combinations = [];
      this.weights = { misses: 40, response: 25, faults: 25, cpu: 10 };
      this.sortCol = 'score';
      this.sortAsc = false;

      // Linux Monitor State
      this.contextSwitches = 142;
      this.lastJobRunning = null;

      this.init();
    }

    init() {
      this.bindEvents();
    }

    onSimulationUpdated(jobs, config) {
      this.duelJobs = JSON.parse(JSON.stringify(jobs));
      this.duelConfig = { ...this.duelConfig, ...config };

      // 1. Recompute Duel Mode
      this.recalculateDuel();

      // 2. Recompute Ledger 45 combinations
      this.recalculateLedger();

      // 3. Render Charts
      this.renderCharts();

      // 4. Update Dynamic Conclusion
      this.renderConclusion();
    }

    bindEvents() {
      // Duel Mode Selectors
      const schedA = document.getElementById('duelSchedA');
      const allocA = document.getElementById('duelAllocA');
      const replA = document.getElementById('duelReplA');

      const schedB = document.getElementById('duelSchedB');
      const allocB = document.getElementById('duelAllocB');
      const replB = document.getElementById('duelReplB');

      const updateA = () => {
        if (schedA) this.stratA.sched = schedA.value;
        if (allocA) this.stratA.alloc = allocA.value;
        if (replA) this.stratA.repl = replA.value;
        this.recalculateDuel();
      };

      const updateB = () => {
        if (schedB) this.stratB.sched = schedB.value;
        if (allocB) this.stratB.alloc = allocB.value;
        if (replB) this.stratB.repl = replB.value;
        this.recalculateDuel();
      };

      if (schedA) schedA.addEventListener('change', updateA);
      if (allocA) allocA.addEventListener('change', updateA);
      if (replA) replA.addEventListener('change', updateA);

      if (schedB) schedB.addEventListener('change', updateB);
      if (allocB) allocB.addEventListener('change', updateB);
      if (replB) replB.addEventListener('change', updateB);

      // Ledger Weight Sliders
      const wMisses = document.getElementById('weightMisses');
      const wResp = document.getElementById('weightResp');
      const wFaults = document.getElementById('weightFaults');
      const wCpu = document.getElementById('weightCpu');

      const onWeightChange = () => {
        if (wMisses) this.weights.misses = parseInt(wMisses.value, 10);
        if (wResp) this.weights.response = parseInt(wResp.value, 10);
        if (wFaults) this.weights.faults = parseInt(wFaults.value, 10);
        if (wCpu) this.weights.cpu = parseInt(wCpu.value, 10);

        // Update labels
        const lblM = document.getElementById('lblWeightMisses');
        const lblR = document.getElementById('lblWeightResp');
        const lblF = document.getElementById('lblWeightFaults');
        const lblC = document.getElementById('lblWeightCpu');
        if (lblM) lblM.textContent = `${this.weights.misses}%`;
        if (lblR) lblR.textContent = `${this.weights.response}%`;
        if (lblF) lblF.textContent = `${this.weights.faults}%`;
        if (lblC) lblC.textContent = `${this.weights.cpu}%`;

        this.renderLedgerTable();
      };

      if (wMisses) wMisses.addEventListener('input', onWeightChange);
      if (wResp) wResp.addEventListener('input', onWeightChange);
      if (wFaults) wFaults.addEventListener('input', onWeightChange);
      if (wCpu) wCpu.addEventListener('input', onWeightChange);

      // CSV Export Button
      const btnExportCsv = document.getElementById('btnExportCsv');
      if (btnExportCsv) {
        btnExportCsv.addEventListener('click', () => this.exportCsv());
      }

      // Tie List Collapsible Toggle
      const tieBtn = document.getElementById('tieToggleBtn');
      if (tieBtn) {
        tieBtn.addEventListener('click', () => {
          const content = document.getElementById('tieCollapsibleContent');
          if (content) {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            tieBtn.querySelector('.tie-arrow').textContent = isHidden ? '▲' : '▼';
          }
        });
      }
    }

    // --- Duel Mode ---
    recalculateDuel() {
      if (!this.duelJobs || this.duelJobs.length === 0) return;

      this.duelSimA = this.engine.simulateSystem({
        jobs: this.duelJobs,
        scheduler: this.stratA.sched,
        allocationStrategy: this.stratA.alloc,
        replacementPolicy: this.stratA.repl,
        totalFrames: this.duelConfig.totalFrames,
        quantum: this.duelConfig.quantum,
        faultPenalty: this.duelConfig.faultPenalty
      });

      this.duelSimB = this.engine.simulateSystem({
        jobs: this.duelJobs,
        scheduler: this.stratB.sched,
        allocationStrategy: this.stratB.alloc,
        replacementPolicy: this.stratB.repl,
        totalFrames: this.duelConfig.totalFrames,
        quantum: this.duelConfig.quantum,
        faultPenalty: this.duelConfig.faultPenalty
      });

      this.renderDuelScoreboard();
    }

    renderDuelScoreboard() {
      if (!this.duelSimA || !this.duelSimB) return;
      const a = this.duelSimA;
      const b = this.duelSimB;

      // Elements Strategy A
      const respA = document.getElementById('duelRespA');
      const missA = document.getElementById('duelMissA');
      const faultsA = document.getElementById('duelFaultsA');
      const cpuA = document.getElementById('duelCpuA');

      // Elements Strategy B
      const respB = document.getElementById('duelRespB');
      const missB = document.getElementById('duelMissB');
      const faultsB = document.getElementById('duelFaultsB');
      const cpuB = document.getElementById('duelCpuB');

      if (respA) respA.textContent = `${a.avgResponse.toFixed(1)} ticks`;
      if (missA) missA.textContent = `${a.deadlineMisses} (${(a.deadlineMissRate * 100).toFixed(0)}%)`;
      if (faultsA) faultsA.textContent = `${a.totalFaults}`;
      if (cpuA) cpuA.textContent = `${(a.cpuUtilisation * 100).toFixed(1)}%`;

      if (respB) respB.textContent = `${b.avgResponse.toFixed(1)} ticks`;
      if (missB) missB.textContent = `${b.deadlineMisses} (${(b.deadlineMissRate * 100).toFixed(0)}%)`;
      if (faultsB) faultsB.textContent = `${b.totalFaults}`;
      if (cpuB) cpuB.textContent = `${(b.cpuUtilisation * 100).toFixed(1)}%`;

      // Determine Outcome Banner
      const banner = document.getElementById('duelResultBanner');
      if (!banner) return;

      let scoreA = 0;
      let scoreB = 0;

      if (a.deadlineMisses < b.deadlineMisses) scoreA++;
      else if (b.deadlineMisses < a.deadlineMisses) scoreB++;

      if (a.avgResponse < b.avgResponse) scoreA++;
      else if (b.avgResponse < a.avgResponse) scoreB++;

      if (a.totalFaults < b.totalFaults) scoreA++;
      else if (b.totalFaults < a.totalFaults) scoreB++;

      if (a.cpuUtilisation > b.cpuUtilisation) scoreA++;
      else if (b.cpuUtilisation > a.cpuUtilisation) scoreB++;

      const colA = document.getElementById('duelColA');
      const colB = document.getElementById('duelColB');

      if (scoreA > scoreB) {
        banner.textContent = `Strategy A Leads: ${this.stratA.sched} meets deadlines with fewer stalls.`;
        banner.style.color = 'var(--neon-teal)';
        banner.style.borderColor = 'var(--neon-teal)';
        if (colA) colA.classList.add('leading');
        if (colB) colB.classList.remove('leading');
      } else if (scoreB > scoreA) {
        banner.textContent = `Strategy B Leads: ${this.stratB.sched} outperforms on current edge constraints.`;
        banner.style.color = 'var(--neon-amber)';
        banner.style.borderColor = 'var(--neon-amber)';
        if (colB) colB.classList.add('leading');
        if (colA) colA.classList.remove('leading');
      } else {
        banner.textContent = `Tied: Both configurations produce identical overall performance on this workload.`;
        banner.style.color = 'var(--text-muted)';
        banner.style.borderColor = 'var(--border-subtle)';
        if (colA) colA.classList.remove('leading');
        if (colB) colB.classList.remove('leading');
      }
    }

    // --- 45 Combinations Ledger ---
    recalculateLedger() {
      if (!this.duelJobs || this.duelJobs.length === 0) return;

      this.combinations = this.engine.evaluateAllCombinations(this.duelJobs, {
        totalFrames: this.duelConfig.totalFrames,
        quantum: this.duelConfig.quantum,
        faultPenalty: this.duelConfig.faultPenalty
      });

      this.renderLedgerTable();
    }

    renderLedgerTable() {
      const tbody = document.getElementById('ledgerTableBody');
      if (!tbody || this.combinations.length === 0) return;

      const rankedObj = this.engine.rankCombinations(this.combinations, this.weights);
      const ranked = rankedObj.ranked;

      // Handle Tie Notification
      const tieBox = document.getElementById('tieAlertBox');
      const tieCountEl = document.getElementById('tieCountText');
      const tieListEl = document.getElementById('tieCollapsibleList');

      if (rankedObj.hasTie) {
        if (tieBox) tieBox.style.display = 'block';
        if (tieCountEl) tieCountEl.textContent = `${rankedObj.tiedWinners.length} configurations tie for top rank (Score: ${rankedObj.topScore})`;
        if (tieListEl) {
          tieListEl.innerHTML = rankedObj.tiedWinners.map(c => `
            <li><strong>${c.scheduler}</strong> + ${c.allocation} + ${c.replacement} (Misses: ${c.deadlineMisses}, Faults: ${c.totalFaults})</li>
          `).join('');
        }
      } else {
        if (tieBox) tieBox.style.display = 'none';
      }

      // Sort according to active sort column
      const sorted = [...ranked].sort((a, b) => {
        let valA = a[this.sortCol];
        let valB = b[this.sortCol];
        if (typeof valA === 'string') {
          return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return this.sortAsc ? (valA - valB) : (valB - valA);
      });

      tbody.innerHTML = sorted.map((c, idx) => {
        const isTop = (c.score === rankedObj.topScore);
        return `
          <tr style="${isTop ? 'background: rgba(0, 245, 212, 0.08); font-weight: 600;' : ''}">
            <td>${idx + 1}</td>
            <td><strong>${c.scheduler}</strong></td>
            <td>${c.allocation}</td>
            <td>${c.replacement}</td>
            <td style="color: ${c.deadlineMisses > 0 ? 'var(--neon-magenta)' : 'var(--neon-green)'};">${c.deadlineMisses}</td>
            <td>${c.avgResponse.toFixed(1)}</td>
            <td>${c.totalFaults}</td>
            <td>${(c.cpuUtilisation * 100).toFixed(0)}%</td>
            <td style="color: var(--neon-teal); font-weight: 700;">${c.score}</td>
          </tr>
        `;
      }).join('');
    }

    exportCsv() {
      if (this.combinations.length === 0) return;
      const ranked = this.engine.rankCombinations(this.combinations, this.weights).ranked;

      const headers = ['Rank', 'Scheduler', 'Allocation', 'Replacement', 'DeadlineMisses', 'AvgResponseTicks', 'TotalFaults', 'CpuUtilPercent', 'Score'];
      const rows = ranked.map((c, i) => [
        i + 1,
        `"${c.scheduler}"`,
        `"${c.allocation}"`,
        `"${c.replacement}"`,
        c.deadlineMisses,
        c.avgResponse.toFixed(2),
        c.totalFaults,
        (c.cpuUtilisation * 100).toFixed(1),
        c.score
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `edge_ai_scheduler_ledger_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // --- Custom Clean SVG Charts (Never mixing units on one axis!) ---
    renderCharts() {
      this.renderSchedulerTimeChart();
      this.renderMissRateChart();
      this.renderFaultsByPolicyChart();
      this.renderPressureTrendChart();
    }

    renderSchedulerTimeChart() {
      const container = document.getElementById('chartSchedulerTime');
      if (!container || !this.duelJobs || this.duelJobs.length === 0) return;

      const schedulers = this.engine.SCHEDULERS;
      const data = schedulers.map(s => {
        const sim = this.engine.simulateSystem({
          jobs: this.duelJobs,
          scheduler: s,
          totalFrames: this.duelConfig.totalFrames,
          faultPenalty: this.duelConfig.faultPenalty
        });
        return {
          name: s,
          resp: sim.avgResponse,
          wait: sim.avgWaiting,
          turn: sim.avgTurnaround
        };
      });

      const maxVal = Math.max(...data.map(d => Math.max(d.resp, d.wait, d.turn, 1))) * 1.15;
      const w = 440;
      const h = 200;
      const padLeft = 40;
      const padBottom = 30;
      const padTop = 15;
      const barAreaW = w - padLeft - 10;
      const barAreaH = h - padBottom - padTop;
      const groupW = barAreaW / schedulers.length;
      const barW = groupW / 3.8;

      let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="font-family: var(--font-mono); font-size: 10px;">`;
      
      // Grid lines
      for (let step = 0; step <= 4; step++) {
        const yVal = (maxVal / 4) * step;
        const yPos = padTop + barAreaH - (yVal / maxVal) * barAreaH;
        svg += `
          <line x1="${padLeft}" y1="${yPos}" x2="${w - 10}" y2="${yPos}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3" />
          <text x="${padLeft - 6}" y="${yPos + 3}" fill="#64748b" text-anchor="end">${yVal.toFixed(0)}</text>
        `;
      }

      // Bars
      data.forEach((d, i) => {
        const gx = padLeft + i * groupW + groupW * 0.15;
        const hResp = (d.resp / maxVal) * barAreaH;
        const hWait = (d.wait / maxVal) * barAreaH;
        const hTurn = (d.turn / maxVal) * barAreaH;

        // Response bar (Cyan)
        svg += `<rect x="${gx}" y="${padTop + barAreaH - hResp}" width="${barW}" height="${hResp}" fill="#00b4d8" rx="2">
                  <title>${d.name} Resp: ${d.resp.toFixed(1)} ticks</title>
                </rect>`;
        // Waiting bar (Amber)
        svg += `<rect x="${gx + barW + 2}" y="${padTop + barAreaH - hWait}" width="${barW}" height="${hWait}" fill="#ffb703" rx="2">
                  <title>${d.name} Wait: ${d.wait.toFixed(1)} ticks</title>
                </rect>`;
        // Turnaround bar (Teal)
        svg += `<rect x="${gx + (barW + 2) * 2}" y="${padTop + barAreaH - hTurn}" width="${barW}" height="${hTurn}" fill="#00f5d4" rx="2">
                  <title>${d.name} Turnaround: ${d.turn.toFixed(1)} ticks</title>
                </rect>`;

        // X Label
        const shortName = d.name === 'Round Robin' ? 'RR' : d.name;
        svg += `<text x="${gx + barW * 1.5}" y="${h - 8}" fill="#94a3b8" text-anchor="middle">${shortName}</text>`;
      });

      svg += `</svg>`;
      container.innerHTML = svg;
    }

    renderMissRateChart() {
      const container = document.getElementById('chartMissRate');
      if (!container || !this.duelJobs) return;

      const schedulers = this.engine.SCHEDULERS;
      const data = schedulers.map(s => {
        const sim = this.engine.simulateSystem({
          jobs: this.duelJobs,
          scheduler: s,
          totalFrames: this.duelConfig.totalFrames,
          faultPenalty: this.duelConfig.faultPenalty
        });
        return { name: s, missRate: sim.deadlineMissRate * 100 };
      });

      const w = 440;
      const h = 200;
      const padLeft = 45;
      const padBottom = 30;
      const padTop = 15;
      const barAreaW = w - padLeft - 10;
      const barAreaH = h - padBottom - padTop;
      const groupW = barAreaW / schedulers.length;
      const barW = groupW * 0.55;

      let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="font-family: var(--font-mono); font-size: 10px;">`;

      // 0 to 100% grid lines
      [0, 25, 50, 75, 100].forEach(pct => {
        const yPos = padTop + barAreaH - (pct / 100) * barAreaH;
        svg += `
          <line x1="${padLeft}" y1="${yPos}" x2="${w - 10}" y2="${yPos}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3" />
          <text x="${padLeft - 6}" y="${yPos + 3}" fill="#64748b" text-anchor="end">${pct}%</text>
        `;
      });

      data.forEach((d, i) => {
        const gx = padLeft + i * groupW + groupW * 0.22;
        const bH = (d.missRate / 100) * barAreaH;
        const barColor = d.missRate === 0 ? 'var(--neon-green)' : (d.missRate < 40 ? 'var(--neon-amber)' : 'var(--neon-magenta)');

        svg += `
          <rect x="${gx}" y="${padTop + barAreaH - bH}" width="${barW}" height="${bH}" fill="${barColor}" rx="3">
            <title>${d.name}: ${d.missRate.toFixed(1)}% misses</title>
          </rect>
          <text x="${gx + barW / 2}" y="${padTop + barAreaH - bH - 4}" fill="#fff" text-anchor="middle" font-size="9">${d.missRate.toFixed(0)}%</text>
          <text x="${gx + barW / 2}" y="${h - 8}" fill="#94a3b8" text-anchor="middle">${d.name === 'Round Robin' ? 'RR' : d.name}</text>
        `;
      });

      svg += `</svg>`;
      container.innerHTML = svg;
    }

    renderFaultsByPolicyChart() {
      const container = document.getElementById('chartFaultsPolicy');
      if (!container || !this.duelJobs) return;

      const policies = this.engine.REPLACEMENTS;
      const data = policies.map(p => {
        const sim = this.engine.simulateSystem({
          jobs: this.duelJobs,
          replacementPolicy: p,
          totalFrames: this.duelConfig.totalFrames,
          faultPenalty: this.duelConfig.faultPenalty
        });
        return { name: p, faults: sim.totalFaults };
      });

      const maxFaults = Math.max(...data.map(d => d.faults), 1) * 1.2;
      const w = 440;
      const h = 200;
      const padLeft = 40;
      const padBottom = 30;
      const padTop = 15;
      const barAreaW = w - padLeft - 10;
      const barAreaH = h - padBottom - padTop;
      const groupW = barAreaW / policies.length;
      const barW = groupW * 0.5;

      let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="font-family: var(--font-mono); font-size: 10px;">`;

      for (let s = 0; s <= 4; s++) {
        const yVal = (maxFaults / 4) * s;
        const yPos = padTop + barAreaH - (yVal / maxFaults) * barAreaH;
        svg += `
          <line x1="${padLeft}" y1="${yPos}" x2="${w - 10}" y2="${yPos}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3" />
          <text x="${padLeft - 6}" y="${yPos + 3}" fill="#64748b" text-anchor="end">${yVal.toFixed(0)}</text>
        `;
      }

      data.forEach((d, i) => {
        const gx = padLeft + i * groupW + groupW * 0.25;
        const bH = (d.faults / maxFaults) * barAreaH;
        const color = d.name === 'Optimal' ? '#00f5d4' : (d.name === 'LRU' ? '#00b4d8' : '#f59e0b');

        svg += `
          <rect x="${gx}" y="${padTop + barAreaH - bH}" width="${barW}" height="${bH}" fill="${color}" rx="3">
            <title>${d.name}: ${d.faults} page faults</title>
          </rect>
          <text x="${gx + barW / 2}" y="${padTop + barAreaH - bH - 4}" fill="#fff" text-anchor="middle">${d.faults}</text>
          <text x="${gx + barW / 2}" y="${h - 8}" fill="#94a3b8" text-anchor="middle">${d.name}</text>
        `;
      });

      svg += `</svg>`;
      container.innerHTML = svg;
    }

    renderPressureTrendChart() {
      const container = document.getElementById('chartPressureTrend');
      if (!container || !this.duelJobs) return;

      // Vary frames from 4 to 40
      const framePoints = [4, 6, 8, 10, 14, 18, 24, 32, 40];
      const curveData = framePoints.map(f => {
        const sim = this.engine.simulateSystem({
          jobs: this.duelJobs,
          totalFrames: f,
          faultPenalty: 2
        });
        return { frames: f, faults: sim.totalFaults, pressure: sim.memoryPressure };
      });

      const maxFaults = Math.max(...curveData.map(d => d.faults), 1) * 1.15;
      const w = 440;
      const h = 200;
      const padLeft = 40;
      const padBottom = 30;
      const padTop = 15;
      const areaW = w - padLeft - 10;
      const areaH = h - padBottom - padTop;

      let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="font-family: var(--font-mono); font-size: 10px;">`;

      // Grid
      for (let s = 0; s <= 4; s++) {
        const yVal = (maxFaults / 4) * s;
        const yPos = padTop + areaH - (yVal / maxFaults) * areaH;
        svg += `
          <line x1="${padLeft}" y1="${yPos}" x2="${w - 10}" y2="${yPos}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3" />
          <text x="${padLeft - 6}" y="${yPos + 3}" fill="#64748b" text-anchor="end">${yVal.toFixed(0)}</text>
        `;
      }

      // Polyline path
      const points = curveData.map((d, i) => {
        const px = padLeft + (i / (curveData.length - 1)) * areaW;
        const py = padTop + areaH - (d.faults / maxFaults) * areaH;
        return `${px},${py}`;
      }).join(' ');

      // Fill area under curve
      const firstX = padLeft;
      const lastX = padLeft + areaW;
      const bottomY = padTop + areaH;
      const areaPoints = `${firstX},${bottomY} ${points} ${lastX},${bottomY}`;

      svg += `
        <polygon points="${areaPoints}" fill="rgba(0, 245, 212, 0.12)" />
        <polyline points="${points}" fill="none" stroke="#00f5d4" stroke-width="2.5" />
      `;

      // Data dots & X labels
      curveData.forEach((d, i) => {
        const px = padLeft + (i / (curveData.length - 1)) * areaW;
        const py = padTop + areaH - (d.faults / maxFaults) * areaH;

        svg += `
          <circle cx="${px}" cy="${py}" r="3.5" fill="#ffffff" stroke="#00f5d4" stroke-width="2">
            <title>${d.frames} Frames: ${d.faults} faults (Pressure ${d.pressure.toFixed(2)}x)</title>
          </circle>
          <text x="${px}" y="${h - 8}" fill="#94a3b8" text-anchor="middle">${d.frames}</text>
        `;
      });

      svg += `</svg>`;
      container.innerHTML = svg;
    }

    // --- Dynamic Plain-English Conclusion ---
    renderConclusion() {
      const container = document.getElementById('autoConclusionText');
      if (!container || this.combinations.length === 0) return;

      // Find best for each goal:
      // 1. Fastest response time
      const bestResp = [...this.combinations].sort((a, b) => a.avgResponse - b.avgResponse)[0];
      // 2. Fewest deadline misses
      const bestMiss = [...this.combinations].sort((a, b) => a.deadlineMisses - b.deadlineMisses || a.avgResponse - b.avgResponse)[0];
      // 3. Fewest page faults
      const bestFaults = [...this.combinations].sort((a, b) => a.totalFaults - b.totalFaults || a.deadlineMisses - b.deadlineMisses)[0];

      container.innerHTML = `
        <p>Based on the simulation of the current edge workload across all 45 operational combinations:</p>
        <ul style="margin: 0.75rem 0 0.75rem 1.5rem; line-height: 1.8;">
          <li>
            <strong style="color: var(--neon-cyan);">Fastest Response Time:</strong>
            Achieved by <strong>${bestResp.scheduler}</strong> with <em>${bestResp.allocation}</em> allocation and <em>${bestResp.replacement}</em> replacement, yielding an average response latency of <strong>${bestResp.avgResponse.toFixed(1)} ticks</strong>. Round Robin and preemptive EDF excel at early core dispatching.
          </li>
          <li>
            <strong style="color: var(--neon-teal);">Fewest Deadline Misses:</strong>
            Secured by <strong>${bestMiss.scheduler}</strong> with <em>${bestMiss.allocation}</em> allocation and <em>${bestMiss.replacement}</em> replacement, recording only <strong>${bestMiss.deadlineMisses} misses</strong> (${(bestMiss.deadlineMissRate * 100).toFixed(0)}%). Preemptive Earliest Deadline First prioritizes urgent inferencing tasks before critical boundaries expire.
          </li>
          <li>
            <strong style="color: var(--neon-amber);">Fewest Page Faults & Stalls:</strong>
            Minimized by <strong>${bestFaults.replacement}</strong> page replacement coupled with <em>${bestFaults.allocation}</em> frame allocation, holding faults to <strong>${bestFaults.totalFaults}</strong>. By retaining active temporal working sets, memory thrashing and CPU pipeline stalls are eliminated.
          </li>
        </ul>
        <p style="font-size: 0.88rem; color: var(--text-dim); margin-top: 0.5rem;">
          Recommendation: For hard real-time AI workloads on embedded microcontrollers, combine <strong>EDF scheduling</strong> with <strong>Proportional allocation</strong> and <strong>LRU/Optimal replacement</strong> to balance temporal deadlines against tight physical RAM constraints.
        </p>
      `;
    }

    // --- Linux Monitor Panel Telemetry ---
    updateLinuxTerminal(tick, activeEvent, simResult) {
      const topCpuEl = document.getElementById('termTopCpu');
      const topMemEl = document.getElementById('termTopMem');
      const termTasksEl = document.getElementById('termTasksRunning');
      const termTableBody = document.getElementById('termProcessBody');
      const vmstatRow = document.getElementById('termVmstatRow');
      const freeMemRow = document.getElementById('termFreeRow');

      if (!simResult) return;

      // Track context switches
      if (activeEvent && activeEvent.jobId !== this.lastJobRunning && activeEvent.type === 'exec') {
        this.contextSwitches++;
        this.lastJobRunning = activeEvent.jobId;
      }

      const busyPct = (simResult.cpuUtilisation * 100).toFixed(1);
      const idlePct = (100 - simResult.cpuUtilisation * 100).toFixed(1);
      const totalFrames = simResult.totalFrames || 10;
      const memUsedFrames = Math.min(totalFrames, Object.keys(activeEvent.framesSnapshot || {}).length * 2);
      const memUsedPct = ((memUsedFrames / totalFrames) * 100).toFixed(1);

      if (topCpuEl) topCpuEl.textContent = `%Cpu(s): ${busyPct} us, 1.2 sy, 0.0 ni, ${idlePct} id, ${(simResult.stallTicks > 0 ? 8.2 : 0.0)} wa`;
      if (topMemEl) topMemEl.textContent = `MiB Mem :  ${totalFrames * 64} total, ${(totalFrames - memUsedFrames) * 64} free, ${memUsedFrames * 64} used, 128 buff/cache`;
      if (termTasksEl) termTasksEl.textContent = `Tasks: ${simResult.jobs.length} total, ${activeEvent.type === 'exec' ? 1 : 0} running, ${activeEvent.readyQueue.length} sleeping, 0 stopped, 0 zombie`;

      // Update Top process list
      if (termTableBody) {
        termTableBody.innerHTML = simResult.jobs.map((j, i) => {
          const isRunning = activeEvent.jobId === j.id && activeEvent.type === 'exec';
          const isStalled = activeEvent.jobId === j.id && activeEvent.type === 'stall';
          const stateChar = isRunning ? 'R' : (isStalled ? 'D' : (j.finishTick !== null && j.finishTick <= tick ? 'S' : 'I'));
          const cpuVal = isRunning ? '98.5' : (isStalled ? '12.0' : '0.0');
          const memVal = ((j.allocatedFramesCount / totalFrames) * 100).toFixed(1);

          return `
            <tr style="${isRunning ? 'color: var(--neon-teal); font-weight: 700;' : ''}">
              <td>${1040 + i}</td>
              <td>root</td>
              <td>${20 - j.priority}</td>
              <td>0</td>
              <td>${j.totalPages * 4}M</td>
              <td>${j.allocatedFramesCount * 4}M</td>
              <td>${j.allocatedFramesCount * 2}M</td>
              <td>${stateChar}</td>
              <td>${cpuVal}</td>
              <td>${memVal}</td>
              <td>0:${String(j.executedTicks).padStart(2, '0')}.22</td>
              <td>inference_${j.id.toLowerCase()}</td>
            </tr>
          `;
        }).join('');
      }

      // Update vmstat
      if (vmstatRow) {
        vmstatRow.innerHTML = `
          <td>${activeEvent.readyQueue.length + (activeEvent.type === 'exec' ? 1 : 0)}</td>
          <td>${activeEvent.type === 'stall' ? 1 : 0}</td>
          <td>0</td>
          <td>${(totalFrames - memUsedFrames) * 4096}</td>
          <td>2048</td>
          <td>8192</td>
          <td>0</td>
          <td>${activeEvent.type === 'stall' ? 1 : 0}</td>
          <td>${activeEvent.hit ? 4 : 0}</td>
          <td>${activeEvent.type === 'stall' ? 8 : 0}</td>
          <td>${1024 + tick * 3}</td>
          <td>${this.contextSwitches}</td>
          <td>${busyPct}</td>
          <td>1</td>
          <td>${idlePct}</td>
          <td>${activeEvent.type === 'stall' ? 14 : 0}</td>
          <td>0</td>
        `;
      }

      // Update free -m
      if (freeMemRow) {
        freeMemRow.innerHTML = `
          <td><strong>Mem:</strong></td>
          <td>${totalFrames * 64}</td>
          <td>${memUsedFrames * 64}</td>
          <td>${(totalFrames - memUsedFrames) * 64}</td>
          <td>16</td>
          <td>32</td>
          <td>${(totalFrames - memUsedFrames) * 64 + 16}</td>
        `;
      }
    }
  }

  OSSim.DashboardController = DashboardController;
})(typeof self !== 'undefined' ? self : this);

