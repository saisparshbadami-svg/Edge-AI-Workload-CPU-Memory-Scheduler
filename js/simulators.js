/**
 * Interactive Simulators Controller: CPU Scheduler Lab & Memory Lab
 * Visualizes Gantt runway, ready queue, physical frame grid, memory pressure gauge, and controls.
 * Student: Sai Sparsh B | Reg. No. 25BTRPW078
 */

(function (root) {
  'use strict';

  const OSSim = root.OSSim = root.OSSim || {};

  class SimulatorsController {
    constructor() {
      this.engine = OSSim.Engine;
      
      // Active Simulation Config
      this.currentPresetKey = 'smart-camera';
      this.jobs = JSON.parse(JSON.stringify(this.engine.PRESETS[this.currentPresetKey].jobs));
      
      // CPU Lab Settings
      this.cpuScheduler = 'EDF';
      this.quantum = 3;
      this.aging = false;
      this.agingInterval = 4;
      
      // Memory Lab Settings
      this.totalFrames = this.engine.PRESETS[this.currentPresetKey].totalFrames || 10;
      this.allocationStrategy = 'Proportional';
      this.replacementPolicy = 'LRU';
      this.faultPenalty = this.engine.PRESETS[this.currentPresetKey].faultPenalty !== undefined
        ? this.engine.PRESETS[this.currentPresetKey].faultPenalty : 2;

      // Playback State
      this.simResult = null;
      this.currentTick = 0;
      this.isPlaying = false;
      this.playSpeed = 1; // 1x, 2x, 5x
      this.playInterval = null;

      // Memory Side-by-side State
      this.memRefString = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
      this.memFramesCount = 3;
      this.memStep = 0;
      this.memResults = { FIFO: null, LRU: null, Optimal: null };

      // Spring physics needle state
      this.gaugeValue = 1.0;
      this.needleAngle = 0;
      this.needleVelocity = 0;

      this.init();
    }

    init() {
      this.recalculateSimulation();
      this.bindEvents();
      this.updateMemSideBySide();
      this.renderAll();
      this.startGaugeAnimation();
    }

    recalculateSimulation() {
      this.simResult = this.engine.simulateSystem({
        jobs: this.jobs,
        scheduler: this.cpuScheduler,
        quantum: this.quantum,
        aging: this.aging,
        agingInterval: this.agingInterval,
        totalFrames: this.totalFrames,
        allocationStrategy: this.allocationStrategy,
        replacementPolicy: this.replacementPolicy,
        faultPenalty: this.faultPenalty
      });

      // Clamp currentTick
      if (this.currentTick > this.simResult.totalTicks) {
        this.currentTick = this.simResult.totalTicks;
      }

      // Notify dashboard if registered
      if (OSSim.Dashboard && typeof OSSim.Dashboard.onSimulationUpdated === 'function') {
        OSSim.Dashboard.onSimulationUpdated(this.jobs, {
          totalFrames: this.totalFrames,
          quantum: this.quantum,
          faultPenalty: this.faultPenalty,
          aging: this.aging
        });
      }
    }

    bindEvents() {
      // Preset Selection
      const presetBtns = document.querySelectorAll('[data-preset]');
      presetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          presetBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const pKey = btn.getAttribute('data-preset');
          this.loadPreset(pKey);
        });
      });

      // CPU Scheduler Selection
      const schedBtns = document.querySelectorAll('[data-scheduler]');
      schedBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          schedBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.cpuScheduler = btn.getAttribute('data-scheduler');
          
          // Toggle quantum slider visibility for Round Robin
          const quantumWrap = document.getElementById('quantumControlWrap');
          if (quantumWrap) {
            quantumWrap.style.display = (this.cpuScheduler === 'Round Robin') ? 'flex' : 'none';
          }
          // Toggle aging option for Priority
          const agingWrap = document.getElementById('agingControlWrap');
          if (agingWrap) {
            agingWrap.style.display = (this.cpuScheduler === 'Priority') ? 'flex' : 'none';
          }

          this.recalculateSimulation();
          this.renderAll();
        });
      });

      // Quantum Slider
      const quantumSlider = document.getElementById('quantumSlider');
      if (quantumSlider) {
        quantumSlider.addEventListener('input', (e) => {
          this.quantum = parseInt(e.target.value, 10);
          const valEl = document.getElementById('quantumVal');
          if (valEl) valEl.textContent = this.quantum;
          this.recalculateSimulation();
          this.renderAll();
        });
      }

      // Aging Checkbox
      const agingCheckbox = document.getElementById('agingCheckbox');
      if (agingCheckbox) {
        agingCheckbox.addEventListener('change', (e) => {
          this.aging = e.target.checked;
          this.recalculateSimulation();
          this.renderAll();
        });
      }

      // Memory Allocation Strategy
      const allocBtns = document.querySelectorAll('[data-allocation]');
      allocBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          allocBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.allocationStrategy = btn.getAttribute('data-allocation');
          this.recalculateSimulation();
          this.renderAll();
        });
      });

      // Page Replacement Policy
      const replBtns = document.querySelectorAll('[data-replacement]');
      replBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          replBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.replacementPolicy = btn.getAttribute('data-replacement');
          this.recalculateSimulation();
          this.renderAll();
        });
      });

      // Physical Frames Slider
      const framesSlider = document.getElementById('framesSlider');
      if (framesSlider) {
        framesSlider.addEventListener('input', (e) => {
          this.totalFrames = parseInt(e.target.value, 10);
          const fVal = document.getElementById('framesVal');
          if (fVal) fVal.textContent = this.totalFrames;
          this.recalculateSimulation();
          this.renderAll();
        });
      }

      // Fault Penalty Slider
      const penaltySlider = document.getElementById('penaltySlider');
      if (penaltySlider) {
        penaltySlider.addEventListener('input', (e) => {
          this.faultPenalty = parseInt(e.target.value, 10);
          const pVal = document.getElementById('penaltyVal');
          if (pVal) pVal.textContent = `${this.faultPenalty} ticks`;
          this.recalculateSimulation();
          this.renderAll();
        });
      }

      // Playback Controls
      const playBtn = document.getElementById('btnPlay');
      const pauseBtn = document.getElementById('btnPause');
      const stepBtn = document.getElementById('btnStep');
      const resetBtn = document.getElementById('btnReset');
      const scrubber = document.getElementById('tickScrubber');

      if (playBtn) playBtn.addEventListener('click', () => this.play());
      if (pauseBtn) pauseBtn.addEventListener('click', () => this.pause());
      if (stepBtn) stepBtn.addEventListener('click', () => this.step());
      if (resetBtn) resetBtn.addEventListener('click', () => this.reset());

      if (scrubber) {
        scrubber.addEventListener('input', (e) => {
          this.pause();
          this.currentTick = parseInt(e.target.value, 10);
          this.renderTick();
        });
      }

      // Speed selection
      const speedBtns = document.querySelectorAll('[data-speed]');
      speedBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          speedBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.playSpeed = parseFloat(btn.getAttribute('data-speed'));
          if (this.isPlaying) {
            this.pause();
            this.play();
          }
        });
      });

      // Memory Lab Side-by-Side Reference String Controls
      const refStringInput = document.getElementById('refStringInput');
      const btnGenLocality = document.getElementById('btnGenLocality');
      const btnGenRandom = document.getElementById('btnGenRandom');
      const memFramesInput = document.getElementById('memFramesInput');
      const btnMemStep = document.getElementById('btnMemStep');
      const btnMemReset = document.getElementById('btnMemReset');

      if (refStringInput) {
        refStringInput.addEventListener('change', (e) => {
          const parsed = e.target.value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
          if (parsed.length > 0) {
            this.memRefString = parsed;
            this.updateMemSideBySide();
          }
        });
      }

      if (btnGenLocality) {
        btnGenLocality.addEventListener('click', () => {
          this.memRefString = this.engine.generateReferenceString(20, 8, 0.75, Date.now());
          if (refStringInput) refStringInput.value = this.memRefString.join(', ');
          this.updateMemSideBySide();
        });
      }

      if (btnGenRandom) {
        btnGenRandom.addEventListener('click', () => {
          this.memRefString = this.engine.generateReferenceString(20, 8, 0.1, Date.now());
          if (refStringInput) refStringInput.value = this.memRefString.join(', ');
          this.updateMemSideBySide();
        });
      }

      if (memFramesInput) {
        memFramesInput.addEventListener('input', (e) => {
          this.memFramesCount = parseInt(e.target.value, 10) || 3;
          const lbl = document.getElementById('memFramesInputVal');
          if (lbl) lbl.textContent = this.memFramesCount;
          this.updateMemSideBySide();
        });
      }

      if (btnMemStep) {
        btnMemStep.addEventListener('click', () => {
          this.stepMemSideBySide();
        });
      }

      if (btnMemReset) {
        btnMemReset.addEventListener('click', () => {
          this.memStep = 0;
          this.renderMemSideBySide();
        });
      }

      // Add Job Button
      const btnAddJob = document.getElementById('btnAddJob');
      if (btnAddJob) {
        btnAddJob.addEventListener('click', () => {
          this.promptAddJob();
        });
      }
    }

    loadPreset(presetKey) {
      if (!this.engine.PRESETS[presetKey]) return;
      this.currentPresetKey = presetKey;
      const preset = this.engine.PRESETS[presetKey];
      this.jobs = JSON.parse(JSON.stringify(preset.jobs));
      this.totalFrames = preset.totalFrames || 10;
      this.faultPenalty = preset.faultPenalty !== undefined ? preset.faultPenalty : 2;

      // Update UI Inputs
      const framesSlider = document.getElementById('framesSlider');
      if (framesSlider) framesSlider.value = this.totalFrames;
      const fVal = document.getElementById('framesVal');
      if (fVal) fVal.textContent = this.totalFrames;

      const penaltySlider = document.getElementById('penaltySlider');
      if (penaltySlider) penaltySlider.value = this.faultPenalty;
      const pVal = document.getElementById('penaltyVal');
      if (pVal) pVal.textContent = `${this.faultPenalty} ticks`;

      this.currentTick = 0;
      this.recalculateSimulation();
      this.renderAll();
    }

    play() {
      if (this.isPlaying) return;
      this.isPlaying = true;
      const playBtn = document.getElementById('btnPlay');
      const pauseBtn = document.getElementById('btnPause');
      if (playBtn) playBtn.classList.add('active');
      if (pauseBtn) pauseBtn.classList.remove('active');

      const delay = Math.max(100, Math.floor(700 / this.playSpeed));
      this.playInterval = setInterval(() => {
        if (this.currentTick < this.simResult.totalTicks) {
          this.currentTick++;
          this.renderTick();
        } else {
          this.pause();
        }
      }, delay);
    }

    pause() {
      this.isPlaying = false;
      if (this.playInterval) {
        clearInterval(this.playInterval);
        this.playInterval = null;
      }
      const playBtn = document.getElementById('btnPlay');
      const pauseBtn = document.getElementById('btnPause');
      if (playBtn) playBtn.classList.remove('active');
      if (pauseBtn) pauseBtn.classList.add('active');
    }

    step() {
      this.pause();
      if (this.currentTick < this.simResult.totalTicks) {
        this.currentTick++;
        this.renderTick();
      }
    }

    reset() {
      this.pause();
      this.currentTick = 0;
      this.renderTick();
    }

    // --- Renderers ---
    renderAll() {
      this.renderScrubber();
      this.renderMetricsSummary();
      this.renderTimelineRunway();
      this.renderJobTable();
      this.renderTick();
    }

    renderScrubber() {
      const scrubber = document.getElementById('tickScrubber');
      const maxTickEl = document.getElementById('scrubberMaxTick');
      if (scrubber && this.simResult) {
        scrubber.max = this.simResult.totalTicks;
        scrubber.value = this.currentTick;
      }
      if (maxTickEl && this.simResult) {
        maxTickEl.textContent = `Tick ${this.simResult.totalTicks}`;
      }
    }

    renderMetricsSummary() {
      if (!this.simResult) return;
      const r = this.simResult;

      const elAvgResp = document.getElementById('metricAvgResp');
      const elAvgWait = document.getElementById('metricAvgWait');
      const elAvgTurn = document.getElementById('metricAvgTurn');
      const elMissRate = document.getElementById('metricMissRate');
      const elCpuUtil = document.getElementById('metricCpuUtil');
      const elFaultCount = document.getElementById('metricFaultCount');

      if (elAvgResp) elAvgResp.textContent = `${r.avgResponse.toFixed(1)} ticks`;
      if (elAvgWait) elAvgWait.textContent = `${r.avgWaiting.toFixed(1)} ticks`;
      if (elAvgTurn) elAvgTurn.textContent = `${r.avgTurnaround.toFixed(1)} ticks`;
      if (elMissRate) {
        elMissRate.textContent = `${(r.deadlineMissRate * 100).toFixed(0)}% (${r.deadlineMisses}/${r.totalJobs})`;
        elMissRate.style.color = r.deadlineMisses > 0 ? 'var(--neon-magenta)' : 'var(--neon-green)';
      }
      if (elCpuUtil) elCpuUtil.textContent = `${(r.cpuUtilisation * 100).toFixed(1)}%`;
      if (elFaultCount) elFaultCount.textContent = `${r.totalFaults} (${(r.faultRate * 100).toFixed(0)}%)`;

      // Update Gauge Target
      this.gaugeValue = r.memoryPressure;
    }

    renderTimelineRunway() {
      const strip = document.getElementById('ganttStrip');
      const axis = document.getElementById('runwayTicksAxis');
      if (!strip || !this.simResult) return;

      const totalTicks = Math.max(1, this.simResult.totalTicks);
      strip.innerHTML = '';
      if (axis) axis.innerHTML = '';

      // Job color palette
      const jobColors = {
        'J1': '#00f5d4',
        'J2': '#ffb703',
        'J3': '#f72585',
        'J4': '#00b4d8',
        'J5': '#a78bfa'
      };

      for (let t = 0; t < totalTicks; t++) {
        const item = this.simResult.timeline[t] || { type: 'idle' };
        const block = document.createElement('div');
        block.className = `gantt-block ${item.type}`;
        block.style.width = `${100 / totalTicks}%`;
        block.id = `gantt-tick-${t}`;

        if (item.type === 'exec') {
          block.style.backgroundColor = jobColors[item.jobId] || '#38bdf8';
          block.textContent = `${item.jobId}:P${item.page}`;
          block.title = `Tick ${t}: ${item.jobId} running page ${item.page}`;
        } else if (item.type === 'stall') {
          block.textContent = `STALL P${item.page}`;
          block.title = `Tick ${t}: Page fault stall for ${item.jobId}`;
        } else {
          block.textContent = '-';
          block.title = `Tick ${t}: CPU Idle`;
        }

        strip.appendChild(block);

        // Axis labels (every 2 or 5 ticks depending on length)
        if (axis && (totalTicks <= 20 || t % 2 === 0 || t === totalTicks - 1)) {
          const tickLabel = document.createElement('span');
          tickLabel.className = 'runway-tick-label';
          tickLabel.style.width = `${100 / totalTicks}%`;
          tickLabel.textContent = t;
          axis.appendChild(tickLabel);
        }
      }
    }

    renderTick() {
      const currentTickEl = document.getElementById('currentTickDisplay');
      if (currentTickEl) currentTickEl.textContent = `Tick: ${this.currentTick}`;

      const scrubber = document.getElementById('tickScrubber');
      if (scrubber) scrubber.value = this.currentTick;

      // Highlight active tick block on runway
      const totalTicks = this.simResult ? this.simResult.totalTicks : 0;
      for (let t = 0; t < totalTicks; t++) {
        const el = document.getElementById(`gantt-tick-${t}`);
        if (el) {
          if (t === this.currentTick) {
            el.style.outline = '2px solid #ffffff';
            el.style.zIndex = '5';
          } else if (t < this.currentTick) {
            el.style.outline = 'none';
            el.style.opacity = '1';
          } else {
            el.style.outline = 'none';
            el.style.opacity = '0.35';
          }
        }
      }

      const activeEvent = (this.simResult && this.simResult.timeline[this.currentTick])
        ? this.simResult.timeline[this.currentTick]
        : { type: 'idle', readyQueue: [], framesSnapshot: {} };

      // Update CPU Core Box
      const coreJobEl = document.getElementById('activeCoreJob');
      const coreStatusEl = document.getElementById('activeCoreStatus');
      const coreQuantumEl = document.getElementById('activeCoreQuantum');

      if (coreJobEl) {
        if (activeEvent.type === 'exec') {
          coreJobEl.textContent = activeEvent.jobId;
          coreJobEl.style.color = 'var(--neon-teal)';
        } else if (activeEvent.type === 'stall') {
          coreJobEl.textContent = `${activeEvent.jobId} (FAULT)`;
          coreJobEl.style.color = 'var(--neon-magenta)';
        } else {
          coreJobEl.textContent = 'IDLE';
          coreJobEl.style.color = 'var(--text-dim)';
        }
      }

      if (coreStatusEl) {
        if (activeEvent.type === 'exec') {
          coreStatusEl.textContent = `Accessing Page ${activeEvent.page} (HIT)`;
        } else if (activeEvent.type === 'stall') {
          coreStatusEl.textContent = `Stall handling Page ${activeEvent.page}`;
        } else {
          coreStatusEl.textContent = 'Ready Queue Empty';
        }
      }

      if (coreQuantumEl) {
        if (this.cpuScheduler === 'Round Robin') {
          coreQuantumEl.textContent = `RR Quantum: ${this.quantum} ticks`;
        } else if (this.cpuScheduler === 'Priority' && this.aging) {
          coreQuantumEl.textContent = `Priority (Aging Enabled)`;
        } else {
          coreQuantumEl.textContent = `${this.cpuScheduler} Mode`;
        }
      }

      // Update Ready Queue
      const queueContainer = document.getElementById('readyQueueChips');
      if (queueContainer) {
        queueContainer.innerHTML = '';
        if (activeEvent.readyQueue && activeEvent.readyQueue.length > 0) {
          activeEvent.readyQueue.forEach(jId => {
            const job = this.jobs.find(j => j.id === jId);
            const chip = document.createElement('div');
            chip.className = 'queue-chip';
            chip.innerHTML = `
              <strong>${jId}</strong>
              <span style="font-size: 0.72rem; color: var(--text-dim);">D:${job ? job.deadline : '-'}</span>
            `;
            queueContainer.appendChild(chip);
          });
        } else {
          queueContainer.innerHTML = `<span style="color: var(--text-dim); font-size: 0.8rem; font-style: italic;">No jobs waiting in queue</span>`;
        }
      }

      // Update Physical Frames in Memory Lab
      this.renderPhysicalFrames(activeEvent);
      this.updateJobTableRuntime();

      // Trigger Linux Monitor update
      if (OSSim.Dashboard && typeof OSSim.Dashboard.updateLinuxTerminal === 'function') {
        OSSim.Dashboard.updateLinuxTerminal(this.currentTick, activeEvent, this.simResult);
      }
    }

    renderPhysicalFrames(activeEvent) {
      const container = document.getElementById('physicalFramesGrid');
      if (!container) return;

      container.innerHTML = '';
      const totalF = this.totalFrames;

      // Reconstruct resident pages up to currentTick
      const residentPages = [];
      const snap = activeEvent.framesSnapshot || {};
      for (const [jId, pages] of Object.entries(snap)) {
        for (const p of pages) {
          residentPages.push({ jobId: jId, page: p });
        }
      }

      for (let f = 0; f < totalF; f++) {
        const slot = document.createElement('div');
        slot.className = 'frame-slot';

        if (f < residentPages.length) {
          const resident = residentPages[f];
          slot.classList.add('occupied');
          
          if (activeEvent.jobId === resident.jobId && activeEvent.page === resident.page) {
            if (activeEvent.hit) {
              slot.classList.add('hit');
            } else if (activeEvent.type === 'stall') {
              slot.classList.add('fault');
            }
          }

          if (activeEvent.victim === resident.page && activeEvent.jobId === resident.jobId) {
            slot.classList.add('evicting');
          }

          slot.innerHTML = `
            <span class="frame-slot-id">F${f}</span>
            <span class="frame-slot-page">P${resident.page}</span>
            <span class="frame-slot-owner">${resident.jobId}</span>
          `;
        } else {
          slot.innerHTML = `
            <span class="frame-slot-id">F${f}</span>
            <span class="frame-slot-page" style="color: var(--text-dim);">-</span>
            <span class="frame-slot-owner" style="color: var(--text-dim);">Free</span>
          `;
        }

        container.appendChild(slot);
      }
    }

    renderJobTable() {
      const tbody = document.getElementById('jobTableBody');
      if (!tbody || !this.simResult) return;

      tbody.innerHTML = '';
      this.simResult.jobs.forEach(j => {
        const tr = document.createElement('tr');
        tr.id = `job-row-${j.id}`;

        const isMet = (j.finishTick !== null && j.finishTick <= j.deadline);
        const hasFinished = j.finishTick !== null && j.finishTick <= this.currentTick;
        const statusHtml = !hasFinished
          ? `<span style="color: var(--text-dim);">-</span>`
          : (isMet
            ? `<span class="badge-met">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Met
               </span>`
            : `<span class="badge-missed">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Missed
               </span>`);

        tr.innerHTML = `
          <td><strong>${j.id}</strong></td>
          <td>${escapeHtml(j.name)}</td>
          <td>${j.arrival}</td>
          <td>${j.burst}</td>
          <td>${j.deadline}</td>
          <td>${j.priority}</td>
          <td>${j.totalPages}</td>
          <td id="td-resp-${j.id}">${j.responseTime !== null ? j.responseTime : '-'}</td>
          <td id="td-wait-${j.id}">${j.waitingTicks !== null ? j.waitingTicks : '-'}</td>
          <td id="td-turn-${j.id}">${j.turnaroundTicks !== null ? j.turnaroundTicks : '-'}</td>
          <td id="td-fault-${j.id}">${j.pageFaults}</td>
          <td id="td-status-${j.id}">${statusHtml}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    updateJobTableRuntime() {
      if (!this.simResult) return;
      this.simResult.jobs.forEach(j => {
        const tdStatus = document.getElementById(`td-status-${j.id}`);
        const tdResp = document.getElementById(`td-resp-${j.id}`);
        const tdWait = document.getElementById(`td-wait-${j.id}`);
        const tdTurn = document.getElementById(`td-turn-${j.id}`);

        const started = j.firstRunTick !== null && j.firstRunTick <= this.currentTick;
        const finished = j.finishTick !== null && j.finishTick <= this.currentTick;

        if (tdResp) tdResp.textContent = started ? j.responseTime : '-';
        if (tdTurn) tdTurn.textContent = finished ? j.turnaroundTicks : '-';
        if (tdWait) tdWait.textContent = finished ? j.waitingTicks : '-';

        if (tdStatus) {
          if (!finished) {
            tdStatus.innerHTML = `<span style="color: var(--text-dim);">-</span>`;
          } else {
            const isMet = j.finishTick <= j.deadline;
            tdStatus.innerHTML = isMet
              ? `<span class="badge-met">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Met
                 </span>`
              : `<span class="badge-missed">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  Missed
                 </span>`;
          }
        }
      });
    }

    // --- Side by Side Memory Comparison ---
    updateMemSideBySide() {
      this.memResults.FIFO = this.engine.runPageReplacement('FIFO', this.memRefString, this.memFramesCount);
      this.memResults.LRU = this.engine.runPageReplacement('LRU', this.memRefString, this.memFramesCount);
      this.memResults.Optimal = this.engine.runPageReplacement('Optimal', this.memRefString, this.memFramesCount);

      this.renderMemSideBySide();
    }

    stepMemSideBySide() {
      if (this.memStep < this.memRefString.length - 1) {
        this.memStep++;
      } else {
        this.memStep = 0;
      }
      this.renderMemSideBySide();
    }

    renderMemSideBySide() {
      const container = document.getElementById('sideBySidePolicies');
      if (!container) return;

      const policies = ['FIFO', 'LRU', 'Optimal'];
      // Determine winner (least faults)
      const minFaults = Math.min(
        this.memResults.FIFO.totalFaults,
        this.memResults.LRU.totalFaults,
        this.memResults.Optimal.totalFaults
      );

      container.innerHTML = policies.map(p => {
        const res = this.memResults[p];
        const isWinner = res.totalFaults === minFaults;
        const curStep = res.steps[this.memStep] || { frames: [], isFault: false, victim: null, page: '-' };

        return `
          <div class="policy-mini-card ${isWinner ? 'winner' : ''}">
            <div class="policy-mini-title">
              <span>${p}</span>
              <span style="color: ${isWinner ? 'var(--neon-teal)' : 'var(--text-muted)'};">
                ${res.totalFaults} Faults
              </span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-dim); font-family: var(--font-mono);">
              Step ${this.memStep + 1} of ${this.memRefString.length} (Page: ${curStep.page})
            </div>
            <div style="display: flex; gap: 6px; margin: 0.5rem 0;">
              ${Array.from({ length: this.memFramesCount }, (_, idx) => {
                const pg = curStep.frames[idx] !== undefined ? curStep.frames[idx] : '-';
                const isHit = !curStep.isFault && pg === curStep.page;
                const isFault = curStep.isFault && pg === curStep.page;
                let bg = 'rgba(255, 255, 255, 0.05)';
                let border = 'rgba(255, 255, 255, 0.1)';
                if (isHit) { bg = 'rgba(16, 185, 129, 0.3)'; border = 'var(--neon-green)'; }
                if (isFault) { bg = 'rgba(239, 68, 68, 0.3)'; border = 'var(--neon-red)'; }
                return `
                  <div style="flex: 1; height: 36px; display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; background: ${bg}; border: 1px solid ${border}; border-radius: 4px; color: #fff;">
                    ${pg}
                  </div>
                `;
              }).join('')}
            </div>
            <div style="font-size: 0.75rem; font-family: var(--font-mono); color: ${curStep.isFault ? 'var(--neon-magenta)' : 'var(--neon-green)'};">
              ${curStep.isFault ? `Fault (Victim: ${curStep.victim !== null ? curStep.victim : 'none'})` : 'Hit (Zero stall)'}
            </div>
          </div>
        `;
      }).join('');
    }

    // --- Spring Physics Memory Pressure Gauge Animation ---
    startGaugeAnimation() {
      const canvas = document.getElementById('pressureGaugeCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const springK = 0.08;
      const damping = 0.82;

      const renderGauge = () => {
        // Map gaugeValue (0 to 2.5) to angle (-Math.PI * 0.75 to Math.PI * 0.75)
        const clampedVal = Math.min(2.5, Math.max(0, this.gaugeValue));
        const targetAngle = -Math.PI * 0.65 + (clampedVal / 2.5) * (Math.PI * 1.3);

        // Spring acceleration
        const force = (targetAngle - this.needleAngle) * springK;
        this.needleVelocity = (this.needleVelocity + force) * damping;
        this.needleAngle += this.needleVelocity;

        // Draw Gauge
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h * 0.85;
        const radius = Math.min(cx - 20, cy - 15);

        // Outer Arc Zones
        // Green: 0 to 1.0 (clampedVal <= 1.0)
        // Amber: 1.0 to 1.5
        // Red: > 1.5
        const startRad = -Math.PI * 0.82;
        const endRad = Math.PI * -0.18;
        const span = endRad - startRad;

        ctx.lineWidth = 14;
        ctx.lineCap = 'round';

        // Normal zone
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startRad, startRad + span * 0.45);
        ctx.strokeStyle = '#10b981';
        ctx.stroke();

        // Stressed zone
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startRad + span * 0.45, startRad + span * 0.72);
        ctx.strokeStyle = '#ffb703';
        ctx.stroke();

        // Thrashing zone
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startRad + span * 0.72, endRad);
        ctx.strokeStyle = '#ef4444';
        ctx.stroke();

        // Draw Needle
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.needleAngle);

        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.lineTo(0, -radius + 8);
        ctx.lineTo(4, 0);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 245, 212, 0.8)';
        ctx.shadowBlur = 8;
        ctx.fill();

        ctx.restore();

        // Center Pin
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'var(--neon-teal)';
        ctx.fill();

        // Update Text Readout
        const readout = document.getElementById('pressureGaugeReadout');
        const status = document.getElementById('pressureGaugeStatus');
        if (readout) readout.textContent = `${this.gaugeValue.toFixed(2)}x`;
        if (status) {
          if (this.gaugeValue <= 1.0) {
            status.textContent = 'Normal Working Sets';
            status.style.color = 'var(--neon-green)';
          } else if (this.gaugeValue <= 1.5) {
            status.textContent = 'Memory Stressed';
            status.style.color = 'var(--neon-amber)';
          } else {
            status.textContent = 'Thrashing Warning!';
            status.style.color = 'var(--neon-red)';
          }
        }

        requestAnimationFrame(renderGauge);
      };

      renderGauge();
    }

    // Modal / Prompt to add custom job
    promptAddJob() {
      const newId = `J${this.jobs.length + 1}`;
      const name = window.prompt(`Enter Job Name for ${newId}:`, `Inference Model ${newId}`);
      if (!name) return;
      const arrival = parseInt(window.prompt('Arrival Tick (e.g. 0):', '2'), 10) || 0;
      const burst = parseInt(window.prompt('Burst Ticks (e.g. 6):', '5'), 10) || 4;
      const deadline = parseInt(window.prompt('Deadline Tick (e.g. 16):', '16'), 10) || 15;
      const priority = parseInt(window.prompt('Priority (1=High, 5=Low):', '2'), 10) || 2;
      const totalPages = parseInt(window.prompt('Virtual Page Count (e.g. 4):', '4'), 10) || 4;

      this.jobs.push({
        id: newId,
        name: name,
        arrival: arrival,
        burst: burst,
        deadline: deadline,
        priority: priority,
        totalPages: totalPages,
        refString: Array.from({ length: burst }, (_, i) => i % totalPages)
      });

      this.recalculateSimulation();
      this.renderAll();
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  OSSim.SimulatorsController = SimulatorsController;
})(typeof self !== 'undefined' ? self : this);
