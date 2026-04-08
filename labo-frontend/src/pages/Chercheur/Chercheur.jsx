import React, { useState, useEffect, useCallback } from "react";
import "./Chercheur.css";
import Projet from "../../composants/Projet/Projet";
import Rapport from "../../composants/Rapport/Rapport";
import Document from "../../composants/Document/Document";
import logo from "../../assets/image.png";
/* ─────────────────────────────────────────────
   CONSTANTS & HELPERS
───────────────────────────────────────────── */
const API_BASE = "http://localhost:8000/api";

const getToken = () => localStorage.getItem("token");

const getUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); }
  catch { return {}; }
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

/* ─────────────────────────────────────────────
   NAV ITEMS CONFIG
───────────────────────────────────────────── */
const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Tableau de bord",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    id: "document",
    label: "Mes documents",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    statKey: "documents",
  },
  {
    id: "projet",
    label: "Mes projets",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    statKey: "projets",
  },
  {
    id: "rapport",
    label: "Gérer Rapport",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
];

/* ─────────────────────────────────────────────
   STAT CARD
───────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, accent, loading }) {
  return (
    <div className="ch-stat-card" style={{ "--sa": accent }}>
      <div className="ch-stat-card-glow" />
      <div className="ch-stat-header">
        <span className="ch-stat-icon">{icon}</span>
        <span className="ch-stat-label">{label}</span>
      </div>
      <div className="ch-stat-value">
        {loading ? <span className="ch-stat-skeleton" /> : value ?? "—"}
      </div>
      {sub && <div className="ch-stat-sub">{sub}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   RECENT ITEM
───────────────────────────────────────────── */
function RecentItem({ icon, title, meta, onClick, accent }) {
  return (
    <div className="ch-recent-item" onClick={onClick} style={{ "--ra": accent }}>
      <span className="ch-recent-icon">{icon}</span>
      <div className="ch-recent-info">
        <strong>{title}</strong>
        <small>{meta}</small>
      </div>
      <svg className="ch-recent-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ACTIVITY FEED ITEM
───────────────────────────────────────────── */
function ActivityItem({ icon, text, date, color }) {
  return (
    <div className="ch-activity-item">
      <span className="ch-activity-dot" style={{ background: color }} />
      <span className="ch-activity-icon">{icon}</span>
      <div className="ch-activity-content">
        <span className="ch-activity-text">{text}</span>
        <span className="ch-activity-date">{date}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function Chercheur() {
  const user = getUser();

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) window.location.href = "/";
  }, []);

  /* ── State ── */
  const [projets,    setProjets]    = useState([]);
  const [documents,  setDocuments]  = useState([]);
  const [stats,      setStats]      = useState({ projets: 0, documents: 0, visibilites: 0, });
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState("dashboard");
  const [toast,      setToast]      = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ── Toast ── */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  /* ── Chargement données ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const userId = user.id || user.userId;

      /* Projets */
      let userProjets = [];
      try {
        const allProjets = await apiFetch("/projet");
        userProjets = allProjets.filter(p =>
          p.participants?.some(part => part.id === userId || part.id === String(userId))
        );
        setProjets(userProjets);
      } catch (e) { console.error("Projets:", e); }

      /* Documents */
      let userDocs = [];
      try {
        const allDocs = await apiFetch("/documents");
        userDocs = allDocs.filter(d =>
          d.auteur_id === userId || d.auteur_id === String(userId)
        );
        setDocuments(userDocs);
      } catch (e) { console.error("Documents:", e); }

      /* Stats */
      const visibilites   = userDocs.filter(d => d.visibilite).length;
      
      setStats({
        projets:    userProjets.length,
        documents:  userDocs.length,
        visibilites,
        
      });
    } catch (e) {
      showToast("Erreur lors du chargement des données", "error");
    } finally {
      setLoading(false);
    }
  }, [user.id, user.userId]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Logout ── */
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/Connexion";
  };

  /* ── Navigation ── */
  const navigate = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  /* ── Activité récente simulée depuis les données réelles ── */
  const recentActivity = [
    ...projets.slice(0, 2).map(p => ({
      icon: "📁", text: `Projet « ${p.titre} »`, color: "#f59e0b",
      date: p.date_debut ? new Date(p.date_debut).toLocaleDateString("fr-FR") : "—",
    })),
    ...documents.slice(0, 3).map(d => ({
      icon: d.visibilite ? "🌐" : "🔒",
      text: `${d.visibilite ? "Public" : "Privé"} : « ${d.titre} »`,
      color: d.visibilite ? "#4a7c59" : "#6366f1",
      date: new Date(d.date_creation).toLocaleDateString("fr-FR"),
    })),
  ].slice(0, 5);

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <div className={`ch-root ${sidebarOpen ? "sidebar-open" : ""}`}>

      {/* ── Toast ── */}
      {toast && (
        <div className={`ch-toast ch-toast-${toast.type}`}>
          {toast.type === "success" ? "✓" : "⚠"} {toast.msg}
        </div>
      )}

      {/* ── Overlay mobile ── */}
      {sidebarOpen && (
        <div className="ch-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ══════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════ */}
      <aside className={`ch-sidebar ${sidebarOpen ? "open" : ""}`}>

        {/* Brand */}
        <div className="ch-brand">
          <div className="ad-brand-mark">
            <img src={logo} alt="logo" className="ad-logo" />
          </div>
          <div className="ch-brand-text">
            <span className="ch-brand-title">LabLESOR</span>
            <span className="ch-brand-sub">Laboratoire Economie et SOciétés Rurales</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="ch-nav">
          <span className="ch-nav-group-label">Navigation</span>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`ch-nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
            >
              <span className="ch-nav-icon">{item.icon}</span>
              <span className="ch-nav-label">{item.label}</span>
              {item.statKey && stats[item.statKey] > 0 && (
                <span className="ch-nav-badge">{stats[item.statKey]}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Profil */}
        <div className="ch-sidebar-profile">
          <div className="ch-profile-avatar">
            {(user.nom || "C").charAt(0).toUpperCase()}
          </div>
          <div className="ch-profile-info">
            <span className="ch-profile-name">{user.nom || "Chercheur"}</span>
            <span className="ch-profile-role">
              <span className="ch-profile-dot" />
              Chercheur
            </span>
          </div>
          <button className="ch-btn-logout" onClick={handleLogout} title="Déconnexion">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════
          MAIN
      ══════════════════════════════════════ */}
      <main className="ch-main">

        {/* Topbar */}
        <header className="ch-topbar">
          <div className="ch-topbar-left">
            <button className="ch-btn-menu" onClick={() => setSidebarOpen(s => !s)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div className="ch-topbar-breadcrumb">
              <span className="ch-breadcrumb-home">LabLESOR</span>
              <span className="ch-breadcrumb-sep">/</span>
              <span className="ch-breadcrumb-current">
                {NAV_ITEMS.find(n => n.id === activeTab)?.label || activeTab}
              </span>
            </div>
          </div>
          <div className="ch-topbar-right">
            <button
              className="ch-btn-refresh"
              onClick={loadData}
              disabled={loading}
              title="Actualiser les données"
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                className={loading ? "ch-spin" : ""}
              >
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              {loading ? "Chargement…" : "Actualiser"}
            </button>
          </div>
        </header>

        {/* ── Contenu ── */}
        <div className="ch-content">

          {/* ═══════════ DASHBOARD ═══════════ */}
          {activeTab === "dashboard" && (
            <div className="ch-dashboard">

              {/* Greeting */}
              <div className="ch-greeting">
                <div className="ch-greeting-text">
                  <h2>Bonjour, {user.nom || "Chercheur"} 👋</h2>
                  <p>Voici un résumé de votre activité de recherche.</p>
                </div>
                <span className="ch-greeting-date">
                  {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>

              {/* Stats */}
              <div className="ch-stats-grid">
                <StatCard
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                  label="Mes documents"
                  value={stats.documents}
                  sub="Total déposés"
                  accent="#6366f1"
                  loading={loading}
                />
                <StatCard
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>}
                  label="Mes projets"
                  value={stats.projets}
                  sub="Projets actifs"
                  accent="#f59e0b"
                  loading={loading}
                />
                <StatCard
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>}
                  label="Publiés"
                  value={stats.visibilites}
                  sub="Articles publiés"
                  accent="#4a7c59"
                  loading={loading}
                />
                
              </div>

              {/* Bottom grid */}
              <div className="ch-dash-grid">

                {/* Projets récents */}
                <div className="ch-card">
                  <div className="ch-card-header">
                    <span className="ch-card-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      Projets récents
                    </span>
                    <button className="ch-card-link" onClick={() => navigate("projet")}>
                      Voir tout
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  </div>
                  <div className="ch-recent-list">
                    {loading ? (
                      [1,2,3].map(i => <div key={i} className="ch-skeleton-row" />)
                    ) : projets.length === 0 ? (
                      <div className="ch-empty-inline">
                        <span>📁</span>
                        <span>Aucun projet assigné</span>
                      </div>
                    ) : (
                      projets.slice(0, 4).map(p => (
                        <RecentItem
                          key={p.id}
                          icon="📁"
                          title={p.titre}
                          meta={`${p.participants?.length || 0} participant(s)${p.date_debut ? ` · Début ${new Date(p.date_debut).toLocaleDateString("fr-FR")}` : ""}`}
                          accent="#f59e0b"
                          onClick={() => navigate("projet")}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Documents récents */}
                <div className="ch-card">
                  <div className="ch-card-header">
                    <span className="ch-card-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      Documents récents
                    </span>
                    <button className="ch-card-link" onClick={() => navigate("document")}>
                      Voir tout
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  </div>
                  <div className="ch-recent-list">
                    {loading ? (
                      [1,2,3].map(i => <div key={i} className="ch-skeleton-row" />)
                    ) : documents.length === 0 ? (
                      <div className="ch-empty-inline">
                        <span>📄</span>
                        <span>Aucun document déposé</span>
                      </div>
                    ) : (
                      documents.slice(0, 4).map(d => (
                        <RecentItem
                          key={d.id}
                          icon={d.type === "ARTICLE" ? "📰" : d.type === "IMAGE" ? "🖼️" : d.type === "VIDEO" ? "🎬" : "📄"}
                          title={d.titre}
                          meta={`${d.type}${d.visibilite ? ". 🌐 Public" : ". 🔒 Privé"} · ${new Date(d.date_creation).toLocaleDateString("fr-FR")}`}
                          accent="#6366f1"
                          onClick={() => navigate("document")}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Activité récente */}
                <div className="ch-card ch-card-activity">
                  <div className="ch-card-header">
                    <span className="ch-card-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                      Activité récente
                    </span>
                  </div>
                  <div className="ch-activity-list">
                    {loading ? (
                      [1,2,3].map(i => <div key={i} className="ch-skeleton-row" />)
                    ) : recentActivity.length === 0 ? (
                      <div className="ch-empty-inline">
                        <span>📊</span>
                        <span>Aucune activité récente</span>
                      </div>
                    ) : (
                      recentActivity.map((a, i) => (
                        <ActivityItem key={i} {...a} />
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}
          {/* ═══════════ DOCUMENTS ═══════════ */}
          {activeTab === "document" && (
            <div className="ch-tab-pane">
              <Document role="CHERCHEUR" />
            </div>
          )}

          {/* ═══════════ PROJETS ═══════════ */}
          {activeTab === "projet" && (
            <div className="ch-tab-pane">
              <Projet key="projet-tab" user={user} showOnlyUserProjets={true} />
            </div>
          )}

          {/* ═══════════ RAPPORT ═══════════ */}
          {activeTab === "rapport" && (
            <div className="ch-tab-pane">
              <Rapport user={user} />
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
