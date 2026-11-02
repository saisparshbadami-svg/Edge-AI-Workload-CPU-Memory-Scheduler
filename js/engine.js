/**
 * Edge-AI Workload CPU and Memory Scheduler - Core Engine
 * Zero dependencies, deterministic, verifiable.
 * Student: Sai Sparsh B | Reg. No. 25BTRPW078
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OSSim = root.OSSim || {};
    root.OSSim.Engine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Seeded Pseudo-Random Number Generator (Mulberry32)
  function createPRNG(seed) {
    let s = (seed >>> 0) || 1337;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- Page Replacement Simulation ---
  /**
   * Run page replacement for a single reference string.
   * @param {string} policy - 'FIFO', 'LRU', or 'Optimal'
   * @param {Array<number>} refString - Array of page numbers
   * @param {number} numFrames - Number of physical frames available
   * @returns {Object} Simulation trace and metric summary
   */
  function runPageReplacement(policy, refString, numFrames) {
    if (!refString || refString.length === 0 || numFrames <= 0) {
      return { totalFaults: 0, totalHits: 0, faultRate: 0, steps: [] };
    }

    const frames = []; // Array of { page, loadTime, lastUsed }
    const steps = [];
    let faults = 0;
    let hits = 0;

    for (let i = 0; i < refString.length; i++) {
      const page = refString[i];
      const existingIdx = frames.findIndex(f => f.page === page);

      if (existingIdx !== -1) {
        // HIT
        hits++;
        frames[existingIdx].lastUsed = i;
        steps.push({
          step: i,
          page: page,
          isFault: false,
          victim: null,
          frames: frames.map(f => f.page),
          framesFull: frames.map(f => ({ ...f }))
        });
      } else {
        // FAULT
        faults++;
        let victim = null;

        if (frames.length < numFrames) {
          // Free frame available
          frames.push({ page: page, loadTime: i, lastUsed: i });
        } else {
          // Eviction needed
          let evictIdx = 0;

          if (policy === 'FIFO') {
            // Evict earliest loaded page
            let earliestLoad = frames[0].loadTime;
            for (let j = 1; j < frames.length; j++) {
              if (frames[j].loadTime < earliestLoad) {
                earliestLoad = frames[j].loadTime;
                evictIdx = j;
              }
            }
          } else if (policy === 'LRU') {
            // Evict least recently used page
            let leastRecent = frames[0].lastUsed;
            for (let j = 1; j < frames.length; j++) {
              if (frames[j].lastUsed < leastRecent) {
                leastRecent = frames[j].lastUsed;
                evictIdx = j;
              }
            }
          } else if (policy === 'Optimal') {
            // Belady's MIN: Evict page with furthest next reference
            let maxDistance = -1;
            for (let j = 0; j < frames.length; j++) {
              const p = frames[j].page;
              let nextUse = -1;
              for (let k = i + 1; k < refString.length; k++) {
                if (refString[k] === p) {
                  nextUse = k;
                  break;
                }
              }
              if (nextUse === -1) {
                // Not referenced again: infinite distance!
                maxDistance = Infinity;
                evictIdx = j;
                break; // Highest eviction priority
              } else if (nextUse > maxDistance) {
                maxDistance = nextUse;
                evictIdx = j;
              }
            }
          }

          victim = frames[evictIdx].page;
          frames[evictIdx] = { page: page, loadTime: i, lastUsed: i };
        }

        steps.push({
          step: i,
          page: page,
          isFault: true,
          victim: victim,
          frames: frames.map(f => f.page),
          framesFull: frames.map(f => ({ ...f }))
        });
      }
    }

    return {
      policy: policy,
      numFrames: numFrames,
      totalReferences: refString.length,
      totalFaults: faults,
      totalHits: hits,
      faultRate: faults / refString.length,
      hitRate: hits / refString.length,
      steps: steps
    };
  }

  // --- Frame Allocation Strategies ---
  /**
   * Allocate frames to active jobs based on strategy.
   * @param {string} strategy - 'Equal', 'Proportional', or 'Priority'
   * @param {Array<Object>} jobs - List of active jobs with { id, totalPages, priority }
   * @param {number} totalFrames - Total physical frames available
   * @returns {Object} Map of jobId -> allocated frame count
   */
  function allocateFrames(strategy, jobs, totalFrames) {
    const allocation = {};
    if (!jobs || jobs.length === 0 || totalFrames <= 0) return allocation;

    const n = jobs.length;

    if (strategy === 'Equal') {
      const base = Math.max(1, Math.floor(totalFrames / n));
      let remainder = totalFrames - (base * n);
      for (const job of jobs) {
        let extra = 0;
        if (remainder > 0) {
          extra = 1;
          remainder--;
        }
        allocation[job.id] = base + extra;
      }
    } else if (strategy === 'Proportional') {
      const sumPages = jobs.reduce((sum, j) => sum + (j.totalPages || 4), 0);
      let allocatedTotal = 0;
      for (const job of jobs) {
        const share = Math.max(1, Math.floor(totalFrames * ((job.totalPages || 4) / (sumPages || 1))));
        allocation[job.id] = share;
        allocatedTotal += share;
      }
      // Distribute any remaining or handle overflow
      let diff = totalFrames - allocatedTotal;
      if (diff > 0) {
        for (let i = 0; i < jobs.length && diff > 0; i++) {
          allocation[jobs[i].id] += 1;
          diff--;
        }
      } else if (diff < 0) {
        for (let i = jobs.length - 1; i >= 0 && diff < 0; i--) {
          if (allocation[jobs[i].id] > 1) {
            allocation[jobs[i].id] -= 1;
            diff++;
          }
        }
      }
    } else if (strategy === 'Priority') {
      // Lower number = higher priority. Weight = (6 - priority) clamped >= 1
      const weights = jobs.map(j => Math.max(1, 6 - (j.priority || 3)));
      const sumWeight = weights.reduce((a, b) => a + b, 0);
      let allocatedTotal = 0;
      for (let i = 0; i < jobs.length; i++) {
        const share = Math.max(1, Math.floor(totalFrames * (weights[i] / sumWeight)));
        allocation[jobs[i].id] = share;
        allocatedTotal += share;
      }
      let diff = totalFrames - allocatedTotal;
      if (diff > 0) {
        // Give leftover frames to highest priority jobs first
        const sorted = [...jobs].sort((a, b) => (a.priority || 3) - (b.priority || 3));
        for (let i = 0; i < sorted.length && diff > 0; i++) {
          allocation[sorted[i].id] += 1;
          diff--;
        }
      } else if (diff < 0) {
        // Take frames from lowest priority jobs first
        const sorted = [...jobs].sort((a, b) => (b.priority || 3) - (a.priority || 3));
        for (let i = 0; i < sorted.length && diff < 0; i++) {
          if (allocation[sorted[i].id] > 1) {
            allocation[sorted[i].id] -= 1;
            diff++;
          }
        }
      }
    }

    return allocation;
  }

  // --- Combined Integrated Simulation Engine ---
  /**
   * Run full discrete tick simulation with CPU scheduler and Virtual Memory.
   * @param {Object} options Configuration parameters:
   *   - jobs: Array of job objects
   *   - scheduler: 'FCFS' | 'SJF' | 'Round Robin' | 'Priority' | 'EDF'
   *   - quantum: number (for Round Robin)
   *   - aging: boolean (for Priority)
   *   - agingInterval: number (ticks waiting to improve priority)
   *   - totalFrames: number of physical frames
   *   - allocationStrategy: 'Equal' | 'Proportional' | 'Priority'
   *   - replacementPolicy: 'FIFO' | 'LRU' | 'Optimal'
   *   - faultPenalty: number of ticks CPU stalls on page fault (default: 2)
   *   - maxTicks: maximum ticks to simulate (guard against infinite loops)
   */
  function simulateSystem(options) {
    const {
      jobs: inputJobs = [],
      scheduler = 'EDF',
      quantum = 3,
      aging = false,
      agingInterval = 4,
      totalFrames = 12,
      allocationStrategy = 'Proportional',
      replacementPolicy = 'LRU',
      faultPenalty = 2,
      maxTicks = 500
    } = options;

    // Deep clone jobs and initialize runtime state
    const jobs = inputJobs.map(j => ({
      id: j.id,
      name: j.name || j.id,
      arrival: j.arrival,
      burst: j.burst,
      deadline: j.deadline,
      priority: j.priority || 3,
      effectivePriority: j.priority || 3,
      totalPages: j.totalPages || 4,
      refString: (j.refString && j.refString.length > 0)
        ? [...j.refString]
        : Array.from({ length: j.burst }, (_, i) => i % (j.totalPages || 4)),
      remainingBurst: j.burst,
      executedTicks: 0,
      firstRunTick: null,
      finishTick: null,
      missedDeadline: false,
      waitingTicks: 0,
      turnaroundTicks: null,
      responseTime: null,
      pageFaults: 0,
      pageHits: 0,
      frames: [], // currently resident pages in allocated frames: [{ page, loadTick, lastAccessTick }]
      allocatedFramesCount: 1,
      stallRemaining: 0,
      stalledForPage: null
    }));

    // Precalculate initial frame allocations
    const initialAllocation = allocateFrames(allocationStrategy, jobs, totalFrames);
    for (const j of jobs) {
      j.allocatedFramesCount = initialAllocation[j.id] || 1;
    }

    const timeline = []; // Per tick record: { tick, jobId, type: 'exec'|'stall'|'idle', page, hit, victim, readyQueue, runningJob }
    let currentJob = null;
    let currentSlice = 0;
    const readyQueue = [];
    const completedJobs = [];
    let tick = 0;
    let totalFaults = 0;
    let totalHits = 0;
    let busyTicks = 0;
    let stallTicks = 0;

    // Helper: update dynamic frame allocation among ready + running jobs
    function refreshAllocations() {
      const activeJobs = jobs.filter(j => j.remainingBurst > 0 && j.arrival <= tick);
      if (activeJobs.length > 0) {
        const alloc = allocateFrames(allocationStrategy, activeJobs, totalFrames);
        for (const j of activeJobs) {
          j.allocatedFramesCount = alloc[j.id] || 1;
          // Trim frames if allocation shrunk
          while (j.frames.length > j.allocatedFramesCount) {
            j.frames.shift();
          }
        }
      }
    }

    while (completedJobs.length < jobs.length && tick < maxTicks) {
      // 1. Check newly arrived jobs at this tick
      for (const j of jobs) {
        if (j.arrival === tick && !readyQueue.includes(j) && j !== currentJob && j.remainingBurst > 0) {
          readyQueue.push(j);
        }
      }

      // 2. Handle aging for Priority scheduler
      if (scheduler === 'Priority' && aging) {
        for (const rj of readyQueue) {
          if ((tick - rj.arrival) > 0 && (tick - rj.arrival) % agingInterval === 0) {
            if (rj.effectivePriority > 1) {
              rj.effectivePriority -= 1; // 1 is highest priority
            }
          }
        }
      }

      refreshAllocations();

      // 3. Scheduling decision:
      // Check if currentJob is finished
      if (currentJob && currentJob.remainingBurst === 0 && currentJob.stallRemaining === 0) {
        currentJob.finishTick = tick;
        currentJob.turnaroundTicks = tick - currentJob.arrival;
        currentJob.waitingTicks = currentJob.turnaroundTicks - currentJob.burst;
        currentJob.missedDeadline = tick > currentJob.deadline;
        completedJobs.push(currentJob);
        currentJob = null;
        currentSlice = 0;
      }

      // Check preemption or selection
      if (scheduler === 'EDF') {
        // Preemptive Earliest Deadline First:
        // Include currentJob in candidate pool if not currently in a fault stall
        if (currentJob && currentJob.stallRemaining === 0) {
          readyQueue.push(currentJob);
          currentJob = null;
        }
        if (!currentJob && readyQueue.length > 0) {
          // Sort by deadline ascending, tie-break by arrival then id
          readyQueue.sort((a, b) => {
            if (a.deadline !== b.deadline) return a.deadline - b.deadline;
            if (a.arrival !== b.arrival) return a.arrival - b.arrival;
            return a.id.localeCompare(b.id);
          });
          currentJob = readyQueue.shift();
        }
      } else if (scheduler === 'Round Robin') {
        // If quantum reached, preempt currentJob to back of readyQueue
        if (currentJob && currentJob.stallRemaining === 0 && currentSlice >= quantum) {
          readyQueue.push(currentJob);
          currentJob = null;
          currentSlice = 0;
        }
        if (!currentJob && readyQueue.length > 0) {
          currentJob = readyQueue.shift();
          currentSlice = 0;
        }
      } else if (scheduler === 'SJF') {
        // Non-preemptive Shortest Job First
        if (!currentJob && readyQueue.length > 0) {
          readyQueue.sort((a, b) => {
            if (a.burst !== b.burst) return a.burst - b.burst;
            if (a.arrival !== b.arrival) return a.arrival - b.arrival;
            return a.id.localeCompare(b.id);
          });
          currentJob = readyQueue.shift();
        }
      } else if (scheduler === 'Priority') {
        // Non-preemptive Priority (with effectivePriority)
        if (!currentJob && readyQueue.length > 0) {
          readyQueue.sort((a, b) => {
            if (a.effectivePriority !== b.effectivePriority) return a.effectivePriority - b.effectivePriority;
            if (a.arrival !== b.arrival) return a.arrival - b.arrival;
            return a.id.localeCompare(b.id);
          });
          currentJob = readyQueue.shift();
        }
      } else {
        // FCFS: Non-preemptive
        if (!currentJob && readyQueue.length > 0) {
          readyQueue.sort((a, b) => {
            if (a.arrival !== b.arrival) return a.arrival - b.arrival;
            return a.id.localeCompare(b.id);
          });
          currentJob = readyQueue.shift();
        }
      }

      // 4. Execute Tick
      if (!currentJob) {
        // CPU Idle
        timeline.push({
          tick: tick,
          type: 'idle',
          jobId: null,
          page: null,
          hit: false,
          victim: null,
          stallRemaining: 0,
          readyQueue: readyQueue.map(j => j.id),
          framesSnapshot: {}
        });
      } else {
        // Record first response tick
        if (currentJob.firstRunTick === null) {
          currentJob.firstRunTick = tick;
          currentJob.responseTime = tick - currentJob.arrival;
        }

        // Check if currently resolving a page-fault stall
        if (currentJob.stallRemaining > 0) {
          stallTicks++;
          currentJob.stallRemaining--;
          timeline.push({
            tick: tick,
            type: 'stall',
            jobId: currentJob.id,
            page: currentJob.stalledForPage,
            hit: false,
            victim: null,
            stallRemaining: currentJob.stallRemaining,
            readyQueue: readyQueue.map(j => j.id),
            framesSnapshot: getFramesSnapshot(jobs)
          });

          // If stall finished at this tick, page is now resident
          if (currentJob.stallRemaining === 0) {
            currentJob.stalledForPage = null;
          }
        } else {
          // Job executes a regular CPU tick: look up required page reference
          const refIndex = currentJob.executedTicks % currentJob.refString.length;
          const reqPage = currentJob.refString[refIndex];

          const residentIdx = currentJob.frames.findIndex(f => f.page === reqPage);

          if (residentIdx !== -1) {
            // PAGE HIT: Zero stall, execute burst
            totalHits++;
            busyTicks++;
            currentJob.pageHits++;
            currentJob.frames[residentIdx].lastAccessTick = tick;

            currentJob.executedTicks++;
            currentJob.remainingBurst--;
            currentSlice++;

            timeline.push({
              tick: tick,
              type: 'exec',
              jobId: currentJob.id,
              page: reqPage,
              hit: true,
              victim: null,
              stallRemaining: 0,
              readyQueue: readyQueue.map(j => j.id),
              framesSnapshot: getFramesSnapshot(jobs)
            });
          } else {
            // PAGE FAULT: Page must be loaded into memory
            totalFaults++;
            currentJob.pageFaults++;

            let victimPage = null;
            const maxF = currentJob.allocatedFramesCount;

            if (currentJob.frames.length < maxF) {
              currentJob.frames.push({ page: reqPage, loadTick: tick, lastAccessTick: tick });
            } else {
              // Eviction
              let evictIdx = 0;
              if (replacementPolicy === 'FIFO') {
                let oldest = currentJob.frames[0].loadTick;
                for (let k = 1; k < currentJob.frames.length; k++) {
                  if (currentJob.frames[k].loadTick < oldest) {
                    oldest = currentJob.frames[k].loadTick;
                    evictIdx = k;
                  }
                }
              } else if (replacementPolicy === 'LRU') {
                let least = currentJob.frames[0].lastAccessTick;
                for (let k = 1; k < currentJob.frames.length; k++) {
                  if (currentJob.frames[k].lastAccessTick < least) {
                    least = currentJob.frames[k].lastAccessTick;
                    evictIdx = k;
                  }
                }
              } else if (replacementPolicy === 'Optimal') {
                let maxDist = -1;
                for (let k = 0; k < currentJob.frames.length; k++) {
                  const p = currentJob.frames[k].page;
                  let nextDist = Infinity;
                  // Look ahead in remaining ref string
                  for (let off = 1; off < currentJob.burst - currentJob.executedTicks; off++) {
                    const nextRef = currentJob.refString[(currentJob.executedTicks + off) % currentJob.refString.length];
                    if (nextRef === p) {
                      nextDist = off;
                      break;
                    }
                  }
                  if (nextDist === Infinity) {
                    evictIdx = k;
                    break;
                  } else if (nextDist > maxDist) {
                    maxDist = nextDist;
                    evictIdx = k;
                  }
                }
              }

              victimPage = currentJob.frames[evictIdx].page;
              currentJob.frames[evictIdx] = { page: reqPage, loadTick: tick, lastAccessTick: tick };
            }

            if (faultPenalty > 0) {
              // Stall penalty counts as CPU time
              stallTicks++;
              currentJob.stallRemaining = faultPenalty - 1; // this tick counts as 1st stall tick
              currentJob.stalledForPage = reqPage;

              timeline.push({
                tick: tick,
                type: 'stall',
                jobId: currentJob.id,
                page: reqPage,
                hit: false,
                victim: victimPage,
                stallRemaining: currentJob.stallRemaining,
                readyQueue: readyQueue.map(j => j.id),
                framesSnapshot: getFramesSnapshot(jobs)
              });
            } else {
              // Zero penalty: immediately execute burst
              busyTicks++;
              currentJob.executedTicks++;
              currentJob.remainingBurst--;
              currentSlice++;

              timeline.push({
                tick: tick,
                type: 'exec',
                jobId: currentJob.id,
                page: reqPage,
                hit: false,
                victim: victimPage,
                stallRemaining: 0,
                readyQueue: readyQueue.map(j => j.id),
                framesSnapshot: getFramesSnapshot(jobs)
              });
            }
          }
        }
      }

      tick++;
    }

    // Finish any remaining incomplete jobs at simulation boundary
    for (const j of jobs) {
      if (j.remainingBurst > 0 && j.finishTick === null) {
        j.finishTick = tick;
        j.turnaroundTicks = tick - j.arrival;
        j.waitingTicks = Math.max(0, j.turnaroundTicks - j.burst);
        j.missedDeadline = true;
      }
    }

    // Calculate aggregated metrics
    const totalJobs = jobs.length;
    const completedCount = jobs.filter(j => j.remainingBurst === 0).length;
    const deadlineMisses = jobs.filter(j => j.missedDeadline).length;
    const deadlineMissRate = totalJobs > 0 ? (deadlineMisses / totalJobs) : 0;

    const avgResponse = totalJobs > 0
      ? (jobs.reduce((sum, j) => sum + (j.responseTime !== null ? j.responseTime : 0), 0) / totalJobs)
      : 0;

    const avgTurnaround = totalJobs > 0
      ? (jobs.reduce((sum, j) => sum + (j.turnaroundTicks !== null ? j.turnaroundTicks : 0), 0) / totalJobs)
      : 0;

    const avgWaiting = totalJobs > 0
      ? (jobs.reduce((sum, j) => sum + (j.waitingTicks !== null ? j.waitingTicks : 0), 0) / totalJobs)
      : 0;

    const totalElapsedTicks = Math.max(1, tick);
    const cpuUtilisation = (busyTicks + stallTicks) / totalElapsedTicks;

    const totalPageDemand = jobs.reduce((sum, j) => sum + (j.totalPages || 4), 0);
    const memoryPressure = totalFrames > 0 ? (totalPageDemand / totalFrames) : 1;

    const totalReferences = totalFaults + totalHits;
    const faultRate = totalReferences > 0 ? (totalFaults / totalReferences) : 0;

    return {
      scheduler,
      allocationStrategy,
      replacementPolicy,
      quantum,
      aging,
      totalFrames,
      faultPenalty,
      totalTicks: tick,
      busyTicks,
      stallTicks,
      cpuUtilisation: Math.min(1.0, Math.max(0.0, cpuUtilisation)),
      totalFaults,
      totalHits,
      faultRate,
      memoryPressure,
      totalJobs,
      completedCount,
      deadlineMisses,
      deadlineMissRate,
      avgResponse,
      avgTurnaround,
      avgWaiting,
      jobs: jobs.map(j => ({
        id: j.id,
        name: j.name,
        arrival: j.arrival,
        burst: j.burst,
        deadline: j.deadline,
        priority: j.priority,
        totalPages: j.totalPages,
        firstRunTick: j.firstRunTick,
        finishTick: j.finishTick,
        responseTime: j.responseTime,
        turnaroundTicks: j.turnaroundTicks,
        waitingTicks: j.waitingTicks,
        missedDeadline: j.missedDeadline,
        pageFaults: j.pageFaults,
        pageHits: j.pageHits,
        allocatedFramesCount: j.allocatedFramesCount
      })),
      timeline
    };
  }

  function getFramesSnapshot(jobs) {
    const snap = {};
    for (const j of jobs) {
      snap[j.id] = (j.frames || []).map(f => f.page);
    }
    return snap;
  }

  // --- Generate Page Reference String with Locality ---
  /**
   * Generates reference string with 80/20 locality principle.
   */
  function generateReferenceString(length, numUniquePages, localityFactor, seed) {
    const prng = createPRNG(seed || 42);
    const refs = [];
    const workingSetSize = Math.max(1, Math.floor(numUniquePages * 0.4));
    let workingSet = Array.from({ length: workingSetSize }, (_, i) => i);

    for (let i = 0; i < length; i++) {
      // Periodically shift the active working set (phase change)
      if (i > 0 && i % 12 === 0) {
        const offset = Math.floor(prng() * (numUniquePages - workingSetSize + 1));
        workingSet = Array.from({ length: workingSetSize }, (_, k) => (offset + k) % numUniquePages);
      }

      if (prng() < localityFactor) {
        // High probability: reference from active working set
        const idx = Math.floor(prng() * workingSet.length);
        refs.push(workingSet[idx]);
      } else {
        // Low probability: random page across full space
        refs.push(Math.floor(prng() * numUniquePages));
      }
    }
    return refs;
  }

  // --- Ledger: Evaluate All 45 Combinations ---
  const SCHEDULERS = ['FCFS', 'SJF', 'Round Robin', 'Priority', 'EDF'];
  const ALLOCATIONS = ['Equal', 'Proportional', 'Priority'];
  const REPLACEMENTS = ['FIFO', 'LRU', 'Optimal'];

  function evaluateAllCombinations(jobs, config = {}) {
    const results = [];
    const totalFrames = config.totalFrames || 12;
    const quantum = config.quantum || 3;
    const faultPenalty = config.faultPenalty !== undefined ? config.faultPenalty : 2;
    const aging = config.aging || false;

    for (const sched of SCHEDULERS) {
      for (const alloc of ALLOCATIONS) {
        for (const repl of REPLACEMENTS) {
          const sim = simulateSystem({
            jobs: jobs,
            scheduler: sched,
            allocationStrategy: alloc,
            replacementPolicy: repl,
            quantum: quantum,
            aging: aging,
            totalFrames: totalFrames,
            faultPenalty: faultPenalty
          });

          results.push({
            id: `${sched}__${alloc}__${repl}`,
            scheduler: sched,
            allocation: alloc,
            replacement: repl,
            deadlineMisses: sim.deadlineMisses,
            deadlineMissRate: sim.deadlineMissRate,
            avgResponse: sim.avgResponse,
            avgWaiting: sim.avgWaiting,
            avgTurnaround: sim.avgTurnaround,
            totalFaults: sim.totalFaults,
            faultRate: sim.faultRate,
            cpuUtilisation: sim.cpuUtilisation,
            totalTicks: sim.totalTicks,
            simData: sim
          });
        }
      }
    }

    return results;
  }

  /**
   * Rank combinations using weighted score.
   * Lower score is better: penalty formula.
   * Weights: { misses: 40, response: 25, faults: 25, cpu: 10 }
   */
  function rankCombinations(combinations, weights = {}) {
    const wMisses = weights.misses !== undefined ? weights.misses : 40;
    const wResponse = weights.response !== undefined ? weights.response : 25;
    const wFaults = weights.faults !== undefined ? weights.faults : 25;
    const wCpu = weights.cpu !== undefined ? weights.cpu : 10;

    // Find min and max for normalization
    let maxMisses = 1, maxResponse = 1, maxFaults = 1;
    for (const c of combinations) {
      if (c.deadlineMisses > maxMisses) maxMisses = c.deadlineMisses;
      if (c.avgResponse > maxResponse) maxResponse = c.avgResponse;
      if (c.totalFaults > maxFaults) maxFaults = c.totalFaults;
    }

    const scored = combinations.map(c => {
      const normMisses = c.deadlineMisses / (maxMisses || 1);
      const normResponse = c.avgResponse / (maxResponse || 1);
      const normFaults = c.totalFaults / (maxFaults || 1);
      const normCpuPenalty = (1.0 - c.cpuUtilisation); // Idle CPU is penalized

      // Penalty score: lower is better
      const penalty = (normMisses * wMisses) +
                      (normResponse * wResponse) +
                      (normFaults * wFaults) +
                      (normCpuPenalty * wCpu);

      // Score on 0-100 scale: 100 is best
      const totalWeight = (wMisses + wResponse + wFaults + wCpu) || 100;
      const score = Math.max(0, 100 - ((penalty / totalWeight) * 100));

      return {
        ...c,
        penaltyScore: penalty,
        score: Math.round(score * 10) / 10
      };
    });

    // Sort descending by score (lowest penalty first)
    scored.sort((a, b) => b.score - a.score || a.deadlineMisses - b.deadlineMisses || a.totalFaults - b.totalFaults);

    // Identify ties
    const topScore = scored[0] ? scored[0].score : 0;
    const tiedWinners = scored.filter(c => Math.abs(c.score - topScore) < 0.001);

    return {
      ranked: scored,
      topScore,
      tiedWinners,
      hasTie: tiedWinners.length > 1
    };
  }

  // --- Presets ---
  const PRESETS = {
    'smart-camera': {
      name: 'Smart Camera',
      description: 'Edge computer vision pipeline with real-time YOLOv8 detector, tracking, and video stream buffering.',
      totalFrames: 10,
      faultPenalty: 2,
      jobs: [
        { id: 'J1', name: 'YOLOv8 Detection', arrival: 0, burst: 8, deadline: 20, priority: 1, totalPages: 5, refString: [0, 1, 2, 3, 0, 1, 4, 0, 1, 2, 3, 4] },
        { id: 'J2', name: 'MobileNet Tracking', arrival: 2, burst: 6, deadline: 18, priority: 2, totalPages: 4, refString: [0, 1, 2, 0, 1, 3, 0, 1, 2, 3] },
        { id: 'J3', name: 'Buffer Flush', arrival: 1, burst: 8, deadline: 28, priority: 4, totalPages: 6, refString: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5] },
        { id: 'J4', name: 'Optical Flow', arrival: 4, burst: 5, deadline: 24, priority: 3, totalPages: 5, refString: [2, 3, 4, 2, 3, 0, 1, 2] }
      ]
    },
    'voice-assistant': {
      name: 'Voice Assistant',
      description: 'Audio speech pipeline: ultra-fast wake word detector + heavy Whisper transcription.',
      totalFrames: 12,
      faultPenalty: 2,
      jobs: [
        { id: 'J1', name: 'Wake Word KWS', arrival: 0, burst: 3, deadline: 6, priority: 1, totalPages: 3, refString: [0, 1, 2, 0, 1, 2] },
        { id: 'J2', name: 'Whisper ASR', arrival: 2, burst: 10, deadline: 32, priority: 3, totalPages: 8, refString: [0, 3, 4, 5, 6, 7, 1, 2, 5, 6] },
        { id: 'J3', name: 'Intent BERT', arrival: 4, burst: 4, deadline: 16, priority: 2, totalPages: 4, refString: [1, 2, 3, 1, 2, 0] },
        { id: 'J4', name: 'TTS Synthesizer', arrival: 6, burst: 5, deadline: 24, priority: 2, totalPages: 5, refString: [2, 0, 4, 1, 3] }
      ]
    },
    'quiet-night': {
      name: 'Quiet Night',
      description: 'Lightly loaded system with total utilization <= 1.0; EDF achieves 0 deadline misses.',
      totalFrames: 14,
      faultPenalty: 0,
      jobs: [
        { id: 'J1', name: 'Sensor Polling', arrival: 0, burst: 3, deadline: 10, priority: 2, totalPages: 3, refString: [0, 1, 2, 0] },
        { id: 'J2', name: 'Telemetry Ping', arrival: 4, burst: 2, deadline: 14, priority: 3, totalPages: 2, refString: [0, 1] },
        { id: 'J3', name: 'Heartbeat Check', arrival: 7, burst: 2, deadline: 18, priority: 1, totalPages: 3, refString: [1, 2] },
        { id: 'J4', name: 'Log Archival', arrival: 10, burst: 4, deadline: 25, priority: 4, totalPages: 4, refString: [0, 2, 3, 1] }
      ]
    },
    'rush-hour': {
      name: 'Rush Hour',
      description: 'Overloaded system where EDF clearly outperforms FCFS on deadline misses, while Round Robin provides best initial response.',
      totalFrames: 10,
      faultPenalty: 0,
      jobs: [
        { id: 'J1', name: 'Heavy Batch Conv', arrival: 0, burst: 14, deadline: 30, priority: 3, totalPages: 5, refString: [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1, 2, 3] },
        { id: 'J2', name: 'Emergency Brake', arrival: 1, burst: 3, deadline: 5, priority: 1, totalPages: 3, refString: [0, 1, 2] },
        { id: 'J3', name: 'Collision Avoid', arrival: 2, burst: 4, deadline: 8, priority: 1, totalPages: 4, refString: [1, 2, 3, 0] },
        { id: 'J4', name: 'Pedestrian Radar', arrival: 5, burst: 4, deadline: 11, priority: 1, totalPages: 3, refString: [0, 1, 2, 0] },
        { id: 'J5', name: 'Lane Trajectory', arrival: 6, burst: 5, deadline: 15, priority: 2, totalPages: 4, refString: [0, 2, 1, 3, 0] }
      ]
    },
    'tight-memory': {
      name: 'Tight Memory',
      description: 'Strict 7-frame physical budget with looped working sets, yielding Optimal < LRU < FIFO distinctly.',
      totalFrames: 7,
      faultPenalty: 3,
      jobs: [
        { id: 'J1', name: 'Deep Feature Extr', arrival: 0, burst: 8, deadline: 25, priority: 2, totalPages: 6, refString: [0, 1, 2, 3, 0, 1, 4, 0, 1, 2, 5, 0] },
        { id: 'J2', name: 'Temporal Attention', arrival: 1, burst: 7, deadline: 24, priority: 1, totalPages: 5, refString: [1, 2, 3, 1, 4, 2, 3, 0, 1, 2] },
        { id: 'J3', name: 'Transformer Block', arrival: 2, burst: 9, deadline: 30, priority: 3, totalPages: 7, refString: [2, 3, 4, 5, 2, 3, 6, 1, 2, 4] }
      ]
    }
  };

  // --- Suite of Correctness Verifications ---
  function runVerifications() {
    const results = [];

    // Test 1: Classic Reference String (7,0,1,2,0,3,0,4,2,3,0,3,2,1,2,0,1,7,0,1 with 3 frames)
    const classicStr = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
    const fifoClassic = runPageReplacement('FIFO', classicStr, 3);
    const lruClassic = runPageReplacement('LRU', classicStr, 3);
    const optClassic = runPageReplacement('Optimal', classicStr, 3);

    const t1Pass = (fifoClassic.totalFaults === 15) &&
                   (lruClassic.totalFaults === 12) &&
                   (optClassic.totalFaults === 9);

    results.push({
      id: 'classic-string',
      name: 'Classic Page Replacement (Silberschatz/Tanenbaum Reference)',
      desc: 'String 7,0,1,2,0,3,0,4,2,3,0,3,2,1,2,0,1,7,0,1 with 3 frames must yield FIFO=15, LRU=12, Optimal=9 faults.',
      passed: t1Pass,
      details: {
        expected: 'FIFO: 15, LRU: 12, Optimal: 9',
        actual: `FIFO: ${fifoClassic.totalFaults}, LRU: ${lruClassic.totalFaults}, Optimal: ${optClassic.totalFaults}`
      }
    });

    // Test 2: Belady's Anomaly String (1,2,3,4,1,2,5,1,2,3,4,5)
    const beladyStr = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
    const fifo3 = runPageReplacement('FIFO', beladyStr, 3);
    const fifo4 = runPageReplacement('FIFO', beladyStr, 4);
    const lru3 = runPageReplacement('LRU', beladyStr, 3);
    const lru4 = runPageReplacement('LRU', beladyStr, 4);
    const opt3 = runPageReplacement('Optimal', beladyStr, 3);
    const opt4 = runPageReplacement('Optimal', beladyStr, 4);

    const t2Pass = (fifo3.totalFaults === 9) &&
                   (fifo4.totalFaults === 10) &&
                   (lru3.totalFaults === 10) &&
                   (lru4.totalFaults === 8) &&
                   (opt3.totalFaults === 7) &&
                   (opt4.totalFaults === 6);

    results.push({
      id: 'belady-anomaly',
      name: "Belady's Anomaly Verification (FIFO fault increase with more frames)",
      desc: 'String 1,2,3,4,1,2,5,1,2,3,4,5: FIFO 9 (3f) -> 10 (4f); LRU 10 -> 8; Optimal 7 -> 6.',
      passed: t2Pass,
      details: {
        expected: 'FIFO: 9 -> 10 (Anomaly!), LRU: 10 -> 8, Optimal: 7 -> 6',
        actual: `FIFO: ${fifo3.totalFaults} -> ${fifo4.totalFaults}, LRU: ${lru3.totalFaults} -> ${lru4.totalFaults}, Optimal: ${opt3.totalFaults} -> ${opt4.totalFaults}`
      }
    });

    // Test 3: EDF Optimality under utilization <= 1.0
    // Quiet night preset has total busy ticks = 11 across time span 25, zero fault penalty.
    const edfSim = simulateSystem({
      jobs: PRESETS['quiet-night'].jobs,
      scheduler: 'EDF',
      totalFrames: 14,
      faultPenalty: 0
    });
    const t3Pass = (edfSim.deadlineMisses === 0);

    results.push({
      id: 'edf-optimality',
      name: 'EDF Feasibility Theorem (U <= 1.0)',
      desc: 'Earliest Deadline First with total utilization <= 1.0 and zero fault penalty yields zero deadline misses.',
      passed: t3Pass,
      details: {
        expected: 'Deadline Misses: 0',
        actual: `Deadline Misses: ${edfSim.deadlineMisses} (Total ticks: ${edfSim.totalTicks})`
      }
    });

    // Test 4: Invariant Check: Optimal faults <= LRU faults and Optimal <= FIFO faults
    let invariantHolds = true;
    const testCases = [
      { str: [0, 1, 2, 3, 0, 1, 4, 0, 1, 2, 3, 4], frames: 3 },
      { str: [2, 3, 2, 1, 5, 2, 4, 5, 3, 2, 5, 2], frames: 3 },
      { str: [1, 2, 3, 4, 2, 1, 5, 6, 2, 1, 2, 3, 7, 6, 3, 2, 1, 2, 3, 6], frames: 4 }
    ];
    for (const tc of testCases) {
      const f = runPageReplacement('FIFO', tc.str, tc.frames).totalFaults;
      const l = runPageReplacement('LRU', tc.str, tc.frames).totalFaults;
      const o = runPageReplacement('Optimal', tc.str, tc.frames).totalFaults;
      if (o > l || o > f) {
        invariantHolds = false;
        break;
      }
    }

    results.push({
      id: 'optimal-lower-bound',
      name: "Belady's MIN Optimal Lower Bound Invariant",
      desc: 'For any reference sequence and frame size, Optimal faults <= LRU faults and Optimal faults <= FIFO faults.',
      passed: invariantHolds,
      details: {
        expected: 'Optimal <= LRU and Optimal <= FIFO across test suites',
        actual: invariantHolds ? 'Invariant holds for all test sequences' : 'Violation detected'
      }
    });

    // Test 5: Determinism and Seed Repeatability
    const prng1 = createPRNG(4242);
    const prng2 = createPRNG(4242);
    let deterministic = true;
    for (let k = 0; k < 100; k++) {
      if (prng1() !== prng2()) {
        deterministic = false;
        break;
      }
    }
    // Also check that no NaN or negative metrics exist in preset evaluations
    const testSim = simulateSystem({ jobs: PRESETS['smart-camera'].jobs, scheduler: 'Round Robin' });
    const noNaN = !isNaN(testSim.avgResponse) && !isNaN(testSim.avgWaiting) &&
                  !isNaN(testSim.avgTurnaround) && !isNaN(testSim.cpuUtilisation) &&
                  testSim.avgResponse >= 0 && testSim.avgWaiting >= 0 &&
                  testSim.avgTurnaround >= 0 && testSim.cpuUtilisation >= 0;

    results.push({
      id: 'determinism-cleanliness',
      name: 'Deterministic PRNG & Safe Metric Invariants',
      desc: 'Identical seed reproduces identical output; no NaN, null, or negative metrics produced in simulation.',
      passed: deterministic && noNaN,
      details: {
        expected: 'PRNG deterministic: true; No NaN/Negative metrics: true',
        actual: `PRNG deterministic: ${deterministic}; Clean metrics: ${noNaN}`
      }
    });

    return results;
  }

  return {
    createPRNG,
    runPageReplacement,
    allocateFrames,
    simulateSystem,
    generateReferenceString,
    evaluateAllCombinations,
    rankCombinations,
    runVerifications,
    SCHEDULERS,
    ALLOCATIONS,
    REPLACEMENTS,
    PRESETS
  };
}));
