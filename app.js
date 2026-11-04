(() => {
  'use strict';
  const data = window.APP_DATA;
  let standardData = window.STANDARDS_115 || { layouts: {}, programs: {} };
  let standards = standardData.programs || {};
  let standardsPromise;
  let schoolDetails116Promise;
  const programByCode = new Map(data.programs.map(program => [program.code, program]));
  const englishListeningCodes = new Set(window.TELC_116.codes);
  const standardSourceBase = 'https://www.cac.edu.tw/CacLink/apply115/115Apply_sievE_Result_querY_615JG8Wgh9d/html_sieve_result_115_Zx57f1dW/Standard/report/';
  const subjects = data.subjects;
  const state = { query: '', school: '', region: '', academicGroup: '', category: '', comparison: '', selected: new Set(), mode: 'all', noSubject: false, englishListening: false, sort: 'code', limit: 50 };
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const format = number => new Intl.NumberFormat('zh-TW').format(number);
  const normalize = value => String(value).toLowerCase().replace(/臺/g, '台').replace(/\s/g, '');

  $('total-programs').textContent = format(data.programs.length);
  $('total-schools').textContent = format(data.schools.length);
  $('english-listening-count').textContent = format(englishListeningCodes.size);
  $('school').insertAdjacentHTML('beforeend', data.schools.map(s => `<option value="${s.code}">${escapeHtml(s.name)}（${s.code}）</option>`).join(''));
  $('region').insertAdjacentHTML('beforeend', data.regions.map(region => `<option value="${region.code}">${escapeHtml(region.name)}</option>`).join(''));
  $('academic-group').insertAdjacentHTML('beforeend', data.academicGroups.map(group => ({ group, count: data.programs.filter(program => program.academicGroups.includes(group)).length })).filter(({ count }) => count > 0).map(({ group, count }) => `<option value="${escapeHtml(group)}">${escapeHtml(group)}（${format(count)}）</option>`).join(''));
  $('category').insertAdjacentHTML('beforeend', data.categories.map(c => `<option value="${c}">${c}</option>`).join(''));
  $('subject-options').innerHTML = subjects.map(s => `<label class="subject-option"><input type="checkbox" value="${s}"><span>${s}</span><small>${format(data.programs.filter(p => p.subjects.includes(s)).length)}</small></label>`).join('');

  function filtered() {
    const q = normalize(state.query);
    const selected = [...state.selected];
    const rows = data.programs.filter(p => {
      if (q && !normalize(`${p.code}${p.name}${p.school}${p.schoolCode}`).includes(q)) return false;
      if (state.school && p.schoolCode !== state.school) return false;
      if (state.region && p.regionCode !== state.region) return false;
      if (state.academicGroup && !p.academicGroups.includes(state.academicGroup)) return false;
      if (state.category && p.category !== state.category) return false;
      if (state.comparison && p.change !== state.comparison) return false;
      if (state.englishListening && !englishListeningCodes.has(p.code)) return false;
      if (state.noSubject) return p.subjects.length === 0;
      if (!selected.length) return true;
      if (state.mode === 'any') return selected.some(s => p.subjects.includes(s));
      if (state.mode === 'exact') return p.subjects.length === selected.length && selected.every(s => p.subjects.includes(s));
      return selected.every(s => p.subjects.includes(s));
    });
    if (state.sort === 'school') rows.sort((a, b) => a.school.localeCompare(b.school, 'zh-Hant') || a.code.localeCompare(b.code));
    if (state.sort === 'subjectCount') rows.sort((a, b) => b.subjects.length - a.subjects.length || a.code.localeCompare(b.code));
    return rows;
  }

  function subjectTags(items, emphasized, style) {
    const cells = subjects.map(s => `<span class="tag-slot"${items.includes(s) ? '' : ' aria-hidden="true"'}>${items.includes(s) ? `<span class="tag ${emphasized.includes(s) ? style : ''}">${escapeHtml(s)}</span>` : ''}</span>`).join('');
    return cells + (items.length ? '' : '<span class="subject-empty-note">不參採</span>');
  }

  function rowHtml(p) {
    const current = subjectTags(p.subjects, p.added, 'added');
    const previous = p.previous ? `<div class="tags">${subjectTags(p.previous.subjects, p.removed, 'removed')}</div>` : '<span class="unmatched">無同名紀錄</span>';
    const previousCode = p.previous && p.previous.code !== p.code ? `<span class="previous-code">115 代碼 ${p.previous.code}</span>` : '';
    const change = p.change === 'changed' ? '<span class="change-pill changed">科目有變動</span>' : p.change === 'unmatched' ? '<span class="change-pill unmatched-pill">待核對</span>' : '';
    const standardButton = `<button class="standard-button" type="button" data-program-code="${p.code}">115／116 篩選標準</button>`;
    return `<tr><td data-label="116 校系"><span class="program-name">${escapeHtml(p.name)}</span><span class="program-codes"><span class="program-code">${p.code}</span>${previousCode}</span><span class="program-group">學群：${escapeHtml(p.academicGroups.join('／'))}</span>${change}${standardButton}</td><td data-label="學校"><span class="school-name">${escapeHtml(p.school)}</span></td><td data-label="類別"><span class="category">${p.category}</span></td><td data-label="116 參採科目"><div class="tags">${current}</div></td><td data-label="115 參採科目">${previous}</td><td data-label="原始資料"><a class="pdf-link" href="data/${p.schoolCode}.pdf#page=${p.page}" target="_blank" rel="noopener noreferrer" aria-label="查看${escapeHtml(p.school)}${escapeHtml(p.name)}的 116 原始 PDF，第 ${p.page} 頁">116 PDF ↗</a></td></tr>`;
  }

  function criteriaTable(title, labels, cells, className = '') {
    return `<section class="standard-section ${className}"><h4>${title}</h4><table class="criteria-table"><thead><tr><th scope="col">科目／項目</th><th scope="col">${title.includes('檢定標準') ? '標準' : '數值'}</th></tr></thead><tbody>${labels.map((label, index) => { const cell = cells[index] || { text: '—', confidence: 1 }; const uncertain = cell.confidence < .7 && cell.text !== '—'; return `<tr><th scope="row">${escapeHtml(label)}</th><td${uncertain ? ' class="ocr-uncertain" title="圖片辨識結果待核對，請查看官方原表"' : ''}>${escapeHtml(cell.text)}${uncertain ? '<sup aria-label="待核對">?</sup>' : ''}</td></tr>`; }).join('')}</tbody></table></section>`;
  }

  function currentCriteriaTable(title, values, combination = '') {
    const rows = Object.entries(values).map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
    const note = combination ? `<p class="standard-combination">學測科目組合：${escapeHtml(combination)}</p>` : '';
    return `<section class="standard-section standard-current"><h4>${title}</h4><table class="criteria-table"><thead><tr><th scope="col">科目／項目</th><th scope="col">${title.includes('檢定標準') ? '標準' : '數值'}</th></tr></thead><tbody>${rows}</tbody></table>${note}</section>`;
  }

  function previousApcsNote(title) {
    return `<section class="standard-section standard-apcs-note"><h4>${title}</h4><p>115 年 APCS 原表採雙層欄位，請開啟下方官方原表核對。</p></section>`;
  }

  function ensureSchoolDetails116() {
    if (window.schoolDetails116) return Promise.resolve();
    if (!schoolDetails116Promise) schoolDetails116Promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'data/school_116.js?v=20261103d';
      script.onload = resolve;
      script.onerror = () => { schoolDetails116Promise = null; reject(new Error('116 校系分則資料載入失敗')); };
      document.head.appendChild(script);
    });
    return schoolDetails116Promise;
  }

  function ensureStandards() {
    if (window.STANDARDS_115) return Promise.resolve();
    if (!standardsPromise) standardsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'data/standards.js?v=20261103b';
      script.onload = () => {
        standardData = window.STANDARDS_115 || { layouts: {}, programs: {} };
        standards = standardData.programs || {};
        resolve();
      };
      script.onerror = () => { standardsPromise = null; reject(new Error('標準資料載入失敗')); };
      document.head.appendChild(script);
    });
    return standardsPromise;
  }

  function openStandards(program) {
    if (!program) return;
    const current = (window.schoolDetails116 || {})[program.code];
    if (!current) throw new Error(`缺少 ${program.code} 的 116 年篩選標準`);
    const rows = program.previous ? standards[program.previous.code] || [] : [];
    $('standards-title').textContent = `${program.school} ${program.name}`;
    $('standards-description').textContent = `116 校系代碼 ${program.code}${program.previous ? ` · 115 校系代碼 ${program.previous.code}` : ' · 115 無同校同名紀錄'}`;
    $('standards-source').hidden = !program.previous;
    $('standards-source').href = program.previous ? `${standardSourceBase}${program.schoolCode}.htm` : '';
    $('school-detail-source-116').href = `https://www.cac.edu.tw/apply116/system/ColQry_116ApplyxForStudent_F75reOza/html/116_${program.code}.htm?v=1.0`;
    $('standards-content').innerHTML = (rows.length ? rows : [null]).map((row, index) => {
      const labels = row ? standardData.layouts[row.layout] : null;
      const details = row ? `<dl class="standard-details">${labels.identity.slice(1).map((label, i) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(row.identity[i + 1].text)}</dd></div>`).join('')}</dl>` : '<p class="standard-error">115 無同校同名篩選標準，以下顯示 116 年資料。</p>';
      const oldChecks = row ? row.layout === '一般:18' ? previousApcsNote('115 檢定標準') : criteriaTable('115 檢定標準', labels.checks, row.checks) : '';
      const oldRatios = row ? row.layout === '一般:18' ? previousApcsNote('115 篩選倍率') : criteriaTable('115 篩選倍率', labels.ratios, row.ratios) : '';
      const passes = row ? criteriaTable('115 通過最低級分（分數）', labels.passes, row.passes, 'standard-passes') : '';
      const grid = `${currentCriteriaTable('116 檢定標準', current.checks)}${oldChecks}${currentCriteriaTable('116 篩選倍率', current.ratios, current.combination)}${oldRatios}${passes}`;
      const extra = row ? `<div class="standard-extra"><strong>115 同級分超額篩選</strong><span>${escapeHtml(row.extra.text)}</span></div>` : '';
      return `<article class="standard-record">${rows.length > 1 ? `<h3>115 原表第 ${index + 1} 列</h3>` : ''}${details}<div class="standard-grid${row ? '' : ' current-only'}">${grid}</div>${extra}</article>`;
    }).join('');
    showStandardsDialog();
  }

  function showStandardsDialog() {
    const dialog = $('standards-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { dialog.setAttribute('open', ''); document.body.classList.add('dialog-open'); }
  }

  function closeStandards() {
    const dialog = $('standards-dialog');
    if (typeof dialog.close === 'function') dialog.close();
    else { dialog.removeAttribute('open'); document.body.classList.remove('dialog-open'); }
  }

  function renderChart(id, labels, counts) {
    const maximum = Math.max(...counts, 1);
    $(id).innerHTML = labels.map((label, index) => `<div class="bar-row"><span class="bar-label">${label}</span><span class="bar-track"><span class="bar-fill" style="display:block;width:${Math.round(counts[index] / maximum * 100)}%"></span></span><span class="bar-value">${format(counts[index])}</span></div>`).join('');
  }

  function render() {
    const rows = filtered();
    $('result-count').textContent = format(rows.length);
    $('result-rows').innerHTML = rows.slice(0, state.limit).map(rowHtml).join('');
    $('empty-state').hidden = rows.length !== 0;
    $('showing-count').textContent = rows.length ? `顯示 ${format(Math.min(state.limit, rows.length))} / ${format(rows.length)} 筆` : '顯示 0 筆';
    $('show-more').hidden = state.limit >= rows.length;
    const selectedSchool = data.schools.find(s => s.code === state.school);
    const selectedRegion = data.regions.find(region => region.code === state.region);
    $('insight-scope').textContent = `目前範圍：${selectedSchool ? selectedSchool.name : '全部學校'}${selectedRegion ? `，${selectedRegion.name}` : ''}${state.academicGroup ? `，${state.academicGroup}學群` : ''}，${format(rows.length)} 筆符合條件的校系`;
    $('changed-count').textContent = format(rows.filter(p => p.change === 'changed').length);
    $('same-count').textContent = format(rows.filter(p => p.change === 'same').length);
    $('unmatched-count').textContent = format(rows.filter(p => p.change === 'unmatched').length);
    renderChart('subject-chart', subjects, subjects.map(s => rows.filter(p => p.subjects.includes(s)).length));
    const countLabels = ['0 科', '1 科', '2 科', '3 科', '4 科', '5 科', '6 科'];
    renderChart('count-chart', countLabels, countLabels.map((_, n) => rows.filter(p => p.subjects.length === n).length));
    $('no-subject').disabled = state.selected.size > 0;
    $('english-listening-filter').setAttribute('aria-pressed', String(state.englishListening));
    $('subject-options').classList.toggle('disabled', state.noSubject);
    $('subject-options').querySelectorAll('input').forEach(input => { input.disabled = state.noSubject; });
    return rows;
  }

  function changed() { state.limit = 50; render(); }
  $('search').addEventListener('input', event => { state.query = event.target.value; changed(); });
  $('school').addEventListener('change', event => { state.school = event.target.value; changed(); });
  $('region').addEventListener('change', event => { state.region = event.target.value; changed(); });
  $('academic-group').addEventListener('change', event => { state.academicGroup = event.target.value; changed(); });
  $('category').addEventListener('change', event => { state.category = event.target.value; changed(); });
  $('comparison').addEventListener('change', event => { state.comparison = event.target.value; changed(); });
  $('subject-options').addEventListener('change', event => { if (event.target.checked) state.selected.add(event.target.value); else state.selected.delete(event.target.value); changed(); });
  document.querySelectorAll('input[name="subject-mode"]').forEach(input => input.addEventListener('change', event => { state.mode = event.target.value; changed(); }));
  $('no-subject').addEventListener('change', event => { state.noSubject = event.target.checked; changed(); });
  $('english-listening-filter').addEventListener('click', () => { state.englishListening = !state.englishListening; changed(); });
  $('sort').addEventListener('change', event => { state.sort = event.target.value; changed(); });
  $('show-more').addEventListener('click', () => { state.limit += 50; render(); });
  $('result-rows').addEventListener('click', event => {
    const button = event.target.closest('button[data-program-code]');
    if (!button || button.disabled) return;
    const program = programByCode.get(button.dataset.programCode);
    button.disabled = true;
    button.textContent = '載入中…';
    Promise.all([ensureSchoolDetails116(), program.previous ? ensureStandards() : Promise.resolve()]).then(() => openStandards(program)).catch(() => {
      $('standards-title').textContent = `${program.school} ${program.name}`;
      $('standards-description').textContent = '115／116 年篩選標準';
      $('standards-content').innerHTML = '<p class="standard-error">篩選標準資料載入失敗，請重新整理網頁後再試；也可查看官方校系分則。</p>';
      $('standards-source').hidden = !program.previous;
      $('standards-source').href = program.previous ? `${standardSourceBase}${program.schoolCode}.htm` : '';
      $('school-detail-source-116').href = `https://www.cac.edu.tw/apply116/system/ColQry_116ApplyxForStudent_F75reOza/html/116_${program.code}.htm?v=1.0`;
      showStandardsDialog();
    }).finally(() => { button.disabled = false; button.textContent = '115／116 篩選標準'; });
  });
  $('standards-close').addEventListener('click', closeStandards);
  $('standards-done').addEventListener('click', closeStandards);
  $('reset-filters').addEventListener('click', () => {
    Object.assign(state, { query: '', school: '', region: '', academicGroup: '', category: '', comparison: '', selected: new Set(), mode: 'all', noSubject: false, englishListening: false, sort: 'code', limit: 50 });
    $('search').value = ''; $('school').value = ''; $('region').value = ''; $('academic-group').value = ''; $('category').value = ''; $('comparison').value = ''; $('sort').value = 'code'; $('no-subject').checked = false;
    document.querySelector('input[name="subject-mode"][value="all"]').checked = true;
    $('subject-options').querySelectorAll('input').forEach(input => { input.checked = false; });
    render();
  });
  render();
})();
