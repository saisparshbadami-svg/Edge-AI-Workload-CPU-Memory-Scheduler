/**
 * Circuit Board & Edge Particle Stream Background Canvas
 * 60fps, tab visibility pause, prefers-reduced-motion fallback, mouse parallax.
 */

(function () {
  'use strict';

  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Check prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    canvas.style.display = 'none';
    return;
  }

  let width = 0;
  let height = 0;
  let animationFrameId = null;
  let isTabVisible = true;

  // Mouse Parallax
  let targetMouseX = 0;
  let targetMouseY = 0;
  let mouseX = 0;
  let mouseY = 0;

  window.addEventListener('mousemove', (e) => {
    targetMouseX = (e.clientX - width / 2) * 0.04;
    targetMouseY = (e.clientY - height / 2) * 0.04;
  }, { passive: true });

  // Resize handler
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * window.devicePixelRatio || width;
    canvas.height = height * window.devicePixelRatio || height;
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    initTraces();
  }

  // --- Circuit Traces & Floating Packets ---
  let traces = [];
  let packets = [];
  let particles = [];

  function initTraces() {
    traces = [];
    packets = [];
    particles = [];

    const centerX = width * 0.72;
    const centerY = height * 0.38;

    // Generate circuit lines directed towards central CPU core
    const numTraces = Math.max(12, Math.floor(width / 90));
    for (let i = 0; i < numTraces; i++) {
      const angle = (i / numTraces) * Math.PI * 2 + (Math.random() * 0.2);
      const startDist = Math.max(width, height) * 0.65;
      const x0 = centerX + Math.cos(angle) * startDist;
      const y0 = centerY + Math.sin(angle) * startDist;

      // Circuit bends (orthogonal path)
      const bend1X = centerX + Math.cos(angle) * (startDist * 0.55);
      const bend1Y = y0;
      const bend2X = bend1X;
      const bend2Y = centerY + Math.sin(angle) * 70;
      const endX = centerX + Math.cos(angle) * 50;
      const endY = centerY + Math.sin(angle) * 40;

      const path = [
        { x: x0, y: y0 },
        { x: bend1X, y: bend1Y },
        { x: bend2X, y: bend2Y },
        { x: endX, y: endY }
      ];

      traces.push(path);

      // Add 1 or 2 glowing packets per trace
      packets.push({
        traceIdx: i,
        progress: Math.random(),
        speed: 0.0012 + Math.random() * 0.002,
        color: Math.random() > 0.4 ? '#00f5d4' : (Math.random() > 0.5 ? '#ffb703' : '#f72585'),
        size: 3 + Math.random() * 2.5
      });
    }

    // Ambient floating particles
    const numParticles = Math.min(60, Math.floor((width * height) / 22000));
    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: 1 + Math.random() * 1.8,
        alpha: 0.15 + Math.random() * 0.45,
        hueShift: Math.random() * 360
      });
    }
  }

  // Linear interpolation along multi-point path
  function getPointOnPath(path, progress) {
    if (!path || path.length < 2) return { x: 0, y: 0 };
    // Segment lengths
    const segments = [];
    let totalLen = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const dx = path[i+1].x - path[i].x;
      const dy = path[i+1].y - path[i].y;
      const len = Math.hypot(dx, dy);
      segments.push(len);
      totalLen += len;
    }

    let targetDist = progress * totalLen;
    let accumulated = 0;

    for (let i = 0; i < segments.length; i++) {
      if (accumulated + segments[i] >= targetDist) {
        const segProgress = (targetDist - accumulated) / (segments[i] || 1);
        return {
          x: path[i].x + (path[i+1].x - path[i].x) * segProgress,
          y: path[i].y + (path[i+1].y - path[i].y) * segProgress
        };
      }
      accumulated += segments[i];
    }
    return path[path.length - 1];
  }

  let colorAngle = 0;

  function render() {
    if (!isTabVisible) return;

    // Smooth mouse parallax
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    colorAngle += 0.003;
    const tealIntensity = 0.5 + 0.2 * Math.sin(colorAngle);
    const blueIntensity = 0.5 + 0.2 * Math.cos(colorAngle);

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(mouseX, mouseY);

    // 1. Draw circuit traces
    ctx.lineWidth = 1;
    for (let i = 0; i < traces.length; i++) {
      const path = traces[i];
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let j = 1; j < path.length; j++) {
        ctx.lineTo(path[j].x, path[j].y);
      }
      ctx.strokeStyle = 'rgba(180, 120, 60, 0.09)'; // copper circuit faint trace
      ctx.stroke();

      // Pad dot at the trace end
      const end = path[path.length - 1];
      ctx.beginPath();
      ctx.arc(end.x, end.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 245, 212, 0.3)';
      ctx.fill();
    }

    // 2. Draw glowing data packets moving along traces
    for (let i = 0; i < packets.length; i++) {
      const p = packets[i];
      p.progress += p.speed;
      if (p.progress >= 1) {
        p.progress = 0;
        p.speed = 0.0012 + Math.random() * 0.002;
      }

      const pt = getPointOnPath(traces[p.traceIdx], p.progress);

      // Packet glow
      const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, p.size * 3.5);
      grad.addColorStop(0, p.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, p.size * 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Packet core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, p.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Draw ambient floating particles
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;

      if (pt.x < 0) pt.x = width;
      if (pt.x > width) pt.x = 0;
      if (pt.y < 0) pt.y = height;
      if (pt.y > height) pt.y = 0;

      ctx.fillStyle = `rgba(0, 245, 212, ${pt.alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    animationFrameId = requestAnimationFrame(render);
  }

  // Visibility Change Handling
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isTabVisible = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    } else {
      isTabVisible = true;
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(render);
      }
    }
  });

  window.addEventListener('resize', resize);
  resize();
  animationFrameId = requestAnimationFrame(render);
})();

