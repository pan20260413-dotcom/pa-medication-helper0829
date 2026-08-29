/* ==========================================================================
   PA 臨床藥物影響助手 - 核心邏輯 (包含 Base64 100% 圖片顯示、繁體中文注音 IME 輸入優化、Exforge 拆解與 PA/ARR 研究工具)
   ========================================================================== */

const app = document.querySelector('#app');
const mainNav = document.querySelector('#main-nav');
const modalOverlay = document.querySelector('#image-modal-overlay');
const modalCloseBtn = document.querySelector('#modal-close-btn');
const modalContent = document.querySelector('#modal-content');

let medications = [];
let selectedCategories = 'ALL';
let searchTerm = '';
let calculatorSelectedIds = new Set(['spironolactone', 'bisoprolol']);
let researchSelectedIds = new Set(['bisoprolol', 'valsartan']);

// 研究版試算欄位
let researchPac = 15;
let researchPra = 0.5;

// 臨床路徑 SIT / CST 確診試驗欄位
let sitPostPac = 12;
let cstPostPac = 15;
let cstPacSuppressionPct = 15;

let compareDrugA = 'valsartan';
let compareDrugB = 'amlodipine';

// 轉義 HTML
const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

/* ==========================================================================
   彈窗大圖檢視 (Modal Viewer)
   ========================================================================== */

function openImageModal(medId) {
  const med = medications.find(m => m.id === medId);
  if (!med || !modalOverlay || !modalContent) return;

  modalContent.innerHTML = `
    <div style="text-align:center;">
      <span style="font-size:0.78rem;font-weight:800;color:var(--primary);background:var(--primary-soft);padding:0.25rem 0.65rem;border-radius:4px;">
        ${escapeHtml(med.category_name_zh || med.category)}
      </span>
      <h2 style="font-size:1.6rem;font-weight:900;color:var(--primary-dark);margin-top:0.35rem;">
        ${escapeHtml(med.generic_name)}
      </h2>
      <div style="font-size:1rem;color:var(--text-body);font-weight:700;">
        ${escapeHtml(med.localized_names ? med.localized_names.join(' / ') : '')}
      </div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem;">
        台灣常見商品名：${escapeHtml(med.brand_names ? med.brand_names.join(', ') : '')}
      </div>

      <div style="background:#ffffff;border:2px solid var(--border);border-radius:12px;padding:1.25rem;margin-bottom:1rem;display:grid;place-items:center;">
        <img src="${escapeHtml(med.image)}" alt="${escapeHtml(med.generic_name)}" style="max-width:100%;height:auto;max-height:260px;object-fit:contain;border-radius:8px;box-shadow:var(--shadow-sm);" />
      </div>

      ${med.image_kind === 'illustration' ? `<p style="margin:-0.35rem 0 0.9rem;font-size:0.78rem;color:var(--text-muted);">外觀示意圖，非實物照片；請以實際藥品與包裝標示為準。</p>` : ''}
      ${med.image_source ? `<p style="margin:-0.35rem 0 0.9rem;font-size:0.74rem;color:var(--text-muted);">圖片／外觀來源：${escapeHtml(med.image_source)}</p>` : ''}

      <div style="text-align:left;background:var(--primary-soft);border:1px solid #bfdbfe;border-radius:8px;padding:0.85rem 1rem;font-size:0.88rem;">
        <strong style="color:var(--primary-dark);">💊 藥物實體外觀特徵標示：</strong>
        <p style="color:var(--text-body);margin-top:0.25rem;">${escapeHtml(med.pill_appearance || '請對照原廠藥盒與藥錠號碼')}</p>
      </div>

      ${med.is_combination ? `
        <div style="margin-top:0.75rem;text-align:left;background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:0.75rem 1rem;font-size:0.85rem;color:#713f12;">
          <strong>🧪 複方成分拆解與說明：</strong>
          <div style="margin-top:0.25rem;">
            <strong>包含成分：</strong>${escapeHtml(med.combination_components)}<br>
            <strong>成分分類：</strong>${escapeHtml(med.combination_categories)}<br>
            <strong>臨床評估：</strong>${escapeHtml(med.combination_notes)}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  modalOverlay.style.display = 'grid';
}

if (modalCloseBtn && modalOverlay) {
  modalCloseBtn.addEventListener('click', () => { modalOverlay.style.display = 'none'; });
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) modalOverlay.style.display = 'none';
  });
}

function updateNavActive(routeName) {
  if (!mainNav) return;
  mainNav.querySelectorAll('.nav-item').forEach(el => {
    if (el.dataset.route === routeName) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

function getArrBadge(med) {
  if (med.is_preferred_for_pa_screening) {
    return `<span class="arr-impact-badge arr-impact-badge--preferred">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      影響極小／洗脫期首選控壓藥
    </span>`;
  }
  if (med.arr_effect_type === 'false_positive') {
    return `<span class="arr-impact-badge arr-impact-badge--fp">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      可能造成 ARR 偏高 (假陽性)
    </span>`;
  }
  return `<span class="arr-impact-badge arr-impact-badge--fn">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
    可能造成 ARR 偏低 (假陰性)
  </span>`;
}

function renderTfdaSectionHtml(med) {
  const portalUrl = 'https://lmspiq.fda.gov.tw/web/DRPIQ/license-search';
  if (med.tfda_specs && med.tfda_specs.length > 0) {
    return med.tfda_specs.map(s => {
      const label = s.brand_spec || s.official_name || s.spec;
      const text = label ? `${s.license}（${label}）` : s.license;
      return `<div style="font-size:0.8rem;margin-top:0.25rem;color:var(--text-body);display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;">
         <span>🇹🇼 <strong>TFDA 藥證字號：</strong>${escapeHtml(text)}</span> 
         <a href="${escapeHtml(s.url || portalUrl)}" target="_blank" rel="noopener noreferrer" class="info-cite-icon" title="前往衛生福利部食品藥物管理署 (TFDA) 官方藥品許可證查詢系統">ⓘ TFDA 官方藥品許可證查詢</a>
       </div>`;
    }).join('');
  }
  const licenseText = med.tfda_license || '待確認';
  const url = med.tfda_url || portalUrl;
  return `<div style="font-size:0.8rem;margin-top:0.25rem;color:var(--text-body);display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;">
     <span>🇹🇼 <strong>TFDA 藥證字號：</strong>${escapeHtml(licenseText)}</span> 
     <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="info-cite-icon" title="前往衛生福利部食品藥物管理署 (TFDA) 官方藥品許可證查詢系統">ⓘ TFDA 官方藥品許可證查詢</a>
   </div>`;
}


function renderFdaSectionHtml(med) {
  if (med.dailymed_url) {
    return `<div style="font-size:0.8rem;margin-top:0.25rem;color:var(--text-body);display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;">
       <span>🇺🇸 <strong>美國 FDA / DailyMed：</strong></span> 
       <a href="${escapeHtml(med.dailymed_url)}" target="_blank" rel="noopener noreferrer" class="info-cite-icon" title="前往 US FDA DailyMed 官方藥品資料">ⓘ FDA / DailyMed 查證</a>
     </div>`;
  }
  return `<div style="font-size:0.8rem;margin-top:0.25rem;color:var(--text-muted);">
     <span>🇺🇸 <strong>美國 FDA / DailyMed：</strong>未找到對應資料</span>
   </div>`;
}

/* ==========================================================================
   ROUTE 1: HOME PORTAL (首頁 - 支援 100% 繁體中文 IME 輸入)
   ========================================================================== */

function getFilteredMedications() {
  const term = searchTerm.trim().toLowerCase();
  return medications.filter(med => {
    const matchesCat = selectedCategories === 'ALL' || 
      (selectedCategories === 'Diuretics' && (med.category.includes('diuretics') || med.category.includes('Diuretic'))) ||
      med.category === selectedCategories;

    const searchables = [
      med.generic_name,
      ...(med.localized_names || []),
      ...(med.brand_names || []),
      med.pill_appearance || '',
      med.combination_components || '',
      med.combination_categories || '',
      med.category,
      med.mechanism
    ].join(' ').toLowerCase();

    return matchesCat && (!term || searchables.includes(term));
  });
}

function renderMedicationCardsHtml(filteredList) {
  if (!filteredList.length) {
    return `
      <div style="grid-column:1/-1;text-align:center;padding:3rem 1rem;background:#ffffff;border-radius:10px;border:1px solid var(--border);">
        <p style="font-size:1.1rem;color:var(--text-muted);">🔍 找不到符合「${escapeHtml(searchTerm)}」的藥物資料</p>
        <p style="font-size:0.85rem;color:var(--text-light);margin-top:0.25rem;">請嘗試搜尋商品名 (如 Exforge 易安穩, Diovan 代文, Norvasc 脈優, 博脈舒, 優力莎, 安脈, 落沙, 卡杜特)。</p>
      </div>
    `;
  }

  return filteredList.map(med => `
    <article class="med-p-card">
      <div class="med-p-card__top">
        <div class="med-p-card__pill-icon" data-zoom-id="${med.id}" title="點擊檢視大圖外觀包裝">
          <img src="${escapeHtml(med.image)}" alt="${escapeHtml(med.generic_name)}" />
        </div>
        <div class="med-p-card__names">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
            <div>
              <span class="med-p-card__tag">${escapeHtml(med.category)}</span>
              ${med.is_combination ? `<span class="combo-tag">複方藥物</span>` : ''}
            </div>
            <span style="font-size:0.75rem;color:var(--text-muted);font-weight:700;">洗脫 ${escapeHtml(med.washout_period)}</span>
          </div>
          <h3 class="med-p-card__generic">
            ${escapeHtml(med.generic_name)}
          </h3>
          <span class="med-p-card__zh">${escapeHtml(med.localized_names ? med.localized_names.join('/') : '')}</span>
          <span class="med-p-card__brands">常用商品：${escapeHtml(med.brand_names ? med.brand_names.join(', ') : '無')}</span>
          
          <div style="margin-top:0.4rem;padding-top:0.35rem;border-top:1px dashed var(--border);">
            ${renderTfdaSectionHtml(med)}
            ${renderFdaSectionHtml(med)}
          </div>
        </div>
      </div>

      <!-- Exforge 易安穩等複方藥物拆解 -->
      ${med.is_combination ? `
        <div class="combo-breakdown-box">
          <div style="font-weight:800;display:flex;align-items:center;gap:0.35rem;margin-bottom:0.15rem;">
            <span>🔬 複方拆解成分：</span>
            <span>${escapeHtml(med.combination_components)}</span>
          </div>
          <div style="font-size:0.78rem;"><strong>成分分類：</strong>${escapeHtml(med.combination_categories)}</div>
        </div>
      ` : ''}

      <div style="font-size:0.82rem;color:var(--text-body);background:var(--bg-page);padding:0.4rem 0.6rem;border-radius:6px;border:1px dashed var(--border);display:flex;align-items:center;gap:0.4rem;">
        <span style="font-weight:700;color:var(--primary);flex-shrink:0;">💊 外觀：</span>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(med.pill_appearance || '請參閱藥盒標示')}</span>
      </div>

      <div>
        ${getArrBadge(med)}
      </div>

      <div class="med-p-card__metrics">
        <div class="metric-col">
          <span class="metric-col__label">PAC (醛固酮)</span>
          <span class="metric-col__val ${med.pac_effect.includes('↑') ? 'up' : (med.pac_effect.includes('↓') ? 'down' : 'flat')}">${escapeHtml(med.pac_effect)}</span>
        </div>
        <div class="metric-col">
          <span class="metric-col__label">PRA (腎素)</span>
          <span class="metric-col__val ${med.pra_effect.includes('↑') ? 'up' : (med.pra_effect.includes('↓') ? 'down' : 'flat')}">${escapeHtml(med.pra_effect)}</span>
        </div>
        <div class="metric-col">
          <span class="metric-col__label">ARR 比值</span>
          <span class="metric-col__val ${med.arr_effect_type === 'false_positive' ? 'up' : (med.arr_effect_type === 'false_negative' ? 'down' : 'flat')}">${med.arr_effect_type === 'false_positive' ? '↑ (假陽)' : (med.arr_effect_type === 'false_negative' ? '↓ (假陰)' : '→ (影響小)')}</span>
        </div>
      </div>

      <div style="display:flex;gap:0.5rem;">
        <button type="button" class="btn btn-outline btn-sm flex-1" data-zoom-id="${med.id}">🖼️ 大圖對比</button>
        <a href="#/medicine/${encodeURIComponent(med.id)}" class="btn btn-primary btn-sm flex-1">📖 詳細說明</a>
      </div>
    </article>
  `).join('');
}

function renderHome() {
  updateNavActive('home');

  const categories = [
    { id: 'ALL', label: '常見降血壓藥物 (全部 33+ 種)' },
    { id: 'MRA', label: 'MRA 鹽皮質受體拮抗劑' },
    { id: 'Beta-blocker', label: 'Beta-blocker 乙型受體阻斷劑' },
    { id: 'ACEI', label: 'ACEI 轉化酶抑制劑' },
    { id: 'ARB', label: 'ARB 受體阻斷劑' },
    { id: 'CCB', label: 'CCB 鈣離子阻斷劑' },
    { id: 'Alpha-blocker', label: 'Alpha-blocker 腎上腺素阻斷劑' },
    { id: 'Diuretics', label: '利尿劑 (Diuretics)' }
  ];

  const chipsHtml = categories.map(cat => {
    const activeClass = selectedCategories === cat.id ? 'active' : '';
    return `<button type="button" class="chip ${activeClass}" data-cat="${cat.id}">
      <span>${cat.label}</span>
    </button>`;
  }).join('');

  const filtered = getFilteredMedications();
  const cardsHtml = renderMedicationCardsHtml(filtered);

  // 取得關鍵藥物 Base64 Image
  const valMed = medications.find(m => m.id === 'valsartan');
  const amlMed = medications.find(m => m.id === 'amlodipine');
  const canMed = medications.find(m => m.id === 'candesartan');
  const bisMed = medications.find(m => m.id === 'bisoprolol');

  app.innerHTML = `
    <!-- 1. Hero 區塊 -->
    <section class="hero-clinic">
      <div class="hero-clinic__left">
        <div class="version-tag">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          PA Clinical & Research Tool 2026
        </div>
        <h1>PA 臨床藥物影響助手</h1>
        <div class="hero-clinic__sub">原發性醛固酮過多症 (Primary Aldosteronism, PA)<br>降血壓藥物實體照片外觀比對 × 複方拆解 × ARR 篩檢工具</div>
        <p class="hero-clinic__desc">
          專為台灣門診與社區健檢研究個案設計，提供每種降血壓藥物（包含 Lesyn 樂壓定、IBIMO 愛彼脈、Aldactone 安達通、Apresoline 阿普利素寧、Exforge 易安穩、Diovan 代文、Norvasc 脈優、Blopress 博脈舒、Unisia 優力莎、Amlobin-O 安脈、Losa & Hydro 落沙、Caduet 卡杜特等）的<strong>真實藥物與包裝外觀比對</strong>、複方拆解成分與 PAC/PRA/ARR 影響分析。
        </p>

        <div class="hero-clinic__actions">
          <a href="#/research" class="btn btn-primary">
            🔬 開啟 PA/ARR 研究版試算工具
          </a>
          <a href="#/calculator" class="btn btn-outline">
            🧮 門診藥物評估計算機
          </a>
        </div>
      </div>

      <!-- Hero 右側：藥物視覺群組 -->
      <div class="pill-cluster-card">
        <div class="pill-cluster-card__title">
          <span>台灣常見藥物實體照片</span>
          <span>點擊卡片放大</span>
        </div>

        <div class="pill-grid-preview">
          <div class="pill-preview-item" data-zoom-id="valsartan" style="cursor:pointer;">
            <img src="${valMed ? valMed.image : 'assets/medicines/valsartan.svg'}" width="36" height="36" style="border-radius:4px;object-fit:cover;" />
            <div>
              <div style="font-size:0.82rem;font-weight:800;color:var(--primary);">Exforge (易安穩)</div>
              <div style="font-size:0.7rem;color:var(--text-muted);">Amlodipine + Valsartan</div>
            </div>
          </div>

          <div class="pill-preview-item" data-zoom-id="amlodipine" style="cursor:pointer;">
            <img src="${amlMed ? amlMed.image : 'assets/medicines/amlodipine.svg'}" width="36" height="36" style="border-radius:4px;object-fit:cover;" />
            <div>
              <div style="font-size:0.82rem;font-weight:800;color:var(--success-dark);">Norvasc (脈優)</div>
              <div style="font-size:0.7rem;color:var(--text-muted);">Amlodipine / 卡杜特</div>
            </div>
          </div>

          <div class="pill-preview-item" data-zoom-id="candesartan" style="cursor:pointer;">
            <img src="${canMed ? canMed.image : 'assets/medicines/candesartan.svg'}" width="36" height="36" style="border-radius:4px;object-fit:cover;" />
            <div>
              <div style="font-size:0.82rem;font-weight:800;color:var(--danger-dark);">Blopress (博脈舒)</div>
              <div style="font-size:0.7rem;color:var(--text-muted);">優力莎 Unisia 複方</div>
            </div>
          </div>

          <div class="pill-preview-item" data-zoom-id="bisoprolol" style="cursor:pointer;">
            <img src="${bisMed ? bisMed.image : 'assets/medicines/bisoprolol.svg'}" width="36" height="36" style="border-radius:4px;object-fit:cover;" />
            <div>
              <div style="font-size:0.82rem;font-weight:800;color:var(--orange);">Concor (康肯)</div>
              <div style="font-size:0.7rem;color:var(--text-muted);">心形刻痕錠</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. 藥物搜尋區 (採用 input type="text" 並完全尊重 IME Composition 注音選字) -->
    <section class="search-section">
      <h2>
        🔍 搜尋藥名／商品名 (支援 LESYN 樂壓定, IBIMO 愛彼脈, Aldactone 安達通, Apresoline, Exforge 易安穩, Diovan 代文, Norvasc 脈優)
      </h2>
      <div class="search-box">
        <svg class="search-box__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="text" id="home-search-input" placeholder="請輸入藥物中文商品名 (如 樂壓定, 博脈舒, 安達通, 哈伯寧, 易安穩, 脈優) 或英文學名..." value="${escapeHtml(searchTerm)}" autocomplete="off" spellcheck="false" />
      </div>

      <div class="category-chips">
        ${chipsHtml}
      </div>
    </section>

    <!-- 3. 33+ 種降血壓藥物圖鑑卡片 -->
    <section style="margin-bottom:2.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h2 style="font-size:1.25rem;font-weight:900;color:var(--primary-dark);display:flex;align-items:center;gap:0.5rem;">
          🖼️ 每種藥物實體照片與外觀圖鑑 (收錄 33+ 種)
        </h2>
        <span id="filtered-count" style="font-size:0.88rem;color:var(--text-muted);font-weight:700;">共 ${filtered.length} 項</span>
      </div>

      <div id="cards-container" class="med-encyclopedia-grid">
        ${cardsHtml}
      </div>
    </section>
  `;

  // 僅更新卡片容器，維持 Input 焦點與注音組合選字 state 完全不動
  function updateCardsContainerOnly() {
    const list = getFilteredMedications();
    const cardsContainer = document.querySelector('#cards-container');
    const filteredCount = document.querySelector('#filtered-count');
    if (cardsContainer) cardsContainer.innerHTML = renderMedicationCardsHtml(list);
    if (filteredCount) filteredCount.textContent = `共 ${list.length} 項`;

    document.querySelectorAll('[data-zoom-id]').forEach(el => {
      el.onclick = () => openImageModal(el.dataset.zoomId);
    });
  }

  const searchInput = document.querySelector('#home-search-input');
  if (searchInput) {
    let isComposing = false;
    let debounceTimer = null;

    searchInput.addEventListener('compositionstart', () => {
      isComposing = true;
    });

    searchInput.addEventListener('compositionend', (e) => {
      isComposing = false;
      searchTerm = e.target.value;
      updateCardsContainerOnly();
    });

    searchInput.addEventListener('input', (e) => {
      if (isComposing) return; // 注音選字未完成前，絕不干擾輸入框
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchTerm = e.target.value;
        updateCardsContainerOnly();
      }, 120);
    });
  }

  document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedCategories = btn.dataset.cat;
      document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateCardsContainerOnly();
    });
  });

  document.querySelectorAll('[data-zoom-id]').forEach(el => {
    el.addEventListener('click', () => {
      openImageModal(el.dataset.zoomId);
    });
  });
}

/* ==========================================================================
   ROUTE 2: RESEARCH MODE (🔬 研究版：PA/ARR 試算與條件篩選工具)
   ========================================================================== */

function renderResearch() {
  updateNavActive('research');

  // 計算 ARR
  const praVal = parseFloat(researchPra);
  const pacVal = parseFloat(researchPac);
  let arrVal = (praVal > 0 && !isNaN(pacVal)) ? (pacVal / praVal) : 0;
  arrVal = Math.round(arrVal * 10) / 10;

  // 陽性門檻判斷 (PAC ≥ 10 ng/dL 且 PRA ≤ 1.0 且 ARR ≥ 30)
  const isPositive = (pacVal >= 10 && praVal <= 1.0 && arrVal >= 30);
  const isBorderline = (!isPositive && arrVal >= 20);

  // 勾選藥物對目前生化數據的臨床干擾提醒
  const selectedMeds = medications.filter(m => researchSelectedIds.has(m.id));
  
  let drugWarnings = [];
  selectedMeds.forEach(m => {
    if (m.category === 'Beta-blocker') {
      drugWarnings.push(`⚠️ <strong>${escapeHtml(m.generic_name)} (${escapeHtml(m.brand_names ? m.brand_names.join(', ') : '')})</strong>：為 Beta-blocker，會強烈抑制腎素活性 (PRA ↓↓)，可能造成計算出來的 ARR 人工暴增 (<strong>假陽性風險</strong>)。`);
    } else if (m.category === 'MRA') {
      drugWarnings.push(`🚨 <strong>${escapeHtml(m.generic_name)} (${escapeHtml(m.brand_names ? m.brand_names.join(', ') : '')})</strong>：為 MRA 保鉀利尿劑，會解除對腎素的抑制使 PRA 暴增 10 倍以上，極易引發嚴重<strong>假陰性</strong>，必須洗脫 4-6 週！`);
    } else if (m.category === 'ARB' || m.category === 'ACEI') {
      drugWarnings.push(`⚠️ <strong>${escapeHtml(m.generic_name)} (${escapeHtml(m.brand_names ? m.brand_names.join(', ') : '')})</strong>：為 ${m.category} 類（如 Exforge (易安穩錠)、Diovan (得安穩錠)、Blopress (博脈舒錠)、Unisia (優雅錠)），會使 PRA 反應性升高，可能拉低 ARR (<strong>假陰性風險</strong>)。`);
    } else if (m.category.includes('diuretics') || m.category.includes('Diuretic')) {
      drugWarnings.push(`⚠️ <strong>${escapeHtml(m.generic_name)}</strong>：為利尿劑，排鈉排水刺激 PRA 升高，可能造成 <strong>假陰性</strong>。`);
    }
  });

  const medicationCheckboxesHtml = medications.map(m => {
    const isChecked = researchSelectedIds.has(m.id) ? 'checked' : '';
    return `
      <label style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0.65rem;background:#ffffff;border:1px solid var(--border);border-radius:6px;font-size:0.85rem;cursor:pointer;">
        <input type="checkbox" data-research-id="${m.id}" ${isChecked} style="width:16px;height:16px;accent-color:var(--primary);" />
        <span style="font-weight:700;">${escapeHtml(m.generic_name)}</span>
        <small style="color:var(--text-muted);">${escapeHtml(m.brand_names ? m.brand_names.join(', ') : '')}</small>
      </label>
    `;
  }).join('');

  app.innerHTML = `
    <div style="margin-bottom:1.5rem;">
      <div style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.25rem 0.65rem;background:var(--primary-soft);color:var(--primary);font-size:0.8rem;font-weight:800;border-radius:999px;margin-bottom:0.5rem;">
        🔬 臨床研究人員與醫師專用工具
      </div>
      <h1 style="font-size:1.85rem;font-weight:900;color:var(--primary-dark);margin-bottom:0.25rem;">PA / ARR 試算與條件篩選工具 (Research Screening Tool)</h1>
      <p style="font-size:0.95rem;color:var(--text-muted);">輸入個案生化抽血數值 PAC 與 PRA，系統將自動計算 ARR 比值，對照收案篩選條件，並連動分析目前用藥對結果的干擾。</p>
    </div>

    <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:1.5rem;">
      <!-- 左側：數據輸入與結果牌 -->
      <div>
        <div style="background:#ffffff;border:1px solid var(--border-strong);border-radius:10px;padding:1.5rem;box-shadow:var(--shadow-sm);margin-bottom:1.25rem;">
          <h2 style="font-size:1.1rem;font-weight:800;color:var(--primary-dark);margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem;">
            📊 輸入血清醛固酮 (PAC) 與腎素活性 (PRA)
          </h2>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem;">
            <div>
              <label style="font-size:0.88rem;font-weight:800;color:var(--text-main);display:block;margin-bottom:0.35rem;">
                PAC (血漿醛固酮濃度)
              </label>
              <div style="display:flex;gap:0.4rem;">
                <input type="number" id="input-pac" value="${researchPac}" step="0.1" style="flex:1;padding:0.6rem 0.75rem;font-size:1.1rem;font-weight:800;border:2px solid var(--border);border-radius:6px;" />
                <span style="padding:0.6rem;background:var(--bg-page);border:1px solid var(--border);border-radius:6px;font-size:0.85rem;font-weight:700;display:grid;place-items:center;">ng/dL</span>
              </div>
            </div>

            <div>
              <label style="font-size:0.88rem;font-weight:800;color:var(--text-main);display:block;margin-bottom:0.35rem;">
                PRA (血漿腎素活性)
              </label>
              <div style="display:flex;gap:0.4rem;">
                <input type="number" id="input-pra" value="${researchPra}" step="0.1" style="flex:1;padding:0.6rem 0.75rem;font-size:1.1rem;font-weight:800;border:2px solid var(--border);border-radius:6px;" />
                <span style="padding:0.6rem;background:var(--bg-page);border:1px solid var(--border);border-radius:6px;font-size:0.85rem;font-weight:700;display:grid;place-items:center;">ng/mL/h</span>
              </div>
            </div>
          </div>

          <!-- 自動計算輸出牌 -->
          <div style="background:var(--bg-page);border:2px solid var(--primary);border-radius:10px;padding:1.25rem;text-align:center;">
            <div style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">自動計算 ARR (PAC / PRA) 比值：</div>
            <div style="font-size:2.8rem;font-weight:900;color:var(--primary-dark);line-height:1.1;margin:0.25rem 0;">
              ${arrVal}
            </div>

            <div style="margin-top:0.75rem;padding:0.75rem;border-radius:8px;font-size:0.92rem;font-weight:800;${isPositive ? 'background:#ecfdf5;color:#065f46;border:1px solid #6ee7b7;' : (isBorderline ? 'background:#fff7ed;color:#9a3412;border:1px solid #fdba74;' : 'background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;')}">
              ${isPositive ? '✅ 符合 PA 篩檢陽性標準 (PAC ≥ 10 ng/dL, PRA ≤ 1.0 ng/mL/h, ARR ≥ 30)' : (isBorderline ? '⚡ 處於臨界範圍 (ARR ≥ 20)，建議配合藥物洗脫後重估' : 'ℹ️ 未達典型 PA 篩檢陽性門檻 (但需評估藥物干擾之假陰性)')}
            </div>
          </div>
        </div>
      </div>

      <!-- 右側：連動用藥干擾分析 -->
      <div>
        <div style="background:#ffffff;border:1px solid var(--border-strong);border-radius:10px;padding:1.5rem;box-shadow:var(--shadow-sm);">
          <h2 style="font-size:1.1rem;font-weight:800;color:var(--primary-dark);margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;">
            ⚠️ 目前個案用藥連動提醒
          </h2>
          <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.75rem;">勾選個案目前服用的降壓藥，系統將提醒其對此抽血數值的干擾性：</p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;max-height:220px;overflow-y:auto;padding-right:0.25rem;margin-bottom:1rem;">
            ${medicationCheckboxesHtml}
          </div>

          <!-- 系統即時警示提醒 Box -->
          <div style="background:#fffbe6;border:1px solid #ffe58f;border-left:4px solid var(--warning);border-radius:8px;padding:1rem;color:#873800;">
            <h4 style="font-size:0.92rem;font-weight:900;margin-bottom:0.4rem;">系統臨床提醒：</h4>
            ${drugWarnings.length ? `
              <div style="font-size:0.85rem;display:flex;flex-direction:column;gap:0.4rem;">
                ${drugWarnings.map(w => `<div>${w}</div>`).join('')}
              </div>
              <div style="font-size:0.8rem;margin-top:0.6rem;padding-top:0.4rem;border-top:1px dashed #ffd591;color:#ad4e00;">
                💡 處置建議：若生化數據符合陽性門檻，但個案正服用干擾藥物，臨床指引建議安排洗脫停藥 2-4 週（MRA 4-6 週）後重新抽血，或替換為 Doxazosin (可多華) 或 Amlodipine (脈優)。
              </div>
            ` : `
              <p style="font-size:0.85rem;color:var(--text-muted);">目前未勾選任何影響藥物。</p>
            `}
          </div>
        </div>
      </div>
    </div>
  `;

  document.querySelector('#input-pac').addEventListener('input', (e) => {
    researchPac = e.target.value;
    renderResearch();
    const el = document.querySelector('#input-pac');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });

  document.querySelector('#input-pra').addEventListener('input', (e) => {
    researchPra = e.target.value;
    renderResearch();
    const el = document.querySelector('#input-pra');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });

  document.querySelectorAll('input[data-research-id]').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.research-id;
      if (e.target.checked) researchSelectedIds.add(id);
      else researchSelectedIds.delete(id);
      renderResearch();
    });
  });
}

/* ==========================================================================
   ROUTE: PATHWAY (臨床路徑與確診指引)
   ========================================================================== */

function renderPathway() {
  updateNavActive('pathway');

  const sitPacVal = parseFloat(sitPostPac);
  let sitResultBadge = '';
  if (sitPacVal > 10) {
    sitResultBadge = '<span style="color:#065f46;background:#ecfdf5;border:1px solid #6ee7b7;padding:0.35rem 0.75rem;border-radius:6px;font-weight:800;display:inline-block;">✅ SIT 陽性 (Post-SIT PAC > 10 ng/dL) — 確診為原發性醛固酮過多症 (PA)</span>';
  } else if (sitPacVal < 5) {
    sitResultBadge = '<span style="color:#1e3a8a;background:#eff6ff;border:1px solid #93c5fd;padding:0.35rem 0.75rem;border-radius:6px;font-weight:800;display:inline-block;">ℹ️ SIT 陰性 (Post-SIT PAC < 5 ng/dL) — 排除原發性醛固酮過多症</span>';
  } else {
    sitResultBadge = '<span style="color:#9a3412;background:#fff7ed;border:1px solid #fdba74;padding:0.35rem 0.75rem;border-radius:6px;font-weight:800;display:inline-block;">⚡ 臨界範圍 (5-10 ng/dL) — 建議配合 Captopril 試驗或進一步評估</span>';
  }

  const cstPacVal = parseFloat(cstPostPac);
  const cstSuppVal = parseFloat(cstPacSuppressionPct);
  let cstResultBadge = '';
  if (cstPacVal > 11 || cstSuppVal < 30) {
    cstResultBadge = '<span style="color:#065f46;background:#ecfdf5;border:1px solid #6ee7b7;padding:0.35rem 0.75rem;border-radius:6px;font-weight:800;display:inline-block;">✅ CST 陽性 (未受顯著抑制, PAC > 11 ng/dL 或 下降 < 30%) — 確診 PA</span>';
  } else {
    cstResultBadge = '<span style="color:#1e3a8a;background:#eff6ff;border:1px solid #93c5fd;padding:0.35rem 0.75rem;border-radius:6px;font-weight:800;display:inline-block;">ℹ️ CST 正常抑制 — 降幅 ≥ 30% 且 PAC 降至正常</span>';
  }

  app.innerHTML = `
    <div style="margin-bottom:1.5rem;">
      <div style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.25rem 0.65rem;background:var(--primary-soft);color:var(--primary);font-size:0.8rem;font-weight:800;border-radius:999px;margin-bottom:0.5rem;">
        🏥 PA Clinical Pathway & Subtyping Guide 2026
      </div>
      <h1 style="font-size:1.85rem;font-weight:900;color:var(--primary-dark);margin-bottom:0.25rem;">原發性醛固酮過多症 (PA) 臨床路徑與確診指引</h1>
      <p style="font-size:0.95rem;color:var(--text-muted);">本專區提供依據 Endocrine Society Guidelines (2016) 與台灣高血壓學會共識制定之 4 步驟臨床路徑、確診試驗判讀工具與 MRA 標靶治療建議。</p>
    </div>

    <!-- 4 步驟臨床路徑圖解 (對照截圖 1) -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:1rem;margin-bottom:2rem;">
      <div style="background:#ffffff;border:1.5px solid var(--primary);border-radius:10px;padding:1.25rem;box-shadow:var(--shadow-sm);">
        <div style="font-size:0.75rem;font-weight:800;color:var(--primary);margin-bottom:0.3rem;">STEP 1: 初步篩檢</div>
        <div style="font-weight:900;color:var(--primary-dark);font-size:1.05rem;margin-bottom:0.4rem;">ARR 篩檢比值試算</div>
        <div style="font-size:0.85rem;color:var(--text-muted);line-height:1.5;">對高危險族群 (抗藥性高血壓、自發/誘發性低血鉀、腎上腺偶發瘤) 進行 PAC/PRA 採血。篩檢陽性標準：PAC ≥ 10 ng/dL 且 PRA ≤ 1.0 且 ARR ≥ 30 (臨界 ≥ 20)。</div>
      </div>

      <div style="background:#ffffff;border:1.5px solid var(--primary);border-radius:10px;padding:1.25rem;box-shadow:var(--shadow-sm);">
        <div style="font-size:0.75rem;font-weight:800;color:var(--primary);margin-bottom:0.3rem;">STEP 2: 確診試驗</div>
        <div style="font-weight:900;color:var(--primary-dark);font-size:1.05rem;margin-bottom:0.4rem;">SIT / CST 確診評估</div>
        <div style="font-size:0.85rem;color:var(--text-muted);line-height:1.5;">若初步篩檢陽性，安排生理食鹽水負載試驗 (SIT 2L NaCl 4h) 或 Captopril 抑制試驗 (CST 50mg) 以確認醛固酮之自主過度分泌性。</div>
      </div>

      <div style="background:#ffffff;border:1.5px solid #f59e0b;border-radius:10px;padding:1.25rem;box-shadow:var(--shadow-sm);">
        <div style="font-size:0.75rem;font-weight:800;color:#d97706;margin-bottom:0.3rem;">STEP 3: 分型與定位</div>
        <div style="font-weight:900;color:#b45309;font-size:1.05rem;margin-bottom:0.4rem;">CT / AVS 導管採血</div>
        <div style="font-size:0.85rem;color:var(--text-muted);line-height:1.5;">高解析度腎上腺 CT/MRI，並以黃金標準 腎上腺靜脈採血 (AVS) 區分單側醛固酮分泌腺瘤 (APA) 或雙側腎上腺增生 (BAH)。</div>
      </div>

      <div style="background:#ffffff;border:1.5px solid #10b981;border-radius:10px;padding:1.25rem;box-shadow:var(--shadow-sm);">
        <div style="font-size:0.75rem;font-weight:800;color:#059669;margin-bottom:0.3rem;">STEP 4: 標靶治療</div>
        <div style="font-weight:900;color:#047857;font-size:1.05rem;margin-bottom:0.4rem;">切除手術 / MRA 藥物</div>
        <div style="font-size:0.85rem;color:var(--text-muted);line-height:1.5;">單側 APA 安排腹腔鏡腎上腺切除術；雙側 BAH 或無法手術者使用 Spironolactone (Aldactone 樂安定/安達信) 或 Eplerenone (Inspra 英斯平) 標靶治療。</div>
      </div>
    </div>

    <!-- SIT 與 CST 兩大確診試驗互動判讀計算器 (對照截圖 2) -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:1.5rem;margin-bottom:2rem;">
      <!-- SIT 試驗判讀 -->
      <div style="background:#ffffff;border:1px solid var(--border-strong);border-radius:10px;padding:1.5rem;box-shadow:var(--shadow-sm);">
        <h3 style="font-size:1.1rem;font-weight:900;color:var(--primary-dark);margin-bottom:0.5rem;">
          🩸 生理食鹽水負載試驗 (Saline Infusion Test, SIT)
        </h3>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem;line-height:1.5;">病患靜臥 4 小時靜脈滴注 2,000 mL 0.9% 生理食鹽水，檢測滴注完成後之血漿醛固酮濃度 (Post-SIT PAC)：</p>

        <div style="margin-bottom:1rem;">
          <label style="font-size:0.88rem;font-weight:800;color:var(--text-main);display:block;margin-bottom:0.35rem;">
            Post-SIT PAC (滴注後醛固酮濃度)
          </label>
          <div style="display:flex;gap:0.4rem;">
            <input type="number" id="input-sit-pac" value="${sitPostPac}" step="0.1" style="flex:1;padding:0.6rem;font-size:1.1rem;font-weight:800;border:2px solid var(--border);border-radius:6px;" />
            <span style="padding:0.6rem;background:var(--bg-page);border:1px solid var(--border);border-radius:6px;font-size:0.85rem;font-weight:700;display:grid;place-items:center;">ng/dL</span>
          </div>
        </div>

        <div style="margin-bottom:1rem;">
          ${sitResultBadge}
        </div>

        <div style="font-size:0.82rem;color:var(--text-muted);background:var(--bg-page);padding:0.85rem;border-radius:6px;border:1px dashed var(--border);line-height:1.6;">
          💡 <strong>SIT 判定指引標準：</strong><br>
          • PAC > 10 ng/dL：確立 PA 確診。<br>
          • PAC < 5 ng/dL：排除 PA。<br>
          • PAC 5–10 ng/dL：灰藍色臨界區，需配合臨床與其他試驗。
        </div>
      </div>

      <!-- CST 試驗判讀 -->
      <div style="background:#ffffff;border:1px solid var(--border-strong);border-radius:10px;padding:1.5rem;box-shadow:var(--shadow-sm);">
        <h3 style="font-size:1.1rem;font-weight:900;color:var(--primary-dark);margin-bottom:0.5rem;">
          💊 Captopril 抑制試驗 (Captopril Suppression Test, CST)
        </h3>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem;line-height:1.5;">口服 Captopril 50mg，於 2 小時後抽血檢測 PAC 濃度與相較基線之抑制百分比：</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem;">
          <div>
            <label style="font-size:0.85rem;font-weight:800;color:var(--text-main);display:block;margin-bottom:0.35rem;">
              Post-CST PAC 濃度
            </label>
            <div style="display:flex;gap:0.4rem;">
              <input type="number" id="input-cst-pac" value="${cstPostPac}" step="0.1" style="flex:1;padding:0.5rem;font-size:1rem;font-weight:800;border:2px solid var(--border);border-radius:6px;" />
              <span style="padding:0.5rem;background:var(--bg-page);border:1px solid var(--border);border-radius:6px;font-size:0.78rem;font-weight:700;display:grid;place-items:center;">ng/dL</span>
            </div>
          </div>

          <div>
            <label style="font-size:0.85rem;font-weight:800;color:var(--text-main);display:block;margin-bottom:0.35rem;">
              PAC 抑制降幅 (%)
            </label>
            <div style="display:flex;gap:0.4rem;">
              <input type="number" id="input-cst-supp" value="${cstPacSuppressionPct}" step="1" style="flex:1;padding:0.5rem;font-size:1rem;font-weight:800;border:2px solid var(--border);border-radius:6px;" />
              <span style="padding:0.5rem;background:var(--bg-page);border:1px solid var(--border);border-radius:6px;font-size:0.78rem;font-weight:700;display:grid;place-items:center;">%</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom:1rem;">
          ${cstResultBadge}
        </div>

        <div style="font-size:0.82rem;color:var(--text-muted);background:var(--bg-page);padding:0.85rem;border-radius:6px;border:1px dashed var(--border);line-height:1.6;">
          💡 <strong>CST 判定指引標準：</strong><br>
          • 正常人服藥後，PAC 應被顯著抑制（下降 > 30%）。<br>
          • 若 PA 患者之 PAC 保持高位 (> 11 ng/dL) 或降幅 < 30%，代表分泌具自主性。
        </div>
      </div>
    </div>

    <!-- MRA 標靶治療指引 -->
    <div style="background:#ffffff;border:1px solid var(--border-strong);border-radius:10px;padding:1.5rem;box-shadow:var(--shadow-sm);margin-bottom:2rem;">
      <h3 style="font-size:1.15rem;font-weight:900;color:var(--primary-dark);margin-bottom:1rem;">
        🩺 雙側腎上腺增生 (BAH) / MRA 藥物治療微調指引
      </h3>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:1.25rem;">
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:1rem;">
          <h4 style="font-size:0.98rem;font-weight:900;color:#0369a1;margin-bottom:0.4rem;">🥇 第一線首選 MRA：Spironolactone (Aldactone 樂安定/安達信)</h4>
          <p style="font-size:0.88rem;color:var(--text-body);line-height:1.5;">
            • 為非選擇性醛固酮受體拮抗劑，為雙側增生或無法手術患者之標準首選藥物。<br>
            • <strong>劑量微調目標：</strong>以控制血壓至標的 (&lt;140/90 mmHg) 與維持正常血鉀 (4.0-5.0 mEq/L) 為原則。<br>
            • <strong>副作用監測：</strong>因具抗雄性素與黃體素作用，男性可能出現男性女乳症 (Gynecomastia)；女性可能出現月經不規則。
          </p>
        </div>

        <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:1rem;">
          <h4 style="font-size:0.98rem;font-weight:900;color:#854d0e;margin-bottom:0.4rem;">🥈 選擇性 MRA 替代藥：Eplerenone (Inspra 英斯平)</h4>
          <p style="font-size:0.88rem;color:var(--text-body);line-height:1.5;">
            • 為高度選擇性醛固酮受體拮抗劑，對雄性素與黃體素受體之親和力極低。<br>
            • <strong>臨床適應症：</strong>當患者使用 Spironolactone 出現明顯男性女乳症、乳房疼痛或嚴重月經失調時之第一首選替代藥物。<br>
            • <strong>臨床注意：</strong>其半衰期較短，部分患者需每日給藥二次 (BID) 以達最佳血壓控制效果。
          </p>
        </div>
      </div>
    </div>
  `;

  const sitInput = document.querySelector('#input-sit-pac');
  if (sitInput) {
    sitInput.addEventListener('input', (e) => {
      sitPostPac = e.target.value;
      renderPathway();
      const el = document.querySelector('#input-sit-pac');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  }

  const cstPacInput = document.querySelector('#input-cst-pac');
  if (cstPacInput) {
    cstPacInput.addEventListener('input', (e) => {
      cstPostPac = e.target.value;
      renderPathway();
      const el = document.querySelector('#input-cst-pac');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  }

  const cstSuppInput = document.querySelector('#input-cst-supp');
  if (cstSuppInput) {
    cstSuppInput.addEventListener('input', (e) => {
      cstPacSuppressionPct = e.target.value;
      renderPathway();
      const el = document.querySelector('#input-cst-supp');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  }
}

/* ==========================================================================
   ROUTE 3: CALCULATOR (門診用藥評估計算機)
   ========================================================================== */

function renderCalculator() {
  updateNavActive('calculator');

  const selectedMeds = medications.filter(m => calculatorSelectedIds.has(m.id));
  
  let riskLevel = 'LOW';
  let hasMra = false;
  let hasBetaBlocker = false;
  let hasAceiArb = false;
  let hasDiuretic = false;

  selectedMeds.forEach(m => {
    if (m.category === 'MRA') hasMra = true;
    if (m.category === 'Beta-blocker') hasBetaBlocker = true;
    if (m.category === 'ACEI' || m.category === 'ARB') hasAceiArb = true;
    if (m.category.includes('diuretics') || m.category.includes('Diuretic')) hasDiuretic = true;
  });

  if (hasMra) riskLevel = 'HIGH';
  else if (hasBetaBlocker || hasAceiArb || hasDiuretic) riskLevel = 'MODERATE';
  else riskLevel = 'LOW';

  const checkboxListHtml = medications.map(m => {
    const isChecked = calculatorSelectedIds.has(m.id) ? 'checked' : '';
    return `
      <label style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;background:#ffffff;border:1px solid var(--border);border-radius:8px;cursor:pointer;">
        <input type="checkbox" data-id="${m.id}" ${isChecked} style="width:18px;height:18px;accent-color:var(--primary);" />
        <img src="${escapeHtml(m.image)}" width="36" height="36" style="border-radius:4px;object-fit:cover;" />
        <div style="flex:1;min-width:0;">
          <strong style="font-size:0.95rem;color:var(--text-main);">${escapeHtml(m.generic_name)} (${escapeHtml(m.localized_names ? m.localized_names.join('/') : '')})</strong>
          <div style="font-size:0.78rem;color:var(--text-muted);">常用商品：${escapeHtml(m.brand_names ? m.brand_names.join(', ') : '')}</div>
        </div>
        <span style="font-size:0.78rem;font-weight:700;padding:0.2rem 0.5rem;border-radius:4px;background:${m.is_preferred_for_pa_screening ? '#ecfdf5' : '#fef2f2'};color:${m.is_preferred_for_pa_screening ? '#047857' : '#b91c1c'};">
          ${m.is_preferred_for_pa_screening ? '首選替代藥' : `洗脫 ${m.washout_period}`}
        </span>
      </label>
    `;
  }).join('');

  let resultHeaderHtml = '';
  if (riskLevel === 'HIGH') {
    resultHeaderHtml = `
      <div style="padding:1.25rem;background:#fef2f2;border:1px solid #fca5a5;border-left:5px solid var(--danger);border-radius:8px;color:#991b1b;margin-bottom:1.25rem;">
        <h3 style="font-size:1.15rem;font-weight:900;margin-bottom:0.25rem;">🚨 高度 ARR 假陰性干擾風險 (High Interference)</h3>
        <p style="font-size:0.9rem;">包含 MRA 保鉀利尿劑 (如 Spironolactone 樂安定)，會大幅提升 PRA 並導致 ARR 嚴重假陰性，<strong>必須進行洗脫停藥 4-6 週</strong>。</p>
      </div>
    `;
  } else if (riskLevel === 'MODERATE') {
    resultHeaderHtml = `
      <div style="padding:1.25rem;background:#fff7ed;border:1px solid #fdba74;border-left:5px solid var(--orange);border-radius:8px;color:#9a3412;margin-bottom:1.25rem;">
        <h3 style="font-size:1.15rem;font-weight:900;margin-bottom:0.25rem;">⚠️ 中度 ARR 干擾風險 (Moderate Interference)</h3>
        <p style="font-size:0.9rem;">包含 Beta-blocker、ACEI、ARB (含 Exforge (易安穩錠)、Blopress (博脈舒錠)、Unisia (優雅錠)、Amlobin-O (降壓安錠)、Losa & Hydro (那寶穩膜衣錠/落沙) 等) 或利尿劑，可能引發假陽性或假陰性。<strong>建議進行洗脫停藥 2-4 週</strong>。</p>
      </div>
    `;
  } else {
    resultHeaderHtml = `
      <div style="padding:1.25rem;background:#ecfdf5;border:1px solid #6ee7b7;border-left:5px solid var(--success);border-radius:8px;color:#065f46;margin-bottom:1.25rem;">
        <h3 style="font-size:1.15rem;font-weight:900;margin-bottom:0.25rem;">✅ 低干擾 / 安全可採血 (Minimal Interference)</h3>
        <p style="font-size:0.9rem;">目前選擇藥物 (如 Cardura (可多華錠), Norvasc (脈優錠) / Caduet (卡杜特膜衣錠), Isoptin SR (心舒平持續性膜衣錠)) 對 ARR 比值影響極小，不需停藥洗脫，可直接安排採血。</p>
      </div>
    `;
  }

  const selectedListHtml = selectedMeds.length ? selectedMeds.map(m => `
    <div style="padding:0.85rem;background:#ffffff;border:1px solid var(--border);border-radius:8px;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.75rem;">
      <img src="${escapeHtml(m.image)}" width="36" height="36" style="border-radius:4px;object-fit:cover;" />
      <div style="flex:1;">
        <div style="font-weight:800;font-size:0.95rem;">${escapeHtml(m.generic_name)} (${escapeHtml(m.category)})</div>
        <div style="font-size:0.82rem;color:var(--text-muted);">常用商品：${escapeHtml(m.brand_names ? m.brand_names.join(', ') : '')} | 洗脫期：${escapeHtml(m.washout_period)}</div>
      </div>
    </div>
  `).join('') : '<p style="color:var(--text-muted);">請在左側勾選病人目前服用的藥物組合。</p>';

  app.innerHTML = `
    <div style="margin-bottom:1.5rem;">
      <h1 style="font-size:1.8rem;font-weight:900;color:var(--primary-dark);margin-bottom:0.25rem;">PA 門診藥物干擾與洗脫期評估計算機</h1>
      <p style="font-size:0.95rem;color:var(--text-muted);">勾選病人目前發藥處方，或點選下方社區健檢常見多藥組合進行快速帶入評估。</p>
    </div>

    <!-- Quick Presets -->
    <div style="background:#ffffff;border:1px solid var(--border-strong);border-radius:10px;padding:1.25rem;margin-bottom:1.5rem;">
      <h3 style="font-size:0.98rem;font-weight:800;color:var(--primary);margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;">
        📋 社區健檢與門診常見多藥組合快速帶入 (Preset Combinations)
      </h3>

      <div style="display:flex;gap:0.6rem;flex-wrap:wrap;">
        <button type="button" class="preset-btn btn btn-outline btn-sm" data-preset="candesartan,bisoprolol,amlodipine">
          💊 組合 A: Blopress (博脈舒錠) + Concor (康肯轉釋錠) + Norvasc (脈優錠)
        </button>

        <button type="button" class="preset-btn btn btn-outline btn-sm" data-preset="valsartan,nebivolol">
          💊 組合 B: Exforge (易安穩錠) + Nebilet (耐比洛錠)
        </button>

        <button type="button" class="preset-btn btn btn-outline btn-sm" data-preset="propafenone,olmesartan,amlodipine">
          💊 組合 C: Propafenone (律摩諾) + Amlobin-O (降壓安錠)
        </button>

        <button type="button" class="preset-btn btn btn-outline btn-sm" data-preset="olmesartan,amlodipine,doxazosin">
          💊 組合 D: Amlodipine + Olmesartan (Sevikar 舒脈康膜衣錠 / Amlobin-O 降壓安錠) + Norvasc + Doxazosin
        </button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1.2fr;gap:1.5rem;">
      <div style="background:#ffffff;border:1px solid var(--border-strong);border-radius:10px;padding:1.5rem;">
        <h2 style="font-size:1.1rem;font-weight:800;color:var(--primary-dark);margin-bottom:1rem;">勾選病人用藥 (已選 ${selectedMeds.length} 項)</h2>
        <div style="display:flex;flex-direction:column;gap:0.5rem;max-height:500px;overflow-y:auto;padding-right:0.25rem;">
          ${checkboxListHtml}
        </div>
      </div>

      <div style="background:#ffffff;border:1px solid var(--border-strong);border-radius:10px;padding:1.5rem;">
        <h2 style="font-size:1.1rem;font-weight:800;color:var(--primary-dark);margin-bottom:1rem;">臨床評估結果與洗脫建議</h2>
        ${resultHeaderHtml}

        <h3 style="font-size:0.95rem;font-weight:800;color:var(--text-main);margin-bottom:0.5rem;">已選擇藥物洗脫細節：</h3>
        ${selectedListHtml}
      </div>
    </div>
  `;

  document.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) calculatorSelectedIds.add(id);
      else calculatorSelectedIds.delete(id);
      renderCalculator();
    });
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ids = btn.dataset.preset.split(',');
      calculatorSelectedIds = new Set(ids);
      renderCalculator();
    });
  });
}

/* ==========================================================================
   ROUTE 4: MATRIX (對照總表)
   ========================================================================== */

function renderMatrix() {
  updateNavActive('matrix');

  const rowsHtml = medications.map(med => `
    <tr>
      <td><img src="${escapeHtml(med.image)}" width="36" height="36" data-zoom-id="${med.id}" style="cursor:pointer;border-radius:4px;object-fit:cover;" /></td>
      <td>
        <a href="#/medicine/${encodeURIComponent(med.id)}" style="color:var(--primary);font-weight:700;text-decoration:none;">
          ${escapeHtml(med.generic_name)}
        </a>
        <br><small style="color:var(--text-muted);">${escapeHtml(med.localized_names ? med.localized_names.join('/') : '')}</small>
      </td>
      <td>${escapeHtml(med.category)}</td>
      <td><small>${escapeHtml(med.brand_names ? med.brand_names.join(', ') : '無')}</small></td>
      <td style="font-size:0.8rem;color:var(--text-body);">${escapeHtml(med.pill_appearance || '請參閱標籤')}</td>
      <td style="font-weight:700;color:${med.pac_effect.includes('↑') ? 'var(--danger)' : 'var(--blue-alt)'};">${escapeHtml(med.pac_effect)}</td>
      <td style="font-weight:700;color:${med.pra_effect.includes('↑') ? 'var(--danger)' : 'var(--blue-alt)'};">${escapeHtml(med.pra_effect)}</td>
      <td>${getArrBadge(med)}</td>
      <td style="font-weight:700;">${escapeHtml(med.washout_period)}</td>
      <td style="font-size:0.85rem;font-weight:700;color:var(--primary-dark);">${escapeHtml(med.ddd ? (med.ddd.standard_mg_per_day_raw ? med.ddd.standard_mg_per_day_raw + ' mg' : '-') : '-')}</td>
    </tr>
  `).join('');

  app.innerHTML = `
    <div style="margin-bottom:1.5rem;">
      <h1 style="font-size:1.8rem;font-weight:900;color:var(--primary-dark);margin-bottom:0.25rem;">ARR 降血壓藥物影響與對照總表</h1>
      <p style="font-size:0.95rem;color:var(--text-muted);">一覽所有降壓藥物對 PAC (醛固酮)、PRA (腎素活性) 及 ARR 比值之影響與建議洗脫期。</p>
    </div>

    <div class="table-card">
      <table class="clinic-table">
        <thead>
          <tr>
            <th>外觀</th>
            <th>學名 / 中文藥名</th>
            <th>藥物分類</th>
            <th>常見商品名 (含 Exforge (易安穩錠), Blopress (博脈舒錠), Unisia (優雅錠), Amlobin-O (降壓安錠), Losa & Hydro (那寶穩膜衣錠/落沙) 等)</th>
            <th>藥物外觀</th>
            <th>PAC 影響</th>
            <th>PRA 影響</th>
            <th>ARR 干擾評估</th>
            <th>建議洗脫期</th>
            <th>WHO DDD (mg/日)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll('[data-zoom-id]').forEach(el => {
    el.addEventListener('click', () => openImageModal(el.dataset.zoomId));
  });
}

/* ==========================================================================
   ROUTE 5: WASHOUT (洗脫期專頁)
   ========================================================================== */

function renderWashout() {
  updateNavActive('washout');

  const valMed = medications.find(m => m.id === 'valsartan');
  const bisMed = medications.find(m => m.id === 'bisoprolol');
  const spiMed = medications.find(m => m.id === 'spironolactone');
  const doxMed = medications.find(m => m.id === 'doxazosin');
  const verMed = medications.find(m => m.id === 'verapamil');
  const hydMed = medications.find(m => m.id === 'hydralazine');
  const amlMed = medications.find(m => m.id === 'amlodipine');
  const lacMed = medications.find(m => m.id === 'lacidipine');
  const nifMed = medications.find(m => m.id === 'nifedipine');

  app.innerHTML = `
    <div style="margin-bottom:1.5rem;">
      <h1 style="font-size:1.8rem;font-weight:900;color:var(--primary-dark);margin-bottom:0.25rem;">降血壓藥物洗脫期與替代藥物專頁</h1>
      <p style="font-size:0.95rem;color:var(--text-muted);">門診收案與 ARR 篩檢採血前之藥物調整與洗脫期管理指引。</p>
    </div>

    <!-- 1. 洗脫期參考 -->
    <section class="washout-section" style="margin-bottom:2rem;">
      <h2 style="font-size:1.25rem;font-weight:900;color:var(--primary-dark);margin-bottom:1rem;">⏱️ 各類降壓藥物洗脫期參考</h2>

      <div class="washout-list" style="display:flex;flex-direction:column;gap:0.85rem;">
        <div class="washout-row">
          <div class="washout-row__left">
            <img src="${spiMed ? spiMed.image : 'assets/medicines/spironolactone.svg'}" width="40" height="40" style="border-radius:4px;object-fit:cover;" />
            <div>
              <div style="font-size:1rem;font-weight:800;color:var(--danger-dark);">MRA 鹽皮質受體拮抗劑 (Aldactone 樂安定 / Inspra 英斯平)</div>
              <small style="color:var(--text-muted);">極高干擾！直接競合醛固酮受體，使 PRA 暴增，造成嚴重假陰性。</small>
            </div>
          </div>
          <div class="washout-row__time">💊 ➔ ➔ ➔ ⏱ 必須停藥 4–6 週</div>
        </div>

        <div class="washout-row">
          <div class="washout-row__left">
            <img src="${bisMed ? bisMed.image : 'assets/medicines/bisoprolol.svg'}" width="40" height="40" style="border-radius:4px;object-fit:cover;" />
            <div>
              <div style="font-size:1rem;font-weight:800;color:var(--orange);">Beta-blocker 乙型受體阻斷劑 (Concor (康肯轉釋錠) / Nebilet (耐比洛錠) / Inderal (恩特來錠))</div>
              <small style="color:var(--text-muted);">強效抑制腎素釋放致 PRA 接近零造成假陽性。</small>
            </div>
          </div>
          <div class="washout-row__time">💊 ➔ ➔ ⏱ 停藥洗脫 2–4 週</div>
        </div>

        <div class="washout-row">
          <div class="washout-row__left">
            <img src="${valMed ? valMed.image : 'assets/medicines/valsartan.svg'}" width="40" height="40" style="border-radius:4px;object-fit:cover;" />
            <div>
              <div style="font-size:1rem;font-weight:800;color:var(--primary);">ACEI / ARB 類與複方錠 (Exforge (易安穩錠) / Blopress (博脈舒錠) / Unisia (優雅錠) / Amlobin-O (降壓安錠) / Losa & Hydro (那寶穩膜衣錠/落沙))</div>
              <small style="color:var(--text-muted);">提升 PRA 造成假陰性。</small>
            </div>
          </div>
          <div class="washout-row__time">💊 ➔ ➔ ⏱ 停藥洗脫 2–4 週</div>
        </div>
      </div>
    </section>

    <!-- 2. 優先考慮 | 低 ARR 干擾替代藥物卡片 (對照截圖 1) -->
    <section style="background:#ffffff;border:1px solid var(--border);border-radius:12px;padding:1.5rem;margin-bottom:2rem;box-shadow:var(--shadow-sm);">
      <h2 style="font-size:1.25rem;font-weight:900;color:var(--primary-dark);display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
        🥇 優先考慮 | 低 ARR 干擾替代藥物 (Low-interference replacement antihypertensives)
      </h2>
      <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:1.25rem;line-height:1.6;">
        當停用干擾 ARR 評估的降壓藥物（如 MRA、Beta-blockers、ACEI/ARB、利尿劑）進行洗脫時，為維持患者血壓安全，應優先使用對血漿腎素活性 (PRA) 與醛固酮 (PAC) 幾乎無干擾的首選替代藥物：
      </p>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:1.25rem;">
        <!-- Card 1: Doxazosin -->
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:1.25rem;position:relative;">
          <div style="display:flex;align-items:center;gap:0.85rem;margin-bottom:0.85rem;">
            <div style="width:48px;height:48px;background:#ffffff;border:1px solid #86efac;border-radius:8px;display:grid;place-items:center;overflow:hidden;flex-shrink:0;">
              <img src="${doxMed ? doxMed.image : 'assets/medicines/doxazosin.svg'}" width="40" height="40" style="object-fit:cover;" />
            </div>
            <div>
              <span style="font-size:0.75rem;font-weight:800;background:#15803d;color:#ffffff;padding:0.15rem 0.5rem;border-radius:4px;display:inline-block;margin-bottom:0.2rem;">Alpha-1 受體阻斷劑</span>
              <h3 style="font-size:1.05rem;font-weight:900;color:#14532d;margin:0;">Cardura (可多華錠) / Xadosin/Doxasin (薩多心錠) [成分: Doxazosin]</h3>
            </div>
          </div>
          <div style="font-size:0.88rem;color:#166534;line-height:1.6;">
            <p style="margin-bottom:0.35rem;"><strong>藥理類別：</strong>Alpha-1 受體阻斷劑 (Alpha-blocker)</p>
            <p style="margin:0;"><strong>臨床定位：</strong>對 ARR 的干擾相對較小，可作為 PA 篩檢前調整降壓治療時的替代選項。</p>
          </div>
        </div>

        <!-- Card 2: Verapamil SR -->
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:1.25rem;position:relative;">
          <div style="display:flex;align-items:center;gap:0.85rem;margin-bottom:0.85rem;">
            <div style="width:48px;height:48px;background:#ffffff;border:1px solid #7dd3fc;border-radius:8px;display:grid;place-items:center;overflow:hidden;flex-shrink:0;cursor:pointer;" data-zoom-id="verapamil" title="點擊檢視實體照片">
              <img src="${verMed ? verMed.image : 'assets/medicines/verapamil_real.png'}" width="44" height="44" style="object-fit:cover;border-radius:4px;" />
            </div>
            <div>
              <span style="font-size:0.75rem;font-weight:800;background:#0369a1;color:#ffffff;padding:0.15rem 0.5rem;border-radius:4px;display:inline-block;margin-bottom:0.2rem;">Non-DHP CCB</span>
              <h3 style="font-size:1.05rem;font-weight:900;color:#0c4a6e;margin:0;">Verapamil SR (Isoptin SR 心舒平持續膜衣錠)</h3>
            </div>
          </div>
          <div style="font-size:0.88rem;color:#075985;line-height:1.6;">
            <p style="margin-bottom:0.35rem;"><strong>藥理類別：</strong>非二氫吡啶類鈣離子阻斷劑 (Non-DHP CCB)</p>
            <p style="margin:0;"><strong>臨床定位：</strong>對 ARR 的干擾相對較小，可作為 PA 篩檢前調整降壓治療時的替代選項。</p>
          </div>
        </div>

        <!-- Card 3: Hydralazine -->
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:1.25rem;position:relative;">
          <div style="display:flex;align-items:center;gap:0.85rem;margin-bottom:0.85rem;">
            <div style="width:48px;height:48px;background:#ffffff;border:1px solid #fdba74;border-radius:8px;display:grid;place-items:center;overflow:hidden;flex-shrink:0;cursor:pointer;" data-zoom-id="hydralazine" title="點擊檢視實體照片">
              <img src="${hydMed ? hydMed.image : 'assets/medicines/hydralazine_real.png'}" width="44" height="44" style="object-fit:cover;border-radius:4px;" />
            </div>
            <div>
              <span style="font-size:0.75rem;font-weight:800;background:#c2410c;color:#ffffff;padding:0.15rem 0.5rem;border-radius:4px;display:inline-block;margin-bottom:0.2rem;">直接血管擴張劑</span>
              <h3 style="font-size:1.05rem;font-weight:900;color:#7c2d12;margin:0;">Hydralazine (肼屈嗪)</h3>
            </div>
          </div>
          <div style="font-size:0.88rem;color:#9a3412;line-height:1.6;">
            <p style="margin-bottom:0.35rem;"><strong>藥理類別：</strong>直接血管擴張劑 (Direct vasodilator)</p>
            <p style="margin:0;"><strong>臨床定位：</strong>可作為 PA 篩檢前需要維持血壓控制時的替代選項之一；對 ARR 的干擾相對有限，但應注意反射性心搏過速及其他臨床副作用。</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. 長效 DHP-CCB 選項 (對照截圖 2) -->
    <section style="background:#ffffff;border:1px solid var(--border);border-radius:12px;padding:1.5rem;margin-bottom:2rem;box-shadow:var(--shadow-sm);">
      <h2 style="font-size:1.25rem;font-weight:900;color:var(--primary-dark);display:flex;align-items:center;gap:0.5rem;margin-bottom:1.25rem;">
        🟢 血壓控制選項 | 長效 DHP-CCB (Long-acting DHP Calcium Channel Blockers)
      </h2>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:1rem;margin-bottom:1.25rem;">
        <!-- Amlodipine -->
        <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:1rem;display:flex;align-items:center;gap:0.85rem;">
          <div style="width:40px;height:40px;background:#ffffff;border:1px solid #d8b4fe;border-radius:6px;display:grid;place-items:center;overflow:hidden;flex-shrink:0;cursor:pointer;" data-zoom-id="amlodipine" title="點擊檢視實體照片">
            <img src="${amlMed ? amlMed.image : 'assets/medicines/amlodipine.svg'}" width="36" height="36" style="object-fit:cover;" />
          </div>
          <div>
            <h3 style="font-size:1rem;font-weight:900;color:#581c87;margin:0;">Norvasc (脈優錠) [成分: Amlodipine]</h3>
            <span style="font-size:0.82rem;color:#7e22ce;">長效 DHP-CCB / 血壓控制選項</span>
          </div>
        </div>

        <!-- Lacidipine -->
        <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:1rem;display:flex;align-items:center;gap:0.85rem;">
          <div style="width:40px;height:40px;background:#ffffff;border:1px solid #d8b4fe;border-radius:6px;display:grid;place-items:center;overflow:hidden;flex-shrink:0;cursor:pointer;" data-zoom-id="lacidipine" title="點擊檢視實體照片">
            <img src="${lacMed ? lacMed.image : 'assets/medicines/lacidipine_real.png'}" width="36" height="36" style="object-fit:cover;" />
          </div>
          <div>
            <h3 style="font-size:1rem;font-weight:900;color:#581c87;margin:0;">Lacidipine (LESYN (樂壓定膜衣錠))</h3>
            <span style="font-size:0.82rem;color:#7e22ce;">長效 DHP-CCB / 血壓控制選項</span>
          </div>
        </div>

        <!-- Nifedipine -->
        <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:1rem;display:flex;align-items:center;gap:0.85rem;">
          <div style="width:40px;height:40px;background:#ffffff;border:1px solid #d8b4fe;border-radius:6px;display:grid;place-items:center;overflow:hidden;flex-shrink:0;cursor:pointer;" data-zoom-id="nifedipine" title="點擊檢視實體照片">
            <img src="${nifMed ? nifMed.image : 'assets/medicines/nifedipine.svg'}" width="36" height="36" style="object-fit:cover;" />
          </div>
          <div>
            <h3 style="font-size:1rem;font-weight:900;color:#581c87;margin:0;">Nifedipine (長效製劑)</h3>
            <span style="font-size:0.82rem;color:#7e22ce;">長效 DHP-CCB / 血壓控制選項</span>
          </div>
        </div>
      </div>

      <!-- CCB 說明提示 -->
      <div style="background:#f3e8ff;border:1px solid #d8b4fe;border-radius:8px;padding:0.85rem 1.1rem;font-size:0.88rem;color:#6b21a8;line-height:1.6;">
        💡 DHP-CCB 對 ARR 的影響相對較小，但非完全無干擾。若採完整停藥策略，應依 guideline 考慮於 ARR 檢測前停用；若因血壓控制或停藥風險無法停用，則應依個案安全性及藥物干擾方向解讀 ARR。
      </div>
    </section>

    <!-- 4. 併用原則與實務重點 (對照截圖 3) -->
    <section style="display:grid;grid-template-columns:1fr;gap:1.25rem;margin-bottom:2rem;">
      <div style="background:#fff7ed;border:1px solid #ffedd5;border-left:5px solid #f97316;border-radius:8px;padding:1.25rem;">
        <h3 style="font-size:1.05rem;font-weight:900;color:#9a3412;display:flex;align-items:center;gap:0.4rem;margin-bottom:0.5rem;">
          ❎ 併用兩種以上降血壓藥物之洗脫與替換原則
        </h3>
        <p style="font-size:0.9rem;color:#c2410c;line-height:1.6;margin:0;">
          對於同時使用多種可能干擾 ARR 的降壓藥物患者，應優先評估高干擾藥物的停藥／替換可能性，並依血壓控制需求、共病與停藥風險選擇適當的低干擾替代藥物。
        </p>
      </div>

      <div style="background:#f0f9ff;border:1px solid #e0f2fe;border-left:5px solid #0284c7;border-radius:8px;padding:1.25rem;">
        <h3 style="font-size:1.05rem;font-weight:900;color:#075985;display:flex;align-items:center;gap:0.4rem;margin-bottom:0.5rem;">
          💡 臨床實務重點：ARR 陰性解讀與評估原則
        </h3>
        <p style="font-size:0.9rem;color:#0369a1;line-height:1.6;margin:0;">
          若 ARR 結果受到可能造成假陰性的藥物影響，且臨床仍高度懷疑 PA，不宜僅依單次陰性 ARR 排除 PA；應依臨床情境評估是否於藥物調整後重新檢測。
        </p>
      </div>
    </section>
  `;

  document.querySelectorAll('[data-zoom-id]').forEach(el => {
    el.addEventListener('click', () => openImageModal(el.dataset.zoomId));
  });
}

/* ==========================================================================
   ROUTE 6: COMPARE (併排比對)
   ========================================================================== */

function renderCompare() {
  updateNavActive('compare');

  const drugA = medications.find(m => m.id === compareDrugA) || medications[0];
  const drugB = medications.find(m => m.id === compareDrugB) || medications[1];

  const optionsHtmlA = medications.map(m => `<option value="${m.id}" ${m.id === drugA.id ? 'selected' : ''}>${escapeHtml(m.generic_name)} (${escapeHtml(m.category)})</option>`).join('');
  const optionsHtmlB = medications.map(m => `<option value="${m.id}" ${m.id === drugB.id ? 'selected' : ''}>${escapeHtml(m.generic_name)} (${escapeHtml(m.category)})</option>`).join('');

  app.innerHTML = `
    <div style="margin-bottom:1.5rem;">
      <h1 style="font-size:1.8rem;font-weight:900;color:var(--primary-dark);margin-bottom:0.25rem;">藥物併排外觀與干擾比對工具</h1>
      <p style="font-size:0.95rem;color:var(--text-muted);">選擇兩種降血壓藥物進行外觀與 PAC/PRA/ARR 影響的比對。</p>
    </div>

    <div style="display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap;">
      <select id="compare-select-a" style="flex:1;min-width:240px;padding:0.75rem;border-radius:6px;border:2px solid var(--border);font-size:0.95rem;font-family:inherit;">
        ${optionsHtmlA}
      </select>
      <div style="display:grid;place-items:center;font-weight:900;color:var(--text-muted);">VS</div>
      <select id="compare-select-b" style="flex:1;min-width:240px;padding:0.75rem;border-radius:6px;border:2px solid var(--border);font-size:0.95rem;font-family:inherit;">
        ${optionsHtmlB}
      </select>
    </div>

    <div class="table-card">
      <table class="clinic-table">
        <thead>
          <tr>
            <th style="width:180px;">比對項目</th>
            <th>${escapeHtml(drugA.generic_name)}</th>
            <th>${escapeHtml(drugB.generic_name)}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>實體藥物圖片</th>
            <td><img src="${escapeHtml(drugA.image)}" width="64" height="64" data-zoom-id="${drugA.id}" style="cursor:pointer;border-radius:6px;object-fit:cover;" /></td>
            <td><img src="${escapeHtml(drugB.image)}" width="64" height="64" data-zoom-id="${drugB.id}" style="cursor:pointer;border-radius:6px;object-fit:cover;" /></td>
          </tr>
          <tr>
            <th>藥物分類</th>
            <td>${escapeHtml(drugA.category_name_zh || drugA.category)} (${escapeHtml(drugA.category)})</td>
            <td>${escapeHtml(drugB.category_name_zh || drugB.category)} (${escapeHtml(drugB.category)})</td>
          </tr>
          <tr>
            <th>常見商品名</th>
            <td>${escapeHtml(drugA.brand_names ? drugA.brand_names.join(', ') : '無')}</td>
            <td>${escapeHtml(drugB.brand_names ? drugB.brand_names.join(', ') : '無')}</td>
          </tr>
          <tr>
            <th>藥物外觀描述</th>
            <td>${escapeHtml(drugA.pill_appearance || '請參閱標籤')}</td>
            <td>${escapeHtml(drugB.pill_appearance || '請參閱標籤')}</td>
          </tr>
          <tr>
            <th>ARR 干擾評估</th>
            <td>${getArrBadge(drugA)}</td>
            <td>${getArrBadge(drugB)}</td>
          </tr>
          <tr>
            <th>建議洗脫期</th>
            <td style="font-weight:900;font-size:1.05rem;">${escapeHtml(drugA.washout_period)}</td>
            <td style="font-weight:900;font-size:1.05rem;">${escapeHtml(drugB.washout_period)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  document.querySelector('#compare-select-a').addEventListener('change', (e) => {
    compareDrugA = e.target.value;
    renderCompare();
  });
  document.querySelector('#compare-select-b').addEventListener('change', (e) => {
    compareDrugB = e.target.value;
    renderCompare();
  });
  document.querySelectorAll('[data-zoom-id]').forEach(el => {
    el.addEventListener('click', () => openImageModal(el.dataset.zoomId));
  });
}

/* ==========================================================================
   ROUTE 7: DETAIL VIEW (單一藥物詳細說明頁)
   ========================================================================== */

function renderDetail(id) {
  updateNavActive('');

  const med = medications.find(m => m.id === id);
  if (!med) {
    window.location.hash = '#/';
    return;
  }

  app.innerHTML = `
    <div style="margin-bottom:1.5rem;">
      <a href="#/" class="btn btn-outline btn-sm">
        ← 返回藥物圖鑑與外觀
      </a>
    </div>

    <article style="background:#ffffff;border:1px solid var(--border-strong);border-radius:10px;padding:2rem;box-shadow:var(--shadow-sm);">
      <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:1.5rem;padding-bottom:1.5rem;border-bottom:2px solid var(--border);margin-bottom:1.5rem;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:1rem;">
          <div style="width:96px;height:96px;background:var(--bg-page);border-radius:10px;border:1px solid var(--border);display:grid;place-items:center;cursor:pointer;overflow:hidden;" data-zoom-id="${med.id}" title="點擊檢視放大外觀圖">
            <img src="${escapeHtml(med.image)}" alt="${escapeHtml(med.generic_name)}" style="width:100%;height:100%;object-fit:cover;" />
          </div>
          <div>
            <div style="font-size:0.82rem;color:var(--primary);font-weight:800;margin-bottom:0.2rem;">
              ${escapeHtml(med.category_name_zh || med.category)} ${med.is_combination ? ' (複方藥物)' : ''}
            </div>
            <h1 style="font-size:2rem;font-weight:900;color:var(--primary-dark);line-height:1.2;">
              ${escapeHtml(med.generic_name)}
            </h1>
            <div style="font-size:1.1rem;color:var(--text-body);font-weight:700;">${escapeHtml(med.localized_names ? med.localized_names.join(' / ') : '')}</div>
            <div style="font-size:0.88rem;color:var(--text-muted);margin-top:0.25rem;"><strong>常見商品名：</strong>${escapeHtml(med.brand_names ? med.brand_names.join(', ') : '無')}</div>

            <div style="margin-top:0.75rem;padding:0.75rem 1rem;background:var(--bg-page);border:1px solid var(--border);border-radius:6px;">
              ${renderTfdaSectionHtml(med)}
              ${renderFdaSectionHtml(med)}
            </div>
          </div>
        </div>

        <div>
          ${getArrBadge(med)}
        </div>
      </header>

      ${med.is_combination ? `
        <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:1rem 1.25rem;margin-bottom:1.5rem;color:#713f12;">
          <h3 style="font-size:1rem;font-weight:900;margin-bottom:0.25rem;">🔬 複方藥物成分拆解資訊</h3>
          <p style="font-size:0.9rem;"><strong>包含成分：</strong>${escapeHtml(med.combination_components)}</p>
          <p style="font-size:0.9rem;"><strong>成分分類：</strong>${escapeHtml(med.combination_categories)}</p>
          <p style="font-size:0.88rem;margin-top:0.25rem;color:#854d0e;"><strong>臨床評估：</strong>${escapeHtml(med.combination_notes)}</p>
        </div>
      ` : ''}

      <!-- 外觀視覺特徵 -->
      <div style="background:var(--primary-soft);border:1px solid #bfdbfe;padding:1rem 1.25rem;border-radius:8px;margin-bottom:1.5rem;display:flex;align-items:center;gap:1rem;">
        <div style="font-size:1.8rem;line-height:1;">💊</div>
        <div>
          <strong style="font-size:0.95rem;color:var(--primary-dark);">藥物實體外觀說明：</strong>
          <div style="font-size:0.9rem;color:var(--text-body);margin-top:0.15rem;">${escapeHtml(med.pill_appearance || '請參考原廠藥盒標示')}</div>
        </div>
      </div>

      <!-- 4 大指標 -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:1rem;margin-bottom:2rem;">
        <div style="background:var(--bg-page);border:1px solid var(--border);padding:1rem;border-radius:8px;text-align:center;">
          <div style="font-size:0.82rem;color:var(--text-muted);font-weight:700;">PAC (醛固酮) 影響</div>
          <div style="font-size:1.5rem;font-weight:900;margin-top:0.25rem;color:${med.pac_effect.includes('↑') ? 'var(--danger)' : 'var(--blue-alt)'};">${escapeHtml(med.pac_effect)}</div>
        </div>

        <div style="background:var(--bg-page);border:1px solid var(--border);padding:1rem;border-radius:8px;text-align:center;">
          <div style="font-size:0.82rem;color:var(--text-muted);font-weight:700;">PRA (腎素活性) 影響</div>
          <div style="font-size:1.5rem;font-weight:900;margin-top:0.25rem;color:${med.pra_effect.includes('↑') ? 'var(--danger)' : 'var(--blue-alt)'};">${escapeHtml(med.pra_effect)}</div>
        </div>

        <div style="background:var(--bg-page);border:1px solid var(--border);padding:1rem;border-radius:8px;text-align:center;">
          <div style="font-size:0.82rem;color:var(--text-muted);font-weight:700;">ARR 比值干擾</div>
          <div style="font-size:1.15rem;font-weight:900;margin-top:0.25rem;">${escapeHtml(med.arr_effect)}</div>
        </div>

        <div style="background:var(--bg-page);border:1px solid var(--border);padding:1rem;border-radius:8px;text-align:center;">
          <div style="font-size:0.82rem;color:var(--text-muted);font-weight:700;">建議洗脫停藥期</div>
          <div style="font-size:1.3rem;font-weight:900;margin-top:0.25rem;color:var(--danger-dark);">${escapeHtml(med.washout_period)}</div>
        </div>
      </div>

      ${med.ddd ? `
        <!-- WHO 定義每日劑量 (DDD) 資訊卡 -->
        <div style="background:var(--bg-page);border:1px solid var(--border);border-radius:8px;padding:1.25rem;margin-bottom:2rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem;">
            <h3 style="font-size:1.05rem;font-weight:900;color:var(--primary-dark);display:flex;align-items:center;gap:0.5rem;margin:0;">
              <span>📊 WHO 定義每日劑量 (DDD) 資訊</span>
            </h3>
            <span style="font-size:0.78rem;padding:0.2rem 0.6rem;border-radius:12px;font-weight:700;${med.ddd.status === '已確認' ? 'background:#dcfce7;color:#166534;border:1px solid #86efac;' : 'background:#fef3c7;color:#92400e;border:1px solid #fde047;'}">
              資料狀態：${escapeHtml(med.ddd.status || '檢核中')}
            </span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:0.75rem;margin-bottom:0.75rem;">
            <div style="background:#ffffff;border:1px solid var(--border);padding:0.75rem 1rem;border-radius:6px;">
              <div style="font-size:0.78rem;color:var(--text-muted);font-weight:700;">標準每日 DDD (WHO)</div>
              <div style="font-size:1.15rem;font-weight:900;color:var(--primary-dark);margin-top:0.15rem;">
                ${escapeHtml(med.ddd.standard_mg_per_day_raw || '-')} <span style="font-size:0.8rem;font-weight:normal;">mg/day</span>
              </div>
            </div>

            <div style="background:#ffffff;border:1px solid var(--border);padding:0.75rem 1rem;border-radius:6px;">
              <div style="font-size:0.78rem;color:var(--text-muted);font-weight:700;">單錠規格劑量</div>
              <div style="font-size:1.15rem;font-weight:900;color:var(--primary-dark);margin-top:0.15rem;">
                ${escapeHtml(med.ddd.tablet_strength_mg_raw || '-')} <span style="font-size:0.8rem;font-weight:normal;">mg/tab</span>
              </div>
            </div>

            <div style="background:#ffffff;border:1px solid var(--border);padding:0.75rem 1rem;border-radius:6px;">
              <div style="font-size:0.78rem;color:var(--text-muted);font-weight:700;">每錠內含 DDD 單位數</div>
              <div style="font-size:1.15rem;font-weight:900;color:var(--primary-dark);margin-top:0.15rem;">
                ${escapeHtml(med.ddd.ddd_per_tablet_raw || '-')} <span style="font-size:0.8rem;font-weight:normal;">DDD/tab</span>
              </div>
            </div>
          </div>

          ${med.ddd.components && med.ddd.components.length > 0 ? `
            <div style="font-size:0.85rem;color:var(--text-body);background:#ffffff;border:1px solid var(--border);border-radius:6px;padding:0.75rem 1rem;">
              <strong style="color:var(--primary-dark);">成分對應與換算比例：</strong>
              <ul style="margin:0.35rem 0 0 1.25rem;padding:0;">
                ${med.ddd.components.map(c => `
                  <li>${escapeHtml(c.name || '核心成分')}: ${escapeHtml(c.mg_raw || '-')} mg / WHO DDD ${escapeHtml(c.who_ddd_raw || '-')} mg (換算比值: ${escapeHtml(c.ratio_raw || '-')})</li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.5rem;text-align:right;">
            資料來源：${escapeHtml(med.ddd.source || 'WHO ATC/DDD Index')}
          </div>
        </div>
      ` : ''}

      <!-- 臨床處置卡 -->
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-left:5px solid var(--danger);padding:1.25rem;border-radius:8px;margin-bottom:2rem;color:#991b1b;">
        <h3 style="font-size:1.05rem;font-weight:900;margin-bottom:0.35rem;">原發性醛固酮過多症 (PA) 臨床處置與注意事項</h3>
        <p style="font-size:0.95rem;line-height:1.6;margin-bottom:0.5rem;">${escapeHtml(med.screening_recommendation)}</p>
        <p style="font-size:0.88rem;color:#7f1d1d;"><strong>ARR 影響說明：</strong>${escapeHtml(med.pac_pra_arr_effect)}</p>
        <p style="font-size:0.88rem;color:#7f1d1d;margin-top:0.35rem;"><strong>常見副作用與警語：</strong>${escapeHtml(med.common_side_effects)} — ${escapeHtml(med.important_warnings)}</p>
      </div>

      <!-- 臨床詳細資訊 -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:1.25rem;">
        <div style="background:var(--bg-page);border:1px solid var(--border);padding:1.25rem;border-radius:8px;">
          <h4 style="font-size:0.95rem;font-weight:800;color:var(--primary-dark);margin-bottom:0.5rem;">藥理作用機轉 (Mechanism)</h4>
          <p style="font-size:0.9rem;color:var(--text-body);">${escapeHtml(med.mechanism)}</p>
        </div>

        <div style="background:var(--bg-page);border:1px solid var(--border);padding:1.25rem;border-radius:8px;">
          <h4 style="font-size:0.95rem;font-weight:800;color:var(--primary-dark);margin-bottom:0.5rem;">主要適應症 (Indications)</h4>
          <p style="font-size:0.9rem;color:var(--text-body);">${escapeHtml(med.indications)}</p>
        </div>
      </div>
    </article>
  `;

  document.querySelectorAll('[data-zoom-id]').forEach(el => {
    el.addEventListener('click', () => openImageModal(el.dataset.zoomId));
  });
}


/* ==========================================================================
   📖 資料來源 (Data Sources & References)
   ========================================================================== */

function renderSources() {
  updateNavActive('sources');

  app.innerHTML = `
    <section class="section-container" style="padding-top: 1.5rem; padding-bottom: 3rem;">
      
      <!-- 頁面 Header 區塊 -->
      <div style="background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%); color: #ffffff; padding: 2rem 1.5rem; border-radius: var(--radius-lg); margin-bottom: 2rem; box-shadow: var(--shadow-md);">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
          <span style="font-size: 1.8rem; line-height: 1;">📖</span>
          <h1 style="font-size: 1.6rem; font-weight: 900; margin: 0; color: #ffffff;">資料來源</h1>
        </div>
        <p style="font-size: 0.98rem; opacity: 0.95; line-height: 1.6; margin-top: 0.5rem; max-width: 900px;">
          本網站資料來自不同官方及可靠資料來源，以下依用途分類說明。
        </p>
      </div>

      <!-- 四大分類內容 -->
      <div style="display: flex; flex-direction: column; gap: 2.25rem;">

        <!-- 第一類：PA 相關資料 -->
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; border-bottom: 2px solid var(--primary-light); padding-bottom: 0.5rem;">
            <span style="font-size: 1.25rem;">🩺</span>
            <h2 style="font-size: 1.25rem; font-weight: 900; color: var(--primary-dark); margin: 0;">一、PA 相關資料</h2>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
            
            <!-- 卡片 1 -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--primary-dark); margin-bottom: 0.6rem; line-height: 1.4;">
                  Primary Aldosteronism: An Endocrine Society Clinical Practice Guideline
                </h3>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.4rem;">
                  <strong>發布機構：</strong>Endocrine Society
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.4rem;">
                  <strong>發布年份：</strong>2025 年
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.8rem; line-height: 1.5;">
                  <strong>資料用途：</strong>PA篩檢、診斷、治療與臨床管理參考
                </div>
              </div>
              <div style="border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.5rem;">
                <a href="https://www.endocrine.org/clinical-practice-guidelines/primary-aldosteronism-2" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; font-weight: 700; color: var(--primary-light); text-decoration: none;">
                  🔗 官方來源連結 ↗
                </a>
              </div>
            </div>

            <!-- 卡片 2 -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--primary-dark); margin-bottom: 0.6rem; line-height: 1.4;">
                  Case detection and diagnosis of primary aldosteronism - The consensus of Taiwan Society of Aldosteronism
                </h3>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.4rem;">
                  <strong>發布機構：</strong>Taiwan Society of Aldosteronism
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.4rem;">
                  <strong>發布年份：</strong>2017 年
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.8rem; line-height: 1.5;">
                  <strong>資料用途：</strong>台灣PA篩檢、ARR、確診及AVS參考
                </div>
              </div>
              <div style="border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.5rem;">
                <a href="https://pubmed.ncbi.nlm.nih.gov/28735660/" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; font-weight: 700; color: var(--primary-light); text-decoration: none;">
                  🔗 原始來源連結 (PubMed) ↗
                </a>
              </div>
            </div>

            <!-- 卡片 3 -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--primary-dark); margin-bottom: 0.6rem; line-height: 1.4;">
                  Targeted treatment of primary aldosteronism - The consensus of Taiwan Society of Aldosteronism
                </h3>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.4rem;">
                  <strong>發布機構：</strong>Taiwan Society of Aldosteronism
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.4rem;">
                  <strong>發布年份：</strong>2019 年
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.8rem; line-height: 1.5;">
                  <strong>資料用途：</strong>PA治療參考
                </div>
              </div>
              <div style="border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.5rem;">
                <a href="https://pubmed.ncbi.nlm.nih.gov/29506889/" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; font-weight: 700; color: var(--primary-light); text-decoration: none;">
                  🔗 原始來源連結 (PubMed) ↗
                </a>
              </div>
            </div>

          </div>
        </div>

        <!-- 第二類：DDD 資料 -->
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; border-bottom: 2px solid var(--primary-light); padding-bottom: 0.5rem;">
            <span style="font-size: 1.25rem;">📊</span>
            <h2 style="font-size: 1.25rem; font-weight: 900; color: var(--primary-dark); margin: 0;">二、DDD 資料</h2>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
            
            <!-- 卡片 1 -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--primary-dark); margin-bottom: 0.6rem; line-height: 1.4;">
                  ATC/DDD system
                </h3>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.4rem;">
                  <strong>發布機構：</strong>World Health Organization (WHO)
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.8rem; line-height: 1.5;">
                  <strong>資料用途：</strong>ATC分類與DDD標準參考
                </div>
              </div>
              <div style="border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.5rem;">
                <a href="https://www.who.int/standards/classifications/other-classifications/the-anatomical-therapeutic-chemical-classification-system-with-defined-daily-doses" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; font-weight: 700; color: var(--primary-light); text-decoration: none;">
                  🔗 官方來源連結 ↗
                </a>
              </div>
            </div>

            <!-- 卡片 2 -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--primary-dark); margin-bottom: 0.6rem; line-height: 1.4;">
                  Defined Daily Dose (DDD) – ATC/DDD Toolkit
                </h3>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.4rem;">
                  <strong>發布機構：</strong>WHO / WHO Collaborating Centre for Drug Statistics Methodology
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.8rem; line-height: 1.5;">
                  <strong>資料用途：</strong>DDD定義與分配原則
                </div>
              </div>
              <div style="border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.5rem;">
                <a href="https://www.who.int/tools/atc-ddd-toolkit/about-ddd" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; font-weight: 700; color: var(--primary-light); text-decoration: none;">
                  🔗 官方來源連結 ↗
                </a>
              </div>
            </div>

            <!-- 卡片 3 -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--primary-dark); margin-bottom: 0.6rem; line-height: 1.4;">
                  ATC/DDD Methodology
                </h3>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.4rem;">
                  <strong>發布機構：</strong>WHO / WHO Collaborating Centre for Drug Statistics Methodology
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.8rem; line-height: 1.5;">
                  <strong>資料用途：</strong>ATC/DDD方法學、分類與DDD assignment原則
                </div>
              </div>
              <div style="border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.5rem;">
                <a href="https://www.who.int/tools/atc-ddd-toolkit/methodology" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; font-weight: 700; color: var(--primary-light); text-decoration: none;">
                  🔗 官方來源連結 ↗
                </a>
              </div>
            </div>

          </div>
        </div>

        <!-- 第三類：藥品資料 -->
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; border-bottom: 2px solid var(--primary-light); padding-bottom: 0.5rem;">
            <span style="font-size: 1.25rem;">💊</span>
            <h2 style="font-size: 1.25rem; font-weight: 900; color: var(--primary-dark); margin: 0;">三、藥品資料</h2>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
            
            <!-- 卡片 1 -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--primary-dark); margin-bottom: 0.6rem; line-height: 1.4;">
                  TFDA 藥品許可證查詢
                </h3>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.4rem;">
                  <strong>發布機構：</strong>衛生福利部食品藥物管理署（TFDA）
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.8rem; line-height: 1.5;">
                  <strong>資料用途：</strong>台灣藥品許可證、官方品名、規格與藥證資料
                </div>
              </div>
              <div style="border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.5rem;">
                <a href="https://lmspiq.fda.gov.tw/web/DRPIQ/license-search" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; font-weight: 700; color: var(--primary-light); text-decoration: none;">
                  🔗 官方來源連結 ↗
                </a>
              </div>
            </div>

            <!-- 卡片 2 -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.4rem;">
                  <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--primary-dark); margin: 0; line-height: 1.4;">
                    DailyMed
                  </h3>
                  <span style="font-size: 0.75rem; font-weight: 700; background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 0.2rem 0.55rem; border-radius: 12px; white-space: nowrap;">
                    ⚠️ 網站實際使用待核對
                  </span>
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.4rem;">
                  <strong>發布機構：</strong>U.S. National Library of Medicine (NLM)
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.8rem; line-height: 1.5;">
                  <strong>資料用途：</strong>美國藥品標籤與藥品資訊參考
                </div>
              </div>
              <div style="border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.5rem;">
                <a href="https://dailymed.nlm.nih.gov/dailymed/" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; font-weight: 700; color: var(--primary-light); text-decoration: none;">
                  🔗 官方來源連結 ↗
                </a>
              </div>
            </div>

            <!-- 卡片 3 -->
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.4rem;">
                  <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--primary-dark); margin: 0; line-height: 1.4;">
                    FDA Drugs
                  </h3>
                  <span style="font-size: 0.75rem; font-weight: 700; background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 0.2rem 0.55rem; border-radius: 12px; white-space: nowrap;">
                    ⚠️ 網站實際使用待核對
                  </span>
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.4rem;">
                  <strong>發布機構：</strong>U.S. Food and Drug Administration
                </div>
                <div style="font-size: 0.88rem; color: var(--text-body); margin-bottom: 0.8rem; line-height: 1.5;">
                  <strong>資料用途：</strong>美國官方藥品資訊參考
                </div>
              </div>
              <div style="border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.5rem;">
                <a href="https://www.fda.gov/drugs" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; font-weight: 700; color: var(--primary-light); text-decoration: none;">
                  🔗 官方來源連結 ↗
                </a>
              </div>
            </div>

          </div>
        </div>

        <!-- 第四類：其他參考資料 -->
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; border-bottom: 2px solid var(--primary-light); padding-bottom: 0.5rem;">
            <span style="font-size: 1.25rem;">📚</span>
            <h2 style="font-size: 1.25rem; font-weight: 900; color: var(--primary-dark); margin: 0;">四、其他參考資料</h2>
          </div>

          <div style="background: var(--bg-card); border: 1px dashed var(--border-strong); border-radius: var(--radius-md); padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.95rem; font-weight: 500;">
            目前暫無其他已確認來源
          </div>
        </div>

      </div>

    </section>
  `;
}

/* ==========================================================================
   Router Initialization
   ========================================================================== */

function route() {
  const hash = window.location.hash || '#/';
  const detailMatch = hash.match(/^#\/medicine\/([^?]+)$/);
  
  if (hash === '#/' || hash === '') {
    renderHome();
  } else if (hash === '#/research') {
    renderResearch();
  } else if (hash === '#/pathway') {
    renderPathway();
  } else if (hash === '#/calculator') {
    renderCalculator();
  } else if (hash === '#/matrix') {
    renderMatrix();
  } else if (hash === '#/washout') {
    renderWashout();
  } else if (hash === '#/compare') {
    renderCompare();
  } else if (hash === '#/sources') {
    renderSources();
  } else if (detailMatch) {
    renderDetail(decodeURIComponent(detailMatch[1]));
  } else {
    renderHome();
  }

  window.scrollTo(0, 0);
}

// Initial Boot
async function start() {
  try {
    const [res, overridesRes] = await Promise.all([
      fetch('data/medications.json'),
      fetch('data/medication-image-overrides.json')
    ]);
    if (!res.ok) throw new Error('無法載入藥物資料庫 json');
    const baseMedications = await res.json();
    const overrides = overridesRes.ok ? await overridesRes.json() : {};
    medications = baseMedications.map((medication) => {
      const override = overrides[medication.id] || {};
      const mergedBrands = [...new Set([...(medication.brand_names || []), ...(override.brand_names_add || [])])];
      return { ...medication, ...override, brand_names: mergedBrands };
    });
    
    route();
    window.addEventListener('hashchange', route);
  } catch (err) {
    app.innerHTML = `
      <div style="text-align:center;padding:5rem 1rem;color:var(--danger);">
        <h2>⚠️ 藥物資料載入失敗</h2>
        <p style="margin-top:0.5rem;color:var(--text-muted);">請確認是否已透過 HTTP 伺服器啟動 (例如 python -m http.server 8000)。</p>
      </div>
    `;
    console.error(err);
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => console.log('SW reg error:', err));
  });
}

start();
