/**
 * 🧮 DDD 計算器 - 獨立邏輯引擎 (不依賴 app.js)
 * 資料來源：data/toolbox_master.json (116 筆抗高血壓藥 Master Data)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const select1 = document.getElementById('drug-select-1');
  const select2 = document.getElementById('drug-select-2');
  const select3 = document.getElementById('drug-select-3');

  const dose1 = document.getElementById('drug-dose-1');
  const dose2 = document.getElementById('drug-dose-2');
  const dose3 = document.getElementById('drug-dose-3');

  const info1 = document.getElementById('drug-info-1');
  const info2 = document.getElementById('drug-info-2');
  const info3 = document.getElementById('drug-info-3');

  const tableBody = document.getElementById('ddd-results-tbody');
  const totalDddEl = document.getElementById('total-ddd-value');

  let masterData = [];

  try {
    const res = await fetch('data/toolbox_master.json');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    masterData = await res.json();
    initApp();
  } catch (err) {
    console.error('Failed to load Master Data:', err);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="7" style="color:#dc2626;text-align:center;">載入 116 筆 Master Data 失敗，請確認檔案路徑。</td></tr>`;
    }
  }

  function initApp() {
    populateSelects();
    attachEventListeners();
    calculateAndRender();
  }

  function populateSelects() {
    // Sort Master Data alphabetically by brand_name
    const sortedData = [...masterData].sort((a, b) => a.brand_name.localeCompare(b.brand_name));

    const buildOptions = (isOptional) => {
      let html = isOptional ? `<option value="">-- 無 --</option>` : `<option value="">-- 請選擇藥品 --</option>`;
      sortedData.forEach(item => {
        const combTag = item.is_combination ? ' [複方]' : '';
        html += `<option value="${escapeHtml(item.id)}">${escapeHtml(item.brand_name)} (${escapeHtml(item.generic_name)})${combTag}</option>`;
      });
      return html;
    };

    select1.innerHTML = buildOptions(false);
    select2.innerHTML = buildOptions(true);
    select3.innerHTML = buildOptions(true);

    // Default select first item for Drug 1 if available
    if (sortedData.length > 0) {
      select1.value = sortedData[0].id;
    }
  }

  function attachEventListeners() {
    [select1, select2, select3, dose1, dose2, dose3].forEach(el => {
      if (el) el.addEventListener('change', calculateAndRender);
    });
  }

  function getDrugData(id) {
    return masterData.find(item => item.id === id) || null;
  }

  function renderDrugCardInfo(drug, doseVal, infoContainer) {
    if (!drug) {
      infoContainer.innerHTML = `<div style="color:var(--ddd-text-muted);font-style:italic;">未選擇藥品</div>`;
      return;
    }

    let compHtml = '';
    drug.components.forEach(c => {
      const whoStr = c.is_valid_ddd ? `${c.who_ddd_mg} mg` : `<span class="ddd-status--invalid">未提供 / ${escapeHtml(c.who_ddd_raw || '無')}</span>`;
      const perTabStr = c.is_valid_ddd ? `${c.ddd_per_tab.toFixed(4)} DDD` : `<span class="ddd-status--invalid">無法計算</span>`;
      compHtml += `
        <div class="ddd-info-box__item">
          <span>成分：<strong>${escapeHtml(c.name)}</strong> (${c.dose_raw || c.dose_mg} mg)</span>
          <span>WHO DDD: ${whoStr} (每錠 ${perTabStr})</span>
        </div>
      `;
    });

    infoContainer.innerHTML = `
      <div class="ddd-info-box">
        <div style="font-weight:700;margin-bottom:0.35rem;color:var(--ddd-text-primary);">
          ${escapeHtml(drug.brand_name)} - ${escapeHtml(drug.generic_name)}
          ${drug.is_combination ? '<span class="ddd-tag ddd-tag--combo">複方</span>' : '<span class="ddd-tag ddd-tag--mono">單方</span>'}
        </div>
        ${compHtml}
      </div>
    `;
  }

  function calculateAndRender() {
    const slots = [
      { select: select1, dose: dose1, info: info1, label: '藥品一' },
      { select: select2, dose: dose2, info: info2, label: '藥品二' },
      { select: select3, dose: dose3, info: info3, label: '藥品三' }
    ];

    let rowsHtml = '';
    let totalDailyDdd = 0;
    let hasInvalidComp = false;
    let selectedCount = 0;

    slots.forEach(slot => {
      const drugId = slot.select.value;
      const drug = getDrugData(drugId);
      const pillsPerDay = parseFloat(slot.dose.value) || 1.0;

      renderDrugCardInfo(drug, pillsPerDay, slot.info);

      if (drug) {
        selectedCount++;
        drug.components.forEach((c, idx) => {
          let perTabDddStr = '';
          let dailyDddStr = '';

          if (c.is_valid_ddd) {
            const dailyDdd = c.ddd_per_tab * pillsPerDay;
            totalDailyDdd += dailyDdd;
            perTabDddStr = `<span class="ddd-status--valid">${c.ddd_per_tab.toFixed(4)}</span>`;
            dailyDddStr = `<span class="ddd-status--valid" style="font-weight:800;color:var(--ddd-primary);">${dailyDdd.toFixed(4)}</span>`;
          } else {
            hasInvalidComp = true;
            perTabDddStr = `<span class="ddd-status--invalid">無法計算</span>`;
            dailyDddStr = `<span class="ddd-status--invalid">無法計算 / WHO DDD 未提供</span>`;
          }

          const drugNameCol = idx === 0 ? `
            <td rowspan="${drug.components.length}" style="vertical-align:top;font-weight:700;background:var(--ddd-bg-card);">
              <div>${escapeHtml(drug.brand_name)}</div>
              <div style="font-size:0.78rem;color:var(--ddd-text-muted);font-weight:normal;">${escapeHtml(drug.generic_name)}</div>
              ${drug.is_combination ? '<span class="ddd-tag ddd-tag--combo" style="margin-top:0.25rem;">複方</span>' : ''}
            </td>
            <td rowspan="${drug.components.length}" style="vertical-align:top;text-align:center;">
              ${pillsPerDay} 顆/天
            </td>
          ` : '';

          rowsHtml += `
            <tr>
              ${drugNameCol}
              <td style="font-weight:600;">${escapeHtml(c.name)}</td>
              <td>${escapeHtml(c.dose_raw || c.dose_mg)} mg</td>
              <td>${c.is_valid_ddd ? c.who_ddd_mg + ' mg' : '<span class="ddd-status--invalid">未提供 (' + escapeHtml(c.who_ddd_raw) + ')</span>'}</td>
              <td>${perTabDddStr}</td>
              <td>${dailyDddStr}</td>
            </tr>
          `;
        });
      }
    });

    if (selectedCount === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--ddd-text-muted);padding:2rem;">請在上方選擇至少一個藥品開始計算。</td></tr>`;
      totalDddEl.innerHTML = `<span style="font-size:1rem;color:var(--ddd-text-muted);">請選擇藥品</span>`;
      return;
    }

    tableBody.innerHTML = rowsHtml;

    if (hasInvalidComp) {
      totalDddEl.innerHTML = `<span class="ddd-summary-val--invalid">無法計算（含未提供 WHO DDD 成分）</span>`;
    } else {
      totalDddEl.innerHTML = `<span>${totalDailyDdd.toFixed(4)} <span style="font-size:1rem;font-weight:normal;color:var(--ddd-text-muted);">DDD / 天</span></span>`;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
