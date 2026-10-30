(() => {
  'use strict';
  const data = window.APP_DATA;
  let standardData = window.STANDARDS_115 || { layouts: {}, programs: {} };
  let standards = standardData.programs || {};
  let standardsPromise;
  const programByCode = new Map(data.programs.map(program => [program.code, program]));
  const standardSourceBase = 'https://www.cac.edu.tw/CacLink/apply115/115Apply_sievE_Result_querY_615JG8Wgh9d/html_sieve_result_115_Zx57f1dW/Standard/report/';
  const subjects = data.subjects;
  const state = { query: '', school: '', category: '', comparison: '', selected: new Set(), mode: 'all', noSubject: false, sort: 'code', limit: 50 };
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const format = number => new Intl.NumberFormat('zh-TW').format(number);
  const normalize = value => String(value).toLowerCase().replace(/臺/g, '台').replace(/\s/g, '');

  $('total-programs').textContent = format(data.programs.length);
  $('total-schools').textContent = format(data.schools.length);
  $('school').insertAdjacentHTML('beforeend', data.schools.map(s => `<option value="${s.code}">${escapeHtml(s.name)}（${s.code}）</option>`).join(''));
  $('category').insertAdjacentHTML('beforeend', data.categories.map(c => `<option value="${c}">${c}</option>`).join(''));
  $('subject-options').innerHTML = subjects.map(s => `<label class="subject-option"><input type="checkbox" value="${s}"><span>${s}</span><small>${format(data.programs.filter(p => p.subjects.includes(s)).length)}</small></label>`).join('');

  function filtered() {
    const q = normalize(state.query);
    const selected = [...state.selected];
    const rows = data.programs.filter(p => {
      if (q && !normalize(`${p.code}${p.name}${p.school}${p.schoolCode}`).includes(q)) return false;
      if (state.school && p.schoolCode !== state.school) return false;
      if (state.category && p.category !== state.category) return false;
      if (state.comparison && p.change !== state.comparison) return false;
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
    const previous = p.previous ? `<div class="tags">${subjectTags(p.previous.subjects, p.removed, 'removed')}</div>${p.previous.code !== p.code ? `<span class="previous-code">115 代碼 ${p.previous.code}</span>` : ''}` : '<span class="unmatched">無同名紀錄</span>';
    const change = p.change === 'changed' ? '<span class="change-pill changed">科目有變動</span>' : p.change === 'unmatched' ? '<span class="change-pill unmatched-pill">待核對</span>' : '';
    const hasStandards = Boolean(p.previous);
    const standardButton = `<button class="standard-button" type="button" data-program-code="${p.code}" ${hasStandards ? '' : 'disabled title="沒有可對應的 115 年篩選標準"'}>115 篩選標準</button>`;
    return `<tr><td data-label="116 校系"><span class="program-name">${escapeHtml(p.name)}</span><span class="program-code">${p.code}</span>${change}${standardButton}</td><td data-label="學校"><span class="school-name">${escapeHtml(p.school)}</span></td><td data-label="類別"><span class="category">${p.category}</span></td><td data-label="116 參採科目"><div class="tags">${current}</div></td><td data-label="115 參採科目">${previous}</td><td data-label="原始資料"><a class="pdf-link" href="data/${p.schoolCode}.pdf#page=${p.page}" target="_blank" rel="noopener noreferrer" aria-label="查看${escapeHtml(p.school)}${escapeHtml(p.name)}的 116 原始 PDF，第 ${p.page} 頁">116 PDF ↗</a></td></tr>`;
  }

  function criteriaTable(title, labels, cells) {
    return `<section class="standard-section"><h4>${title}</h4><table class="criteria-table"><thead><tr><th scope="col">科目／項目</th><th scope="col">${title === '檢定標準' ? '標準' : '數值'}</th></tr></thead><tbody>${labels.map((label, index) => { const cell = cells[index] || { text: '—', confidence: 1 }; const uncertain = cell.confidence < .7 && cell.text !== '—'; return `<tr><th scope="row">${escapeHtml(label)}</th><td${uncertain ? ' class="ocr-uncertain" title="圖片辨識結果待核對，請查看官方原表"' : ''}>${escapeHtml(cell.text)}${uncertain ? '<sup aria-label="待核對">?</sup>' : ''}</td></tr>`; }).join('')}</tbody></table></section>`;
  }

  function ensureStandards() {
    if (window.STANDARDS_115) return Promise.resolve();
    if (!standardsPromise) standardsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'data/standards.js?v=20261030b';
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
    if (!program || !program.previous) return;
    const rows = standards[program.previous.code];
    if (!rows || !rows.length) {
      $('standards-title').textContent = `${program.school} ${program.previous.name}`;
      $('standards-description').textContent = `115 校系代碼 ${program.previous.code}`;
      $('standards-content').innerHTML = '<p class="standard-error">暫無可對應的 115 年篩選標準資料。請查看官方原表。</p>';
      $('standards-source').href = `${standardSourceBase}${program.schoolCode}.htm`;
      showStandardsDialog();
      return;
    }
    $('standards-title').textContent = `${program.school} ${program.previous.name}`;
    $('standards-description').textContent = `115 校系代碼 ${program.previous.code}${program.previous.code !== program.code ? ` · 116 校系代碼 ${program.code}` : ''}`;
    $('standards-content').innerHTML = rows.map((row, index) => {
      const labels = standardData.layouts[row.layout];
      const details = labels.identity.slice(1).map((label, i) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(row.identity[i + 1].text)}</dd></div>`).join('');
      return `<article class="standard-record">${rows.length > 1 ? `<h3>原表第 ${index + 1} 列</h3>` : ''}<dl class="standard-details">${details}</dl><div class="standard-grid">${criteriaTable('檢定標準', labels.checks, row.checks)}${criteriaTable('篩選倍率', labels.ratios, row.ratios)}${criteriaTable('通過最低級分（分數）', labels.passes, row.passes)}</div><div class="standard-extra"><strong>同級分超額篩選</strong><span>${escapeHtml(row.extra.text)}</span></div></article>`;
    }).join('');
    $('standards-source').href = `${standardSourceBase}${program.schoolCode}.htm`;
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
    $('insight-scope').textContent = `目前範圍：${selectedSchool ? selectedSchool.name : '全部學校'}，${format(rows.length)} 筆符合條件的校系`;
    $('changed-count').textContent = format(rows.filter(p => p.change === 'changed').length);
    $('same-count').textContent = format(rows.filter(p => p.change === 'same').length);
    $('unmatched-count').textContent = format(rows.filter(p => p.change === 'unmatched').length);
    renderChart('subject-chart', subjects, subjects.map(s => rows.filter(p => p.subjects.includes(s)).length));
    const countLabels = ['0 科', '1 科', '2 科', '3 科', '4 科', '5 科', '6 科'];
    renderChart('count-chart', countLabels, countLabels.map((_, n) => rows.filter(p => p.subjects.length === n).length));
    $('no-subject').disabled = state.selected.size > 0;
    $('subject-options').classList.toggle('disabled', state.noSubject);
    $('subject-options').querySelectorAll('input').forEach(input => { input.disabled = state.noSubject; });
    return rows;
  }

  function changed() { state.limit = 50; render(); }
  $('search').addEventListener('input', event => { state.query = event.target.value; changed(); });
  $('school').addEventListener('change', event => { state.school = event.target.value; changed(); });
  $('category').addEventListener('change', event => { state.category = event.target.value; changed(); });
  $('comparison').addEventListener('change', event => { state.comparison = event.target.value; changed(); });
  $('subject-options').addEventListener('change', event => { if (event.target.checked) state.selected.add(event.target.value); else state.selected.delete(event.target.value); changed(); });
  document.querySelectorAll('input[name="subject-mode"]').forEach(input => input.addEventListener('change', event => { state.mode = event.target.value; changed(); }));
  $('no-subject').addEventListener('change', event => { state.noSubject = event.target.checked; changed(); });
  $('sort').addEventListener('change', event => { state.sort = event.target.value; changed(); });
  $('show-more').addEventListener('click', () => { state.limit += 50; render(); });
  $('result-rows').addEventListener('click', event => {
    const button = event.target.closest('button[data-program-code]');
    if (!button || button.disabled) return;
    const program = programByCode.get(button.dataset.programCode);
    button.disabled = true;
    button.textContent = '載入中…';
    ensureStandards().then(() => openStandards(program)).catch(() => {
      $('standards-title').textContent = `${program.school} ${program.name}`;
      $('standards-description').textContent = '115 年篩選標準';
      $('standards-content').innerHTML = '<p class="standard-error">篩選標準資料載入失敗，請重新整理網頁後再試；也可查看官方原表。</p>';
      $('standards-source').href = `${standardSourceBase}${program.schoolCode}.htm`;
      showStandardsDialog();
    }).then(() => { button.disabled = false; button.textContent = '115 篩選標準'; });
  });
  $('standards-close').addEventListener('click', closeStandards);
  $('standards-done').addEventListener('click', closeStandards);
  $('reset-filters').addEventListener('click', () => {
    Object.assign(state, { query: '', school: '', category: '', comparison: '', selected: new Set(), mode: 'all', noSubject: false, sort: 'code', limit: 50 });
    $('search').value = ''; $('school').value = ''; $('category').value = ''; $('comparison').value = ''; $('sort').value = 'code'; $('no-subject').checked = false;
    document.querySelector('input[name="subject-mode"][value="all"]').checked = true;
    $('subject-options').querySelectorAll('input').forEach(input => { input.checked = false; });
    render();
  });
  $('export-csv').addEventListener('click', () => {
    const rows = filtered();
    const values = [['116校系代碼', '116校系名稱', '學校代碼', '學校名稱', '類別', '116參採科目', '115校系代碼', '115參採科目', '比較結果', '116新增科目', '116移除科目', '116 PDF網址'], ...rows.map(p => [p.code, p.name, p.schoolCode, p.school, p.category, p.subjects.join('、') || '不參採', p.previous ? p.previous.code : '', p.previous ? p.previous.subjects.join('、') || '不參採' : '無同名紀錄', p.change, p.added.join('、'), p.removed.join('、'), `https://www.cac.edu.tw/apply116/Classification_readfile.php?fileid=${p.schoolCode}`])];
    const csv = '\ufeff' + values.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `116_115申請入學參採科目比較_${rows.length}筆.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
})();
