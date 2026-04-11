import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "./Invite.css";
import logo from "../../assets/image.png";

const API_BASE = "http://localhost:8000/api";
const getToken = () => localStorage.getItem("token");
const getUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); }
  catch { return {}; }
};

const TYPE_META = {
  ARTICLE: { icon: "📰", color: "#534AB7", label: "Article" },
  ENQUETE: { icon: "📋", color: "#7F77DD", label: "Enquête" },
  IMAGE:   { icon: "🖼️", color: "#1D9E75", label: "Image" },
  RAPPORT: { icon: "📊", color: "#BA7517", label: "Rapport" },
  VIDEO:   { icon: "🎬", color: "#D4537E", label: "Vidéo" },
  CARTE:   { icon: "🗺️",  color: "#0F6E56", label: "Carte" },
};

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

function applySmartFilter(docs, search, typeFilter) {
  let pool = typeFilter === "ALL" ? docs : docs.filter(d => d.type === typeFilter);
  if (search.trim()) {
    const lq = search.toLowerCase();
    return pool.filter(d =>
      d.titre?.toLowerCase().includes(lq) ||
      d.description?.toLowerCase().includes(lq) ||
      d.mots_cles?.toLowerCase().includes(lq) ||
      d.auteur_nom?.toLowerCase().includes(lq) ||
      d.projet_titre?.toLowerCase().includes(lq) ||
      d.doi?.toLowerCase().includes(lq)
    );
  }
  const seen = new Map();
  for (const doc of pool) {
    const key = doc.auteur_id ?? doc.auteur_nom ?? "__inconnu__";
    if (!seen.has(key)) {
      seen.set(key, doc);
    } else {
      const prev = seen.get(key);
      if (new Date(doc.date_creation) > new Date(prev.date_creation)) {
        seen.set(key, doc);
      }
    }
  }
  return [...seen.values()];
}

/* ── Donut Chart (Chart.js) — height réduit pour one-page ── */
function DonutChart({ data, total }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (typeof window.Chart === "undefined") return;

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new window.Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data:            data.map(d => d.count),
          backgroundColor: data.map(d => d.color),
          borderWidth:     2,
          borderColor:     "#fff",
          hoverOffset:     4,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        cutout:              "72%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pct = total > 0 ? Math.round(ctx.parsed / total * 100) : 0;
                return `  ${ctx.label} — ${ctx.parsed} docs (${pct}%)`;
              },
            },
          },
        },
      },
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data, total]);

  return (
    /* height réduit à 110px pour tenir dans une page */
    <div style={{ position: "relative", width: "100%", height: 110 }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Graphique circulaire — répartition des documents par type"
      >
        {data.map(d => `${d.label}: ${d.count}`).join(", ")}
      </canvas>
    </div>
  );
}

/* ── KPI Card ── */
function KpiCard({ value, label, sub, accent, loading }) {
  return (
    <div className="inv-kpi-card" style={{ "--ka": accent || "#534AB7" }}>
      <div className="inv-kpi-val">
        {loading ? <span className="inv-stat-skeleton" /> : (value ?? "—")}
      </div>
      <div className="inv-kpi-label">{label}</div>
      {sub && <div className="inv-kpi-sub">{sub}</div>}
    </div>
  );
}

/* ── TypeBadge ── */
function TypeBadge({ type }) {
  const m = TYPE_META[type] || { icon: "📄", color: "#888", label: type };
  return (
    <span className="inv-type-badge" style={{ "--bc": m.color }}>
      {m.icon} {m.label}
    </span>
  );
}

/* ── Document Card ── */
function DocumentCard({ doc, onClick }) {
  const m = TYPE_META[doc.type] || { icon: "📄", color: "#888" };
  return (
    <div className="inv-doc-card" style={{ "--dc": m.color }} onClick={() => onClick(doc)}>
      <div className="inv-doc-card-accent" />
      <div className="inv-doc-card-header">
        <TypeBadge type={doc.type} />
        {doc.visibilite && <span className="inv-doc-pub-badge">✓ Publié</span>}
      </div>
      <h4 className="inv-doc-title">{doc.titre}</h4>
      {doc.description && (
        <p className="inv-doc-desc">
          {doc.description.slice(0, 120)}{doc.description.length > 120 ? "…" : ""}
        </p>
      )}
      <div className="inv-doc-meta">
        {doc.auteur_nom    && <span className="inv-doc-author">👤 {doc.auteur_nom}</span>}
        {doc.projet_titre  && <span className="inv-doc-project">📁 {doc.projet_titre}</span>}
        <span className="inv-doc-date">
          {new Date(doc.date_creation).toLocaleDateString("fr-FR")}
        </span>
      </div>
      {doc.mots_cles && (
        <div className="inv-doc-tags">
          {doc.mots_cles.split(",").slice(0, 3).map((kw, i) => (
            <span key={i} className="inv-doc-tag">{kw.trim()}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Detail Modal ── */
function DetailModal({ doc, onClose }) {
  const m = TYPE_META[doc.type] || { icon: "📄", color: "#888" };
  const getFileUrl = lien => lien ? `http://localhost:8000/${lien.replace(/\\/g, "/")}` : null;
  const getExt     = lien => lien ? lien.split(".").pop().toLowerCase() : "";
  const ext   = getExt(doc.lien);
  const isImg = ["jpg","jpeg","png","gif","svg","webp"].includes(ext);
  const isPdf = ext === "pdf";
  const isVid = ["mp4","webm","avi","mov","mkv"].includes(ext);

  const handleDownload = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `${doc.titre}.${ext}`;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(url); a.remove();
    } catch { alert("Erreur lors du téléchargement"); }
  };

  return (
    <div className="inv-modal-overlay" onClick={onClose}>
      <div className="inv-modal-box" onClick={e => e.stopPropagation()} style={{ "--mc": m.color }}>
        <div className="inv-modal-header" style={{ borderColor: m.color }}>
          <div className="inv-modal-header-left">
            <span className="inv-modal-icon">{m.icon}</span>
            <div>
              <h3 className="inv-modal-title">{doc.titre}</h3>
              <div className="inv-modal-chips">
                <TypeBadge type={doc.type} />
                {doc.visibilite && <span className="inv-doc-pub-badge">✓ Publié</span>}
              </div>
            </div>
          </div>
          <button className="inv-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="inv-modal-body">
          <dl className="inv-modal-meta">
            {doc.auteur_nom    && <><dt>Auteur</dt><dd>👤 {doc.auteur_nom}</dd></>}
            {doc.projet_titre  && <><dt>Projet</dt><dd>📁 {doc.projet_titre}</dd></>}
            <dt>Date</dt>
            <dd>{new Date(doc.date_creation).toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" })}</dd>
            {doc.mots_cles    && <><dt>Mots-clés</dt><dd>{doc.mots_cles}</dd></>}
            {doc.description  && <><dt>Description</dt><dd>{doc.description}</dd></>}
            {doc.doi          && <><dt>DOI</dt><dd><a href={`https://doi.org/${doc.doi}`} target="_blank" rel="noreferrer">{doc.doi}</a></dd></>}
            {doc.resume       && <><dt>Résumé</dt><dd>{doc.resume}</dd></>}
            {doc.citation_apa && <><dt>Citation APA</dt><dd>{doc.citation_apa}</dd></>}
            {doc.journal      && <><dt>Journal</dt><dd>{doc.journal}</dd></>}
            {doc.maison_edition && <><dt>Maison d'édition</dt><dd>{doc.maison_edition}</dd></>}
            {doc.resolution   && <><dt>Résolution</dt><dd>{doc.resolution}</dd></>}
            {doc.format       && <><dt>Format</dt><dd>{doc.format}</dd></>}
          </dl>
          {doc.lien && (
            <div className="inv-modal-file">
              {isImg && <img src={getFileUrl(doc.lien)} alt={doc.titre} className="inv-modal-preview" />}
              {isVid && <video controls className="inv-modal-preview"><source src={getFileUrl(doc.lien)} /></video>}
              {isPdf && <iframe src={getFileUrl(doc.lien)} title={doc.titre} className="inv-modal-iframe" />}
              <div className="inv-modal-file-actions">
                <a href={getFileUrl(doc.lien)} target="_blank" rel="noreferrer" className="inv-file-link"
                  style={{ color: m.color, borderColor: `${m.color}40`, background: `${m.color}10` }}>
                  👁️ Ouvrir
                </a>
                <button onClick={handleDownload} className="inv-file-dl">⬇️ Télécharger</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Search Banner ── */
function SearchBanner({ total, filtered, onClear }) {
  return (
    <div className="inv-search-banner">
      <span className="inv-search-banner-icon">🔍</span>
      <span>
        <strong>{filtered}</strong> résultat{filtered !== 1 ? "s" : ""} sur{" "}
        <strong>{total}</strong> documents
      </span>
      <button className="inv-btn-ghost inv-search-banner-clear" onClick={onClear}>
        ✕ Effacer
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════ */
export default function Invite() {
  const user = getUser();

  const [documents,   setDocuments]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast,       setToast]       = useState(null);
  const [chartReady,  setChartReady]  = useState(false);

  const [activeView,  setActiveView]  = useState("dashboard");
  const [search,      setSearch]      = useState("");
  const [typeFilter,  setTypeFilter]  = useState("ALL");
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    if (window.Chart) { setChartReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    script.onload = () => setChartReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => { if (!getToken()) window.location.href = "/"; }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const allDocs = await apiFetch("/documents");
      setDocuments(allDocs);
    } catch (e) {
      console.error(e); setError(e.message);
      showToast("Erreur lors du chargement", "error");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  /* ── Stats ── */
  const stats = useMemo(() => {
    const now       = new Date();
    const thisMonth = (d) => {
      const dd = new Date(d.date_creation);
      return dd.getMonth() === now.getMonth() && dd.getFullYear() === now.getFullYear();
    };
    const byType = Object.keys(TYPE_META).reduce((acc, t) => {
      acc[t] = documents.filter(d => d.type === t).length;
      return acc;
    }, {});
    const donutData = Object.entries(TYPE_META).map(([type, meta]) => ({
      label: meta.label, color: meta.color, count: byType[type] || 0,
    })).filter(d => d.count > 0);
    const published     = documents.filter(d => d.visibilite).length;
    const pubRate       = documents.length > 0 ? Math.round((published / documents.length) * 100) : 0;
    const activeAuthors = new Set(documents.filter(d => d.visibilite && d.auteur_id).map(d => d.auteur_id)).size;
    const thisMonthAdds = documents.filter(d => thisMonth(d)).length;
    return {
      total: documents.length, published, pubRate, activeAuthors, thisMonthAdds,
      byType, donutData,
      recentDocs: [...documents]
        .sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation))
        .slice(0, 8),
    };
  }, [documents]);

  const isSearchActive = search.trim() !== "" || typeFilter !== "ALL";
  const filtered = useMemo(
    () => applySmartFilter(documents, search, typeFilter),
    [documents, search, typeFilter]
  );
  const clearFilters = () => { setSearch(""); setTypeFilter("ALL"); };

  const navItems = [
    {
      id: "dashboard", label: "Tableau de bord",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
      ),
    },
    {
      id: "documents", label: "Documents visibles",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
    },
  ];

  return (
    <div className={`inv-root ${sidebarOpen ? "sidebar-open" : ""}`}>

      {toast && (
        <div className={`inv-toast inv-toast-${toast.type}`}>
          {toast.type === "success" ? "✓" : "⚠"} {toast.msg}
        </div>
      )}

      {sidebarOpen && (
        <div className="inv-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`inv-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="inv-brand">
          <div className="inv-brand-mark">
            <img src={logo} alt="logo" className="inv-logo" />
          </div>
          <div className="inv-brand-text">
            <span className="inv-brand-title">LabLESOR</span>
            <span className="inv-brand-sub">Économie et Sociétés Rurales</span>
          </div>
        </div>

        <nav className="inv-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`inv-nav-item ${activeView === item.id ? "active" : ""}`}
              onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
            >
              <span className="inv-nav-icon">{item.icon}</span>
              <span className="inv-nav-label">{item.label}</span>
              {item.id === "documents" && documents.length > 0 && (
                <span className="inv-nav-badge">{documents.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="inv-sidebar-footer">
          <div className="inv-profile">
            <div className="inv-profile-avatar">
              {(user.nom || "I").charAt(0).toUpperCase()}
            </div>
            <div className="inv-profile-info">
              <span className="inv-profile-name">{user.nom || "Invité"}</span>
              <span className="inv-profile-role">
                <span className="inv-role-dot" />Invité
              </span>
            </div>
            <button className="inv-btn-logout" onClick={handleLogout} title="Déconnexion">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="inv-main">
        <header className="inv-topbar">
          <div className="inv-topbar-left">
            <button className="inv-btn-menu" onClick={() => setSidebarOpen(s => !s)}>☰</button>
            <div className="inv-breadcrumb">
              <span className="inv-breadcrumb-home">LabLESOR</span>
              <span className="inv-breadcrumb-sep">/</span>
              <span className="inv-breadcrumb-current">
                {activeView === "dashboard" ? "Tableau de bord" : "Documents"}
              </span>
            </div>
          </div>
          <div className="inv-topbar-right">
            <span className="inv-date">
              {new Date().toLocaleDateString("fr-FR", { weekday:"short", day:"numeric", month:"short" })}
            </span>
            <button className="inv-btn-refresh" onClick={loadData} disabled={loading} title="Actualiser">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          </div>
        </header>

        <div className="inv-content">

          {/* ════ DASHBOARD ════ */}
          {activeView === "dashboard" && (
            <div className="inv-dashboard">

              {/* ── Greeting ── */}
              <div className="inv-greeting">
                <div className="inv-greeting-inner">
                  <div>
                    <h2 className="inv-greeting-title">
                      Bonjour, {user.nom || "Invité"} 👋
                    </h2>
                    <p className="inv-greeting-sub">
                      Vous avez accès à <strong>{stats.total}</strong>{" "}
                      document{stats.total !== 1 ? "s" : ""} publics de la plateforme LabLESOR.
                    </p>
                  </div>
                  <div className="inv-greeting-badge">
                    <span className="inv-greeting-badge-val">{stats.total}</span>
                    <span className="inv-greeting-badge-lbl">Documents</span>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="inv-loading">
                  <div className="inv-spinner" /><span>Chargement…</span>
                </div>
              ) : error ? (
                <div className="inv-error">
                  <span>⚠ {error}</span>
                  <button className="inv-btn-ghost" onClick={loadData}>Réessayer</button>
                </div>
              ) : (
                <>
                  {/* ── KPIs ── */}
                  <div className="inv-kpis-grid">
                    <KpiCard value={stats.total}          label="Documents"  sub="accessibles"              accent="#534AB7" loading={loading} />
                    <KpiCard value={stats.published}      label="Publiés"    sub={`${stats.pubRate}% du total`} accent="#1D9E75" loading={loading} />
                    <KpiCard value={stats.activeAuthors}  label="Auteurs"    sub="actifs"                   accent="#BA7517" loading={loading} />
                    <KpiCard value={`+${stats.thisMonthAdds}`} label="Ajouts" sub="ce mois"                 accent="#7F77DD" loading={loading} />
                  </div>

                  {/* ── Dashboard body : 3 colonnes ── */}
                  <div className="inv-dashboard-body">

                    {/* Colonne 1 — Répartition (Donut) */}
                    <div className="inv-panel">
                      <div className="inv-panel-head">
                        <span className="inv-panel-title">Répartition par type</span>
                        <span className="inv-panel-sub">Distribution des {stats.total} documents</span>
                      </div>
                      {chartReady ? (
                        <DonutChart data={stats.donutData} total={stats.total} />
                      ) : (
                        <div className="inv-loading" style={{ height: 110 }}>
                          <div className="inv-spinner" />
                        </div>
                      )}
                      <div className="inv-donut-legend">
                        {stats.donutData.map(d => {
                          const pct = stats.total > 0 ? Math.round(d.count / stats.total * 100) : 0;
                          return (
                            <div key={d.label} className="inv-legend-row">
                              <span className="inv-legend-sq" style={{ background: d.color }} />
                              <span className="inv-legend-name">{d.label}</span>
                              <span className="inv-legend-val">{d.count}</span>
                              <span className="inv-legend-pct">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                   
                    {/* Colonne 3 — Derniers documents */}
                    <div className="inv-card">
                      <div className="inv-card-header">
                        <span className="inv-card-title">Derniers documents ajoutés</span>
                        <button className="inv-btn-text" onClick={() => setActiveView("documents")}>
                          Voir tous →
                        </button>
                      </div>
                      {stats.recentDocs.length === 0 ? (
                        <div className="inv-empty">
                          <span>📭</span>
                          <p>Aucun document disponible.</p>
                        </div>
                      ) : (
                        <div className="inv-recent-list">
                          {stats.recentDocs.map(doc => {
                            const m = TYPE_META[doc.type] || { color: "#888" };
                            return (
                              <div key={doc.id} className="inv-recent-item" onClick={() => setSelectedDoc(doc)}>
                                <span className="inv-recent-dot" style={{ background: m.color }} />
                                <div className="inv-recent-info">
                                  <span className="inv-recent-title">{doc.titre}</span>
                                  <span className="inv-recent-meta">
                                    {doc.auteur_nom && <>{doc.auteur_nom} · </>}
                                    {new Date(doc.date_creation).toLocaleDateString("fr-FR")}
                                  </span>
                                </div>
                                {doc.visibilite && (
                                  <span className="inv-doc-pub-badge sm">Publié</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>{/* fin inv-dashboard-body */}
                </>
              )}
            </div>
          )}

          {/* ════ DOCUMENTS ════ */}
          {activeView === "documents" && (
            <div className="inv-docs-view">
              <div className="inv-docs-header">
                <h3 className="inv-docs-title">
                  Documents publics
                  <span className="inv-docs-count">{filtered.length}</span>
                  {!isSearchActive && documents.length > filtered.length && (
                    <span className="inv-docs-hint">· {documents.length} au total</span>
                  )}
                </h3>
                <p className="inv-docs-sub">
                  {isSearchActive
                    ? "🔎 Mode recherche : tous les documents correspondants sont affichés."
                    : "👤 Affichage par défaut : un document par auteur (le plus récent)."}
                </p>
              </div>

              <div className="inv-docs-filters">
                <div className="inv-search-wrap">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input
                    placeholder="Titre, auteur, mots-clés, DOI…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && <button onClick={() => setSearch("")}>✕</button>}
                </div>
                <select className="inv-filter-sel" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                  <option value="ALL">Tous les types</option>
                  {Object.entries(TYPE_META).map(([t, m]) => (
                    <option key={t} value={t}>{m.icon} {m.label}</option>
                  ))}
                </select>
              </div>

              {isSearchActive && (
                <SearchBanner total={documents.length} filtered={filtered.length} onClear={clearFilters} />
              )}

              {loading ? (
                <div className="inv-loading"><div className="inv-spinner" /><span>Chargement…</span></div>
              ) : error ? (
                <div className="inv-error">
                  <span>⚠ {error}</span>
                  <button className="inv-btn-ghost" onClick={loadData}>Réessayer</button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="inv-empty">
                  <span style={{ fontSize: 40 }}>🔍</span>
                  <p>{isSearchActive ? "Aucun résultat pour ces critères." : "Aucun document public disponible."}</p>
                  {isSearchActive && (
                    <button className="inv-btn-ghost" onClick={clearFilters}>Effacer les filtres</button>
                  )}
                </div>
              ) : (
                <div className="inv-docs-grid">
                  {filtered.map(doc => (
                    <DocumentCard key={doc.id} doc={doc} onClick={setSelectedDoc} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {selectedDoc && (
        <DetailModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
      )}
    </div>
  );
}