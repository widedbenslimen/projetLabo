import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./Invite.css";
import logo from "../../assets/image.png";
import LabDocuments from "../../composants/LabDocuments/LabDocuments";

const API_BASE = "http://localhost:8000/api";
const getToken = () => localStorage.getItem("token");
const getUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); }
  catch { return {}; }
};

const TYPE_META = {
  ARTICLE: { icon: "📰", color: "#4F46E5", bg: "#EEF2FF", label: "Articles" },
  ENQUETE: { icon: "📋", color: "#DB2777", bg: "#FCE7F3", label: "Enquêtes" },
  IMAGE:   { icon: "🖼️", color: "#D97706", bg: "#FEF3C7", label: "Images" },
  RAPPORT: { icon: "📊", color: "#0D9488", bg: "#CCFBF1", label: "Rapports" },
  VIDEO:   { icon: "🎬", color: "#E11D48", bg: "#FFE4E6", label: "Vidéos" },
  CARTE:   { icon: "🗺️", color: "#7C3AED", bg: "#EDE9FE", label: "Cartes" },
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

/* ── KPI Card ── */
function KpiCard({ value, label, sub, accent, bg, icon, loading, onClick }) {
  return (
    <button
      className="inv-kpi-card"
      style={{ "--ka": accent || "#4F46E5" }}
      onClick={onClick}
      title={`Voir ${label}`}
    >
      <div className="inv-kpi-icon" style={{ background: bg || "#EEF2FF", color: accent }}>
        {icon}
      </div>
      <div className="inv-kpi-val">
        {loading ? <span className="inv-stat-skeleton" /> : (value ?? "—")}
      </div>
      <div className="inv-kpi-label">{label}</div>
      {sub && <div className="inv-kpi-sub">{sub}</div>}
      <div className="inv-kpi-arrow">→</div>
    </button>
  );
}

/* ── Donut Chart Component ── */
function DonutChart({ data, total }) {
  if (!data || data.length === 0) {
    return <div className="inv-loading" style={{ height: 200 }}><div className="inv-spinner" /></div>;
  }

  // Calculer les angles pour le donut
  let currentAngle = -90; // Commencer à -90° (12h)
  const segments = [];
  
  data.forEach((item) => {
    const angle = (item.count / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    
    // Convertir en radians
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    // Calculer les coordonnées
    const x1 = 50 + 35 * Math.cos(startRad);
    const y1 = 50 + 35 * Math.sin(startRad);
    const x2 = 50 + 35 * Math.cos(endRad);
    const y2 = 50 + 35 * Math.sin(endRad);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    const pathData = [
      `M 50 50`,
      `L ${x1} ${y1}`,
      `A 35 35 0 ${largeArc} 1 ${x2} ${y2}`,
      `Z`
    ].join(' ');
    
    segments.push({
      path: pathData,
      color: item.color,
      label: item.label,
      count: item.count,
      percent: ((item.count / total) * 100).toFixed(1)
    });
    
    currentAngle += angle;
  });

  return (
    <div className="inv-donut-container">
      <div className="inv-donut-chart">
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
          {segments.map((segment, idx) => (
            <path
              key={idx}
              d={segment.path}
              fill={segment.color}
              stroke="#fff"
              strokeWidth="1.5"
              className="inv-donut-segment"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                // Optionnel: naviguer vers les documents de ce type
                const typeKey = Object.keys(TYPE_META).find(
                  key => TYPE_META[key].label === segment.label
                );
                if (typeKey && window.goToDocuments) {
                  window.goToDocuments(typeKey);
                }
              }}
            >
              <title>{`${segment.label}: ${segment.count} (${segment.percent}%)`}</title>
            </path>
          ))}
          <circle cx="50" cy="50" r="20" fill="#fff" stroke="#e2e8f0" strokeWidth="1.5" />
          <text
            x="50"
            y="46"
            textAnchor="middle"
            fontSize="11"
            fill="#1e293b"
            fontWeight="bold"
          >
            {total}
          </text>
          <text
            x="50"
            y="58"
            textAnchor="middle"
            fontSize="7"
            fill="#64748b"
          >
            total
          </text>
        </svg>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════ */
export default function Invite() {
  const user = getUser();

  const [documents,   setDocuments]   = useState([]);
  const [labDocs,     setLabDocs]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast,       setToast]       = useState(null);
  const [chartReady,  setChartReady]  = useState(false);

  // activeView: "dashboard" | "documents"
  const [activeView,  setActiveView]  = useState("dashboard");

  // docFilter: null | "visible" | "ARTICLE" | "RAPPORT" | etc.
  const [docFilter,   setDocFilter]   = useState(null);

  useEffect(() => { if (!getToken()) window.location.href = "/"; }, []);

  // Exposer goToDocuments pour le DonutChart
  useEffect(() => {
    window.goToDocuments = goToDocuments;
    return () => { delete window.goToDocuments; };
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const allDocs = await apiFetch("/documents");
      setLabDocs(allDocs);
      setDocuments(allDocs);
    } catch (e) {
      console.error(e); setError(e.message);
      showToast("Erreur lors du chargement", "error");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Activer le graphique après le chargement
  useEffect(() => {
    if (!loading && documents.length > 0) {
      setTimeout(() => setChartReady(true), 100);
    }
  }, [loading, documents]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/Connexion";
  };

  /* ── Navigation vers les documents avec filtre ── */
  const goToDocuments = (filter = null) => {
    setDocFilter(filter);
    setActiveView("documents");
    setSidebarOpen(false);
  };

  /* ── Stats ── */
  const stats = useMemo(() => {
    const byType = Object.keys(TYPE_META).reduce((acc, t) => {
      acc[t] = documents.filter(d => d.type === t).length;
      return acc;
    }, {});
    
    const typeData = Object.entries(TYPE_META).map(([type, meta]) => ({
      type, label: meta.label, color: meta.color, bg: meta.bg,
      icon: meta.icon, count: byType[type] || 0,
    })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);

    // Données pour le donut
    const donutData = typeData.map(d => ({
      label: d.label,
      count: d.count,
      color: d.color
    }));

    const published = documents.filter(d => d.visibilite).length;
    const pubRate   = documents.length > 0 ? Math.round((published / documents.length) * 100) : 0;

    return {
      total: documents.length, published, pubRate,
      byType, typeData, donutData,
      recentDocs: [...documents]
        .sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation))
        .slice(0, 5),
    };
  }, [documents]);

  const navItems = [
    {
      id: "dashboard", label: "Tableau de bord",
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/>
          <rect x="9" y="9" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/>
        </svg>
      ),
    },
    {
      id: "documents", label: "Documents",
      badge: documents.length,
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6z"/>
          <polyline points="9 2 9 6 13 6"/>
          <line x1="5" y1="9" x2="11" y2="9"/>
          <line x1="5" y1="11.5" x2="9" y2="11.5"/>
        </svg>
      ),
    },
  ];

  const typeFilters = Object.entries(TYPE_META).filter(([t]) => (stats.byType?.[t] || 0) > 0);

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
            <span className="inv-brand-title">LESOR</span>
            <span className="inv-brand-sub">Économie et Sociétés Rurales</span>
          </div>
        </div>

        <nav className="inv-nav">
          <div className="inv-nav-section-label">Navigation</div>
          {navItems.map(item => (
            <button
              key={item.id}
              className={`inv-nav-item ${activeView === item.id && !docFilter ? "active" : ""}`}
              onClick={() => {
                if (item.id === "documents") {
                  goToDocuments(null);
                } else {
                  setActiveView(item.id);
                  setDocFilter(null);
                  setSidebarOpen(false);
                }
              }}
            >
              <span className="inv-nav-icon">{item.icon}</span>
              <span className="inv-nav-label">{item.label}</span>
              {item.badge > 0 && (
                <span className="inv-nav-badge">{item.badge}</span>
              )}
            </button>
          ))}

          {typeFilters.length > 0 && (
            <>
              <div className="inv-nav-section-label" style={{ marginTop: 10 }}>Filtres rapides</div>
              {typeFilters.map(([type, meta]) => (
                <button
                  key={type}
                  className={`inv-nav-item ${activeView === "documents" && docFilter === type ? "active" : ""}`}
                  onClick={() => goToDocuments(type)}
                >
                  <span className="inv-nav-icon" style={{ fontSize: 14 }}>{meta.icon}</span>
                  <span className="inv-nav-label">{meta.label}</span>
                  <span className="inv-nav-count">{stats.byType?.[type] || 0}</span>
                </button>
              ))}
            </>
          )}
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
              <span className="inv-breadcrumb-home">LESOR</span>
              <span className="inv-breadcrumb-sep">/</span>
              <span className="inv-breadcrumb-current">
                {activeView === "dashboard"
                  ? "Tableau de bord"
                  : docFilter
                    ? (TYPE_META[docFilter]?.label || "Documents")
                    : "Documents"}
              </span>
            </div>
          </div>
          <div className="inv-topbar-right">
            <span className="inv-date">
              {new Date().toLocaleDateString("fr-FR", { weekday:"short", day:"numeric", month:"short" })}
            </span>
            <button className="inv-btn-refresh" onClick={loadData} disabled={loading} title="Actualiser">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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

              {/* Greeting */}
              <div className="inv-greeting">
                <div className="inv-greeting-inner">
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <h2 className="inv-greeting-title">
                      Bonjour, {user.nom || "Invité"} 👋
                    </h2>
                    <p className="inv-greeting-sub">
                      Le laboratoire LESOR compte <strong>{labDocs.length}</strong>{" "}
                      document{labDocs.length !== 1 ? "s" : ""} au total.
                    </p>
                  </div>
                  <div className="inv-greeting-badge" style={{ position: "relative", zIndex: 1 }}>
                    <span className="inv-greeting-badge-val">{labDocs.length}</span>
                    <span className="inv-greeting-badge-lbl">documents</span>
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
                  {/* KPIs cliquables */}
                  <div className="inv-kpis-grid">
                    <KpiCard
                      value={labDocs.length}
                      label="Total documents"
                      sub="tous types confondus"
                      accent="#4F46E5"
                      bg="#EEF2FF"
                      icon={
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                          <path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6z"/>
                          <polyline points="9 2 9 6 13 6"/>
                        </svg>
                      }
                      loading={loading}
                      onClick={() => goToDocuments(null)}
                    />
                    <KpiCard
                      value={stats.published}
                      label="Visibles"
                      sub={`${stats.pubRate}% du total`}
                      accent="#0D9488"
                      bg="#CCFBF1"
                      icon={
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                          <circle cx="8" cy="8" r="6"/>
                          <polyline points="5 8 7 10 11 6"/>
                        </svg>
                      }
                      loading={loading}
                      onClick={() => goToDocuments("visible")}
                    />
                    <KpiCard
                      value={stats.byType?.ARTICLE ?? 0}
                      label="Articles"
                      sub={`dont ${documents.filter(d => d.type === "ARTICLE" && d.visibilite).length} visibles`}
                      accent="#4F46E5"
                      bg="#EEF2FF"
                      icon={<span style={{ fontSize: 14 }}>📰</span>}
                      loading={loading}
                      onClick={() => goToDocuments("ARTICLE")}
                    />
                  </div>

                  {/* Dashboard body */}
                  <div className="inv-dashboard-body">

                    {/* Répartition par type — Graphique en donut */}
                    <div className="inv-panel">
                      <div className="inv-panel-head">
                        <span className="inv-panel-title">Répartition par type</span>
                        <span className="inv-panel-sub">Distribution des {stats.total} documents</span>
                      </div>
                      {chartReady ? (
                        <DonutChart data={stats.donutData} total={stats.total} />
                      ) : (
                        <div className="inv-loading" style={{ height: 200 }}>
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

                    {/* Derniers documents */}
                    <div className="inv-card">
                      <div className="inv-card-header">
                        <div>
                          <span className="inv-card-title">Derniers ajouts</span>
                          <span className="inv-card-sub">Documents récents</span>
                        </div>
                        <button className="inv-btn-text" onClick={() => goToDocuments(null)}>
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
                            const m = TYPE_META[doc.type] || { color: "#888", bg: "#f5f5f5", icon: "📄" };
                            return (
                              <div key={doc.id} className="inv-recent-item" onClick={() => goToDocuments(doc.type)}>
                                <div className="inv-recent-thumb" style={{ background: m.bg }}>
                                  {m.icon}
                                </div>
                                <div className="inv-recent-info">
                                  <span className="inv-recent-title">{doc.titre}</span>
                                  <span className="inv-recent-meta">
                                    {doc.auteur_nom && <>{doc.auteur_nom} · </>}
                                    {new Date(doc.date_creation).toLocaleDateString("fr-FR")}
                                  </span>
                                </div>
                                {doc.visibilite
                                  ? <span className="inv-doc-badge pub">Publié</span>
                                  : <span className="inv-doc-badge draft">Brouillon</span>
                                }
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                </>
              )}
            </div>
          )}

          {/* ════ DOCUMENTS — délégué à LabDocuments ════ */}
          {activeView === "documents" && (
            <div className="inv-labdocs-wrapper">
              <LabDocuments
                userRole="INVITE"
                initialFilter={docFilter}
                onClearFilter={() => setDocFilter(null)}
              />
            </div>
          )}

        </div>
      </main>
    </div>
  );
}