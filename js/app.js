/**
 * Main Application Orchestrator
 * Hero animations, interactive checklist, code viewer, verification modal, smooth scroll.
 * Student: Sai Sparsh B | Reg. No. 25BTRPW078
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Subsystems
    if (OSSim.SimulatorsController) {
      OSSim.simController = new OSSim.SimulatorsController();
    }
    if (OSSim.DashboardController) {
      OSSim.Dashboard = new OSSim.DashboardController();
      // Connect initial simulation state
      if (OSSim.simController) {
        OSSim.Dashboard.onSimulationUpdated(OSSim.simController.jobs, {
          totalFrames: OSSim.simController.totalFrames,
          quantum: OSSim.simController.quantum,
          faultPenalty: OSSim.simController.faultPenalty,
          aging: OSSim.simController.aging
        });
      }
    }

    initNavbar();
    initGlowingCursor();
    initHeroTyping();
    initHeroVisualAnimation();
    initScrollReveals();
    initConceptsAccordion();
    initCodeViewer();
    initDeliverablesChecklist();
    initVerificationModal();
    initBackToTop();
  });

  // --- Sticky Navbar & Scroll Progress Bar ---
  function initNavbar() {
    const nav = document.querySelector('.site-nav');
    const progressBar = document.querySelector('.scroll-progress-bar');
    const navLinks = document.querySelectorAll('.nav-links a');
    const mobileToggle = document.querySelector('.mobile-toggle');

    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;

      if (progressBar) progressBar.style.width = `${progress}%`;

      if (nav) {
        if (scrollY > 40) {
          nav.classList.add('scrolled');
        } else {
          nav.classList.remove('scrolled');
        }
      }

      // Highlight active section link
      const sections = document.querySelectorAll('section[id]');
      sections.forEach(sec => {
        const top = sec.offsetTop - 120;
        const height = sec.offsetHeight;
        const id = sec.getAttribute('id');
        if (scrollY >= top && scrollY < top + height) {
          navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
          });
        }
      });
    }, { passive: true });

    // Mobile nav toggle
    if (mobileToggle && nav) {
      mobileToggle.addEventListener('click', () => {
        nav.classList.toggle('mobile-open');
      });

      navLinks.forEach(link => {
        link.addEventListener('click', () => {
          nav.classList.remove('mobile-open');
        });
      });
    }
  }

  // --- Glowing Cursor Trail ---
  function initGlowingCursor() {
    if (window.matchMedia('(hover: none) or (pointer: coarse)').matches) return;

    const dot = document.querySelector('.cursor-dot');
    const glow = document.querySelector('.cursor-glow');
    if (!dot || !glow) return;

    let mouseX = -100;
    let mouseY = -100;
    let glowX = -100;
    let glowY = -100;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
    }, { passive: true });

    function animateGlow() {
      glowX += (mouseX - glowX) * 0.15;
      glowY += (mouseY - glowY) * 0.15;
      glow.style.transform = `translate(${glowX}px, ${glowY}px)`;
      requestAnimationFrame(animateGlow);
    }
    requestAnimationFrame(animateGlow);
  }

  // --- Hero Typing Effect ---
  function initHeroTyping() {
    const titleEl = document.getElementById('heroHeadlineText');
    if (!titleEl) return;

    const fullText = "Edge-AI Workload CPU & Memory Scheduler";
    let idx = 0;
    titleEl.textContent = '';

    function typeChar() {
      if (idx < fullText.length) {
        titleEl.textContent += fullText.charAt(idx);
        idx++;
        setTimeout(typeChar, 45);
      }
    }
    setTimeout(typeChar, 250);
  }

  // --- Hero Visual Animation (Life immediately on load) ---
  function initHeroVisualAnimation() {
    const queueLane = document.getElementById('heroQueuePackets');
    const activeJobEl = document.getElementById('heroActiveJob');
    const framesGrid = document.getElementById('heroFramesGrid');
    if (!queueLane || !activeJobEl || !framesGrid) return;

    const sampleJobs = [
      { id: 'YOLOv8', urgency: 'urgency-critical', page: 2 },
      { id: 'MobileNet', urgency: 'urgency-high', page: 0 },
      { id: 'Whisper', urgency: 'urgency-normal', page: 5 },
      { id: 'BERT', urgency: 'urgency-high', page: 3 },
      { id: 'ResNet', urgency: 'urgency-normal', page: 1 }
    ];

    let cycle = 0;

    // Initialize 8 frame cells
    framesGrid.innerHTML = Array.from({ length: 8 }, (_, i) => `
      <div class="hero-frame-cell" id="hero-fc-${i}">F${i}</div>
    `).join('');

    setInterval(() => {
      cycle++;
      const current = sampleJobs[cycle % sampleJobs.length];
      const next1 = sampleJobs[(cycle + 1) % sampleJobs.length];
      const next2 = sampleJobs[(cycle + 2) % sampleJobs.length];

      // Update active job in CPU
      activeJobEl.textContent = `${current.id}:P${current.page}`;
      activeJobEl.style.color = current.urgency === 'urgency-critical' ? 'var(--neon-magenta)' : 'var(--neon-teal)';

      // Update queue
      queueLane.innerHTML = `
        <div class="hero-job-packet ${next1.urgency}">${next1.id} (D:${10 + (cycle % 4) * 2})</div>
        <div class="hero-job-packet ${next2.urgency}">${next2.id} (D:${18 + (cycle % 5)})</div>
      `;

      // Animate frame cells
      const frameIdx = cycle % 8;
      const cell = document.getElementById(`hero-fc-${frameIdx}`);
      if (cell) {
        cell.className = 'hero-frame-cell occupied';
        cell.textContent = `P${current.page}`;
        if (cycle % 3 === 0) {
          cell.classList.add('fault');
        }
      }
    }, 1800);
  }

  // --- Scroll Reveal Animations ---
  function initScrollReveals() {
    const revealElements = document.querySelectorAll('.glass-card, .section-header, .step-item, .outcome-card, .callout-card');
    
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    revealElements.forEach(el => observer.observe(el));
  }

  // --- Core Concepts Accordion ---
  function initConceptsAccordion() {
    const cards = document.querySelectorAll('.concept-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const isExpanded = card.classList.contains('expanded');
        // Toggle only this card
        card.classList.toggle('expanded', !isExpanded);
        const toggleText = card.querySelector('.toggle-text');
        if (toggleText) {
          toggleText.textContent = !isExpanded ? 'Collapse Concept Details' : 'Expand Concept Details';
        }
      });
    });
  }

  // --- Code Viewer & Copy Button ---
  function initCodeViewer() {
    const tabBtns = document.querySelectorAll('.code-tab-btn');
    const codePre = document.getElementById('codeDisplayPre');
    const copyBtn = document.getElementById('btnCopyCode');

    const snippets = {
      python: `# ==============================================================================
# Edge-AI Workload CPU & Memory Scheduler (Python Companion Simulator)
# Implements: Preemptive Earliest Deadline First (EDF) & Least Recently Used (LRU)
# Verification: Zero external dependencies; reads /proc/stat & /proc/meminfo on Linux
# Student: Sai Sparsh B | Reg. No. 25BTRPW078
# ==============================================================================

import time

class InferenceJob:
    def __init__(self, job_id, arrival, burst, deadline, priority, total_pages, ref_string):
        self.id = job_id
        self.arrival = arrival
        self.burst = burst
        self.deadline = deadline
        self.priority = priority
        self.total_pages = total_pages
        self.ref_string = ref_string
        self.remaining_burst = burst
        self.executed_ticks = 0
        self.first_run = None
        self.finish_tick = None
        self.faults = 0
        self.resident_frames = []      # List of [page, last_access_tick]
        self.allocated_frame_count = 2

def pick_next_job_edf(ready_queue):
    """
    Earliest Deadline First (EDF) selection policy.
    Preemptive: Returns ready job with minimum absolute deadline.
    """
    if not ready_queue:
        return None
    # Sort by earliest deadline, break ties by arrival time
    return min(ready_queue, key=lambda j: (j.deadline, j.arrival))

def access_memory_lru(job, current_tick, fault_penalty=2):
    """
    Least Recently Used (LRU) demand paging mechanism.
    Returns (is_fault, victim_page, stall_ticks)
    """
    req_page = job.ref_string[job.executed_ticks % len(job.ref_string)]
    
    # Check if page is currently resident
    for entry in job.resident_frames:
        if entry[0] == req_page:
            entry[1] = current_tick  # Update access timestamp
            return (False, None, 0)
            
    # Page Fault Occurred
    job.faults += 1
    victim = None
    if len(job.resident_frames) >= job.allocated_frame_count:
        # Evict least recently used page (minimum access timestamp)
        job.resident_frames.sort(key=lambda e: e[1])
        victim = job.resident_frames.pop(0)[0]
        
    job.resident_frames.append([req_page, current_tick])
    return (True, victim, fault_penalty)

# Example Execution
if __name__ == "__main__":
    jobs = [
        InferenceJob("J1", arrival=0, burst=6, deadline=12, priority=1, total_pages=5, ref_string=[0, 1, 2, 0, 3, 1]),
        InferenceJob("J2", arrival=2, burst=4, deadline=14, priority=2, total_pages=4, ref_string=[1, 2, 3, 1])
    ]
    ready = [j for j in jobs if j.arrival == 0]
    next_job = pick_next_job_edf(ready)
    fault, victim, stall = access_memory_lru(next_job, current_tick=0)
    print(f"Scheduled: {next_job.id} | Page Fault: {fault} | Stall Penalty: {stall} ticks")
`,
      c: `/* ==============================================================================
 * Edge-AI Workload CPU & Memory Scheduler (C Skeleton Implementation)
 * Embedded Real-Time Operating System (RTOS) Core Kernel Routine
 * Student: Sai Sparsh B | Reg. No. 25BTRPW078
 * ============================================================================== */

#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

#define MAX_JOBS 8
#define MAX_FRAMES 16

typedef struct {
    int page;
    int last_access_tick;
    int load_tick;
} FrameEntry;

typedef struct {
    char id[4];
    int arrival;
    int burst;
    int remaining_burst;
    int deadline;
    int priority;
    int total_pages;
    int executed_ticks;
    int page_faults;
    int allocated_frames;
    FrameEntry resident[MAX_FRAMES];
    int resident_count;
} EdgeJob;

/* EDF Preemptive Job Selection */
EdgeJob* pick_edf_job(EdgeJob* jobs[], int job_count, int current_tick) {
    EdgeJob* best = NULL;
    for (int i = 0; i < job_count; i++) {
        EdgeJob* j = jobs[i];
        if (j->arrival <= current_tick && j->remaining_burst > 0) {
            if (best == NULL || j->deadline < best->deadline) {
                best = j;
            }
        }
    }
    return best;
}

/* LRU Page Replacement */
bool access_page_lru(EdgeJob* job, int page, int tick, int* victim_out) {
    *victim_out = -1;
    // 1. Search for resident page (HIT)
    for (int i = 0; i < job->resident_count; i++) {
        if (job->resident[i].page == page) {
            job->resident[i].last_access_tick = tick;
            return true; /* Page Hit */
        }
    }
    
    // 2. Page Fault (Eviction if full)
    job->page_faults++;
    if (job->resident_count >= job->allocated_frames) {
        int lru_idx = 0;
        int min_tick = job->resident[0].last_access_tick;
        for (int i = 1; i < job->resident_count; i++) {
            if (job->resident[i].last_access_tick < min_tick) {
                min_tick = job->resident[i].last_access_tick;
                lru_idx = i;
            }
        }
        *victim_out = job->resident[lru_idx].page;
        job->resident[lru_idx].page = page;
        job->resident[lru_idx].last_access_tick = tick;
        job->resident[lru_idx].load_tick = tick;
    } else {
        job->resident[job->resident_count].page = page;
        job->resident[job->resident_count].last_access_tick = tick;
        job->resident[job->resident_count].load_tick = tick;
        job->resident_count++;
    }
    return false; /* Page Fault */
}
`
    };

    let activeLang = 'python';

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeLang = btn.getAttribute('data-lang');
        if (codePre) {
          codePre.textContent = snippets[activeLang];
        }
      });
    });

    if (codePre) {
      codePre.textContent = snippets.python;
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(snippets[activeLang]).then(() => {
          copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Copied!
          `;
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy Code
            `;
          }, 2000);
        }).catch(() => {
          window.prompt('Copy snippet:', snippets[activeLang]);
        });
      });
    }
  }

  // --- Deliverables Checklist with LocalStorage Persistence ---
  function initDeliverablesChecklist() {
    const items = document.querySelectorAll('.checklist-item');
    const progressBar = document.getElementById('checklistProgressBar');
    const countEl = document.getElementById('checklistCount');

    const STORAGE_KEY = 'edge_ai_os_checklist_state';
    let savedState = {};

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) savedState = JSON.parse(stored);
    } catch (e) {
      savedState = {};
    }

    function updateProgress() {
      let checkedCount = 0;
      items.forEach((item, index) => {
        const isChecked = item.classList.contains('checked');
        if (isChecked) checkedCount++;
        savedState[index] = isChecked;
      });

      const total = items.length;
      const pct = total > 0 ? (checkedCount / total) * 100 : 0;

      if (progressBar) progressBar.style.width = `${pct}%`;
      if (countEl) countEl.textContent = `${checkedCount} of ${total} Completed (${pct.toFixed(0)}%)`;

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
      } catch (e) {
        // Safe fallback if local storage is restricted
      }
    }

    items.forEach((item, index) => {
      // Restore state
      if (savedState[index] === true) {
        item.classList.add('checked');
      }

      item.addEventListener('click', () => {
        item.classList.toggle('checked');
        updateProgress();
      });
    });

    updateProgress();
  }

  // --- Verification Drawer / Modal ---
  function initVerificationModal() {
    const modal = document.getElementById('verificationModal');
    const openBtns = document.querySelectorAll('[data-open-verification]');
    const closeBtn = document.getElementById('btnCloseVerification');
    const listContainer = document.getElementById('modalTestList');

    if (!modal) return;

    const populateTests = () => {
      if (!listContainer || !OSSim.Engine) return;
      const results = OSSim.Engine.runVerifications();

      listContainer.innerHTML = results.map(r => `
        <div style="background: rgba(4, 10, 18, 0.7); border-left: 4px solid ${r.passed ? 'var(--neon-green)' : 'var(--neon-red)'}; padding: 1rem; border-radius: 6px; margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
            <strong style="color: #fff; font-size: 0.95rem;">${r.name}</strong>
            <span style="font-family: var(--font-mono); font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; background: ${r.passed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${r.passed ? 'var(--neon-green)' : 'var(--neon-red)'};">
              ${r.passed ? 'PASS' : 'FAIL'}
            </span>
          </div>
          <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.5rem;">${r.desc}</p>
          <div style="font-family: var(--font-mono); font-size: 0.78rem; background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 4px;">
            <span style="color: var(--text-dim);">Actual:</span> <span style="color: var(--neon-teal);">${r.details.actual}</span>
          </div>
        </div>
      `).join('');
    };

    openBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        populateTests();
        modal.classList.add('open');
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  // --- Back to Top ---
  function initBackToTop() {
    const btn = document.getElementById('btnBackToTop');
    if (btn) {
      btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }
})();

