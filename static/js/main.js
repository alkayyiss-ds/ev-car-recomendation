/* =============================================================
   EcoDrive Matchmaker — Interactive JavaScript
   ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initLeafParticles();
    initSliders();
    initScoreRings();
    initCountUpStats();
    initScrollAnimations();
    initInlineCharts();
});


/* ── NAVBAR SCROLL EFFECT ──────────────────── */
function initNavbar() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const links = document.querySelectorAll('.nav-link[data-section]');

    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);

        // Highlight active nav link based on scroll position
        let current = '';
        document.querySelectorAll('section[id], .hero-landing[id]').forEach(section => {
            const top = section.offsetTop - 100;
            if (window.scrollY >= top) current = section.id;
        });
        links.forEach(link => {
            link.classList.toggle('active', link.dataset.section === current);
        });
    });
}


/* ── LEAF PARTICLE ANIMATION ───────────────── */
function initLeafParticles() {
    const container = document.querySelector('.leaf-particles');
    if (!container) return;

    const leafEmojis = ['🍃', '🌿', '🌱', '☘️', '🍀'];
    const totalLeaves = 15;

    for (let i = 0; i < totalLeaves; i++) {
        const leaf = document.createElement('span');
        leaf.className = 'leaf';
        leaf.textContent = leafEmojis[Math.floor(Math.random() * leafEmojis.length)];
        leaf.style.left = Math.random() * 100 + '%';
        leaf.style.fontSize = (0.8 + Math.random() * 0.8) + 'rem';
        leaf.style.animationDuration = (8 + Math.random() * 12) + 's';
        leaf.style.animationDelay = (Math.random() * 10) + 's';
        container.appendChild(leaf);
    }
}


/* ── SLIDERS ───────────────────────────────── */
function initSliders() {
    [['city_ratio', 'cityDisp'], ['eco_priority', 'ecoDisp']].forEach(([id, disp]) => {
        const el = document.getElementById(id);
        if (el) syncSlider(el, disp, '%');
    });
}

function syncSlider(el, dispId, suffix) {
    const display = document.getElementById(dispId);
    if (display) display.textContent = el.value + suffix;
    const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.background = `linear-gradient(to right, var(--forest-mid) ${pct}%, var(--cream-dark) ${pct}%)`;
}


/* ── SCORE RINGS ANIMATION ─────────────────── */
function initScoreRings() {
    document.querySelectorAll('.r-prog').forEach(el => {
        const target = el.getAttribute('stroke-dashoffset');
        el.style.strokeDashoffset = 138;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.style.strokeDashoffset = target;
            });
        });
    });
}


/* ── COUNT-UP ANIMATION ────────────────────── */
function initCountUpStats() {
    const counters = document.querySelectorAll('[data-count-target]');
    if (!counters.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.counted) {
                entry.target.dataset.counted = 'true';
                animateCounter(entry.target);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(el) {
    const target = parseFloat(el.dataset.countTarget);
    const suffix = el.dataset.countSuffix || '';
    const duration = 1800;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * target);
        el.textContent = current.toLocaleString('id-ID') + suffix;
        if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}


/* ── SCROLL ANIMATIONS (Intersection Observer) ── */
function initScrollAnimations() {
    const fadeEls = document.querySelectorAll('.fade-in');
    if (!fadeEls.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    fadeEls.forEach(el => observer.observe(el));
}


/* ── VIEW TOGGLE ───────────────────────────── */
function setView(mode) {
    const grid = document.getElementById('vehiclesGrid');
    if (!grid) return;
    grid.classList.toggle('list-view', mode === 'list');
    document.getElementById('btnGrid').classList.toggle('active', mode === 'grid');
    document.getElementById('btnList').classList.toggle('active', mode === 'list');
}


/* ── SORT CARDS ────────────────────────────── */
function sortCards(key, btn) {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const grid = document.getElementById('vehiclesGrid');
    if (!grid) return;
    [...grid.children].sort((a, b) => {
        const va = parseFloat(a.dataset[key]);
        const vb = parseFloat(b.dataset[key]);
        return key === 'co2' ? va - vb : vb - va;
    }).forEach(c => grid.appendChild(c));
}


/* ── SELECT CARD ───────────────────────────── */
function selectCard(el) {
    document.querySelectorAll('.v-card').forEach(c => c.classList.remove('is-selected'));
    el.classList.add('is-selected');
}


/* ── COMPARE BAR ───────────────────────────── */
let cmpData = [];

function syncCmpBar() {
    const cbs = [...document.querySelectorAll('.cmp-cb:checked')];
    if (cbs.length > 4) {
        cbs[cbs.length - 1].checked = false;
        return syncCmpBar();
    }
    cmpData = cbs.map(cb => ({
        name: cb.dataset.name,
        score: +cb.dataset.score,
        co2: +cb.dataset.co2,
        mpg: +cb.dataset.mpg,
        range: +cb.dataset.range,
        cityMpg: +cb.dataset.citympg || +cb.dataset.mpg,
    }));
    const bar = document.getElementById('cmpBar');
    if (cmpData.length >= 2) {
        bar.classList.add('show');
        document.getElementById('cmpCount').textContent = cmpData.length + ' kendaraan';
        document.getElementById('cmpChips').innerHTML = cmpData.map(c =>
            `<span class="cmp-chip">${c.name}</span>`
        ).join('');
    } else {
        bar.classList.remove('show');
    }
}

function clearCmp() {
    document.querySelectorAll('.cmp-cb').forEach(cb => cb.checked = false);
    cmpData = [];
    document.getElementById('cmpBar').classList.remove('show');
}


/* ── COMPARE MODAL ─────────────────────────── */
let chart = null;

function openModal() {
    document.getElementById('cmpOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.querySelectorAll('.ctab').forEach((t, i) => t.classList.toggle('active', i === 0));
    document.getElementById('chartWrap').style.display = 'block';
    document.getElementById('tableWrap').style.display = 'none';
    buildChart('radar');
}

function closeModal() {
    document.getElementById('cmpOverlay').classList.remove('open');
    document.body.style.overflow = '';
    if (chart) { chart.destroy(); chart = null; }
}

function bgClose(e) {
    if (e.target === document.getElementById('cmpOverlay')) closeModal();
}

function showTab(type, btn) {
    document.querySelectorAll('.ctab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    if (chart) { chart.destroy(); chart = null; }
    if (type === 'table') {
        document.getElementById('chartWrap').style.display = 'none';
        document.getElementById('tableWrap').style.display = 'block';
        buildTable();
    } else {
        document.getElementById('chartWrap').style.display = 'block';
        document.getElementById('tableWrap').style.display = 'none';
        buildChart(type);
    }
}

const CPALS = [
    { bg: 'rgba(45,90,61,0.15)', bd: '#2D5A3D' },
    { bg: 'rgba(200,121,42,0.15)', bd: '#C8792A' },
    { bg: 'rgba(42,95,143,0.15)', bd: '#2A5F8F' },
    { bg: 'rgba(184,76,60,0.15)', bd: '#B84C3C' },
];

function buildChart(type) {
    const ctx = document.getElementById('cmpChart').getContext('2d');
    Chart.defaults.color = '#8C8070';
    Chart.defaults.borderColor = 'rgba(28,26,22,0.08)';
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

    if (type === 'radar') {
        chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Eco Score', 'MPG', 'Jarak (÷10)', 'CO₂ Rendah', 'Efisiensi Kota'],
                datasets: cmpData.map((c, i) => ({
                    label: c.name,
                    data: [c.score, Math.min(c.mpg, 100), Math.min(c.range / 10, 100), Math.max(0, 100 - c.co2 / 80), Math.min(c.cityMpg, 100)],
                    backgroundColor: CPALS[i].bg,
                    borderColor: CPALS[i].bd,
                    pointBackgroundColor: CPALS[i].bd,
                    borderWidth: 2, pointRadius: 4,
                }))
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#4A4438', font: { size: 12 } } } },
                scales: { r: { suggestedMin: 0, suggestedMax: 100, grid: { color: 'rgba(28,26,22,0.06)' }, ticks: { display: false }, pointLabels: { color: '#8C8070', font: { size: 12 } } } },
                animation: { duration: 900 }
            }
        });
    } else {
        chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Eco Score', 'MPG', 'Range (mil)'],
                datasets: cmpData.map((c, i) => ({
                    label: c.name,
                    data: [c.score, c.mpg, c.range],
                    backgroundColor: CPALS[i].bg.replace('0.15', '0.75'),
                    borderColor: CPALS[i].bd,
                    borderWidth: 1, borderRadius: 8,
                }))
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#4A4438', font: { size: 12 } } } },
                scales: {
                    x: { ticks: { color: '#8C8070' }, grid: { color: 'rgba(28,26,22,0.05)' } },
                    y: { ticks: { color: '#8C8070' }, grid: { color: 'rgba(28,26,22,0.05)' } }
                },
                animation: { duration: 700 }
            }
        });
    }
}

function buildTable() {
    const metrics = [
        { key: 'score', label: '🏆 Eco Score' },
        { key: 'mpg', label: '⚡ MPG' },
        { key: 'range', label: '🛣 Range (mil)' },
        { key: 'co2', label: '🌿 CO₂/Thn (kg)' },
        { key: 'cityMpg', label: '🏙 City MPG' }
    ];
    let html = `<table style="width:100%;border-collapse:collapse;font-size:0.83rem;font-family:'Plus Jakarta Sans',sans-serif;">
    <thead><tr>
        <th style="text-align:left;padding:12px;border-bottom:2px solid rgba(28,26,22,0.15);color:#8C8070;font-weight:600;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;">Metrik</th>`;

    cmpData.forEach((c, i) => {
        html += `<th style="padding:12px;border-bottom:2px solid rgba(28,26,22,0.15);color:${CPALS[i].bd};font-weight:700;text-align:center;">${c.name}</th>`;
    });
    html += `</tr></thead><tbody>`;

    metrics.forEach(m => {
        const vals = cmpData.map(c => c[m.key]);
        const best = m.key === 'co2' ? Math.min(...vals) : Math.max(...vals);
        html += `<tr><td style="padding:10px 12px;border-bottom:1px solid rgba(28,26,22,0.08);color:#8C8070;">${m.label}</td>`;
        vals.forEach(v => {
            const isB = v === best;
            html += `<td style="padding:10px 12px;border-bottom:1px solid rgba(28,26,22,0.08);text-align:center;font-weight:${isB ? 700 : 400};color:${isB ? '#3D7A52' : '#4A4438'}">${v}${isB ? ' <span style="color:#C8792A;font-size:0.75rem;">★</span>' : ''}</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById('tableWrap').innerHTML = html;
}


/* ── INLINE CHARTS (from chart_data) ───────── */
let inlineCharts = {};

function initInlineCharts() {
    // Read chart data from JSON script tag
    const el = document.getElementById('chartDataPayload');
    if (!el) return;
    let data;
    try {
        data = JSON.parse(el.textContent);
    } catch (e) {
        return;
    }
    if (!data) return;

    // Show default tab
    switchChartTab('co2bar');

    // Build all charts when their tab is shown
    buildCO2BarChart(data.co2_bar);
    buildDonutChart(data.donut);
    buildScatterChart(data.scatter);
    buildRadarOverview(data.radar);
}

function switchChartTab(tabId) {
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.chart-pane').forEach(p => p.classList.remove('active'));

    const btn = document.querySelector(`.chart-tab[data-tab="${tabId}"]`);
    const pane = document.getElementById('pane-' + tabId);
    if (btn) btn.classList.add('active');
    if (pane) pane.classList.add('active');

    // Destroy and rebuild to fix sizing
    Object.keys(inlineCharts).forEach(key => {
        if (inlineCharts[key]) {
            inlineCharts[key].resize();
        }
    });
}

function buildCO2BarChart(data) {
    const ctx = document.getElementById('co2BarChart');
    if (!ctx || !data) return;

    const colors = data.values.map(v =>
        v === 0 ? 'rgba(82,183,136,0.85)' :
        v < 3000 ? 'rgba(45,90,61,0.75)' :
        v < 5500 ? 'rgba(200,121,42,0.75)' :
        'rgba(184,76,60,0.75)'
    );

    inlineCharts.co2bar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'CO₂ Tahunan (kg)',
                data: data.values,
                backgroundColor: colors,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1C1A16',
                    titleFont: { family: "'Plus Jakarta Sans'" },
                    bodyFont: { family: "'Plus Jakarta Sans'" },
                    cornerRadius: 8,
                    padding: 12,
                }
            },
            scales: {
                x: {
                    ticks: { color: '#8C8070', font: { size: 11 }, maxRotation: 45 },
                    grid: { display: false },
                },
                y: {
                    ticks: { color: '#8C8070', font: { size: 11 } },
                    grid: { color: 'rgba(28,26,22,0.06)' },
                    title: { display: true, text: 'kg CO₂ / tahun', color: '#8C8070', font: { size: 11 } },
                }
            },
            animation: { duration: 1000, easing: 'easeOutQuart' }
        }
    });
}

function buildDonutChart(data) {
    const ctx = document.getElementById('donutChart');
    if (!ctx || !data) return;

    const palette = [
        'rgba(45,90,61,0.85)',
        'rgba(200,121,42,0.85)',
        'rgba(42,95,143,0.85)',
        'rgba(184,76,60,0.85)',
        'rgba(123,94,167,0.85)',
    ];

    inlineCharts.donut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.values,
                backgroundColor: palette.slice(0, data.labels.length),
                borderWidth: 3,
                borderColor: '#fff',
                hoverOffset: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#4A4438',
                        font: { size: 12, family: "'Plus Jakarta Sans'" },
                        padding: 16,
                        usePointStyle: true,
                        pointStyleWidth: 10,
                    }
                },
                tooltip: {
                    backgroundColor: '#1C1A16',
                    cornerRadius: 8,
                    padding: 12,
                }
            },
            animation: { animateRotate: true, duration: 1200 }
        }
    });
}

function buildScatterChart(data) {
    const ctx = document.getElementById('scatterChart');
    if (!ctx || !data) return;

    inlineCharts.scatter = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Rekomendasi',
                data: data.points.map(p => ({ x: p.x, y: p.y })),
                backgroundColor: 'rgba(45,90,61,0.7)',
                borderColor: '#2D5A3D',
                borderWidth: 2,
                pointRadius: 8,
                pointHoverRadius: 12,
                pointStyle: 'circle',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1C1A16',
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        label: function(ctx) {
                            const pt = data.points[ctx.dataIndex];
                            return `${pt.label}: ${pt.x} MPG, ${pt.y} g/mil CO₂`;
                        }
                    }
                },
            },
            scales: {
                x: {
                    title: { display: true, text: 'Combined MPG', color: '#8C8070', font: { size: 11 } },
                    ticks: { color: '#8C8070' },
                    grid: { color: 'rgba(28,26,22,0.06)' },
                },
                y: {
                    title: { display: true, text: 'CO₂ (g/mil)', color: '#8C8070', font: { size: 11 } },
                    ticks: { color: '#8C8070' },
                    grid: { color: 'rgba(28,26,22,0.06)' },
                    reverse: true,
                }
            },
            animation: { duration: 900 }
        }
    });
}

function buildRadarOverview(data) {
    const ctx = document.getElementById('radarOverviewChart');
    if (!ctx || !data) return;

    const radarPals = [
        { bg: 'rgba(45,90,61,0.12)', bd: '#2D5A3D' },
        { bg: 'rgba(200,121,42,0.12)', bd: '#C8792A' },
        { bg: 'rgba(42,95,143,0.12)', bd: '#2A5F8F' },
    ];

    inlineCharts.radar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: data.labels,
            datasets: data.datasets.map((ds, i) => ({
                label: ds.name,
                data: ds.values,
                backgroundColor: radarPals[i].bg,
                borderColor: radarPals[i].bd,
                pointBackgroundColor: radarPals[i].bd,
                borderWidth: 2,
                pointRadius: 4,
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#4A4438', font: { size: 12, family: "'Plus Jakarta Sans'" } }
                }
            },
            scales: {
                r: {
                    suggestedMin: 0, suggestedMax: 100,
                    grid: { color: 'rgba(28,26,22,0.06)' },
                    ticks: { display: false },
                    pointLabels: { color: '#8C8070', font: { size: 12 } },
                }
            },
            animation: { duration: 1000 }
        }
    });
}


/* ── FORM LOADING STATE ────────────────────── */
const filterForm = document.getElementById('filterForm');
if (filterForm) {
    filterForm.addEventListener('submit', function () {
        const btn = document.getElementById('submitBtn');
        btn.classList.add('loading');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:7px;"></i>Menganalisis...';
    });
}
