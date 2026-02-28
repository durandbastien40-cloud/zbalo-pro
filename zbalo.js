// ═══════════════════════════════════════════════════════════════
// ZBALO Pro — Frontend JS
// Toute la logique UI — appelle les APIs Flask
// ═══════════════════════════════════════════════════════════════

// ── STATE LOCAL ──
let state = {
  cultures: [], entretiens: [], stocks: [], ventes: [],
  depenses: [], rappels: [], fiches: [], serres: [],
  settings: {}, stats: {}
};
let adminMode = false;
let aiHistory = [];

// ── API HELPERS ──
async function api(method, url, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
const GET    = url => api('GET', url);
const POST   = (url, body) => api('POST', url, body);
const PUT    = (url, body) => api('PUT', url, body);
const DELETE = url => api('DELETE', url);

// ── SYNC STATUS ──
function showStatus(msg, duration=3000) {
  const bar = document.getElementById('syncStatus');
  const txt = document.getElementById('syncStatusText');
  if (!bar || !txt) return;
  txt.textContent = msg;
  bar.style.display = 'flex'; bar.style.opacity = '1';
  clearTimeout(window._statusTimer);
  window._statusTimer = setTimeout(() => {
    bar.style.opacity = '0';
    setTimeout(() => bar.style.display = 'none', 500);
  }, duration);
}

// ── TABS ──
const DEFAULT_TABS = [
  { id:'dashboard',  label:'🌿 Tableau de bord' },
  { id:'fiches',     label:'📋 Fiches légumes'  },
  { id:'culture',    label:'🌱 Cultures'         },
  { id:'rappels',    label:'🔔 Rappels', hasBadge:true },
  { id:'entretien',  label:'🔧 Entretiens'       },
  { id:'stock',      label:'📦 Stocks'           },
  { id:'ventes',     label:'💰 Ventes'           },
  { id:'historique', label:'📊 Historique'       },
  { id:'compta',     label:'📒 Comptabilité'     },
  { id:'assistant',  label:'🤖 Assistant'        },
  { id:'admin',      label:'⚙️ Admin', adminOnly:true },
];

let tabOrder = DEFAULT_TABS.map(t => t.id);
let dragSrcIdx = null;

function renderTabs() {
  const container = document.getElementById('tabsContainer');
  const activeId = document.querySelector('.section.active')?.id || 'dashboard';
  const pendingCount = state.rappels.filter(r => {
    const diff = Math.round((new Date(r.date) - new Date()) / 86400000);
    return diff <= 14;
  }).length;

  container.innerHTML = tabOrder.map((id, idx) => {
    const tab = DEFAULT_TABS.find(t => t.id === id);
    if (!tab || (tab.adminOnly && !adminMode)) return '';
    const badge = tab.hasBadge && pendingCount > 0
      ? `<span class="badge-count">${pendingCount}</span>` : '';
    const drag = adminMode ? 'draggable="true"' : '';
    const dragIcon = adminMode ? '<span style="opacity:.35;font-size:.65rem;margin-right:3px">⠿</span>' : '';
    return `<button class="tab-btn ${id===activeId?'active':''}"
      data-tabid="${id}" data-idx="${idx}"
      onclick="showTab('${id}')"
      ${drag}
      ondragstart="onDragStart(event,${idx})"
      ondragover="onDragOver(event)"
      ondrop="onDrop(event,${idx})"
      ondragend="onDragEnd(event)"
    >${dragIcon}${tab.label}${badge}</button>`;
  }).join('');
}

function showTab(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  renderTabs();
  if (id === 'historique') renderHistorique();
  if (id === 'compta') renderCompta();
  if (id === 'admin') renderAdmin();
}

function onDragStart(e, idx) { dragSrcIdx = idx; e.dataTransfer.effectAllowed = 'move'; e.target.style.opacity='.5'; }
function onDragOver(e) {
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('drag-over'));
  e.currentTarget.classList.add('drag-over');
}
function onDrop(e, idx) {
  e.preventDefault();
  if (dragSrcIdx === null || dragSrcIdx === idx) return;
  const [moved] = tabOrder.splice(dragSrcIdx, 1);
  tabOrder.splice(idx, 0, moved);
  localStorage.setItem('zbalo_tab_order', JSON.stringify(tabOrder));
  renderTabs();
}
function onDragEnd(e) {
  e.target.style.opacity='';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('drag-over'));
  dragSrcIdx = null;
}

// ── ADMIN MODE ──
function toggleAdmin() {
  adminMode = !adminMode;
  const btn = document.getElementById('adminBtn');
  btn.textContent = adminMode ? '✅ Admin ON' : '🔧 Admin';
  btn.classList.toggle('active', adminMode);
  document.getElementById('adminBar').classList.toggle('show', adminMode);
  document.getElementById('dragHint').style.display = adminMode ? 'block' : 'none';
  renderTabs();
  renderAll();
}

// ── LOAD ALL DATA ──
async function loadAll() {
  try {
    showStatus('🔄 Chargement...');
    const [cultures, entretiens, stocks, ventes, depenses, rappels, fiches, serres, settings, stats] = await Promise.all([
      GET('/api/cultures'), GET('/api/entretiens'), GET('/api/stocks'),
      GET('/api/ventes'), GET('/api/depenses'), GET('/api/rappels'),
      GET('/api/fiches'), GET('/api/serres'), GET('/api/settings'), GET('/api/stats')
    ]);
    state = { cultures, entretiens, stocks, ventes, depenses, rappels, fiches, serres, settings, stats };
    renderAll();
    showStatus('✅ Données chargées');
  } catch(e) {
    showStatus('⚠️ Erreur de chargement', 5000);
    console.error(e);
  }
}

// ── RENDER ALL ──
function renderAll() {
  document.getElementById('headerDate').textContent =
    new Date().toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'});
  renderDashboard();
  renderRappels();
  renderFiches(state.fiches);
  updateFicheCategories();
  renderCultures(state.cultures);
  updateSerreFilters();
  renderEntretiens(state.entretiens);
  renderStocks(state.stocks);
  renderVentes(state.ventes);
  renderTabs();
}

// ── DASHBOARD ──
function renderDashboard() {
  const s = state.stats;
  document.getElementById('statCultures').textContent   = s.cultures_actives || 0;
  document.getElementById('statRappels').textContent    = s.rappels_pending || 0;
  document.getElementById('statFiches').textContent     = s.fiches_total || 0;
  document.getElementById('statCA').textContent         = (s.ca_mois||0).toFixed(0)+'€';
  document.getElementById('statStockAlert').textContent = s.stock_alertes || 0;

  const soon = state.rappels.filter(r => {
    const diff = Math.round((new Date(r.date) - new Date()) / 86400000);
    return diff <= 7;
  });
  const dashRappels = document.getElementById('dashRappels');
  dashRappels.innerHTML = soon.length
    ? soon.map(renderRappelItem).join('')
    : '<div class="empty-state"><div class="icon">✅</div><p>Aucun rappel urgent</p></div>';
}

// ── RAPPELS ──
function renderRappelItem(r) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(r.date); d.setHours(0,0,0,0);
  const diff = Math.round((d - today) / 86400000);
  const cls = diff < 0 ? 'urgent' : diff <= 3 ? 'urgent' : diff <= 7 ? 'soon' : '';
  const daysTxt = diff < 0 ? `${Math.abs(diff)}j de retard` : diff === 0 ? "Aujourd'hui" : `${diff}j`;
  return `<div class="rappel-item ${cls}">
    <div class="rappel-icon">${r.icon||'📌'}</div>
    <div class="rappel-info"><strong>${r.label}</strong><span>${r.date}</span></div>
    <div class="rappel-days">${diff===0?'📍':diff}<small>${daysTxt}</small></div>
    <button class="btn-done" onclick="markDone(${r.id})">✓ Fait</button>
  </div>`;
}

function renderRappels() {
  const el = document.getElementById('allRappels');
  const sorted = state.rappels.slice().sort((a,b) => new Date(a.date)-new Date(b.date));
  el.innerHTML = sorted.length
    ? sorted.map(renderRappelItem).join('')
    : '<div class="empty-state"><div class="icon">🔔</div><p>Aucun rappel</p></div>';
}

async function markDone(id) {
  await POST(`/api/rappels/${id}/done`);
  state.rappels = state.rappels.filter(r => r.id !== id);
  renderRappels();
  renderDashboard();
  renderTabs();
  showStatus('✅ Rappel marqué fait');
}

// ── FICHES ──
function renderFiches(data) {
  const grid = document.getElementById('fichesGrid');
  if (!data.length) { grid.innerHTML='<div class="empty-state"><div class="icon">📋</div><p>Aucune fiche</p></div>'; return; }
  const catColors = {
    Fruit:'#fef9c3;color:#854d0e', Mini:'#e0f2fe;color:#0369a1',
    Feuille:'#dcfce7;color:#166534', Racine:'#ffedd5;color:#9a3412',
    Herbe:'#f0fdf4;color:#15803d', Brassica:'#ede9fe;color:#6d28d9',
    Allium:'#fce7f3;color:#9d174d', Légumineuse:'#fef3c7;color:#92400e',
    Élevage:'#fef9c3;color:#854d0e'
  };
  grid.innerHTML = data.map(f => {
    const cs = catColors[f.categorie] || '#f3f4f6;color:#374151';
    const [bg,col] = cs.split(';');
    const varietes = Array.isArray(f.varietes) ? f.varietes : [];
    return `<div class="fiche-card">
      <div class="fiche-cat"><span style="background:${bg};${col};padding:3px 10px;border-radius:12px;font-size:.65rem">${f.categorie}</span></div>
      <div class="fiche-name">${f.nom}</div>
      <div class="fiche-varietes">${varietes.slice(0,4).join(' · ')}${varietes.length>4?` +${varietes.length-4}`:''}</div>
      <div class="fiche-temp">
        <div class="temp-chip"><div class="k">Min</div><div class="v">${f.temp_min||'—'}°</div></div>
        <div class="temp-chip" style="background:linear-gradient(135deg,#fef9c3,#fde047)"><div class="k" style="color:#854d0e">Opt.</div><div class="v" style="color:#713f12">${f.temp_opt||'—'}°</div></div>
        <div class="temp-chip" style="background:linear-gradient(135deg,#fee2e2,#fca5a5)"><div class="k" style="color:#991b1b">Max</div><div class="v" style="color:#7f1d1d">${f.temp_max||'—'}°</div></div>
      </div>
      <div class="fiche-data" style="margin-top:10px">
        <div class="fiche-kv"><div class="k">🌱 Levée</div><div class="v">${f.duree_germination||'—'} j</div></div>
        <div class="fiche-kv"><div class="k">📐 Espacement</div><div class="v">${f.espacement||'—'} cm</div></div>
        <div class="fiche-kv"><div class="k">🌱→🌿 Repiquage</div><div class="v">${f.duree_semis_repiquage||'—'} j</div></div>
        <div class="fiche-kv"><div class="k">🌿→🌾 Récolte</div><div class="v">${f.duree_repiquage_recolte||'—'} j</div></div>
        <div class="fiche-kv full"><div class="k">📅 Total semis→récolte</div><div class="v">${f.duree_semis_recolte||'—'} j</div></div>
        ${f.notes?`<div class="fiche-kv full"><div class="k">📝 Notes</div><div class="v">${f.notes}</div></div>`:''}
      </div>
      <div class="fiche-actions">
        <button class="btn-fiche primary" onclick="openModal('culture',{plante:'${f.nom}'})">＋ Semer</button>
        ${adminMode?`<button class="btn-fiche" onclick="editFiche(${f.id})">✏️</button>
        <button class="btn-fiche" onclick="deleteFiche(${f.id})" style="color:var(--rust)">🗑️</button>`:''}
      </div>
    </div>`;
  }).join('');
}

function filterFiches() {
  const q   = document.getElementById('searchFiche')?.value.toLowerCase()||'';
  const cat = document.getElementById('filterCat')?.value||'';
  renderFiches(state.fiches.filter(f =>
    (!q||f.nom.toLowerCase().includes(q)) && (!cat||f.categorie===cat)));
}

function updateFicheCategories() {
  const sel = document.getElementById('filterCat');
  if (!sel) return;
  const cats = [...new Set(state.fiches.map(f=>f.categorie))].sort();
  sel.innerHTML = '<option value="">Toutes catégories</option>'+cats.map(c=>`<option value="${c}">${c}</option>`).join('');
}

// ── CULTURES ──
function renderCultures(data) {
  const tb = document.getElementById('cultureTable');
  if (!data.length) { tb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:40px;color:#aaa">🌱 Aucune culture</td></tr>'; return; }
  const today = new Date();
  tb.innerHTML = data.map(c => {
    const jours = c.date_prevue ? Math.round((new Date(c.date_prevue)-today)/86400000) : null;
    const jStyle = jours!==null?(jours<0?'color:var(--rust)':jours<7?'color:var(--gold)':'color:var(--moss)'):'';
    return `<tr>
      <td><strong>${c.plante}</strong>${c.variete?` · <em style="color:#888;font-size:.75rem">${c.variete}</em>`:''}</td>
      <td><span class="badge badge-${c.type}">${c.type}</span>
        ${c.type==='semis'&&c.mode_semis?`<br><span style="font-size:.65rem;background:${c.mode_semis==='direct'?'#fef3c7':'#d1fae5'};color:${c.mode_semis==='direct'?'#92400e':'#065f46'};padding:1px 6px;border-radius:8px">${c.mode_semis==='direct'?'🟤 Direct':'🟢 Godet'}</span>`:''}
      </td>
      <td>${c.emplacement||'—'}</td>
      <td>${c.date||'—'}</td>
      <td>${c.date_prevue||'—'}</td>
      <td><span class="badge badge-${c.statut==='En cours'?'ok':c.statut==='Terminé'?'out':'low'}">${c.statut}</span></td>
      <td>${c.surface?c.surface+' m²':'—'}</td>
      <td>
        <button class="btn-icon" onclick="editCulture(${c.id})">✏️</button>
        <button class="btn-icon del" onclick="deleteCulture(${c.id})">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function filterCultures() {
  const q=document.getElementById('searchCulture')?.value.toLowerCase()||'';
  const serre=document.getElementById('filterSerre')?.value||'';
  const type=document.getElementById('filterTypeCulture')?.value||'';
  renderCultures(state.cultures.filter(c=>
    (!q||c.plante.toLowerCase().includes(q)||(c.variete||'').toLowerCase().includes(q))&&
    (!serre||c.emplacement===serre)&&(!type||c.type===type)));
}

function updateSerreFilters() {
  const sel = document.getElementById('filterSerre');
  if (!sel) return;
  sel.innerHTML = '<option value="">Toutes les serres</option>'+
    state.serres.map(s=>`<option value="${s}">${s}</option>`).join('');
}

async function deleteCulture(id) {
  if (!confirm('Supprimer cette culture ?')) return;
  await DELETE(`/api/cultures/${id}`);
  state.cultures = state.cultures.filter(c=>c.id!==id);
  renderCultures(state.cultures); showStatus('✅ Culture supprimée');
}

// ── ENTRETIENS ──
function renderEntretiens(data) {
  const tb = document.getElementById('entretienTable');
  if (!data.length) { tb.innerHTML='<tr><td colspan="6" style="text-align:center;padding:40px;color:#aaa">🔧 Aucun entretien</td></tr>'; return; }
  tb.innerHTML = data.map(e=>`<tr>
    <td>${e.date}</td>
    <td><span class="badge badge-entretien">${e.type}</span></td>
    <td>${e.zone||'—'}</td>
    <td>${e.description||'—'}</td>
    <td>${e.duree?e.duree+'h':'—'}</td>
    <td><button class="btn-icon del" onclick="deleteEntretien(${e.id})">🗑️</button></td>
  </tr>`).join('');
}

async function deleteEntretien(id) {
  if (!confirm('Supprimer cet entretien ?')) return;
  await DELETE(`/api/entretiens/${id}`);
  state.entretiens = state.entretiens.filter(e=>e.id!==id);
  renderEntretiens(state.entretiens); showStatus('✅ Entretien supprimé');
}

// ── STOCKS ──
function renderStocks(data) {
  const grid = document.getElementById('stockGrid');
  if (!data.length) { grid.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="icon">📦</div><p>Aucun stock</p></div>'; return; }
  grid.innerHTML = data.map(s => {
    const pct = s.qte_max ? Math.min(100, Math.round((s.qte/s.qte_max)*100)) : 50;
    const level = pct<20?'out':pct<50?'low':'ok';
    return `<div class="stock-card">
      <h4>${s.nom}</h4>
      <div class="stock-qty">${s.qte} <span class="stock-unit">${s.unite}</span></div>
      <div class="stock-bar"><div class="stock-bar-fill ${level}" style="width:${pct}%"></div></div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="badge badge-${level==='out'?'out':level==='low'?'low':'ok'}">${level==='out'?'Rupture':level==='low'?'Stock bas':'OK'}</span>
        <span style="font-size:.7rem;color:#888">max: ${s.qte_max} ${s.unite}</span>
      </div>
      ${s.prix?`<div style="font-size:.75rem;color:var(--earth);margin-top:6px">💰 ${s.prix}€ / ${s.unite}</div>`:''}
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="btn-icon" onclick="editStock(${s.id})" style="flex:1">✏️ Modifier</button>
        <button class="btn-icon del" onclick="deleteStock(${s.id})">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

async function deleteStock(id) {
  if (!confirm('Supprimer ce stock ?')) return;
  await DELETE(`/api/stocks/${id}`);
  state.stocks = state.stocks.filter(s=>s.id!==id);
  renderStocks(state.stocks); showStatus('✅ Stock supprimé');
}

// ── VENTES ──
function renderVentes(data) {
  const tb = document.getElementById('venteTable');
  if (!data.length) { tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:40px;color:#aaa">💰 Aucune vente</td></tr>'; return; }
  tb.innerHTML = data.map(v=>`<tr>
    <td>${v.date}</td>
    <td><span class="badge badge-vente">${v.produit}</span></td>
    <td>${v.qte} ${v.unite||''}</td>
    <td>${v.prix_unit}€</td>
    <td><strong>${(v.qte*v.prix_unit).toFixed(2)}€</strong></td>
    <td>${v.client||'—'}</td>
    <td><button class="btn-icon del" onclick="deleteVente(${v.id})">🗑️</button></td>
  </tr>`).join('');
  const total = data.reduce((s,v)=>s+v.qte*v.prix_unit,0);
  document.getElementById('venteTotalCA').textContent = total.toFixed(2)+' €';
  document.getElementById('venteNb').textContent = data.length;
  document.getElementById('venteMoy').textContent = data.length?(total/data.length).toFixed(2)+' €':'0 €';
}

async function deleteVente(id) {
  if (!confirm('Supprimer cette vente ?')) return;
  await DELETE(`/api/ventes/${id}`);
  state.ventes = state.ventes.filter(v=>v.id!==id);
  renderVentes(state.ventes); showStatus('✅ Vente supprimée');
}

// ── HISTORIQUE ──
function renderHistorique() {
  const anneeEl = document.getElementById('histoAnnee');
  if (!anneeEl) return;
  const annees = [...new Set([
    ...state.ventes.map(v=>new Date(v.date).getFullYear()),
    ...state.cultures.map(c=>new Date(c.date).getFullYear()),
    new Date().getFullYear()
  ])].sort((a,b)=>b-a);
  const cur = parseInt(anneeEl.value)||annees[0];
  anneeEl.innerHTML = annees.map(a=>`<option value="${a}" ${a===cur?'selected':''}>${a}</option>`).join('');
  const filterMois = document.getElementById('histoMois')?.value!==''?parseInt(document.getElementById('histoMois')?.value):null;
  const inP = d => { const dt=new Date(d); return dt.getFullYear()===cur&&(filterMois===null||dt.getMonth()===filterMois); };
  const fV = state.ventes.filter(v=>inP(v.date));
  const fC = state.cultures.filter(c=>inP(c.date));
  const fE = state.entretiens.filter(e=>inP(e.date));
  const ca = fV.reduce((s,v)=>s+v.qte*v.prix_unit,0);
  const h  = fE.reduce((s,e)=>s+(parseFloat(e.duree)||0),0);
  document.getElementById('histoKpis').innerHTML =
    `<div class="stat-card"><div class="stat-num">${fC.length}</div><div class="stat-label">Cultures</div></div>`+
    `<div class="stat-card gold"><div class="stat-num">${ca.toFixed(0)}€</div><div class="stat-label">CA période</div></div>`+
    `<div class="stat-card sky"><div class="stat-num">${fV.length}</div><div class="stat-label">Ventes</div></div>`+
    `<div class="stat-card rust"><div class="stat-num">${h.toFixed(1)}h</div><div class="stat-label">Heures travail</div></div>`;
  const mois = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const caParMois = Array(12).fill(0);
  state.ventes.filter(v=>new Date(v.date).getFullYear()===cur).forEach(v=>{ caParMois[new Date(v.date).getMonth()]+=v.qte*v.prix_unit; });
  drawBar('chartCA', mois, caParMois, '#7a9e6a');
  const statuts={};fC.forEach(c=>{statuts[c.statut]=(statuts[c.statut]||0)+1;});
  drawPie('chartCultures',Object.keys(statuts),Object.values(statuts),['#7a9e6a','#c9a84c','#a04520','#888']);
  const types={};fE.forEach(e=>{types[e.type]=(types[e.type]||0)+1;});
  const tk=Object.keys(types).slice(0,8);
  drawBar('chartEntretiens',tk,tk.map(k=>types[k]),'#7ab5c8');
  const prods={};fV.forEach(v=>{prods[v.produit]=(prods[v.produit]||0)+v.qte*v.prix_unit;});
  const pk=Object.keys(prods).sort((a,b)=>prods[b]-prods[a]).slice(0,6);
  drawBar('chartProduits',pk,pk.map(k=>parseFloat(prods[k].toFixed(0))),'#c9a84c');
  document.getElementById('histoCulturesTable').innerHTML = fC.length
    ? fC.map(c=>`<tr><td><strong>${c.plante}</strong></td><td>${c.variete||'—'}</td><td>${c.emplacement||'—'}</td><td>${c.date}</td><td>${c.date_prevue||'—'}</td><td>${c.surface?c.surface+' m²':'—'}</td><td><span class="badge badge-${c.statut==='En cours'?'ok':c.statut==='Terminé'?'out':'low'}">${c.statut}</span></td></tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;padding:20px;color:#aaa">Aucune culture</td></tr>';
  document.getElementById('histoEntretiensTable').innerHTML = fE.length
    ? fE.map(e=>`<tr><td>${e.date}</td><td><span class="badge badge-entretien">${e.type}</span></td><td>${e.zone||'—'}</td><td>${e.duree?e.duree+'h':'—'}</td><td>${e.description||'—'}</td></tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:20px;color:#aaa">Aucun entretien</td></tr>';
}

function drawBar(id, labels, values, color) {
  const canvas = document.getElementById(id); if (!canvas) return;
  const W=canvas.parentElement?.offsetWidth-40||300, H=160;
  canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,W,H);
  if (!labels.length||values.every(v=>!v)){ctx.fillStyle='#ccc';ctx.font='11px DM Mono,monospace';ctx.textAlign='center';ctx.fillText('Pas de données',W/2,H/2);return;}
  const max=Math.max(...values.map(v=>parseFloat(v)||0))||1;
  const barW=Math.floor((W-20)/labels.length)-4;
  labels.forEach((l,i)=>{
    const val=parseFloat(values[i])||0, barH=Math.floor((val/max)*(H-30)), x=10+i*(barW+4), y=H-20-barH;
    ctx.fillStyle=color; ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(x,y,barW,barH,3); else ctx.rect(x,y,barW,barH);
    ctx.fill();
    ctx.fillStyle='#999';ctx.font='8px DM Mono,monospace';ctx.textAlign='center';
    ctx.fillText(l.length>6?l.substring(0,5)+'.':l,x+barW/2,H-5);
    if(val>0){ctx.fillStyle='#555';ctx.fillText(val>999?Math.round(val/1000)+'k':Math.round(val),x+barW/2,y-4);}
  });
}
function drawPie(id, labels, values, colors) {
  const canvas=document.getElementById(id); if (!canvas) return;
  const W=canvas.parentElement?.offsetWidth-40||300, H=160;
  canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,W,H);
  const total=values.reduce((s,v)=>s+v,0); if(!total){ctx.fillStyle='#ccc';ctx.font='11px DM Mono,monospace';ctx.textAlign='center';ctx.fillText('Pas de données',W/2,H/2);return;}
  const r=H/2-10,cx=H/2,cy=H/2; let start=-Math.PI/2;
  values.forEach((v,i)=>{const a=(v/total)*2*Math.PI;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,start+a);ctx.closePath();ctx.fillStyle=colors[i%colors.length];ctx.fill();start+=a;});
  labels.forEach((l,i)=>{ctx.fillStyle=colors[i%colors.length];ctx.fillRect(H+10,20+i*22,12,12);ctx.fillStyle='#555';ctx.font='11px DM Mono,monospace';ctx.textAlign='left';ctx.fillText(`${l} (${values[i]})`,H+26,31+i*22);});
}

// ── COMPTABILITÉ ──
function renderCompta() {
  const anneeEl = document.getElementById('comptaFiltreAnnee');
  if (!anneeEl) return;
  const annees=[...new Set([...state.depenses.map(d=>new Date(d.date).getFullYear()),new Date().getFullYear()])].sort((a,b)=>b-a);
  const cur=parseInt(anneeEl.value)||annees[0];
  anneeEl.innerHTML=annees.map(a=>`<option value="${a}" ${a===cur?'selected':''}>${a}</option>`).join('');
  const fm=document.getElementById('comptaFiltreMois')?.value!==''?parseInt(document.getElementById('comptaFiltreMois')?.value):null;
  const fc=document.getElementById('comptaFiltreCat')?.value||'';
  const filtered=state.depenses.filter(d=>{
    const dt=new Date(d.date);
    return dt.getFullYear()===cur&&(fm===null||dt.getMonth()===fm)&&(!fc||d.categorie===fc);
  });
  const totalDep=filtered.reduce((s,d)=>s+(parseFloat(d.total)||0),0);
  const totalVentes=state.ventes.filter(v=>new Date(v.date).getFullYear()===cur).reduce((s,v)=>s+v.qte*v.prix_unit,0);
  const solde=totalVentes-totalDep;
  const parCat={};filtered.forEach(d=>{parCat[d.categorie]=(parCat[d.categorie]||0)+(parseFloat(d.total)||0);});
  const topCat=Object.entries(parCat).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('comptaKpis').innerHTML=
    `<div class="stat-card rust"><div class="stat-num">${totalDep.toFixed(0)}€</div><div class="stat-label">Dépenses</div></div>`+
    `<div class="stat-card gold"><div class="stat-num">${totalVentes.toFixed(0)}€</div><div class="stat-label">Recettes</div></div>`+
    `<div class="stat-card"><div class="stat-num" style="color:${solde>=0?'var(--moss)':'var(--rust)'}">${solde>=0?'+':''}${solde.toFixed(0)}€</div><div class="stat-label">Solde</div></div>`+
    `<div class="stat-card"><div class="stat-num" style="font-size:.9rem">${topCat?topCat[0]:'—'}</div><div class="stat-label">Top dépense</div></div>`;
  const tb=document.getElementById('comptaTable');
  const CAT_COLORS={'Graines & semences':'background:#dcfce7;color:#166534','Terreau & substrat':'background:#ffedd5;color:#9a3412','Matériel & outillage':'background:#e0f2fe;color:#0369a1','Engrais & traitement':'background:#f0fdf4;color:#15803d','Élevage & animaux':'background:#fef9c3;color:#854d0e','Énergie & eau':'background:#ede9fe;color:#6d28d9','Autre':'background:#f3f4f6;color:#374151'};
  tb.innerHTML=filtered.length
    ? filtered.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).map(d=>`<tr>
        <td>${d.date}</td>
        <td><strong>${d.fournisseur||'—'}</strong>${d.notes?`<br><small style="color:#888">${d.notes}</small>`:''}${d.scan_ai?'<br><span style="font-size:.65rem;color:var(--moss)">🤖 scan</span>':''}</td>
        <td><span style="${CAT_COLORS[d.categorie]||CAT_COLORS['Autre']};padding:2px 8px;border-radius:10px;font-size:.68rem">${d.categorie||'—'}</span></td>
        <td style="font-size:.78rem;color:#666">${d.articles?.length?d.articles.length+' article(s)':'—'}</td>
        <td><strong style="color:var(--rust)">${parseFloat(d.total||0).toFixed(2)}€</strong></td>
        <td><button class="btn-icon" onclick="editDepense(${d.id})">✏️</button><button class="btn-icon del" onclick="deleteDepense(${d.id})">🗑️</button></td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;padding:40px;color:#aaa">💸 Aucune dépense</td></tr>';
}

async function deleteDepense(id) {
  if (!confirm('Supprimer cette dépense ?')) return;
  await DELETE(`/api/depenses/${id}`);
  state.depenses=state.depenses.filter(d=>d.id!==id);
  renderCompta(); showStatus('✅ Dépense supprimée');
}

// ── SCAN TICKET ──
function openScanTicket() {
  document.getElementById('scanZone').style.display='block';
  document.getElementById('ticketPreview').style.display='none';
}
function closeScanTicket() { document.getElementById('scanZone').style.display='none'; }

async function analyseTicket(event) {
  const file=event.target.files[0]; if (!file) return;
  const reader=new FileReader();
  reader.onload=async function(e) {
    const base64full=e.target.result;
    document.getElementById('ticketImg').src=base64full;
    document.getElementById('ticketPreview').style.display='block';
    const analyseEl=document.getElementById('ticketAnalyse');
    analyseEl.innerHTML='<div style="color:var(--moss);font-size:.82rem">⏳ Analyse en cours...</div>';
    try {
      const result=await POST('/api/scan-ticket',{
        image: base64full.split(',')[1],
        mediaType: file.type||'image/jpeg'
      });
      if (!result.ok) throw new Error(result.error);
      const d=result.data;
      analyseEl.innerHTML=
        '<div style="font-family:Playfair Display,serif;color:var(--moss);margin-bottom:12px">✅ Ticket analysé !</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'+
          `<div style="background:var(--parchment);border-radius:6px;padding:8px"><div style="font-size:.65rem;color:#888">DATE</div><div style="font-size:.85rem;font-weight:500">${d.date||'—'}</div></div>`+
          `<div style="background:var(--parchment);border-radius:6px;padding:8px"><div style="font-size:.65rem;color:#888">FOURNISSEUR</div><div style="font-size:.85rem;font-weight:500">${d.fournisseur||'—'}</div></div>`+
          `<div style="background:var(--parchment);border-radius:6px;padding:8px"><div style="font-size:.65rem;color:#888">CATÉGORIE</div><div style="font-size:.85rem;font-weight:500">${d.categorie||'—'}</div></div>`+
          `<div style="background:#ffebee;border-radius:6px;padding:8px"><div style="font-size:.65rem;color:#888">TOTAL</div><div style="font-size:1.1rem;font-weight:500;color:var(--rust)">${d.total?d.total.toFixed(2)+'€':'—'}</div></div>`+
        '</div>'+
        (d.articles?.length?'<div style="background:var(--parchment);border-radius:6px;padding:8px;margin-bottom:12px">'+d.articles.map(a=>`<div style="font-size:.78rem;padding:2px 0">${a}</div>`).join('')+'</div>':'')+
        '<div style="display:flex;gap:8px">'+
          `<button class="btn-save" style="flex:1" onclick='saveTicket(${JSON.stringify(d).replace(/'/g,"&#39;")})'>💾 Enregistrer</button>`+
          '<button class="btn-cancel" onclick="closeScanTicket()">Annuler</button></div>';
    } catch(err) {
      analyseEl.innerHTML=`<div style="color:var(--rust);font-size:.82rem">⚠️ ${err.message}</div>`;
    }
  };
  reader.readAsDataURL(file);
}

async function saveTicket(d) {
  const dep=await POST('/api/depenses',{...d, scanAI:true});
  state.depenses.unshift(dep);
  closeScanTicket(); renderCompta(); showStatus('✅ Dépense enregistrée');
}

// ── ADMIN ──
function renderAdmin() {
  if (!adminMode) return;
  document.getElementById('adminSerresList').innerHTML=state.serres.map(s=>
    `<div class="admin-list-item"><span>${s}</span>
    <div class="actions"><button class="btn-icon del" onclick="deleteSerre('${s}')">🗑️</button></div></div>`).join('');
  document.getElementById('adminLegumesList').innerHTML=state.fiches.map(f=>
    `<div class="admin-list-item"><span>${f.nom} <span style="color:#888;font-size:.7rem">(${f.categorie})</span></span>
    <div class="actions"><button class="btn-icon" onclick="editFiche(${f.id})">✏️</button>
    <button class="btn-icon del" onclick="deleteFiche(${f.id})">🗑️</button></div></div>`).join('');
  const settings = state.settings;
  renderOptionList('adminEntretienList','types_entretien',settings.types_entretien||[]);
  renderOptionList('adminStatutList','statuts_culture',settings.statuts_culture||[]);
  renderOptionList('adminCatList','categories_legume',settings.categories_legume||[]);
  renderOptionList('adminUniteList','unites_vente',settings.unites_vente||[]);
}

function renderOptionList(containerId, key, opts) {
  const el=document.getElementById(containerId); if (!el) return;
  el.innerHTML=opts.map((o,i)=>
    `<div class="admin-list-item"><span>${o}</span>
    <div class="actions">
      <button class="btn-icon" onclick="editOption('${key}',${i})">✏️</button>
      <button class="btn-icon del" onclick="deleteOption('${key}',${i})">🗑️</button>
    </div></div>`).join('');
}

async function addOption(key, inputId) {
  const input=document.getElementById(inputId); if (!input) return;
  const val=input.value.trim(); if (!val) return;
  const opts=[...(state.settings[key]||[])];
  if (!opts.includes(val)) { opts.push(val); await PUT(`/api/settings/${key}`,{value:opts}); state.settings[key]=opts; renderAdmin(); }
  input.value='';
}
async function deleteOption(key, idx) {
  const opts=[...(state.settings[key]||[])]; opts.splice(idx,1);
  await PUT(`/api/settings/${key}`,{value:opts}); state.settings[key]=opts; renderAdmin();
}
async function editOption(key, idx) {
  const val=prompt('Modifier :',state.settings[key][idx]); if (!val?.trim()) return;
  const opts=[...(state.settings[key]||[])]; opts[idx]=val.trim();
  await PUT(`/api/settings/${key}`,{value:opts}); state.settings[key]=opts; renderAdmin();
}

async function addSerre() {
  const input=document.getElementById('newSerreName'); if (!input) return;
  const nom=input.value.trim(); if (!nom) return;
  await POST('/api/serres',{nom}); state.serres.push(nom);
  input.value=''; renderAdmin(); updateSerreFilters(); showStatus('✅ Serre ajoutée');
}
async function deleteSerre(nom) {
  if (!confirm(`Supprimer "${nom}" ?`)) return;
  await DELETE(`/api/serres/${encodeURIComponent(nom)}`);
  state.serres=state.serres.filter(s=>s!==nom); renderAdmin(); updateSerreFilters(); showStatus('✅ Serre supprimée');
}
async function deleteFiche(id) {
  if (!confirm('Supprimer cette fiche ?')) return;
  await DELETE(`/api/fiches/${id}`);
  state.fiches=state.fiches.filter(f=>f.id!==id); renderFiches(state.fiches); renderAdmin(); showStatus('✅ Fiche supprimée');
}

// ── MODALS ──
function openModal(type, prefill={}) {
  const overlay=document.getElementById('modalOverlay');
  const content=document.getElementById('modalContent');
  const today=new Date().toISOString().split('T')[0];
  const serreOpts=state.serres.map(s=>`<option value="${s}" ${s===(prefill.emplacement||'')?'selected':''}>${s}</option>`).join('');
  const typesEntretien=state.settings.types_entretien||['Arrosage','Taille','Fertilisation','Désherbage','Traitement bio','Autre'];
  const statutsCulture=state.settings.statuts_culture||['En cours','En attente','Terminé'];
  let html='';

  if (type==='culture') {
    const fiche=state.fiches.find(f=>f.nom===prefill.plante);
    const varOpts=fiche?fiche.varietes.map(v=>`<option value="${v}" ${v===prefill.variete?'selected':''}>${v}</option>`).join(''):'';
    html=`<h2>${prefill.id?'Modifier':'Nouvelle'} culture 🌿</h2>
    <div class="form-grid">
      <div class="form-group"><label>Légume *</label>
        <select id="f_plante" onchange="updateModalVarietes()">
          <option value="">-- Choisir --</option>
          ${state.fiches.map(f=>`<option value="${f.nom}" ${f.nom===prefill.plante?'selected':''}>${f.nom}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Variété</label>
        <select id="f_variete">${varOpts||'<option value="">Choisir le légume d\'abord</option>'}</select></div>
      <div class="form-group"><label>Type *</label>
        <select id="f_type" onchange="toggleModeSemis()">
          <option value="semis" ${prefill.type==='semis'?'selected':''}>🌱 Semis</option>
          <option value="plantation" ${prefill.type==='plantation'?'selected':''}>🌿 Plantation</option>
          <option value="recolte" ${prefill.type==='recolte'?'selected':''}>🌾 Récolte</option>
        </select></div>
      <div class="form-group" id="f_mode_semis_group" style="display:${(!prefill.type||prefill.type==='semis')?'flex':'none'}">
        <label>Mode de semis</label>
        <select id="f_modeSemis">
          <option value="direct" ${prefill.mode_semis==='direct'?'selected':''}>🟤 Direct</option>
          <option value="godet" ${prefill.mode_semis==='godet'||!prefill.mode_semis?'selected':''}>🟢 Godet</option>
        </select></div>
      <div class="form-group"><label>Statut</label>
        <select id="f_statut">${statutsCulture.map(s=>`<option ${s===(prefill.statut||'En cours')?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="form-group"><label>Date *</label><input type="date" id="f_date" value="${prefill.date||today}"></div>
      <div class="form-group"><label>Récolte prévue</label><input type="date" id="f_datePrevue" value="${prefill.date_prevue||''}"></div>
      <div class="form-group"><label>Serre *</label>
        <select id="f_emplacement"><option value="">-- Choisir --</option>${serreOpts}</select></div>
      <div class="form-group"><label>Surface (m²)</label>
        <input type="number" id="f_surface" value="${prefill.surface||''}" step="0.5"></div>
      <div class="form-group full"><label>Notes</label><textarea id="f_notes">${prefill.notes||''}</textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn-save" onclick="saveCulture(${prefill.id||'null'})">Enregistrer</button>
    </div>`;
  }

  else if (type==='entretien') {
    html=`<h2>Nouvel entretien</h2>
    <div class="form-grid">
      <div class="form-group"><label>Date *</label><input type="date" id="e_date" value="${today}"></div>
      <div class="form-group"><label>Type *</label>
        <select id="e_type">${typesEntretien.map(t=>`<option>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label>Serre / Zone</label>
        <select id="e_zone"><option value="">-- Choisir --</option>${serreOpts}</select></div>
      <div class="form-group"><label>Durée (h)</label><input type="number" id="e_duree" step="0.5" min="0" placeholder="1.5"></div>
      <div class="form-group full"><label>Description</label><textarea id="e_desc" placeholder="Détails..."></textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn-save" onclick="saveEntretien()">Enregistrer</button>
    </div>`;
  }

  else if (type==='stock') {
    const d=prefill;
    html=`<h2>${d.id?'Modifier':'Nouvel'} stock</h2>
    <div class="form-grid">
      <div class="form-group full"><label>Nom *</label><input id="s_nom" value="${d.nom||''}"></div>
      <div class="form-group"><label>Quantité</label><input type="number" id="s_qte" value="${d.qte||''}"></div>
      <div class="form-group"><label>Stock max</label><input type="number" id="s_qteMax" value="${d.qte_max||''}"></div>
      <div class="form-group"><label>Unité</label><input id="s_unite" value="${d.unite||'kg'}"></div>
      <div class="form-group"><label>Prix (€/unité)</label><input type="number" id="s_prix" value="${d.prix||''}" step="0.01"></div>
      <div class="form-group full"><label>Fournisseur</label><input id="s_fourn" value="${d.fournisseur||''}"></div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn-save" onclick="saveStock(${d.id||'null'})">Enregistrer</button>
    </div>`;
  }

  else if (type==='vente') {
    const stockOpts=state.stocks.map(s=>`<option value="${s.nom}" data-prix="${s.prix||0}" data-unite="${s.unite||''}">${s.nom}</option>`).join('');
    html=`<h2>Nouvelle vente</h2>
    <div class="form-grid">
      <div class="form-group"><label>Date *</label><input type="date" id="v_date" value="${today}"></div>
      <div class="form-group"><label>Produit *</label>
        <select id="v_produit" onchange="autoPrice()">${stockOpts||'<option>Aucun stock</option>'}</select></div>
      <div class="form-group"><label>Quantité *</label><input type="number" id="v_qte" value="1" step="0.1"></div>
      <div class="form-group"><label>Unité</label><input id="v_unite"></div>
      <div class="form-group"><label>Prix unitaire (€) *</label><input type="number" id="v_prixUnit" step="0.01"></div>
      <div class="form-group"><label>Client</label><input id="v_client" placeholder="Marché, AMAP..."></div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn-save" onclick="saveVente()">Enregistrer</button>
    </div>`;
  }

  else if (type==='rappel') {
    html=`<h2>📌 Rappel manuel</h2>
    <div class="form-grid">
      <div class="form-group"><label>Date *</label><input type="date" id="r_date" value="${today}"></div>
      <div class="form-group full"><label>Description *</label><input id="r_label" placeholder="ex: Bâcher avant tempête..."></div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn-save" onclick="saveRappel()">Enregistrer</button>
    </div>`;
  }

  else if (type==='depense') {
    const d=prefill; const CAT_DEP=['Graines & semences','Terreau & substrat','Matériel & outillage','Engrais & traitement','Élevage & animaux','Énergie & eau','Autre'];
    html=`<h2>💸 ${d.id?'Modifier':'Nouvelle'} dépense</h2>
    <div class="form-grid">
      <div class="form-group"><label>Date *</label><input type="date" id="dep_date" value="${d.date||today}"></div>
      <div class="form-group"><label>Fournisseur *</label><input id="dep_fourn" value="${d.fournisseur||''}"></div>
      <div class="form-group"><label>Catégorie</label><select id="dep_cat">${CAT_DEP.map(c=>`<option ${c===d.categorie?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label>Total (€) *</label><input type="number" id="dep_total" value="${d.total||''}" step="0.01"></div>
      <div class="form-group full"><label>Articles (un par ligne)</label>
        <textarea id="dep_articles" rows="4">${(d.articles||[]).join('\n')}</textarea></div>
      <div class="form-group full"><label>Notes</label><input id="dep_notes" value="${d.notes||''}"></div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn-save" onclick="saveDepense(${d.id||'null'})">Enregistrer</button>
    </div>`;
  }

  else if (type==='fiche') {
    const d=prefill; const CATS=['Fruit','Mini','Feuille','Racine','Herbe','Brassica','Allium','Légumineuse','Élevage'];
    html=`<h2>${d.id?'Modifier':'Nouvelle'} fiche légume</h2>
    <div class="form-grid">
      <div class="form-group"><label>Nom *</label><input id="fi_nom" value="${d.nom||''}"></div>
      <div class="form-group"><label>Catégorie</label><select id="fi_cat">${CATS.map(c=>`<option ${c===d.categorie?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="form-group full"><label>Variétés (séparées par virgules)</label>
        <input id="fi_varietes" value="${(d.varietes||[]).join(', ')}"></div>
      <div class="form-group"><label>Temp. Min (°C)</label><input type="number" id="fi_tmin" value="${d.temp_min||''}"></div>
      <div class="form-group"><label>Temp. Opt. (°C)</label><input type="number" id="fi_topt" value="${d.temp_opt||''}"></div>
      <div class="form-group"><label>Temp. Max (°C)</label><input type="number" id="fi_tmax" value="${d.temp_max||''}"></div>
      <div class="form-group"><label>Levée (jours)</label><input type="number" id="fi_germ" value="${d.duree_germination||''}"></div>
      <div class="form-group"><label>Semis→Repiquage (j)</label><input type="number" id="fi_srep" value="${d.duree_semis_repiquage||''}"></div>
      <div class="form-group"><label>Repiquage→Récolte (j)</label><input type="number" id="fi_rr" value="${d.duree_repiquage_recolte||''}"></div>
      <div class="form-group"><label>Semis→Récolte total (j)</label><input type="number" id="fi_sr" value="${d.duree_semis_recolte||''}"></div>
      <div class="form-group"><label>Espacement (cm)</label><input type="number" id="fi_esp" value="${d.espacement||''}"></div>
      <div class="form-group"><label>Profondeur (cm)</label><input type="number" id="fi_prof" value="${d.profondeur||''}" step="0.5"></div>
      <div class="form-group"><label>Unité de vente</label><input id="fi_unite" value="${d.unite||'kg'}"></div>
      <div class="form-group full"><label>Notes</label><textarea id="fi_notes">${d.notes||''}</textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn-save" onclick="saveFiche(${d.id||'null'})">Enregistrer</button>
    </div>`;
  }

  content.innerHTML=html;
  overlay.classList.add('open');
  if (type==='vente') autoPrice();
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }
function closeModalOutside(e) { if (e.target===document.getElementById('modalOverlay')) closeModal(); }

// ── MODAL HELPERS ──
function updateModalVarietes() {
  const plante=document.getElementById('f_plante')?.value;
  const fiche=state.fiches.find(f=>f.nom===plante);
  const sel=document.getElementById('f_variete'); if (!sel) return;
  sel.innerHTML=fiche?fiche.varietes.map(v=>`<option value="${v}">${v}</option>`).join(''):'<option value="">Aucune variété</option>';
}
function toggleModeSemis() {
  const type=document.getElementById('f_type')?.value;
  const g=document.getElementById('f_mode_semis_group');
  if (g) g.style.display=type==='semis'?'flex':'none';
}
function autoPrice() {
  const sel=document.getElementById('v_produit'); if (!sel) return;
  const opt=sel.options[sel.selectedIndex];
  const p=document.getElementById('v_prixUnit'); if(p) p.value=opt?.dataset?.prix||'';
  const u=document.getElementById('v_unite'); if(u) u.value=opt?.dataset?.unite||'';
}

// ── SAVE FUNCTIONS ──
async function saveCulture(id) {
  const plante=document.getElementById('f_plante')?.value; if (!plante) return alert('Légume obligatoire');
  const body={plante,variete:document.getElementById('f_variete')?.value,
    type:document.getElementById('f_type')?.value, modeSemis:document.getElementById('f_modeSemis')?.value,
    statut:document.getElementById('f_statut')?.value, date:document.getElementById('f_date')?.value,
    datePrevue:document.getElementById('f_datePrevue')?.value, emplacement:document.getElementById('f_emplacement')?.value,
    surface:document.getElementById('f_surface')?.value, notes:document.getElementById('f_notes')?.value};
  if (id&&id!=='null') { const c=await PUT(`/api/cultures/${id}`,body); state.cultures=state.cultures.map(x=>x.id==id?c:x); }
  else { const c=await POST('/api/cultures',body); state.cultures.unshift(c); }
  closeModal(); renderCultures(state.cultures); showStatus('✅ Culture enregistrée');
}

async function saveEntretien() {
  const date=document.getElementById('e_date')?.value; if (!date) return alert('Date obligatoire');
  const body={date,type:document.getElementById('e_type')?.value,zone:document.getElementById('e_zone')?.value,
    duree:document.getElementById('e_duree')?.value,description:document.getElementById('e_desc')?.value};
  const e=await POST('/api/entretiens',body); state.entretiens.unshift(e);
  closeModal(); renderEntretiens(state.entretiens); showStatus('✅ Entretien enregistré');
}

async function saveStock(id) {
  const nom=document.getElementById('s_nom')?.value.trim(); if (!nom) return alert('Nom obligatoire');
  const body={nom,qte:parseFloat(document.getElementById('s_qte')?.value)||0,
    qteMax:parseFloat(document.getElementById('s_qteMax')?.value)||100,
    unite:document.getElementById('s_unite')?.value||'kg',
    prix:parseFloat(document.getElementById('s_prix')?.value)||0,
    fournisseur:document.getElementById('s_fourn')?.value||''};
  if (id&&id!=='null') { const s=await PUT(`/api/stocks/${id}`,body); state.stocks=state.stocks.map(x=>x.id==id?s:x); }
  else { const s=await POST('/api/stocks',body); state.stocks.push(s); }
  closeModal(); renderStocks(state.stocks); showStatus('✅ Stock enregistré');
}

async function saveVente() {
  const produit=document.getElementById('v_produit')?.value;
  const qte=parseFloat(document.getElementById('v_qte')?.value);
  const prixUnit=parseFloat(document.getElementById('v_prixUnit')?.value);
  if (!produit||!qte||!prixUnit) return alert('Produit, quantité et prix obligatoires');
  const body={date:document.getElementById('v_date')?.value,produit,qte,prixUnit,
    unite:document.getElementById('v_unite')?.value,client:document.getElementById('v_client')?.value};
  const v=await POST('/api/ventes',body); state.ventes.unshift(v);
  closeModal(); renderVentes(state.ventes); showStatus('✅ Vente enregistrée');
}

async function saveRappel() {
  const date=document.getElementById('r_date')?.value;
  const label=document.getElementById('r_label')?.value.trim();
  if (!date||!label) return alert('Date et description obligatoires');
  const r=await POST('/api/rappels',{date,label});
  state.rappels.push(r); closeModal(); renderRappels(); renderTabs(); showStatus('✅ Rappel créé');
}

async function saveDepense(id) {
  const fourn=document.getElementById('dep_fourn')?.value.trim();
  const total=document.getElementById('dep_total')?.value;
  if (!fourn||!total) return alert('Fournisseur et montant obligatoires');
  const articlesRaw=document.getElementById('dep_articles')?.value||'';
  const body={date:document.getElementById('dep_date')?.value,fournisseur:fourn,
    categorie:document.getElementById('dep_cat')?.value,total:parseFloat(total),
    articles:articlesRaw.split('\n').map(a=>a.trim()).filter(Boolean),
    notes:document.getElementById('dep_notes')?.value||''};
  if (id&&id!=='null') { const d=await PUT(`/api/depenses/${id}`,body); state.depenses=state.depenses.map(x=>x.id==id?d:x); }
  else { const d=await POST('/api/depenses',body); state.depenses.unshift(d); }
  closeModal(); renderCompta(); showStatus('✅ Dépense enregistrée');
}

async function saveFiche(id) {
  const nom=document.getElementById('fi_nom')?.value.trim(); if (!nom) return alert('Nom obligatoire');
  const body={nom,categorie:document.getElementById('fi_cat')?.value,
    varietes:document.getElementById('fi_varietes')?.value.split(',').map(v=>v.trim()).filter(Boolean),
    tempMin:parseFloat(document.getElementById('fi_tmin')?.value)||null,
    tempOpt:parseFloat(document.getElementById('fi_topt')?.value)||null,
    tempMax:parseFloat(document.getElementById('fi_tmax')?.value)||null,
    dureeGermination:parseInt(document.getElementById('fi_germ')?.value)||null,
    dureeSemisRepiquage:parseInt(document.getElementById('fi_srep')?.value)||null,
    dureeRepiquageRecolte:parseInt(document.getElementById('fi_rr')?.value)||null,
    dureeSemisRecolte:parseInt(document.getElementById('fi_sr')?.value)||null,
    espacement:parseFloat(document.getElementById('fi_esp')?.value)||null,
    profondeur:parseFloat(document.getElementById('fi_prof')?.value)||null,
    unite:document.getElementById('fi_unite')?.value,notes:document.getElementById('fi_notes')?.value};
  if (id&&id!=='null') { const f=await PUT(`/api/fiches/${id}`,body); state.fiches=state.fiches.map(x=>x.id==id?f:x); }
  else { const f=await POST('/api/fiches',body); state.fiches.push(f); }
  closeModal(); renderFiches(state.fiches); renderAdmin(); showStatus('✅ Fiche enregistrée');
}

function editCulture(id) { openModal('culture', state.cultures.find(c=>c.id===id)||{}); }
function editStock(id)   { openModal('stock',   state.stocks.find(s=>s.id===id)||{}); }
function editFiche(id)   { openModal('fiche',   state.fiches.find(f=>f.id===id)||{}); }
function editDepense(id) { openModal('depense', state.depenses.find(d=>d.id===id)||{}); }

// ── ASSISTANT IA ──
async function sendAI() {
  const input=document.getElementById('aiInput');
  const msg=input.value.trim(); if (!msg) return;
  input.value=''; await askAI(msg);
}

async function askAI(msg) {
  const messages=document.getElementById('aiMessages');
  aiHistory.push({role:'user',content:msg});
  messages.innerHTML+=`<div class="ai-msg ai-msg-user"><div class="ai-avatar">👤</div><div class="ai-bubble">${msg}</div></div>`;
  const typingId='typing-'+Date.now();
  messages.innerHTML+=`<div class="ai-msg" id="${typingId}"><div class="ai-avatar">🌿</div><div class="ai-bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div></div>`;
  messages.scrollTop=messages.scrollHeight;
  try {
    const res=await POST('/api/chat',{messages:aiHistory});
    document.getElementById(typingId)?.remove();
    let reply=res.reply||'';
    // Masquer les JSON d'action dans l'affichage
    reply=reply.replace(/###\{[^#]+\}###/g,'');
    reply=reply.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>').replace(/\n/g,'<br>');
    aiHistory.push({role:'assistant',content:res.reply});
    messages.innerHTML+=`<div class="ai-msg"><div class="ai-avatar">🌿</div><div class="ai-bubble">${reply}</div></div>`;
    // Si des actions ont été exécutées, recharger les données
    if (res.actions?.length) { await loadAll(); showStatus('✅ '+res.actions.map(a=>a.message).join(' · ')); }
    messages.scrollTop=messages.scrollHeight;
  } catch(e) {
    document.getElementById(typingId)?.remove();
    messages.innerHTML+=`<div class="ai-msg"><div class="ai-avatar">🌿</div><div class="ai-bubble" style="color:var(--rust)">⚠️ Erreur de connexion</div></div>`;
  }
}

// ── INIT ──
const savedOrder = localStorage.getItem('zbalo_tab_order');
if (savedOrder) { try { tabOrder = JSON.parse(savedOrder); } catch(e) {} }
document.getElementById('headerDate').textContent =
  new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
renderTabs();
loadAll();
