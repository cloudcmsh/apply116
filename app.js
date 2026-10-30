(() => {
  'use strict';
  const data = window.APP_DATA;
  const subjects = data.subjects;
  const state = { query: '', school: '', category: '', selected: new Set(), mode: 'all', noSubject: false, sort: 'code', limit: 50 };
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const format = number => new Intl.NumberFormat('zh-TW').format(number);
  const normalize = value => String(value).toLowerCase().replaceAll('臺', '台').replace(/\s/g, '');

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

  function rowHtml(p) {
    const tags = p.subjects.length ? p.subjects.map(s => `<span class="tag">${s}</span>`).join('') : '<span class="tag no">不參採</span>';
    return `<tr><td><span class="program-name">${escapeHtml(p.name)}</span><span class="program-code">${p.code}</span></td><td><span class="school-name">${escapeHtml(p.school)}</span></td><td><span class="category">${p.category}</span></td><td><div class="tags">${tags}</div></td><td><a class="pdf-link" href="data/${p.schoolCode}.pdf#page=${p.page}" target="_blank" rel="noopener noreferrer" aria-label="查看${escapeHtml(p.school)}${escapeHtml(p.name)}的原始 PDF，第 ${p.page} 頁">PDF ↗</a></td></tr>`;
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
  $('subject-options').addEventListener('change', event => { if (event.target.checked) state.selected.add(event.target.value); else state.selected.delete(event.target.value); changed(); });
  document.querySelectorAll('input[name="subject-mode"]').forEach(input => input.addEventListener('change', event => { state.mode = event.target.value; changed(); }));
  $('no-subject').addEventListener('change', event => { state.noSubject = event.target.checked; changed(); });
  $('sort').addEventListener('change', event => { state.sort = event.target.value; changed(); });
  $('show-more').addEventListener('click', () => { state.limit += 50; render(); });
  $('reset-filters').addEventListener('click', () => {
    Object.assign(state, { query: '', school: '', category: '', selected: new Set(), mode: 'all', noSubject: false, sort: 'code', limit: 50 });
    $('search').value = ''; $('school').value = ''; $('category').value = ''; $('sort').value = 'code'; $('no-subject').checked = false;
    document.querySelector('input[name="subject-mode"][value="all"]').checked = true;
    $('subject-options').querySelectorAll('input').forEach(input => { input.checked = false; });
    render();
  });
  $('export-csv').addEventListener('click', () => {
    const rows = filtered();
    const values = [['校系代碼', '校系名稱', '學校代碼', '學校名稱', '類別', '參採科目', 'PDF網址'], ...rows.map(p => [p.code, p.name, p.schoolCode, p.school, p.category, p.subjects.join('、') || '不參採', `https://www.cac.edu.tw/apply116/Classification_readfile.php?fileid=${p.schoolCode}`])];
    const csv = '\ufeff' + values.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `116申請入學參採科目_${rows.length}筆.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
})();
