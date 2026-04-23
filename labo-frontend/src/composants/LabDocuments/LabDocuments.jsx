// src/composants/LabDocuments/LabDocuments.jsx
import { useState, useEffect, useRef } from "react";
import "./LabDocuments.css";

const API_BASE = "http://localhost:8000/api";
const DOCUMENT_TYPES = ["ARTICLE", "ENQUETE", "IMAGE", "RAPPORT", "VIDEO", "CARTE"];

const TYPE_META = {
  ARTICLE: { icon: "📰", color: "#6366f1", label: "Article",  badgeClass: "art" },
  ENQUETE: { icon: "📋", color: "#8b5cf6", label: "Enquête",  badgeClass: "enq" },
  IMAGE:   { icon: "🖼️", color: "#10b981", label: "Image",    badgeClass: "img" },
  RAPPORT: { icon: "📊", color: "#f59e0b", label: "Rapport",  badgeClass: "rap" },
  VIDEO:   { icon: "🎬", color: "#ec4899", label: "Vidéo",    badgeClass: "vid" },
  CARTE:   { icon: "🗺️", color: "#06b6d4", label: "Carte",    badgeClass: "car" },
};

const getToken = () => localStorage.getItem("token");

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

/* ── Badge type ── */
function TypeBadge({ type }) {
  const m = TYPE_META[type] || { icon: "📄", label: type, color: "#888" };
  return (
    <span className="lab-type-badge" style={{ "--bc": m.color }}>
      {m.icon} {m.label || type}
    </span>
  );
}

/* ── Chip visibilité ── */
function VisibilityChip({ visibilite }) {
  return (
    <span className={`lab-vis-chip ${visibilite ? "visible" : "private"}`}>
      {visibilite ? "🌐 Visible" : "🔒 Privé"}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════
   DETAIL PANEL (panneau latéral, style Document.jsx)
══════════════════════════════════════════════════════════ */
function DetailPanel({ doc, onClose }) {
  const m         = TYPE_META[doc.type] || { icon: "📄", color: "#888", label: doc.type };
  const isArticle = doc.type === "ARTICLE";
  const isPublic  = doc.visibilite;

  const getFileUrl  = lien => lien ? `http://localhost:8000/${lien.replace(/\\/g, "/")}` : null;
  const getExt      = lien => lien ? lien.split(".").pop().toLowerCase() : "";
  const getBasename = lien => lien ? lien.split(/[\\/]/).pop() : "";

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
      a.href = url;
      a.download = `${doc.titre}.${ext}`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch { alert("Erreur lors du téléchargement"); }
  };

  return (
    <>
      <div className="lab-panel-backdrop" onClick={onClose} />
      <div className="lab-detail-panel">

        {/* Header */}
        <div className="lab-panel-header">
          <div className="lab-panel-header-left">
            <span className="lab-panel-icon" style={{ color: m.color }}>{m.icon}</span>
            <span className="lab-panel-title">Détail du document</span>
          </div>
          <button className="lab-panel-close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="lab-panel-body">

          {/* Hero */}
          <div className="lab-panel-hero" style={{ "--hc": m.color }}>
            <div className="lab-panel-hero-title">{doc.titre}</div>
            <div className="lab-panel-chips">
              <TypeBadge type={doc.type} />
              <VisibilityChip visibilite={isPublic} />
              {isArticle && doc.sous_type && (
                <span className="lab-chip-sub">
                  {doc.sous_type === "JOURNAL" ? "📰" : "🎤"} {doc.sous_type}
                </span>
              )}
            </div>
          </div>

          {/* ── Champs toujours visibles ── */}
          <dl className="lab-panel-meta">
            {doc.auteur_nom && (
              <>
                <dt>Auteur</dt>
                <dd>
                  {doc.auteur_nom}
                  {isPublic && doc.auteur_email && <em> · {doc.auteur_email}</em>}
                </dd>
              </>
            )}
            <dt>Date de création</dt>
            <dd>
              {new Date(doc.date_creation).toLocaleDateString("fr-FR", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </dd>
            {doc.description && (
              <>
                <dt>Description</dt>
                <dd>{doc.description}</dd>
              </>
            )}

            {/* ── Champs supplémentaires : visibilite=true seulement ── */}
            {isPublic && (
              <>
                {doc.mots_cles && <><dt>Mots-clés</dt><dd>{doc.mots_cles}</dd></>}
                {doc.projet_titre && <><dt>Projet</dt><dd>📁 {doc.projet_titre}</dd></>}
                {doc.doi && (
                  <>
                    <dt>DOI</dt>
                    <dd>
                      <a href={`https://doi.org/${doc.doi}`} target="_blank" rel="noreferrer">
                        {doc.doi}
                      </a>
                    </dd>
                  </>
                )}
                {doc.resume && <><dt>Résumé</dt><dd>{doc.resume}</dd></>}
                {(doc.citation_apa || doc.citation_APA) && (
                  <><dt>APA</dt><dd>{doc.citation_apa || doc.citation_APA}</dd></>
                )}
                {doc.journal && <><dt>Journal</dt><dd>{doc.journal}</dd></>}
                {doc.maison_edition && <><dt>Maison d'édition</dt><dd>{doc.maison_edition}</dd></>}
                {doc.resolution && <><dt>Résolution</dt><dd>{doc.resolution}</dd></>}
                {doc.format && <><dt>Format</dt><dd>{doc.format}</dd></>}
              </>
            )}
          </dl>

          {/* Bannière document privé */}
          {!isPublic && (
            <div className="lab-panel-locked">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Détails restreints — document non visible
            </div>
          )}

          {/* Fichier (public seulement) */}
          {isPublic && doc.lien && (
            <div className="lab-panel-file">
              {isImg && (
                <img src={getFileUrl(doc.lien)} alt={doc.titre} className="lab-panel-preview" />
              )}
              {isVid && (
                <video controls className="lab-panel-preview">
                  <source src={getFileUrl(doc.lien)} />
                </video>
              )}
              {isPdf && (
                <iframe
                  src={getFileUrl(doc.lien)}
                  title={doc.titre}
                  className="lab-panel-iframe"
                />
              )}
              <div className="lab-panel-file-actions">
                <a
                  href={getFileUrl(doc.lien)}
                  target="_blank"
                  rel="noreferrer"
                  className="lab-file-link"
                  style={{ color: m.color, borderColor: `${m.color}40`, background: `${m.color}10` }}
                >
                  👁️ Ouvrir {ext.toUpperCase()}
                </a>
                <button onClick={handleDownload} className="lab-file-dl">
                  ⬇️ Télécharger
                </button>
              </div>
              <small className="lab-faint">📁 {getBasename(doc.lien)}</small>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   TABLE DES DOCUMENTS
══════════════════════════════════════════════════════════ */
function DocTable({ docs, isArticle, onView }) {
  return (
    <div className="lab-table-wrap">
      <table className="lab-table">
        <thead>
          <tr>
            <th>Type</th>
            {isArticle && <th>Sous-type</th>}
            <th>Titre</th>
            <th>Auteur</th>
            <th>Visibilité</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {docs.map(doc => (
            <tr key={doc.id} className="lab-row" onClick={() => onView(doc)}>
              <td><TypeBadge type={doc.type} /></td>
              {isArticle && (
                <td>
                  {doc.sous_type
                    ? <span className="lab-sous-type">{doc.sous_type === "JOURNAL" ? "📰" : "🎤"} {doc.sous_type}</span>
                    : <span className="lab-faint">—</span>}
                </td>
              )}
              <td className="lab-title-cell">
                <span className="lab-title-text">{doc.titre}</span>
                {doc.description && (
                  <span className="lab-desc-preview">
                    {doc.description.length > 60
                      ? doc.description.slice(0, 60) + "…"
                      : doc.description}
                  </span>
                )}
              </td>
              <td className="lab-cell-sm">{doc.auteur_nom || <span className="lab-faint">—</span>}</td>
              <td><VisibilityChip visibilite={doc.visibilite} /></td>
              <td className="lab-cell-date">
                {new Date(doc.date_creation).toLocaleDateString("fr-FR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="lab-table-footer">
        {docs.length} document{docs.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   EMPTY STATE
══════════════════════════════════════════════════════════ */
function EmptyState({ type, hasFilters, onClear }) {
  const m = type ? TYPE_META[type] : null;
  return (
    <div className="lab-empty">
      <div className="lab-empty-icon">{m ? m.icon : "📂"}</div>
      <p className="lab-empty-title">
        {hasFilters ? "Aucun résultat" : `Aucun ${m?.label?.toLowerCase() || "document"} trouvé`}
      </p>
      <p className="lab-empty-sub">
        {hasFilters ? "Ajustez vos filtres." : "Aucun document disponible."}
      </p>
      {hasFilters && (
        <button className="lab-btn-ghost lab-btn-sm" onClick={onClear}>
          Effacer les filtres
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════════════════════ */
export default function LabDocuments({ userRole, initialFilter, onClearFilter }) {
  const [docs,        setDocs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [activeType,  setActiveType]  = useState(null);
  const [visOnlyMode, setVisOnlyMode] = useState(false); // true quand initialFilter === "visible"
  const [expandedView, setExpandedView] = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [search,      setSearch]      = useState("");
  const [yearFilter,  setYearFilter]  = useState("ALL");
  const [visFilter,   setVisFilter]   = useState("ALL");
  const [page,        setPage]        = useState(1);
  const [globalQ,     setGlobalQ]     = useState("");
  const [toast,       setToast]       = useState(null);
  const perPage = 3;

  // Ref pour savoir si c'est le premier montage
  const initialFilterApplied = useRef(false);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const all = await apiFetch("/documents");
        setDocs(all);
      } catch (e) {
        setError(e.message);
        showToast(e.message, "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Appliquer initialFilter dès que les docs sont chargés ──
  useEffect(() => {
    if (loading) return; // Attendre la fin du chargement

    applyFilter(initialFilter);
    initialFilterApplied.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── Réagir aux changements de initialFilter après le premier montage ──
  useEffect(() => {
    if (!initialFilterApplied.current) return; // Pas encore prêt
    applyFilter(initialFilter);
  
  }, [initialFilter]);

  /**
   * applyFilter(filter)
   *   null       → tout afficher, aucun type sélectionné
   *   "visible"  → mode "documents visibles" : tous types, visFilter=VISIBLE
   *   "ARTICLE" | "RAPPORT" | ... → sélectionner ce type, pas de filtre visibilité
   */
  const applyFilter = (filter) => {
    setSelected(null);
    setSearch("");
    setPage(1);

    if (!filter) {
      // Tout — aucun type sélectionné, pas de filtre visibilité
      setVisOnlyMode(false);
      setActiveType(null);
      setExpandedView(false);
      setYearFilter("ALL");
      setVisFilter("ALL");
    } else if (filter === "visible") {
      // Mode "Visibles" : afficher tous les types avec filtre visibilité=VISIBLE
      setVisOnlyMode(true);
      setActiveType(null);
      setExpandedView(false);
      setYearFilter("ALL");
      setVisFilter("VISIBLE");
    } else if (DOCUMENT_TYPES.includes(filter)) {
      // Mode "Type spécifique" ex: ARTICLE, RAPPORT, etc.
      setVisOnlyMode(false);
      setActiveType(filter);
      setExpandedView(true);
      setYearFilter("ALL");
      setVisFilter("ALL");
    }
  };

  const countByType = DOCUMENT_TYPES.reduce((acc, t) => {
    acc[t] = docs.filter(d => d.type === t).length;
    return acc;
  }, {});

  // ── Données source selon le mode ──
  // - visOnlyMode : tous les docs visibles (pas de filtre type)
  // - activeType  : docs filtrés par type
  // - sinon       : aucun (les cartes types sont affichées, pas de liste)
  const sourceDocs = visOnlyMode
    ? docs // le filtre visibilite est géré dans `filtered`
    : activeType
      ? docs.filter(d => d.type === activeType)
      : [];

  const years = [...new Set(sourceDocs.map(d => new Date(d.date_creation).getFullYear()))].sort((a, b) => b - a);
  const isArticle = !visOnlyMode && activeType === "ARTICLE";

  const matchSearch = (d, q) => {
    const lq = q.toLowerCase();
    return (
      d.titre?.toLowerCase().includes(lq) ||
      d.auteur_nom?.toLowerCase().includes(lq) ||
      d.description?.toLowerCase().includes(lq) ||
      (d.visibilite && d.mots_cles?.toLowerCase().includes(lq))
    );
  };

  const filtered = sourceDocs.filter(d => {
    const matchS = !search    || matchSearch(d, search);
    const matchY = yearFilter === "ALL" || new Date(d.date_creation).getFullYear().toString() === yearFilter;
    const matchV = visFilter  === "ALL" || (visFilter === "VISIBLE" ? d.visibilite : !d.visibilite);
    return matchS && matchY && matchV;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated  = filtered.slice((page - 1) * perPage, page * perPage);

  const globalResults = globalQ.trim() ? docs.filter(d => matchSearch(d, globalQ)) : [];

  const totalPublic  = docs.filter(d => d.visibilite).length;
  const totalPrivate = docs.filter(d => !d.visibilite).length;

  const openDetail = async (doc) => {
    if (!doc.visibilite && userRole === "INVITE") {
      showToast("Ce document n'est pas encore visible.", "info");
      return;
    }
    try {
      const full = await apiFetch(`/documents/${doc.id}`);
      setSelected(full);
    } catch {
      setSelected(doc);
    }
  };

  const selectType = (t) => {
    if (activeType === t && expandedView && !visOnlyMode) {
      setExpandedView(false);
      setActiveType(null);
      setVisOnlyMode(false);
      if (onClearFilter) onClearFilter();
    } else if (activeType === t && !visOnlyMode) {
      setExpandedView(true);
    } else {
      setVisOnlyMode(false);
      setActiveType(t);
      setExpandedView(true);
      setSearch("");
      setYearFilter("ALL");
      setVisFilter("ALL");
      setPage(1);
      setSelected(null);
      if (onClearFilter) onClearFilter();
    }
  };

  const clearFilters = () => {
    setSearch("");
    setYearFilter("ALL");
    setVisFilter("ALL");
  };

  // ── Titre du mode actif ──
  const getModeTitle = () => {
    if (visOnlyMode) return "Documents visibles";
    if (activeType) return `${TYPE_META[activeType]?.icon} ${TYPE_META[activeType]?.label}s`;
    return null;
  };

  const showList = visOnlyMode || !!activeType;

  return (
    <div className="lab-root">
      {toast && (
        <div className={`lab-toast lab-toast-${toast.type}`}>
          {toast.type === "error" ? "⚠" : "ℹ"} {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="lab-header">
        <div className="lab-header-left">
          <h2 className="lab-header-title">Documents du Laboratoire</h2>
          {!loading && (
            <div className="lab-header-stats">
              <span className="lab-stat-pill"><strong>{docs.length}</strong> total</span>
              <span className="lab-stat-pill pub"><strong>{totalPublic}</strong> visibles</span>
              <span className="lab-stat-pill priv"><strong>{totalPrivate}</strong> privés</span>
            </div>
          )}
        </div>
        <div className="lab-header-right">
          <div className="lab-search-global">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              placeholder="Rechercher titre, auteur, description…"
              value={globalQ}
              onChange={e => setGlobalQ(e.target.value)}
            />
            {globalQ && <button onClick={() => setGlobalQ("")}>✕</button>}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="lab-body">
        {globalQ.trim() ? (
          /* ── Recherche globale ── */
          <div className="lab-section">
            <div className="lab-section-label">
              {globalResults.length} résultat{globalResults.length !== 1 ? "s" : ""} pour « {globalQ} »
            </div>
            {globalResults.length === 0 ? (
              <div className="lab-empty">
                <div className="lab-empty-icon">
                  <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                </div>
                <p className="lab-empty-title">Aucun résultat</p>
              </div>
            ) : (
              <DocTable docs={globalResults} isArticle={false} onView={openDetail} />
            )}
          </div>
        ) : (
          <>
            {/* ── Cartes de types (masquées en mode "visibles" pour ne pas surcharger) ── */}
            <div className="lab-section">
              {!loading && !error && (
                <div className={`lab-type-grid ${expandedView ? "expanded" : "compact"}`}>
                  {DOCUMENT_TYPES.map(t => {
                    const m      = TYPE_META[t];
                    const count  = countByType[t];
                    const active = !visOnlyMode && activeType === t;
                    return (
                      <button
                        key={t}
                        className={`lab-type-card ${active ? "active" : ""} ${count === 0 ? "empty" : ""}`}
                        style={{ "--tc": m.color }}
                        onClick={() => selectType(t)}
                      >
                        <span className="lab-type-card-icon">{m.icon}</span>
                        <span className="lab-type-card-label">{m.label}</span>
                        <span className="lab-type-card-count">{count}</span>
                        {active && <span className="lab-type-card-active-bar" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Liste (mode "visibles" ou "type spécifique") ── */}
            {showList && (
              <div className="lab-section">
                <div className="lab-filters-bar">
                  <div className="lab-mode-title">
                    {getModeTitle()}
                  </div>
                  {/* Badge du mode actif */}
                  <div
                    className="lab-filter-type-badge"
                    style={{ "--tc": visOnlyMode ? "#0D9488" : TYPE_META[activeType]?.color }}
                  >
                    {visOnlyMode
                      ? "🌐 Documents visibles"
                      : `${TYPE_META[activeType]?.icon} ${TYPE_META[activeType]?.label}s`}
                  </div>

                  <div className="lab-filter-search">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                    </svg>
                    <input
                      placeholder="Filtrer…"
                      value={search}
                      onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                    {search && <button onClick={() => setSearch("")}>✕</button>}
                  </div>

                  <select
                    className="lab-filter-sel"
                    value={yearFilter}
                    onChange={e => { setYearFilter(e.target.value); setPage(1); }}
                  >
                    <option value="ALL">Toutes les années</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>

                  {/* Filtre visibilité (masqué en mode "visibles" car déjà filtré) */}
                  {!visOnlyMode && (
                    <select
                      className="lab-filter-sel"
                      value={visFilter}
                      onChange={e => { setVisFilter(e.target.value); setPage(1); }}
                    >
                      <option value="ALL">Toutes visibilités</option>
                      <option value="VISIBLE">🌐 Visible</option>
                      <option value="PRIVATE">🔒 Privé</option>
                    </select>
                  )}

                  <span className="lab-filter-count">
                    {filtered.length} document{filtered.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {loading ? (
                  <div className="lab-loading">
                    <div className="lab-spinner" />
                    <span>Chargement…</span>
                  </div>
                ) : error ? (
                  <div className="lab-error">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p>{error}</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <EmptyState
                    type={visOnlyMode ? null : activeType}
                    hasFilters={!!(search || yearFilter !== "ALL" || (!visOnlyMode && visFilter !== "ALL"))}
                    onClear={clearFilters}
                  />
                ) : (
                  <>
                    <DocTable
                      docs={paginated}
                      isArticle={isArticle}
                      onView={openDetail}
                    />
                    {totalPages > 1 && (
                      <div className="lab-pagination">
                        <span className="lab-page-info">Page {page} / {totalPages}</span>
                        <div className="lab-page-btns">
                          <button
                            className="lab-page-btn"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                          >←</button>
                          {[...Array(totalPages)].map((_, i) => {
                            const n = i + 1;
                            if (n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                              return (
                                <button
                                  key={n}
                                  className={`lab-page-btn ${page === n ? "active" : ""}`}
                                  onClick={() => setPage(n)}
                                >{n}</button>
                              );
                            if (Math.abs(n - page) === 2)
                              return <span key={n} className="lab-page-dots">…</span>;
                            return null;
                          })}
                          <button
                            className="lab-page-btn"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                          >→</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Loading initial ── */}
      {loading && !showList && (
        <div className="lab-loading">
          <div className="lab-spinner" />
          <span>Chargement des documents…</span>
        </div>
      )}

      {/* ── Panneau détail ── */}
      {selected && (
        <DetailPanel doc={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}