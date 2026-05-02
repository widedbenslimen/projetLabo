// composants/ArticlePub/ArticlePub.jsx
import { useState, useEffect } from "react";
import "./ArticlePub.css";

const API_BASE = "http://localhost:8000/api";
const getToken = () => localStorage.getItem("token");

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || res.statusText);
  }
  return res.json();
}

/* ── Badge sous-type ── */
function SousTypeBadge({ sousType }) {
  if (!sousType) return <span className="ap-faint">—</span>;
  return (
    <span className={`ap-sous-type-badge ${sousType === "JOURNAL" ? "journal" : "conference"}`}>
      {sousType === "JOURNAL" ? "📰 Journal" : "🎤 Conférence"}
    </span>
  );
}

/* ── Chip visibilité ── */
function VisibilityChip({ visibilite }) {
  return (
    <span className={`ap-vis-chip ${visibilite ? "visible" : "private"}`}>
      {visibilite ? "🌐 Visible" : "🔒 Privé"}
    </span>
  );
}

/* ══════════════════════════════════════════════════
   PANNEAU DÉTAIL
══════════════════════════════════════════════════ */
function DetailPanel({ article, onClose, onToggleVisibility, canToggle }) {
  const getFileUrl  = lien => lien ? `http://localhost:8000/${lien.replace(/\\/g, "/")}` : null;
  const getExt      = lien => lien ? lien.split(".").pop().toLowerCase() : "";
  const getBasename = lien => lien ? lien.split(/[\\/]/).pop() : "";

  const ext   = getExt(article.lien);
  const isImg = ["jpg","jpeg","png","gif","svg","webp"].includes(ext);
  const isPdf = ext === "pdf";
  const isVid = ["mp4","webm","avi","mov","mkv"].includes(ext);

  const handleDownload = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents/${article.document_id}/download`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `${article.titre}.${ext}`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch { alert("Erreur lors du téléchargement"); }
  };

  return (
    <>
      <div className="ap-panel-backdrop" onClick={onClose} />
      <div className="ap-detail-panel">
        <div className="ap-panel-header">
          <div className="ap-panel-header-left">
            <span className="ap-panel-icon">📰</span>
            <span className="ap-panel-title">Détail de la publication</span>
          </div>
          <button className="ap-panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="ap-panel-body">
          {/* Hero */}
          <div className="ap-panel-hero">
            <div className="ap-panel-pub-badge">
              <span className="ap-pub-star">🚀</span> Article publié
            </div>
            <h2 className="ap-panel-hero-title">{article.titre}</h2>
            <div className="ap-panel-chips">
              <SousTypeBadge sousType={article.sous_type} />
              <VisibilityChip visibilite={article.visibilite} />
            </div>
          </div>

          {/* Méta */}
          <dl className="ap-panel-meta">
            <dt>Auteur</dt>
            <dd>
              <strong>{article.chercheur_nom || article.auteur_nom || "—"}</strong>
              {article.chercheur_email && <em> · {article.chercheur_email}</em>}
            </dd>

            <dt>Date de publication</dt>
            <dd>
              {new Date(article.date_publication).toLocaleDateString("fr-FR", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </dd>

            <dt>Date de création</dt>
            <dd>
              {new Date(article.date_creation).toLocaleDateString("fr-FR", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </dd>

            {article.projet_titre && (
              <><dt>Projet</dt><dd>📁 {article.projet_titre}</dd></>
            )}
            {article.mots_cles && (
              <><dt>Mots-clés</dt><dd>{article.mots_cles}</dd></>
            )}
            {article.description && (
              <><dt>Description</dt><dd>{article.description}</dd></>
            )}
            {article.doi && (
              <>
                <dt>DOI</dt>
                <dd>
                  <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noreferrer">
                    {article.doi}
                  </a>
                </dd>
              </>
            )}
            {article.resume && (
              <><dt>Résumé</dt><dd>{article.resume}</dd></>
            )}
            {article.citation_apa && (
              <><dt>Citation APA</dt><dd>{article.citation_apa}</dd></>
            )}
            {article.journal && (
              <><dt>Journal</dt><dd>{article.journal}</dd></>
            )}
            {article.maison_edition && (
              <><dt>Maison d'édition</dt><dd>{article.maison_edition}</dd></>
            )}
          </dl>

          {/* Fichier */}
          {article.lien && (
            <div className="ap-panel-file">
              {isImg && <img src={getFileUrl(article.lien)} alt={article.titre} className="ap-panel-preview" />}
              {isVid && (
                <video controls className="ap-panel-preview">
                  <source src={getFileUrl(article.lien)} />
                </video>
              )}
              {isPdf && (
                <iframe src={getFileUrl(article.lien)} title={article.titre} className="ap-panel-iframe" />
              )}
              <div className="ap-panel-file-actions">
                <a
                  href={getFileUrl(article.lien)}
                  target="_blank"
                  rel="noreferrer"
                  className="ap-file-link"
                >
                  👁️ Ouvrir {ext.toUpperCase()}
                </a>
                <button onClick={handleDownload} className="ap-file-dl">⬇️ Télécharger</button>
              </div>
              <small className="ap-faint">📁 {getBasename(article.lien)}</small>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {canToggle && (
          <div className="ap-panel-footer">
            <button
              className={`ap-btn-vis ${article.visibilite ? "private" : "visible"}`}
              onClick={() => onToggleVisibility(article.document_id, !article.visibilite)}
            >
              {article.visibilite ? "🔒 Rendre privé" : "🌐 Rendre visible"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════════════ */
export default function ArticlePub({ userRole, userId }) {
  const [articles,     setArticles]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [toast,        setToast]        = useState(null);
  const [search,       setSearch]       = useState("");
  const [yearFilter,   setYearFilter]   = useState("ALL");
  const [visFilter,    setVisFilter]    = useState("ALL");
  const [sousFilter,   setSousFilter]   = useState("ALL");
  const [page,         setPage]         = useState(1);
  const perPage = 8;

  const isAdmin = userRole === "ADMIN";

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  /* ── Chargement des publications ── */
  const loadArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      // Récupérer toutes les publications avec JOIN document + utilisateur
      const pubs = await apiFetch("/documents/articles");
      setArticles(pubs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadArticles(); }, []);

  /* ── Toggle visibilité ── */
  const handleToggleVisibility = async (docId, newVal) => {
    try {
      await apiFetch(`/documents/${docId}/visibilite`, {
        method: "PATCH",
        body: JSON.stringify({ visibilite: newVal }),
      });
      showToast(newVal ? "Article rendu visible 🌐" : "Article rendu privé 🔒");
      setSelected(null);
      loadArticles();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  /* ── Filtrage ── */
  const years = [...new Set(articles.map(a => new Date(a.date_publication).getFullYear()))].sort((a, b) => b - a);

  // Pour chercheur/cadre : seulement ses propres publications
  const baseArticles = isAdmin
    ? articles
    : articles.filter(a => String(a.chercheur_id) === String(userId));

  const filtered = baseArticles.filter(a => {
    const q      = search.toLowerCase();
    const matchS = !search || a.titre?.toLowerCase().includes(q) || a.chercheur_nom?.toLowerCase().includes(q) || a.mots_cles?.toLowerCase().includes(q);
    const matchY = yearFilter === "ALL" || new Date(a.date_publication).getFullYear().toString() === yearFilter;
    const matchV = visFilter  === "ALL" || (visFilter === "VISIBLE" ? a.visibilite : !a.visibilite);
    const matchT = sousFilter === "ALL" || a.sous_type === sousFilter;
    return matchS && matchY && matchV && matchT;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated  = filtered.slice((page - 1) * perPage, page * perPage);

  const totalVisible = baseArticles.filter(a => a.visibilite).length;
  const totalPrivate = baseArticles.filter(a => !a.visibilite).length;

  const clearFilters = () => {
    setSearch(""); setYearFilter("ALL"); setVisFilter("ALL"); setSousFilter("ALL"); setPage(1);
  };

  return (
    <div className="ap-root">

      {/* Toast */}
      {toast && (
        <div className={`ap-toast ap-toast-${toast.type}`}>
          {toast.type === "success" ? "✓" : "⚠"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="ap-header">
        <div className="ap-header-left">
          <h2 className="ap-title">
            🚀 {isAdmin ? "Articles publiés — Laboratoire" : "Mes articles publiés"}
          </h2>
          {!loading && (
            <div className="ap-header-stats">
              <span className="ap-stat-pill"><strong>{baseArticles.length}</strong> publiés</span>
              <span className="ap-stat-pill vis"><strong>{totalVisible}</strong> visibles</span>
              <span className="ap-stat-pill priv"><strong>{totalPrivate}</strong> privés</span>
            </div>
          )}
        </div>
        
      </div>


      {/* Toolbar */}
      <div className="ap-toolbar">
        <div className="ap-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            placeholder={isAdmin ? "Rechercher titre, auteur, mots-clés…" : "Rechercher titre, mots-clés…"}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          {search && <button onClick={() => setSearch("")}>✕</button>}
        </div>

        <select className="ap-filter-sel" value={sousFilter} onChange={e => { setSousFilter(e.target.value); setPage(1); }}>
          <option value="ALL">Tous types</option>
          <option value="JOURNAL">📰 Journal</option>
          <option value="CONFERENCE">🎤 Conférence</option>
        </select>

        <select className="ap-filter-sel" value={yearFilter} onChange={e => { setYearFilter(e.target.value); setPage(1); }}>
          <option value="ALL">Toutes les années</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Toggle visibilité — seulement si admin ou auteur */}
        <select className="ap-filter-sel" value={visFilter} onChange={e => { setVisFilter(e.target.value); setPage(1); }}>
          <option value="ALL">Toutes visibilités</option>
          <option value="VISIBLE">🌐 Visible</option>
          <option value="PRIVATE">🔒 Privé</option>
        </select>

        <span className="ap-filter-count">
          {filtered.length} article{filtered.length !== 1 ? "s" : ""}
        </span>

        {(search || yearFilter !== "ALL" || visFilter !== "ALL" || sousFilter !== "ALL") && (
          <button className="ap-btn-clear" onClick={clearFilters}>✕ Effacer</button>
        )}
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="ap-loading">
          <div className="ap-spinner" />
          <span>Chargement des articles publiés…</span>
        </div>
      ) : error ? (
        <div className="ap-error">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>{error}</p>
          <button className="ap-btn-retry" onClick={loadArticles}>Réessayer</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ap-empty">
          <div className="ap-empty-icon">📭</div>
          <p className="ap-empty-title">
            {baseArticles.length === 0
              ? isAdmin ? "Aucun article publié dans le laboratoire" : "Vous n'avez pas encore publié d'article"
              : "Aucun résultat pour ces filtres"}
          </p>
          {(search || yearFilter !== "ALL" || visFilter !== "ALL" || sousFilter !== "ALL") && (
            <button className="ap-btn-ghost" onClick={clearFilters}>Effacer les filtres</button>
          )}
        </div>
      ) : (
        <>
          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Titre</th>
                  {isAdmin && <th>Auteur</th>}
                  <th>Sous-type</th>
                  <th>Visibilité</th>
                  <th>Date publication</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(art => (
                  <tr
                    key={art.publication_id}
                    className="ap-row"
                    onClick={() => setSelected(art)}
                  >
                    <td className="ap-title-cell">
                      <span className="ap-pub-icon">🚀</span>
                      <div>
                        <span className="ap-title-text">{art.titre}</span>
                        {art.mots_cles && <span className="ap-kw">{art.mots_cles}</span>}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="ap-cell-sm">
                        <div className="ap-author-cell">
                          <div className="ap-author-av">
                            {(art.chercheur_nom || "?").charAt(0).toUpperCase()}
                          </div>
                          <span>{art.chercheur_nom || <span className="ap-faint">—</span>}</span>
                        </div>
                      </td>
                    )}
                    <td><SousTypeBadge sousType={art.sous_type} /></td>
                    <td><VisibilityChip visibilite={art.visibilite} /></td>
                    <td className="ap-cell-date">
                      {new Date(art.date_publication).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="ap-cell-actions" onClick={e => e.stopPropagation()}>
                      {/* Toggle visibilité rapide */}
                      <button
                        className={`ap-vis-btn ${art.visibilite ? "is-visible" : "is-private"}`}
                        title={art.visibilite ? "Rendre privé" : "Rendre visible"}
                        onClick={() => handleToggleVisibility(art.document_id, !art.visibilite)}
                      >
                        {art.visibilite ? "🔒" : "🌐"}
                      </button>
                      {/* Voir détail */}
                      <button
                        className="ap-view-btn"
                        title="Voir le détail"
                        onClick={() => setSelected(art)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ap-table-footer">
              {filtered.length} article{filtered.length !== 1 ? "s" : ""} publié{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="ap-pagination">
              <span className="ap-page-info">Page {page} / {totalPages}</span>
              <div className="ap-page-btns">
                <button className="ap-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>←</button>
                {[...Array(totalPages)].map((_, i) => {
                  const n = i + 1;
                  if (n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                    return <button key={n} className={`ap-page-btn ${page === n ? "active" : ""}`} onClick={() => setPage(n)}>{n}</button>;
                  if (Math.abs(n - page) === 2) return <span key={n} className="ap-page-dots">…</span>;
                  return null;
                })}
                <button className="ap-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>→</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Panneau détail */}
      {selected && (
        <DetailPanel
          article={selected}
          onClose={() => setSelected(null)}
          onToggleVisibility={handleToggleVisibility}
          canToggle={isAdmin || String(selected.chercheur_id) === String(userId)}
        />
      )}
    </div>
  );
}