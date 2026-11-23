/* Správa článků – ukázková verze bez přihlášení.
   Články se ukládají do localStorage tohoto prohlížeče (klíč TMClanky.STORE).
   V ostré verzi se místo localStorage napojí přihlášení a ukládání na web. */
(() => {
  const T = window.TMClanky;
  const $ = (s, c = document) => c.querySelector(s);
  const form = $('[data-editor]');
  if (!T || !form) return;

  const f = name => form.elements[name];
  const status = $('[data-admin-status]');
  const photoInput = $('[data-photo]');
  const photoPrev = $('[data-photo-preview]');
  const photoRemove = $('[data-photo-remove]');
  const bodyEl = $('[data-body]');
  const btnDelete = $('[data-delete]');
  const btnView = $('[data-view]');
  const pv = { img: $('[data-pv-img]'), title: $('[data-pv-title]'), perex: $('[data-pv-perex]'), body: $('[data-pv-body]') };

  let current = null; // slug upravovaného článku
  let image = '';
  let slugTouched = false;

  const today = () => new Date().toISOString().slice(0, 10);
  const slugify = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  const say = (msg, ok = true) => { status.textContent = msg; status.classList.toggle('is-error', !ok); };

  /* ---------- seznamy ---------- */
  const renderLists = async () => {
    const local = T.getLocal().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const ul = $('[data-local-list]');
    ul.innerHTML = local.length ? local.map(a => `
      <li class="${a.slug === current ? 'is-current' : ''}">
        <button type="button" data-edit="${T.esc(a.slug)}">
          <span class="admin__item-title">${T.esc(a.title || 'Bez názvu')}</span>
          <span class="admin__item-meta">${T.fmtDate(a.date)} · ${a.published ? 'zveřejněno' : 'koncept'}</span>
        </button>
      </li>`).join('') : '<li class="admin__empty">Zatím žádné. Začněte tlačítkem Nový článek.</li>';

    let web = [];
    try { web = await fetch('data/clanky.json', { cache: 'no-cache' }).then(r => r.json()); } catch { /* nic */ }
    $('[data-web-list]').innerHTML = web.map(a => `
      <li><a href="clanek.html?c=${encodeURIComponent(a.slug)}" target="_blank" rel="noopener">
        <span class="admin__item-title">${T.esc(a.title)}</span>
        <span class="admin__item-meta">${T.fmtDate(a.date)} · na webu</span>
      </a></li>`).join('');
  };

  /* ---------- náhled ---------- */
  const preview = () => {
    pv.title.textContent = f('title').value || 'Název článku';
    pv.perex.textContent = f('perex').value;
    pv.body.innerHTML = T.md(bodyEl.value) || '<p class="admin__pv-empty">Tady uvidíte, jak bude článek vypadat.</p>';
    pv.img.hidden = !image;
    if (image) pv.img.src = image;
    photoPrev.hidden = !image;
    photoRemove.hidden = !image;
    if (image) photoPrev.src = image;
  };

  /* ---------- formulář ---------- */
  const fill = a => {
    current = a ? a.slug : null;
    form.reset();
    f('title').value = a?.title || '';
    f('date').value = a?.date || today();
    f('slug').value = a?.slug || '';
    f('perex').value = a?.perex || '';
    bodyEl.value = a?.body || '';
    image = a?.image || '';
    slugTouched = !!a;
    $('[data-editor-title]').textContent = a ? 'Upravit článek' : 'Nový článek';
    btnDelete.hidden = !a;
    btnView.hidden = !(a && a.published);
    if (a) btnView.href = `clanek.html?c=${encodeURIComponent(a.slug)}`;
    say('');
    preview();
    renderLists();
  };

  f('title').addEventListener('input', () => {
    if (!slugTouched) f('slug').value = slugify(f('title').value);
    preview();
  });
  f('slug').addEventListener('input', () => { slugTouched = true; });
  f('perex').addEventListener('input', preview);
  bodyEl.addEventListener('input', preview);

  /* fotka: zmenšíme v prohlížeči, ať se vejde do úložiště */
  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1400;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        image = c.toDataURL('image/jpeg', 0.78);
        preview();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  photoRemove.addEventListener('click', () => { image = ''; photoInput.value = ''; preview(); });

  /* panel s formátováním */
  const wrapSel = (before, after = '', placeholder = '') => {
    const s = bodyEl.selectionStart, e = bodyEl.selectionEnd;
    const sel = bodyEl.value.slice(s, e) || placeholder;
    bodyEl.setRangeText(before + sel + after, s, e, 'end');
    bodyEl.focus();
    preview();
  };
  $('.af-toolbar').addEventListener('click', e => {
    const b = e.target.closest('[data-fmt]');
    if (!b) return;
    const t = b.dataset.fmt;
    const atLineStart = bodyEl.selectionStart === 0 || bodyEl.value[bodyEl.selectionStart - 1] === '\n';
    const nl = atLineStart ? '' : '\n\n';
    if (t === 'h') wrapSel(nl + '## ', '', 'Nadpis');
    if (t === 'b') wrapSel('**', '**', 'tučný text');
    if (t === 'ul') wrapSel(nl + '- ', '', 'položka');
    if (t === 'a') {
      const url = prompt('Adresa odkazu (např. https://…)', 'https://');
      if (url) wrapSel('[', `](${url})`, 'text odkazu');
    }
  });

  /* uložení */
  const save = published => {
    const title = f('title').value.trim();
    if (!title) { say('Doplňte prosím název článku.', false); f('title').focus(); return; }
    const slug = slugify(f('slug').value || title) || 'clanek-' + Date.now();
    const list = T.getLocal();
    if (slug !== current && list.some(a => a.slug === slug)) { say('Článek s touto adresou už existuje. Upravte adresu.', false); f('slug').focus(); return; }
    const item = {
      slug, title, date: f('date').value || today(), perex: f('perex').value.trim(),
      body: bodyEl.value, image, published, updated: new Date().toISOString()
    };
    const next = list.filter(a => a.slug !== current && a.slug !== slug);
    next.push(item);
    if (!T.saveLocal(next)) { say('Článek se nepodařilo uložit – úložiště prohlížeče je plné. Zkuste menší fotku.', false); return; }
    current = slug;
    btnDelete.hidden = false;
    btnView.hidden = !published;
    btnView.href = `clanek.html?c=${encodeURIComponent(slug)}`;
    $('[data-editor-title]').textContent = 'Upravit článek';
    say(published ? 'Článek je zveřejněný (v tomto prohlížeči). Najdete ho na stránce Články.' : 'Koncept je uložený.');
    renderLists();
  };
  form.addEventListener('submit', e => { e.preventDefault(); save(true); });
  $('[data-draft]').addEventListener('click', () => save(false));

  btnDelete.addEventListener('click', () => {
    if (!current || !confirm('Opravdu smazat tento článek?')) return;
    T.saveLocal(T.getLocal().filter(a => a.slug !== current));
    fill(null);
    say('Článek byl smazán.');
  });

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-edit]');
    if (!b) return;
    const a = T.getLocal().find(x => x.slug === b.dataset.edit);
    if (a) { fill(a); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  $('[data-new]').addEventListener('click', () => { fill(null); f('title').focus(); });

  $('[data-export]').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(T.getLocal(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'clanky-zaloha.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  fill(null);
})();
