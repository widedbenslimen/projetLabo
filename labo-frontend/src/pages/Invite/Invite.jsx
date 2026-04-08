import React, { useState, useEffect, useCallback } from "react";
import "./Invite.css";
import logo from "../../assets/image.png";

const API_BASE = "http://localhost:8000/api";
const getToken = () => localStorage.getItem("token");
const getUser  = () => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } };

const TYPE_META = {
  ARTICLE: { icon: "📰", color: "#6366f1", label: "Article" },
  ENQUETE: { icon: "📋", color: "#8b5cf6", label: "Enquête" },
  IMAGE:   { icon: "🖼️", color: "#10b981", label: "Image" },
  RAPPORT: { icon: "📊", color: "#f59e0b", label: "Rapport" },
  VIDEO:   { icon: "🎬", color: "#ec4899", label: "Vidéo" },
  CARTE:   { icon: "🗺️", color: "#06b6d4", label: "Carte" },
};

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

/* ── Sous-composants UI ── */
function StatCard({ icon, label, value, sub, accent, loading }) {
  return (
    <div className="inv-stat-card" style={{ "--sa": accent }}>
      <div className="inv-stat-glow" />
      <div className="inv-stat-header">
        <span className="inv-stat-icon">{icon}</span>
        <span className="inv-stat-label">{label}</span>
      </div>
      <div className="inv-stat-value">
        {loading ? <span className="inv-stat-skeleton" /> : (value ?? "—")}
      </div>
      {sub && <div className="inv-stat-sub">{sub}</div>}
    </div>
  );
}

function TypeBadge({ type }) {
  const m = TYPE_META[type] || { icon: "📄", color: "#888", label: type };
  return <span className="inv-type-badge" style={{ "--bc": m.color }}>{m.icon} {m.label}</span>;
}

function DocumentCard({ doc, onClick }) {
  const m = TYPE_META[doc.type] || { icon: "📄", color: "#888" };
  return (
    <div className="inv-doc-card" style={{ "--dc": m.color }} onClick={() => onClick(doc)}>
      <div className="inv-doc-card-accent" />
      <div className="inv-doc-card-header">
        <TypeBadge type={doc.type} />
        {doc.publie && <span className="inv-doc-pub-badge">✓ Publié</span>}
      </div>
      <h4 className="inv-doc-title">{doc.titre}</h4>
      {doc.description && <p className="inv-doc-desc">{doc.description.slice(0, 120)}{doc.description.length > 120 ? "…" : ""}</p>}
      <div className="inv-doc-meta">
        {doc.auteur_nom && <span className="inv-doc-author">👤 {doc.auteur_nom}</span>}
        {doc.projet_titre && <span className="inv-doc-project">📁 {doc.projet_titre}</span>}
        <span className="inv-doc-date">{new Date(doc.date_creation).toLocaleDateString("fr-FR")}</span>
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

function DetailModal({ doc, onClose }) {
  const m = TYPE_META[doc.type] || { icon: "📄", color: "#888" };
  const getFileUrl  = lien => lien ? `http://localhost:8000/${lien.replace(/\\/g, "/")}` : null;
  const getExt      = lien => lien ? lien.split(".").pop().toLowerCase() : "";
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
                {doc.publie && <span className="inv-doc-pub-badge">✓ Publié</span>}
              </div>
            </div>
          </div>
          <button className="inv-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="inv-modal-body">
          <dl className="inv-modal-meta">
            {doc.auteur_nom && <><dt>Auteur</dt><dd>👤 {doc.auteur_nom}</dd></>}
            {doc.projet_titre && <><dt>Projet</dt><dd>📁 {doc.projet_titre}</dd></>}
            <dt>Date</dt>
            <dd>{new Date(doc.date_creation).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</dd>
            {doc.mots_cles && <><dt>Mots-clés</dt><dd>{doc.mots_cles}</dd></>}
            {doc.description && <><dt>Description</dt><dd>{doc.description}</dd></>}
            {doc.doi && <><dt>DOI</dt><dd><a href={`https://doi.org/${doc.doi}`} target="_blank" rel="noreferrer">{doc.doi}</a></dd></>}
            {doc.resume && <><dt>Résumé</dt><dd>{doc.resume}</dd></>}
            {doc.citation_apa && <><dt>Citation APA</dt><dd>{doc.citation_apa}</dd></>}
            {doc.journal && <><dt>Journal</dt><dd>{doc.journal}</dd></>}
            {doc.maison_edition && <><dt>Maison d'édition</dt><dd>{doc.maison_edition}</dd></>}
            {doc.resolution && <><dt>Résolution</dt><dd>{doc.resolution}</dd></>}
            {doc.format && <><dt>Format</dt><dd>{doc.format}</dd></>}
          </dl>

          {doc.lien && (
            <div className="inv-modal-file">
              {isImg && <img src={getFileUrl(doc.lien)} alt={doc.titre} className="inv-modal-preview" />}
              {isVid && <video controls className="inv-modal-preview"><source src={getFileUrl(doc.lien)} /></video>}
              {isPdf && <iframe src={getFileUrl(doc.lien)} title={doc.titre} className="inv-modal-iframe" />}
              <div className="inv-modal-file-actions">
                <a href={getFileUrl(doc.lien)} target="_blank" rel="noreferrer"
                   className="inv-file-link" style={{ color: m.color, borderColor: `${m.color}40`, background: `${m.color}10` }}>
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

/* ── Composant principal ── */
export default function Invite() {
  const user = getUser();

  const [documents,    setDocuments]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [toast,        setToast]        = useState(null);

  /* Vue et filtres */
  const [activeView,   setActiveView]   = useState("dashboard"); // "dashboard" | "documents"
  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState("ALL");
  const [selectedDoc,  setSelectedDoc]  = useState(null);

  useEffect(() => { if (!getToken()) window.location.href = "/"; }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3200);
  };

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // L'API retourne uniquement les docs visibles pour les INVITÉS
      const allDocs = await apiFetch("/documents");
      setDocuments(allDocs);
    } catch (e) {
      console.error(e);
      setError(e.message);
      showToast("Erreur lors du chargement", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  /* ── Stats ── */
  const stats = {
    total: documents.length,
    publies: documents.filter(d => d.publie).length,
    byType: Object.keys(TYPE_META).reduce((acc, t) => {
      acc[t] = documents.filter(d => d.type === t).length;
      return acc;
    }, {}),
    recentDocs: documents.slice(0, 5),
  };

  /* ── Filtrage documents ── */
  const filtered = documents.filter(d => {
    const lq = search.toLowerCase();
    const matchSearch = !search || (
      d.titre?.toLowerCase().includes(lq) ||
      d.description?.toLowerCase().includes(lq) ||
      d.mots_cles?.toLowerCase().includes(lq) ||
      d.auteur_nom?.toLowerCase().includes(lq) ||
      d.projet_titre?.toLowerCase().includes(lq)
    );
    const matchType = typeFilter === "ALL" || d.type === typeFilter;
    return matchSearch && matchType;
  });

  const navItems = [
    { id: "dashboard", icon: "🏠", label: "Tableau de bord" },
    { id: "documents", icon: "📂", label: "Documents visibles" },
  ];

  return (
    <div className={`inv-root ${sidebarOpen ? "sidebar-open" : ""}`}>

      {toast && <div className={`inv-toast inv-toast-${toast.type}`}>{toast.type === "success" ? "✓" : "⚠"} {toast.msg}</div>}

      {sidebarOpen && <div className="inv-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

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
            <div className="inv-profile-avatar">{(user.nom || "I").charAt(0).toUpperCase()}</div>
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
              {new Date().toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
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

          {/* ════════════════════════════════
              VUE DASHBOARD
          ════════════════════════════════ */}
          {activeView === "dashboard" && (
            <div className="inv-dashboard">
              <div className="inv-greeting">
                <div>
                  <h2 className="inv-greeting-title">Bonjour, {user.nom || "Invité"} 👋</h2>
                  <p className="inv-greeting-sub">
                    Vous avez accès à <strong>{stats.total}</strong> document{stats.total !== 1 ? "s" : ""} publics de la plateforme LabLESOR.
                  </p>
                </div>
              </div>

              {/* Cartes stats */}
              {loading ? (
                <div className="inv-loading"><div className="inv-spinner" /><span>Chargement…</span></div>
              ) : error ? (
                <div className="inv-error"><span>⚠ {error}</span><button className="inv-btn-ghost" onClick={loadData}>Réessayer</button></div>
              ) : (
                <>
                  <div className="inv-stats-grid">
                    <StatCard icon="📂" label="Documents accessibles" value={stats.total}
                      sub="Rendus publics par les auteurs" accent="#6366f1" loading={loading} />
                    <StatCard icon="📢" label="Articles publiés" value={stats.publies}
                      sub="Disponibles en lecture" accent="#10b981" loading={loading} />
                    <StatCard icon="📰" label="Articles" value={stats.byType.ARTICLE || 0}
                      sub="Journaux et conférences" accent="#4f8ef7" loading={loading} />
                    <StatCard icon="📊" label="Rapports" value={stats.byType.RAPPORT || 0}
                      sub="Documents de synthèse" accent="#f59e0b" loading={loading} />
                  </div>

                  {/* Répartition par type */}
                  <div className="inv-card">
                    <div className="inv-card-header">
                      <span className="inv-card-title">Répartition par type</span>
                    </div>
                    <div className="inv-type-bars">
                      {Object.entries(TYPE_META).map(([type, meta]) => {
                        const count = stats.byType[type] || 0;
                        const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                        return (
                          <div key={type} className="inv-type-bar-row">
                            <span className="inv-type-bar-label">{meta.icon} {meta.label}</span>
                            <div className="inv-type-bar-track">
                              <div className="inv-type-bar-fill" style={{ width: `${pct}%`, background: meta.color }} />
                            </div>
                            <span className="inv-type-bar-count" style={{ color: meta.color }}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Documents récents */}
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
                        <p>Aucun document disponible pour le moment.</p>
                      </div>
                    ) : (
                      <div className="inv-recent-list">
                        {stats.recentDocs.map(doc => {
                          const m = TYPE_META[doc.type] || { icon: "📄", color: "#888" };
                          return (
                            <div key={doc.id} className="inv-recent-item" onClick={() => { setSelectedDoc(doc); }}>
                              <span className="inv-recent-icon" style={{ color: m.color }}>{m.icon}</span>
                              <div className="inv-recent-info">
                                <span className="inv-recent-title">{doc.titre}</span>
                                <span className="inv-recent-meta">
                                  {doc.auteur_nom && <>{doc.auteur_nom} · </>}
                                  {new Date(doc.date_creation).toLocaleDateString("fr-FR")}
                                </span>
                              </div>
                              {doc.publie && <span className="inv-doc-pub-badge sm">Publié</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════════════════════════════════
              VUE DOCUMENTS
          ════════════════════════════════ */}
          {activeView === "documents" && (
            <div className="inv-docs-view">
              <div className="inv-docs-header">
                <h3 className="inv-docs-title">
                  Documents publics
                  <span className="inv-docs-count">{filtered.length}</span>
                </h3>
                <p className="inv-docs-sub">
                  🔒 Seuls les documents rendus <strong>publics</strong> par leurs auteurs sont visibles ici.
                </p>
              </div>

              {/* Filtres */}
              <div className="inv-docs-filters">
                <div className="inv-search-wrap">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input placeholder="Rechercher par titre, auteur, mots-clés…"
                    value={search} onChange={e => setSearch(e.target.value)} />
                  {search && <button onClick={() => setSearch("")}>✕</button>}
                </div>
                <select className="inv-filter-sel" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                  <option value="ALL">Tous les types</option>
                  {Object.entries(TYPE_META).map(([t, m]) => (
                    <option key={t} value={t}>{m.icon} {m.label}</option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="inv-loading"><div className="inv-spinner" /><span>Chargement…</span></div>
              ) : error ? (
                <div className="inv-error"><span>⚠ {error}</span><button className="inv-btn-ghost" onClick={loadData}>Réessayer</button></div>
              ) : filtered.length === 0 ? (
                <div className="inv-empty">
                  <span style={{ fontSize: 40 }}>🔍</span>
                  <p>{search || typeFilter !== "ALL" ? "Aucun résultat pour ces critères." : "Aucun document public disponible."}</p>
                  {(search || typeFilter !== "ALL") && (
                    <button className="inv-btn-ghost" onClick={() => { setSearch(""); setTypeFilter("ALL"); }}>Effacer les filtres</button>
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

      {/* ── Modal détail ── */}
      {selectedDoc && <DetailModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />}
    </div>
  );
}