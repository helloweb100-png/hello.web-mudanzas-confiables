/* ==========================================================================
   MUDANZAS CONFIABLES - script.js
   JavaScript nativo, sin dependencias salvo Lenis (scroll suave, opcional:
   si no carga, la página usa el scroll nativo sin perder funcionalidad).

   Arquitectura de rendimiento:
   - Un único bucle por frame (frame()) que lee el scroll y actualiza solo las
     secciones visibles (IntersectionObserver decide cuáles).
   - Solo se animan transform / opacity / variables CSS.
   - Todo el movimiento respeta prefers-reduced-motion.

   Índice:
     1 Utilidades y estado        7 Hero (rotador, red de rutas, tilt)
     2 Motor de scroll            8 Manifiesto (texto que se ilumina)
     3 Preloader                  9 Servicios (tarjetas apiladas)
     4 Header, progreso y menú   10 Viaje horizontal
     5 Anclas                    11 Cifras, FAQ, efectos de cursor
     6 Reveal al hacer scroll    12 Formulario a WhatsApp y arranque
   ========================================================================== */
(() => {
  'use strict';

  /* ======================= 1. UTILIDADES Y ESTADO ======================= */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const root = document.documentElement;
  const body = document.body;
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  const mqDesktop = matchMedia('(min-width: 900px)');
  const reduced = () => mqReduce.matches;

  const S = {
    y: 0, vel: 0, vh: innerHeight, vw: innerWidth, docH: 0,
    lenis: null, dirty: true, animators: [],
  };

  /** Registra una función que se ejecuta cada frame mientras `el` está cerca del viewport. */
  function addAnimator(el, update, margin = '100%') {
    if (!el) return null;
    const a = { el, update, visible: false };
    const io = new IntersectionObserver(
      ([entry]) => { a.visible = entry.isIntersecting; S.dirty = true; },
      { rootMargin: `${margin} 0px ${margin} 0px` }
    );
    io.observe(el);
    S.animators.push(a);
    return a;
  }

  /* ======================= 2. MOTOR DE SCROLL ======================= */
  function initScroll() {
    S.y = window.scrollY;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    if (window.Lenis && !reduced()) {
      S.lenis = new Lenis({
        duration: 1.25,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        wheelMultiplier: 0.95,
        touchMultiplier: 1.2,
      });
      S.lenis.on('scroll', ({ scroll, velocity }) => { S.y = scroll; S.vel = velocity; S.dirty = true; });
      S.lenis.stop(); // bloqueado hasta que termine el preloader
      const raf = (time) => {
        S.lenis.raf(time);
        if (S.dirty) frame();
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    } else {
      let queued = false;
      addEventListener('scroll', () => {
        S.y = window.scrollY; S.dirty = true;
        if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; frame(); }); }
      }, { passive: true });
    }
  }

  const header = $('#site-header');
  const progressBar = $('#scroll-progress');
  const marqueeTrack = $('[data-marquee]');
  let marqueeRate = 1;

  function frame() {
    S.dirty = false;
    const y = S.y;

    header.classList.toggle('is-scrolled', y > 24);
    const max = Math.max(1, S.docH - S.vh);
    progressBar.style.transform = `scaleX(${clamp(y / max).toFixed(4)})`;

    for (const a of S.animators) if (a.visible) a.update(y);

    // El marquee acelera un poco con la velocidad del scroll
    if (marqueeTrack && !reduced()) {
      const target = 1 + clamp(Math.abs(S.vel) / 28, 0, 4);
      marqueeRate = lerp(marqueeRate, target, 0.12);
      for (const anim of marqueeTrack.getAnimations({ subtree: true })) anim.playbackRate = marqueeRate;
      if (Math.abs(marqueeRate - 1) > 0.02) S.dirty = true;
    }
  }

  function measure() {
    S.vh = innerHeight; S.vw = innerWidth;
    S.docH = root.scrollHeight;
    S.dirty = true;
  }

  /* ======================= 3. PRELOADER ======================= */
  function initPreloader() {
    const pl = $('#preloader');
    if (!pl) return Promise.resolve();

    const ring = $('#pl-ring');
    const fill = $('#pl-fill');
    const truck = $('#pl-truck');
    const pct = $('#pl-pct');
    const msg = $('#pl-msg');
    const road = $('.pl__road');

    const C = 339.3;
    const MIN = reduced() ? 350 : 2700;   // el efecto necesita verse completo
    const MAX = 7000;                      // tope de seguridad
    const stages = [
      [0, 'Preparando tu mudanza'],
      [26, 'Embalando con cuidado'],
      [54, 'Cargando el camión'],
      [82, 'En ruta'],
      [100, 'Todo listo'],
    ];
    let loaded = document.readyState === 'complete';
    addEventListener('load', () => { loaded = true; }, { once: true });
    const roadW = road ? road.clientWidth : 300;
    const t0 = performance.now();
    let lastMsg = '';

    return new Promise((resolve) => {
      const tick = (now) => {
        const t = now - t0;
        if (t > MAX) loaded = true;
        const base = easeInOut(clamp(t / MIN));
        const p = Math.min(base, loaded ? 1 : 0.92);
        const n = Math.round(p * 100);

        pct.textContent = n;
        ring.style.strokeDashoffset = (C * (1 - p)).toFixed(2);
        fill.style.transform = `scaleX(${p.toFixed(4)})`;
        truck.style.transform = `translate3d(${(p * roadW).toFixed(1)}px,0,0)`;
        const label = stages.filter(([from]) => n >= from).pop()[1];
        if (label !== lastMsg) { msg.textContent = label; lastMsg = label; }

        if (p >= 1) { resolve(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }).then(async () => {
      await sleep(reduced() ? 0 : 380);
      pl.classList.add('is-leaving');
      await sleep(reduced() ? 0 : 750);
      root.classList.add('is-ready');             // dispara las entradas del hero
      body.classList.remove('is-loading');
      if (S.lenis) S.lenis.start();
      await sleep(reduced() ? 0 : 1100);
      pl.classList.add('is-done');
      pl.remove();
    });
  }

  /* ======================= 4. HEADER, PROGRESO Y MENÚ ======================= */
  function initMenu() {
    const burger = $('#burger');
    const menu = $('#menu');
    if (!burger || !menu) return;

    const setOpen = (open) => {
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      body.classList.toggle('menu-open', open);
      if (S.lenis) (open ? S.lenis.stop() : S.lenis.start());
      if (open) setTimeout(() => $('.menu__link', menu)?.focus({ preventScroll: true }), 350);
      else if (document.activeElement && menu.contains(document.activeElement)) burger.focus({ preventScroll: true });
    };

    burger.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false); });
    matchMedia('(min-width: 1000px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
    window.__closeMenu = () => setOpen(false);
  }

  /* ======================= 5. ANCLAS ======================= */
  function scrollToId(id, instant = false) {
    const target = document.getElementById(id);
    if (!target) return;
    const offset = id === 'inicio' ? 0 : -(parseInt(getComputedStyle(root).getPropertyValue('--header-h'), 10) || 72) + 8;
    if (S.lenis && !instant) {
      S.lenis.scrollTo(target, { offset, duration: 1.7, easing: (t) => 1 - Math.pow(1 - t, 4) });
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top, behavior: instant || reduced() ? 'auto' : 'smooth' });
    }
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  function initAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (href.length < 2) return;
      const id = href.slice(1);
      if (!document.getElementById(id)) return;
      e.preventDefault();
      window.__closeMenu?.();
      scrollToId(id);
      history.replaceState(null, '', href);
    });
  }

  /* ======================= 6. REVEAL AL HACER SCROLL ======================= */
  function initReveal() {
    // Escalonado automático dentro de contenedores [data-stagger]
    $$('[data-stagger]').forEach((group) => {
      $$(':scope > [data-reveal]', group).forEach((el, i) => {
        if (!el.dataset.delay) el.style.setProperty('--d', i * 90);
      });
    });
    $$('[data-reveal][data-delay]').forEach((el) => el.style.setProperty('--d', el.dataset.delay));

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('[data-reveal]').forEach((el) => io.observe(el));
  }

  /* ======================= 7. HERO ======================= */
  /** Palabra rotatoria del titular: "completas / a tiempo / sin rasguños / con calma" */
  function initRotator() {
    const rot = $('.rot');
    if (!rot || reduced()) return;
    const first = $('.rot__w', rot);
    const extra = (rot.dataset.words || '').split('|').filter(Boolean).map((text) => {
      const s = document.createElement('span');
      s.className = 'rot__w';
      s.textContent = text;
      s.setAttribute('aria-hidden', 'true');
      rot.appendChild(s);
      return s;
    });
    const words = [first, ...extra];
    let i = 0;
    const next = () => {
      if (document.hidden) return;
      const prev = words[i];
      i = (i + 1) % words.length;
      prev.classList.replace('is-active', 'is-out');
      words[i].classList.add('is-active');
      setTimeout(() => { // reinicia la posición sin animar
        prev.classList.add('no-t');
        prev.classList.remove('is-out');
        void prev.offsetWidth;
        prev.classList.remove('no-t');
      }, 900);
    };
    setTimeout(() => setInterval(next, 2800), 3200);
  }

  /** Red de rutas: nodos, conexiones y paquetes de luz que viajan entre ellos */
  function initRouteCanvas() {
    const cv = $('#route-canvas');
    const hero = $('#inicio');
    if (!cv || !hero || reduced()) return;
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, nodes = [], packets = [], running = false, last = 0, spawnAt = 0;
    const ptr = { x: -999, y: -999 };

    const resize = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = clamp(Math.round((w * h) / 21000), 22, 62);
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h * 0.78,
        vx: (Math.random() - 0.5) * 0.24, vy: (Math.random() - 0.5) * 0.24,
        r: 1 + Math.random() * 1.7,
      }));
      packets = [];
    };

    const LINK = () => Math.min(150, w * 0.32);

    const draw = (now) => {
      if (!running) return;
      const dt = Math.min(48, now - last || 16); last = now;
      const k = dt / 16.67;
      const link = LINK();
      ctx.clearRect(0, 0, w, h);

      for (const n of nodes) {
        n.x += n.vx * k; n.y += n.vy * k;
        if (n.x < -10) n.x = w + 10; else if (n.x > w + 10) n.x = -10;
        if (n.y < -10) n.y = h * 0.8; else if (n.y > h * 0.8) n.y = -10;
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
          if (d < link) {
            ctx.strokeStyle = `rgba(143,176,255,${(1 - d / link) * 0.32})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        // conexión con el cursor
        const pd = Math.hypot(a.x - ptr.x, a.y - ptr.y);
        if (pd < 170) {
          ctx.strokeStyle = `rgba(108,147,255,${(1 - pd / 170) * 0.7})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(ptr.x, ptr.y); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(157,182,255,.85)';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
      }

      // paquetes de luz (la "carga" viajando por la ruta)
      if (now > spawnAt && packets.length < 12) {
        const a = nodes[(Math.random() * nodes.length) | 0];
        const near = nodes.filter((b) => b !== a && Math.hypot(a.x - b.x, a.y - b.y) < link);
        if (near.length) {
          packets.push({ a, b: near[(Math.random() * near.length) | 0], t: 0, v: 0.008 + Math.random() * 0.01 });
        }
        spawnAt = now + 380 + Math.random() * 500;
      }
      packets = packets.filter((p) => {
        p.t += p.v * k;
        if (p.t >= 1) return false;
        const x = lerp(p.a.x, p.b.x, p.t), y = lerp(p.a.y, p.b.y, p.t);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, 'rgba(255,255,255,.95)');
        g.addColorStop(0.3, 'rgba(108,147,255,.7)');
        g.addColorStop(1, 'rgba(108,147,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.2832); ctx.fill();
        return true;
      });

      requestAnimationFrame(draw);
    };

    const start = () => { if (running) return; running = true; last = performance.now(); requestAnimationFrame(draw); };
    const stop = () => { running = false; };

    resize();
    let rz;
    addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(resize, 200); });
    new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? start() : stop())).observe(hero);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    if (mqFine.matches) {
      hero.addEventListener('pointermove', (e) => {
        const r = cv.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
      });
      hero.addEventListener('pointerleave', () => { ptr.x = ptr.y = -999; });
    }
  }

  /** Parallax de scroll + inclinación 3D de la foto principal según el cursor */
  function initHeroMotion() {
    const hero = $('#inicio');
    const visual = $('.hero__visual');
    const copy = $('.hero__copy');
    const bg = $('.hero__bg');
    if (!hero || !visual || reduced()) return;

    const st = { py: 0, rx: 0, ry: 0, trx: 0, try: 0, raf: 0 };
    const paint = () => {
      visual.style.transform = `translate3d(0,${st.py.toFixed(1)}px,0) perspective(1100px) rotateX(${st.rx.toFixed(2)}deg) rotateY(${st.ry.toFixed(2)}deg)`;
    };

    addAnimator(hero, (y) => {
      const p = clamp(y / (S.vh * 1.1));
      st.py = -p * 70;
      copy.style.transform = `translate3d(0,${(-p * 46).toFixed(1)}px,0)`;
      bg.style.transform = `translate3d(0,${(p * 90).toFixed(1)}px,0)`;
      paint();
    }, '10%');

    if (!mqFine.matches) return;
    const loop = () => {
      st.rx = lerp(st.rx, st.trx, 0.08); st.ry = lerp(st.ry, st.try, 0.08);
      paint();
      if (Math.abs(st.rx - st.trx) > 0.01 || Math.abs(st.ry - st.try) > 0.01) st.raf = requestAnimationFrame(loop);
      else st.raf = 0;
    };
    const kick = () => { if (!st.raf) st.raf = requestAnimationFrame(loop); };
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      st.try = nx * 9; st.trx = -ny * 7; kick();
    });
    hero.addEventListener('pointerleave', () => { st.trx = st.try = 0; kick(); });
  }

  /* ======================= 8. MANIFIESTO ======================= */
  function initManifesto() {
    const el = $('[data-split]');
    if (!el) return;
    const units = [];
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span');
            s.className = 'w'; s.textContent = tok;
            units.push(s); frag.appendChild(s);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.classList.contains('inline-pill')) { child.classList.add('w'); units.push(child); }
          else walk(child);
        }
      });
    };
    walk(el);
    if (reduced()) { units.forEach((u) => (u.style.opacity = 1)); return; }

    const N = units.length;
    const cache = new Array(N).fill(-1);
    addAnimator(el, () => {
      const r = el.getBoundingClientRect();
      const p = clamp((S.vh * 0.86 - r.top) / (r.height + S.vh * 0.36));
      for (let i = 0; i < N; i++) {
        const o = clamp((p * (N + 7) - i) / 7);
        const v = Math.round((0.14 + 0.86 * o) * 100) / 100;
        if (v !== cache[i]) { units[i].style.opacity = v; cache[i] = v; }
      }
    });
  }

  /* ======================= 9. SERVICIOS: TARJETAS APILADAS ======================= */
  function initStack() {
    const stack = $('[data-svc-stack]');
    if (!stack) return;
    const cards = $$('.svc-card', stack);
    let tops = [];
    const readTops = () => { tops = cards.map((c) => parseFloat(getComputedStyle(c).top) || 0); };
    readTops();
    addEventListener('resize', readTops);

    addAnimator(stack, () => {
      if (!mqDesktop.matches || reduced()) {
        cards.forEach((c) => { c.style.transform = ''; c.style.setProperty('--shade', 0); });
        return;
      }
      const rects = cards.map((c) => c.getBoundingClientRect());
      cards.forEach((c, i) => {
        if (i === cards.length - 1) return;
        const span = Math.max(1, S.vh - tops[i + 1]);
        const p = clamp(1 - (rects[i + 1].top - tops[i + 1]) / span);
        c.style.transform = `scale(${(1 - p * 0.055).toFixed(4)})`;
        c.style.setProperty('--shade', (p * 0.6).toFixed(3));
      });
    });
  }

  /* ======================= 10. VIAJE HORIZONTAL ======================= */
  function initJourney() {
    const sec = $('[data-journey]');
    if (!sec) return;
    const track = $('[data-journey-track]', sec);
    const steps = $$('.jstep', sec);
    const nodes = $$('[data-j-node]', sec);
    const truck = $('[data-j-truck]', sec);
    const road = $('.jroad', sec);
    let pinned = false, maxShift = 0, roadW = 0, nodeP = [];

    const setup = () => {
      pinned = !reduced() && innerHeight >= 520;
      sec.classList.toggle('is-pinned', pinned);
      if (!pinned) {
        sec.style.removeProperty('--j-height');
        track.style.transform = '';
        steps.forEach((s) => s.classList.remove('is-active'));
        return;
      }
      track.style.transform = 'none';
      maxShift = Math.max(0, track.offsetWidth - innerWidth);
      sec.style.setProperty('--j-height', `${Math.round(innerHeight + maxShift * 1.15)}px`);
      roadW = road.clientWidth;
      nodeP = nodes.map((n, i) => {
        const s = steps[i];
        const p = clamp((s.offsetLeft + s.offsetWidth / 2 - innerWidth / 2) / Math.max(1, maxShift));
        n.style.left = `${(p * 100).toFixed(2)}%`;
        return p;
      });
      S.dirty = true;
    };

    const update = () => {
      if (!pinned) return;
      const r = sec.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - S.vh));
      track.style.transform = `translate3d(${(-p * maxShift).toFixed(1)}px,0,0)`;
      sec.style.setProperty('--jp', p.toFixed(4));
      truck.style.transform = `translate3d(${(p * roadW).toFixed(1)}px,0,0)`;

      const cx = S.vw / 2;
      let best = 0, bestD = Infinity;
      steps.forEach((s, i) => {
        const b = s.getBoundingClientRect();
        const c = b.left + b.width / 2;
        const d = Math.abs(c - cx);
        if (d < bestD) { bestD = d; best = i; }
        const img = s.querySelector('img');
        if (img) img.style.setProperty('--px', `${(((c - cx) / S.vw) * -46).toFixed(1)}px`);
      });
      steps.forEach((s, i) => s.classList.toggle('is-active', i === best));
      nodes.forEach((n, i) => {
        n.classList.toggle('is-passed', p >= nodeP[i] - 0.002);
        n.classList.toggle('is-current', best === i);
      });
    };

    setup();
    addAnimator(sec, update, '20%');
    let rz;
    const redo = () => { clearTimeout(rz); rz = setTimeout(() => { setup(); measure(); }, 180); };
    addEventListener('resize', redo);
    if ('ResizeObserver' in window) new ResizeObserver(redo).observe(track);
    document.fonts?.ready.then(redo);
  }

  /* ======================= 11. CIFRAS, FAQ, CURSOR ======================= */
  function initCounters() {
    const els = $$('[data-count]');
    if (!els.length || reduced()) return;
    const fmt = new Intl.NumberFormat('es-MX');
    const run = (el) => {
      const end = Number(el.dataset.count);
      const pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
      const dur = 1900;
      const t0 = performance.now();
      const step = (now) => {
        const t = clamp((now - t0) / dur);
        el.textContent = `${pre}${fmt.format(Math.round(end * easeOutExpo(t)))}${suf}`;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); run(e.target); } });
    }, { threshold: 0.6 });
    els.forEach((el) => {
      el.textContent = `${el.dataset.prefix || ''}0${el.dataset.suffix || ''}`;
      io.observe(el);
    });
  }

  function initFaq() {
    const items = $$('.qa');
    const ease = 'cubic-bezier(0.16, 1, 0.3, 1)';
    const collapse = (d) => {
      if (!d.open) return;
      const sum = $('summary', d);
      const start = d.offsetHeight;
      const end = sum.offsetHeight + (d.offsetHeight - d.clientHeight);
      d.style.overflow = 'hidden';
      d.animate({ height: [`${start}px`, `${end}px`] }, { duration: 420, easing: ease }).onfinish = () => {
        d.open = false; d.style.overflow = '';
      };
    };
    const expand = (d) => {
      const start = d.offsetHeight;
      d.open = true;
      const end = d.offsetHeight;
      d.style.overflow = 'hidden';
      d.animate({ height: [`${start}px`, `${end}px`] }, { duration: 520, easing: ease }).onfinish = () => {
        d.style.overflow = '';
      };
    };
    items.forEach((d) => {
      $('summary', d).addEventListener('click', (e) => {
        e.preventDefault();
        if (reduced()) { d.open = !d.open; return; }
        if (d.open) collapse(d);
        else { items.forEach((o) => o !== d && collapse(o)); expand(d); }
      });
    });
  }

  /** Spotlight en tarjetas, botones magnéticos (solo con ratón) */
  function initPointerFx() {
    if (!mqFine.matches || reduced()) return;
    $$('.bento__cell').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx-s', `${e.clientX - r.left}px`);
        card.style.setProperty('--my-s', `${e.clientY - r.top}px`);
      });
    });
    $$('[data-magnetic]').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        btn.style.setProperty('--mx', `${(dx * 14).toFixed(1)}px`);
        btn.style.setProperty('--my', `${(dy * 10).toFixed(1)}px`);
      });
      btn.addEventListener('pointerleave', () => { btn.style.setProperty('--mx', '0px'); btn.style.setProperty('--my', '0px'); });
    });
  }

  function initMarquee() {
    if (!marqueeTrack) return;
    const group = marqueeTrack.firstElementChild;
    const clone = group.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    marqueeTrack.appendChild(clone);
  }

  function initFooterWord() {
    const mega = $('.footer__mega');
    const word = $('[data-footer-word]');
    if (!mega || !word || reduced()) return;
    addAnimator(mega, () => {
      const r = mega.getBoundingClientRect();
      const p = clamp((S.vh - r.top) / (S.vh + r.height));
      word.style.setProperty('--fx', `${((0.5 - p) * S.vw * 0.12).toFixed(1)}px`);
    }, '30%');
  }

  function initWhatsAppTip() {
    const wa = $('#wa-float');
    if (!wa) return;
    let seen = false;
    try { seen = sessionStorage.getItem('mc-wa-tip') === '1'; } catch (_) { /* sin storage */ }
    if (seen) return;
    setTimeout(() => {
      wa.classList.add('is-tip');
      try { sessionStorage.setItem('mc-wa-tip', '1'); } catch (_) { /* sin storage */ }
      setTimeout(() => wa.classList.remove('is-tip'), 6500);
    }, 9000);
  }

  /* ======================= 12. FORMULARIO A WHATSAPP ======================= */
  function initForm() {
    const form = $('#cotizador');
    if (!form) return;
    const number = form.dataset.waNumber;
    const ring = $('#q-ring');
    const pctEl = $('#q-pct');
    const submit = $('.quote__submit', form);
    const success = $('.quote__success', form);
    const successLink = $('[data-success-link]', form);
    const RING = 125.66;

    // Fecha mínima: hoy (hora local)
    const dateInput = $('#f-fecha');
    if (dateInput) {
      const d = new Date();
      dateInput.min = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    const rules = {
      servicio: { get: () => form.querySelector('input[name="servicio"]:checked')?.value || '', ok: (v) => !!v, msg: 'Elige qué vas a mover.' },
      origen: { get: () => form.origen.value.trim(), ok: (v) => v.length >= 3, msg: 'Cuéntanos desde dónde sales.' },
      destino: { get: () => form.destino.value.trim(), ok: (v) => v.length >= 3, msg: 'Cuéntanos a dónde llegas.' },
      nombre: { get: () => form.nombre.value.trim(), ok: (v) => v.length >= 2, msg: 'Escribe tu nombre para saber con quién hablamos.' },
      telefono: { get: () => form.telefono.value.replace(/\D/g, ''), ok: (v) => v.length >= 10, msg: 'Escribe tu número a 10 dígitos para poder responderte.' },
    };

    const setError = (name, message) => {
      const out = form.querySelector(`[data-error-for="${name}"]`);
      if (!out) return;
      out.textContent = message || '';
      const holder = out.closest('.field') || out.closest('fieldset');
      holder?.classList.toggle('is-invalid', !!message);
      form.querySelectorAll(`[name="${name}"]`).forEach((i) => i.setAttribute('aria-invalid', message ? 'true' : 'false'));
    };

    const progress = () => {
      const done = Object.values(rules).filter((r) => r.ok(r.get())).length;
      const p = done / Object.keys(rules).length;
      ring.style.strokeDashoffset = (RING * (1 - p)).toFixed(2);
      pctEl.textContent = `${Math.round(p * 100)}%`;
    };

    form.addEventListener('input', (e) => {
      const name = e.target.name;
      if (rules[name] && rules[name].ok(rules[name].get())) setError(name, '');
      progress();
    });
    form.addEventListener('change', (e) => { if (e.target.name === 'servicio') setError('servicio', ''); progress(); });
    // Validación al salir del campo
    form.addEventListener('focusout', (e) => {
      const name = e.target.name;
      if (rules[name] && e.target.type !== 'radio' && e.target.value) {
        setError(name, rules[name].ok(rules[name].get()) ? '' : rules[name].msg);
      }
    });

    const buildMessage = () => {
      const val = (n) => form.elements[n].value.trim();
      const extras = $$('input[name="extras"]:checked', form).map((i) => i.value).join(', ');
      let fecha = 'Por definir';
      if (val('fecha')) {
        fecha = new Date(`${val('fecha')}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
      }
      const lines = [
        'Hola Mudanzas Confiables, quiero cotizar una mudanza.',
        '',
        `*Servicio:* ${rules.servicio.get()}`,
        `*Desde:* ${val('origen')}`,
        `*Hacia:* ${val('destino')}`,
        `*Fecha aproximada:* ${fecha}`,
        `*Extras:* ${extras || 'Ninguno'}`,
      ];
      if (val('detalles')) lines.push(`*Detalles:* ${val('detalles')}`);
      lines.push('', `Soy ${val('nombre')}. Mi WhatsApp: ${val('telefono')}`);
      return lines.join('\n');
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let firstBad = null;
      Object.entries(rules).forEach(([name, rule]) => {
        const ok = rule.ok(rule.get());
        setError(name, ok ? '' : rule.msg);
        if (!ok && !firstBad) firstBad = name;
      });
      if (firstBad) {
        const target = form.querySelector(`[name="${firstBad}"]`);
        target?.focus({ preventScroll: false });
        return;
      }

      const url = `https://wa.me/${number}?text=${encodeURIComponent(buildMessage())}`;
      submit.classList.add('is-loading');
      // Se abre de inmediato (dentro del gesto del usuario) para que el navegador no lo bloquee
      const win = window.open(url, '_blank');
      if (win) win.opener = null; else window.location.href = url;

      await sleep(reduced() ? 0 : 900);
      submit.classList.remove('is-loading');
      successLink.href = url;
      success.hidden = false;
      $('a, button', success)?.focus({ preventScroll: true });
    });

    $('[data-success-close]', form)?.addEventListener('click', () => { success.hidden = true; });
    progress();
  }

  /* ======================= ARRANQUE ======================= */
  function init() {
    measure();
    initScroll();
    initMenu();
    initAnchors();
    initMarquee();
    initReveal();
    initRotator();
    initRouteCanvas();
    initHeroMotion();
    initManifesto();
    initStack();
    initJourney();
    initCounters();
    initFaq();
    initPointerFx();
    initFooterWord();
    initWhatsAppTip();
    initForm();

    let rz;
    addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(measure, 150); });
    if ('ResizeObserver' in window) new ResizeObserver(() => measure()).observe(body);

    initPreloader().then(() => {
      measure();
      if (location.hash.length > 1) setTimeout(() => scrollToId(location.hash.slice(1), true), 60);
      else window.scrollTo(0, 0);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
