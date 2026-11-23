/* Články – načtení, převod textu na HTML a vykreslení.
   Články z webu jsou v data/clanky.json. Články přidané ve správě (ukázková verze
   bez přihlášení) se ukládají do localStorage tohoto prohlížeče. */
(() => {
  const STORE = 'tm-clanky-v1';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const getLocal = () => {
    try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; }
  };
  const saveLocal = arr => {
    try { localStorage.setItem(STORE, JSON.stringify(arr)); return true; } catch { return false; }
  };

  /* jednoduché formátování: ## nadpis, - odrážka, **tučně**, [text](odkaz) */
  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:|\/|#|[\w-]+\.html)[^)\s]*)\)/g, (m, t, u) => {
      const ext = /^https?:/.test(u);
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
    });
  const md = text => String(text || '').replace(/\r/g, '').split(/\n{2,}/).map(block => {
    const b = block.trim();
    if (!b) return '';
    if (b.startsWith('## ')) return `<h2>${inline(b.slice(3))}</h2>`;
    const lines = b.split('\n');
    if (lines.every(l => /^- /.test(l.trim()))) return `<ul>${lines.map(l => `<li>${inline(l.trim().slice(2))}</li>`).join('')}</ul>`;
    return `<p>${lines.map(inline).join('<br>')}</p>`;
  }).join('\n');

  const fmtDate = d => {
    if (!d) return '';
    const [y, m, day] = d.split('-').map(Number);
    return `${day}. ${m}. ${y}`;
  };

  let cache = null;
  const loadAll = async (prefix = '') => {
    if (cache) return cache;
    let base = [];
    try { base = await fetch(prefix + 'data/clanky.json', { cache: 'no-cache' }).then(r => r.json()); } catch { base = []; }
    base = base.map(a => ({ ...a, image: a.image ? prefix + a.image : '' }));
    const local = getLocal().filter(a => a.published).map(a => ({ ...a, local: true }));
    const bySlug = new Map(base.map(a => [a.slug, a]));
    local.forEach(a => bySlug.set(a.slug, a));
    cache = [...bySlug.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return cache;
  };

  const card = (a, prefix) => `
    <article class="acard">
      <a href="${prefix}clanek.html?c=${encodeURIComponent(a.slug)}">
        <div class="acard__img">${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy">` : ''}</div>
        <p class="acard__meta"><time datetime="${esc(a.date)}">${fmtDate(a.date)}</time>${a.local ? '<span class="acard__badge">Uloženo jen v tomto prohlížeči</span>' : ''}</p>
        <h3 class="acard__title">${esc(a.title)}</h3>
        <p class="acard__perex">${esc(a.perex)}</p>
        <span class="acard__more">Číst článek <span aria-hidden="true">→</span></span>
      </a>
    </article>`;

  const renderLists = async () => {
    const lists = $$('[data-articles]');
    if (!lists.length) return;
    for (const el of lists) {
      const prefix = el.dataset.prefix || '';
      const all = await loadAll(prefix);
      const limit = parseInt(el.dataset.limit || '0', 10);
      let items = all.filter(a => a.slug !== el.dataset.exclude);
      if (limit) items = items.slice(0, limit);
      el.innerHTML = items.length ? items.map(a => card(a, prefix)).join('') : '<p class="acard__empty">Zatím tu nejsou žádné články.</p>';
      el.setAttribute('aria-busy', 'false');
    }
  };

  const renderDetail = async () => {
    const el = $('[data-article]');
    if (!el) return;
    const slug = new URLSearchParams(location.search).get('c');
    const all = await loadAll('');
    const a = all.find(x => x.slug === slug);
    if (!a) {
      el.innerHTML = `<div class="wrap article__missing"><h1 class="sp-hero__title">Článek jsme nenašli</h1><p>Možná byl smazán nebo se změnila adresa.</p><a class="btn" href="clanky.html">Všechny články</a></div>`;
      return;
    }
    document.title = `${a.title} – Truhlářství Mareček Brno`;
    const meta = $('meta[name="description"]');
    if (meta) meta.setAttribute('content', a.perex || '');
    $('[data-a-title]', el).textContent = a.title;
    $('[data-a-crumb]', el).textContent = a.title;
    const t = $('[data-a-date]', el);
    t.textContent = fmtDate(a.date); t.setAttribute('datetime', a.date || '');
    $('[data-a-perex]', el).textContent = a.perex || '';
    const fig = $('[data-a-img]', el);
    if (a.image) { const img = $('img', fig); img.src = a.image; img.alt = a.imageAlt || a.title; } else fig.remove();
    $('[data-a-body]', el).innerHTML = md(a.body);
    if (a.local) $('[data-a-local]', el).hidden = false;
    const more = $('[data-articles]');
    if (more) more.dataset.exclude = a.slug;
  };

  window.TMClanky = { STORE, getLocal, saveLocal, md, fmtDate, esc, loadAll };

  renderDetail().then(renderLists);
})();
