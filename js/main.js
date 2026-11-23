(() => {
  const root = document.documentElement;
  root.classList.remove('no-js');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover)').matches;
  if (canHover && !reduced) root.classList.add('js-hover');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---------- rok, počet let ---------- */
  const year = new Date().getFullYear();
  $$('[data-year]').forEach(el => (el.textContent = year));
  const yearsEl = $('[data-count-years]');
  const years = year - 1994;
  if (yearsEl) yearsEl.textContent = years;

  /* ---------- fotky v pozadí úvodu ---------- */
  const slideshow = (() => {
    const heroEl = $('[data-hero]');
    const slides = heroEl ? $$('.hero__slide', heroEl) : [];
    const dotsWrap = $('[data-slide-dots]');
    if (slides.length < 2) return { start() {} };
    const TIME = 6000;
    heroEl.style.setProperty('--slide-time', `${TIME / 1000}s`);
    let cur = 0, timer = null, running = false, visible = true, started = false;

    const dots = slides.map((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Fotografie ${i + 1}: ${$('figcaption', s).textContent}`);
      b.innerHTML = '<span></span>';
      b.addEventListener('click', () => { go(i); schedule(); });
      dotsWrap.appendChild(b);
      return b;
    });

    const paintDots = () => dots.forEach((d, i) => {
      d.classList.remove('is-active');
      d.classList.toggle('is-done', i < cur);
      d.setAttribute('aria-current', i === cur ? 'true' : 'false');
    });
    const restartDot = () => {
      const d = dots[cur];
      d.classList.remove('is-active');
      void d.offsetWidth; // restart animace proužku
      if (running) d.classList.add('is-active');
    };

    function go(i) {
      slides[cur].classList.remove('is-active');
      cur = (i + slides.length) % slides.length;
      const s = slides[cur];
      const img = $('img', s);
      if (img.loading === 'lazy') img.loading = 'eager';
      s.classList.add('is-active');
      paintDots();
      restartDot();
    }
    function schedule() {
      clearTimeout(timer);
      if (!running) return;
      restartDot();
      timer = setTimeout(() => { go(cur + 1); schedule(); }, TIME);
    }
    const update = () => {
      const should = started && !reduced && visible && !document.hidden;
      if (should === running) return;
      running = should;
      heroEl.classList.toggle('is-paused', !running);
      if (running) schedule(); else { clearTimeout(timer); restartDot(); }
    };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); }).observe(heroEl);
    document.addEventListener('visibilitychange', update);
    paintDots();
    // ostatní fotky načteme až po první
    window.addEventListener('load', () => slides.forEach(s => { $('img', s).loading = 'eager'; }), { once: true });
    return { start() { started = true; update(); } };
  })();

  /* ---------- načítání -> úvod ---------- */
  const start = () => {
    document.body.classList.add('is-loaded');
    setTimeout(() => { document.body.classList.add('is-ready'); slideshow.start(); }, reduced || !$('.loader') ? 0 : 550);
  };

  /* počet let se načte, až je číslo vidět */
  if (yearsEl && !reduced) {
    const yo = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      countUp(yearsEl, years, 1600, 200);
      yo.disconnect();
    }, { threshold: 0.6 });
    yo.observe(yearsEl);
  }
  // úvod se ukáže hned, na stažení fotek se nečeká
  start();

  function countUp(el, to, dur, delay) {
    el.textContent = '0';
    setTimeout(() => {
      const t0 = performance.now();
      const tick = now => {
        const p = Math.min((now - t0) / dur, 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
  }

  /* ---------- rozdělení textu na slova ---------- */
  $$('[data-split]').forEach(el => {
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    const words = text.split(' ');
    el.setAttribute('aria-label', text);
    el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`).join(' ');
  });

  /* ---------- odhalování při scrollu ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const sibs = el.parentElement ? $$(':scope > [data-reveal]', el.parentElement) : [];
      const idx = sibs.indexOf(el);
      if (idx > 0 && el.hasAttribute('data-reveal')) el.style.transitionDelay = `${Math.min(idx, 6) * 70}ms`;
      el.classList.add('is-in');
      io.unobserve(el);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal], [data-split], [data-clip]').forEach(el => io.observe(el));

  /* ---------- navigace ---------- */
  const nav = $('[data-nav]');
  const hero = $('[data-hero]');
  let lastY = window.scrollY;
  const onNav = () => {
    const y = window.scrollY;
    const over = hero && y < hero.offsetHeight - 80;
    nav.classList.toggle('is-over', !!over);
    nav.classList.toggle('is-scrolled', !over && y > 30);
    const menuOpen = document.body.classList.contains('menu-open');
    lastY = y;
  };

  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  const setMenu = open => {
    document.body.classList.toggle('menu-open', open);
    document.body.classList.toggle('is-locked', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Zavřít menu' : 'Otevřít menu');
    menu.setAttribute('aria-hidden', String(!open));
  };
  toggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));

  /* ---------- paralaxa ---------- */
  const para = $$('[data-parallax]');

  /* ---------- průběh zakázky – linka ---------- */
  const steps = $('[data-steps]');
  const stepItems = steps ? $$('li', steps) : [];

  /* ---------- hlavní smyčka scrollu ---------- */
  let ticking = false;
  const frame = () => {
    ticking = false;
    const vh = window.innerHeight;
    onNav();

    if (!reduced) {
      para.forEach(img => {
        const r = img.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const off = (r.top + r.height / 2 - vh / 2) * parseFloat(img.dataset.parallax);
        img.style.translate = `0 ${off.toFixed(1)}px`;
      });
    }

    if (steps) {
      const r = steps.getBoundingClientRect();
      const p = Math.min(Math.max((vh * 0.6 - r.top) / r.height, 0), 1);
      steps.style.setProperty('--p', p.toFixed(3));
      stepItems.forEach(li => li.classList.toggle('is-active', li.getBoundingClientRect().top < vh * 0.6));
    }
  };
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  window.addEventListener('scroll', req, { passive: true });
  window.addEventListener('resize', req);
  frame();

  /* ---------- zvětšení fotografie ---------- */
  const lb = $('[data-lightbox]');
  const lbImg = $('img', lb);
  const lbCap = $('figcaption', lb);
  const items = $$('[data-lb]');
  let cur = 0;
  let lastFocus = null;
  const show = i => {
    cur = (i + items.length) % items.length;
    const a = items[cur];
    lbImg.src = a.getAttribute('href');
    lbImg.alt = $('img', a).alt;
    lbCap.textContent = a.parentElement.querySelector('figcaption')?.textContent || '';
  };
  const openLb = i => {
    lastFocus = items[i];
    show(i);
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    $('[data-lb-close]', lb).focus();
  };
  const closeLb = () => {
    if (!lb.classList.contains('is-open')) return;
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  };
  items.forEach((a, i) => a.addEventListener('click', e => { e.preventDefault(); openLb(i); }));
  $('[data-lb-close]', lb).addEventListener('click', closeLb);
  $('[data-lb-prev]', lb).addEventListener('click', () => show(cur - 1));
  $('[data-lb-next]', lb).addEventListener('click', () => show(cur + 1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeLb(); setMenu(false); }
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'ArrowRight') show(cur + 1);
    if (e.key === 'ArrowLeft') show(cur - 1);
    if (e.key === 'Tab') {
      const f = $$('button', lb);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- FAQ: jen jedna otevřená ---------- */
  const dets = $$('.faq details');
  dets.forEach(d => d.addEventListener('toggle', () => {
    if (d.open) dets.forEach(o => { if (o !== d) o.open = false; });
  }));

  /* ---------- formulář -> připravený e-mail ---------- */
  const form = $('[data-form]');
  const status = $('[data-form-status]');
  if (form) form.noValidate = true;
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    let firstBad = null;
    $$('[required]', form).forEach(f => {
      const bad = !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
      f.closest('.field').classList.toggle('is-error', bad);
      f.setAttribute('aria-invalid', String(bad));
      if (bad && !firstBad) firstBad = f;
    });
    if (firstBad) {
      status.textContent = 'Vyplňte prosím jméno, platný e-mail a co potřebujete vyrobit.';
      firstBad.focus();
      return;
    }
    const d = new FormData(form);
    const body = [
      `Jméno: ${d.get('jmeno')}`,
      `E-mail: ${d.get('email')}`,
      `Telefon: ${d.get('telefon') || '-'}`,
      '',
      d.get('zprava')
    ].join('\n');
    window.location.href = `mailto:jiri@truhlarstvi-marecek.cz?subject=${encodeURIComponent('Poptávka z webu')}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Otevírá se vaše e-mailová aplikace s připravenou zprávou.';
  });
})();
