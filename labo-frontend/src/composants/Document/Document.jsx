import { useState, useEffect, useCallback, useMemo } from "react";
import "./Document.css";


/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const API_BASE = "http://localhost:8000/api";
const DOCUMENT_TYPES = ["ARTICLE", "ENQUETE", "IMAGE", "RAPPORT", "VIDEO", "CARTE"];
const TYPE_META = {
  ARTICLE: { icon: "📰", color: "#6366f1", label: "Article" },
  ENQUETE: { icon: "📋", color: "#8b5cf6", label: "Enquête" },
  IMAGE:   { icon: "🖼️", color: "#10b981", label: "Image" },
  RAPPORT: { icon: "📊", color: "#f59e0b", label: "Rapport" },
  VIDEO:   { icon: "🎬", color: "#ec4899", label: "Vidéo" },
  CARTE:   { icon: "🗺️", color: "#06b6d4", label: "Carte" },
};

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
const getToken = () => localStorage.getItem("token");

function getUserFromToken() {
  try {
    const token = getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { id: payload.id, role: payload.role };
  } catch { return null; }
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${getToken()}`, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || res.statusText);
  }
  return res.json();
}

function getRoleCapabilities(role) {
  switch (role) {
    case "ADMIN":
      return { canCreate: true, canEdit: true, canToggleVis: true, isAdmin: true, filterOwn: false };
    case "CHERCHEUR":
    case "CADRE_TECHNIQUE":
      return { canCreate: true, canEdit: true, canToggleVis: true, isAdmin: false, filterOwn: true };
    default:
      return { canCreate: false, canEdit: false, canToggleVis: false, isAdmin: false, filterOwn: false };
  }
}

/* ═══════════════════════════════════════════════════════════
   SOUS-COMPOSANTS
═══════════════════════════════════════════════════════════ */
function TypeBadge({ type }) {
  const m = TYPE_META[type] || { icon: "📄", color: "#888" };
  return <span className="doc-type-badge" style={{ "--bc": m.color }}>{m.icon} {m.label || type}</span>;
}

function VisibilityChip({ visibilite }) {
  return <span className={`doc-vis-chip ${visibilite ? "visible" : "private"}`}>{visibilite ? "🌐 Visible" : "🔒 Privé"}</span>;
}

function DocModal({ title, onClose, children }) {
  return (
    <div className="doc-modal-overlay" onClick={onClose}>
      <div className="doc-modal-box" onClick={e => e.stopPropagation()}>
        <div className="doc-modal-header">
          <h3>{title}</h3>
          <button className="doc-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="doc-modal-body">{children}</div>
      </div>
    </div>
  );
}

function EmptyState({ type, onAdd, hasFilters, onClear, canCreate }) {
  const m = type ? TYPE_META[type] : null;
  return (
    <div className="doc-empty">
      <div className="doc-empty-icon">{m ? m.icon : "📂"}</div>
      <p className="doc-empty-title">{hasFilters ? "Aucun résultat" : `Aucun ${m?.label?.toLowerCase() || "document"} trouvé`}</p>
      <p className="doc-empty-sub">{hasFilters ? "Ajustez vos filtres." : canCreate ? "Commencez par ajouter votre premier document." : "Aucun document disponible."}</p>
      {hasFilters
        ? <button className="doc-btn-ghost doc-btn-sm" onClick={onClear}>Effacer les filtres</button>
        : canCreate ? <button className="doc-btn-primary doc-btn-sm" onClick={onAdd}>+ Ajouter</button> : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DOC TABLE
═══════════════════════════════════════════════════════════ */
function DocTable({ docs, isArticle, onView, onEdit, onDelete, currentUserId, userRole }) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table">
        <thead>
          <tr>
            <th>Type</th>
            {isArticle && <th>Sous-type</th>}
            <th>Titre</th>
            <th>Auteur</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {docs.map(doc => (
            <tr key={doc.id} className="doc-row" onClick={() => onView(doc)}>
              <td><TypeBadge type={doc.type} /></td>
              {isArticle && (
                <td>{doc.sous_type
                  ? <span className="doc-sous-type">{doc.sous_type === "JOURNAL" ? "📰" : "🎤"} {doc.sous_type}</span>
                  : <span className="doc-faint">—</span>}
                </td>
              )}
              <td className="doc-title-cell">
                <span className="doc-title-text">{doc.titre}</span>
                {doc.mots_cles && <span className="doc-kw">{doc.mots_cles}</span>}
              </td>
              <td className="doc-cell-sm">{doc.auteur_nom || <span className="doc-faint">—</span>}</td>
              <td className="doc-cell-date">{new Date(doc.date_creation).toLocaleDateString("fr-FR")}</td>
              <td className="doc-cell-actions" onClick={e => e.stopPropagation()}>
                {/* Modifier — visible toujours, désactivé si pas auteur/admin */}
                {(() => {
                  const isAdmin  = userRole === "ADMIN";
                  const isAuthor = String(doc.auteur_id) === String(currentUserId);
                  const isProjCreator = doc.projet_createur_id != null &&
                                        String(doc.projet_createur_id) === String(currentUserId);
                  const allowed  = isAdmin || isAuthor || isProjCreator;
                  return (
                    <>
                      <button
                        className={`doc-act-btn${!allowed ? " doc-act-btn--disabled" : ""}`}
                        title={allowed ? "Modifier" : "Vous ne pouvez modifier que vos propres documents"}
                        disabled={!allowed}
                        onClick={allowed ? () => onEdit(doc) : undefined}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        className={`doc-act-btn doc-act-del${!allowed ? " doc-act-btn--disabled" : ""}`}
                        title={allowed ? "Supprimer" : "Vous ne pouvez supprimer que vos propres documents"}
                        disabled={!allowed}
                        onClick={allowed ? () => onDelete(doc.id) : undefined}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </>
                  );
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="doc-table-footer">{docs.length} document{docs.length !== 1 ? "s" : ""}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FORMULAIRE CLASSIQUE
   Utilisé pour :
     • Création depuis une carte de type (lockedType fourni, type non modifiable)
     • Modification d'un document (initial fourni, type en lecture seule)
   Le type est TOUJOURS connu à l'entrée — jamais vide.
═══════════════════════════════════════════════════════════ */
function ClassicDocumentForm({ initial, lockedType, onSubmit, onCancel, loading, role }) {
  const isEditing    = !!initial;
  const resolvedType = isEditing ? initial.type : lockedType;
  const typeMeta     = TYPE_META[resolvedType] || { icon: "📄", color: "#888", label: resolvedType };

  const [form, setForm] = useState({
    titre: "", description: "", mots_cles: "",
    type: resolvedType, projet_id: "",
    doi: "", resume: "", citation_APA: "",
    sous_type: "JOURNAL", journal: "", maison_edition: "",
    resolution: "", format: "", visibilite: false,
    date_creation: "",
    ...(initial || {}),
  });
  const [file,    setFile]    = useState(null);
  const [projets, setProjets] = useState([]);
  // ← Formater la date pour l'affichage
  useEffect(() => { 
  if (initial?.date_creation) {
    const formattedDate = new Date(initial.date_creation).toISOString().split('T')[0];

    setForm(prev => {
      if (prev.date_creation) return prev;
      return { ...prev, date_creation: formattedDate };
    });
  }
}, [initial]);
  useEffect(() => {
    const endpoint = role === "ADMIN" ? "/projet" : "/projet/mes-projets";
    apiFetch(endpoint).then(setProjets).catch(() => setProjets([]));
  }, [role]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = e => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("titre",       form.titre || "");
    fd.append("description", form.description || "");
    fd.append("mots_cles",   form.mots_cles || "");
    fd.append("type",        resolvedType);
    fd.append("projet_id",   form.projet_id || "");
    fd.append("visibilite",  form.visibilite ? "true" : "false");
    fd.append("lien",        form.lien || "");
     // ← AJOUTER LA DATE DE CRÉATION
    if (form.date_creation && form.date_creation.trim() !== "") {
      fd.append("date_creation", form.date_creation);
    }
    if (resolvedType === "ARTICLE") {
      fd.append("sous_type",      form.sous_type || "");
      fd.append("doi",            form.doi || "");
      fd.append("resume",         form.resume || "");
      fd.append("citation_APA",   form.citation_APA || "");
      fd.append("journal",        form.journal || "");
      fd.append("maison_edition", form.maison_edition || "");
    }
    if (resolvedType === "RAPPORT") fd.append("doi", form.doi || "");
    if (resolvedType === "IMAGE") {
      fd.append("resolution", form.resolution || "");
      fd.append("format",     form.format || "");
    }
    if (file) fd.append("file", file);
    onSubmit(fd);
  };

  return (
    <form className="doc-form" onSubmit={handleSubmit}>

      {/* ── Bandeau type verrouillé ── */}
      <div className="doc-form-type-locked" style={{ "--tc": typeMeta.color }}>
        <span className="doc-form-type-locked-icon">{typeMeta.icon}</span>
        <div className="doc-form-type-locked-info">
          <span className="doc-form-type-locked-label">
            {isEditing ? "Type de document" : "Type sélectionné"}
          </span>
          <span className="doc-form-type-locked-value">{typeMeta.label}</span>
        </div>
        <span className="doc-form-type-locked-badge">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          {isEditing ? "Non modifiable" : "Verrouillé"}
        </span>
      </div>

      <div className="doc-form-grid">
        <div className="doc-field doc-field-span">
          <label>Titre *</label>
          <input required value={form.titre} onChange={e => set("titre", e.target.value)} placeholder="Titre du document" />
        </div>
        {/* ← NOUVEAU CHAMP DATE DE CRÉATION */}
        <div className="doc-field">
          <label>Date de création</label>
          <input 
            type="date" 
            value={form.date_creation || ""} 
            onChange={e => set("date_creation", e.target.value)}
            placeholder="YYYY-MM-DD"
          />
          <small className="doc-field-hint">
            Laissez vide pour utiliser la date d'aujourd'hui
          </small>
        </div>

        <div className="doc-field doc-field-span">
          <label>Projet associé</label>
          <select value={form.projet_id || ""} onChange={e => set("projet_id", e.target.value)}>
            <option value="">— Aucun projet —</option>
            {projets.map(p => <option key={p.id} value={p.id}>{p.titre}</option>)}
          </select>
        </div>

        <div className="doc-field doc-field-span">
          <label>Description</label>
          <textarea value={form.description || ""} onChange={e => set("description", e.target.value)} rows={3} placeholder="Décrivez votre document…" />
        </div>

        <div className="doc-field doc-field-span">
          <label>Mots-clés</label>
          <input value={form.mots_cles || ""} onChange={e => set("mots_cles", e.target.value)} placeholder="mot1, mot2, …" />
        </div>

        <div className="doc-field doc-field-span">
          <label>Visibilité du document</label>
          <div
            className={`doc-visibility-toggle ${form.visibilite ? "on" : "off"}`}
            onClick={() => set("visibilite", !form.visibilite)}
            role="switch" aria-checked={form.visibilite} tabIndex={0}
            onKeyDown={e => e.key === " " && set("visibilite", !form.visibilite)}
          >
            <span className="doc-vis-track"><span className="doc-vis-thumb" /></span>
            <div className="doc-vis-text">
              <span className="doc-vis-state">{form.visibilite ? "🌐 Visible" : "🔒 Privé"}</span>
              <small className="doc-field-hint">
                {form.visibilite ? "Visible par tous les utilisateurs connectés" : "Visible uniquement par vous et l'administrateur"}
              </small>
            </div>
          </div>
        </div>

        {resolvedType === "RAPPORT" && (
          <div className="doc-field doc-field-span">
            <label>DOI</label>
            <input value={form.doi || ""} onChange={e => set("doi", e.target.value)} placeholder="10.xxxx/xxxxx" />
          </div>
        )}

        {resolvedType === "ARTICLE" && (<>
          <div className="doc-field">
            <label>Sous-type *</label>
            <select value={form.sous_type} onChange={e => set("sous_type", e.target.value)}
              disabled={isEditing} className={isEditing ? "doc-field-locked" : ""}>
              <option value="JOURNAL">📰 Journal</option>
              <option value="CONFERENCE">🎤 Conférence</option>
            </select>
            {isEditing && <small className="doc-field-hint">Le sous-type ne peut pas être modifié</small>}
          </div>
          <div className="doc-field">
            <label>DOI</label>
            <input value={form.doi || ""} onChange={e => set("doi", e.target.value)} placeholder="10.xxxx/xxxxx" />
          </div>
          <div className="doc-field">
            <label>Citation APA</label>
            <input value={form.citation_APA || ""} onChange={e => set("citation_APA", e.target.value)} />
          </div>
          <div className="doc-field doc-field-span">
            <label>Résumé</label>
            <textarea value={form.resume || ""} onChange={e => set("resume", e.target.value)} rows={2} />
          </div>
          <div className="doc-field">
            <label>Journal</label>
            <input value={form.journal || ""} onChange={e => set("journal", e.target.value)} />
          </div>
          <div className="doc-field">
            <label>Maison d'édition</label>
            <input value={form.maison_edition || ""} onChange={e => set("maison_edition", e.target.value)} />
          </div>
        </>)}

        {resolvedType === "IMAGE" && (<>
          <div className="doc-field">
            <label>Résolution</label>
            <input value={form.resolution || ""} onChange={e => set("resolution", e.target.value)} placeholder="1920x1080" />
          </div>
          <div className="doc-field">
            <label>Format</label>
            <input value={form.format || ""} onChange={e => set("format", e.target.value)} placeholder="jpg, png…" />
          </div>
        </>)}

        <div className="doc-field doc-field-span">
          <label>Fichier</label>
          <input type="file" onChange={e => setFile(e.target.files[0])} />
          {form.lien && (
            <div className="doc-field-current-file">
              <small className="file-current" style={{ marginRight: "12px" }}>Fichier actuel : {form.lien.split(/[\\/]/).pop()}</small>
              <button type="button" className="doc-btn-danger" onClick={() => { setFile(null); set("lien", ""); }}>Supprimer le fichier</button>
            </div>
          )}
        </div>
      </div>

      <div className="doc-form-actions">
        <button type="button" className="doc-btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="doc-btn-primary" disabled={loading}>
          {loading ? <><span className="doc-btn-spinner" /> Enregistrement…</> : isEditing ? "✎ Enregistrer" : "+ Créer"}
        </button>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════════
   PANNEAU DÉTAIL
═══════════════════════════════════════════════════════════ */
function DetailPanel({ doc, onClose, onDelete, onEdit, onToggleVisibility,onPublish, currentUserId, userRole, canEdit, canToggleVis }) {
  const m = TYPE_META[doc.type] || { icon: "📄", color: "#888" };
  const isArticle = doc.type === "ARTICLE";
  const isAdmin   = userRole === "ADMIN";
  const isAuthor  = String(doc.auteur_id) === String(currentUserId);
  const canPublish = isArticle && (isAdmin || isAuthor);

  const getFileUrl  = lien => lien ? `http://localhost:8000/${lien.replace(/\\/g, "/")}` : null;
  const getExt      = lien => lien ? lien.split(".").pop().toLowerCase() : "";
  const getBasename = lien => lien ? lien.split(/[\\/]/).pop() : "";

  const handleDownload = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents/${doc.id}/download`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${doc.titre}.${getExt(doc.lien)}`;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(url); a.remove();
    } catch { alert("Erreur lors du téléchargement"); }
  };

  const ext   = getExt(doc.lien);
  const isImg = ["jpg","jpeg","png","gif","svg","webp"].includes(ext);
  const isPdf = ext === "pdf";
  const isVid = ["mp4","webm","avi","mov","mkv"].includes(ext);

  return (
    <>
      <div className="doc-panel-backdrop" onClick={onClose} />
      <div className="doc-detail-panel">
        <div className="doc-panel-header">
          <div className="doc-panel-header-left">
            <span className="doc-panel-icon" style={{ color: m.color }}>{m.icon}</span>
            <span className="doc-panel-title">Détail du document</span>
          </div>
          <button className="doc-panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="doc-panel-body">
          <div className="doc-panel-hero" style={{ "--hc": m.color }}>
            <div className="doc-panel-hero-title">{doc.titre}</div>
            <div className="doc-panel-chips">
              <TypeBadge type={doc.type} />
              <VisibilityChip visibilite={doc.visibilite} />
              {isArticle && doc.sous_type && (
                <span className="doc-chip-sub">{doc.sous_type === "JOURNAL" ? "📰" : "🎤"} {doc.sous_type}</span>
              )}
            </div>
          </div>
          <dl className="doc-panel-meta">
            {doc.auteur_nom && <><dt>Auteur</dt><dd>{doc.auteur_nom}{doc.auteur_email && <em> · {doc.auteur_email}</em>}</dd></>}
            {doc.projet_titre    && <><dt>Projet</dt><dd>📁 {doc.projet_titre}</dd></>}
            <dt>Date de création</dt>
            <dd>{new Date(doc.date_creation).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</dd>
            {doc.mots_cles       && <><dt>Mots-clés</dt><dd>{doc.mots_cles}</dd></>}
            {doc.description     && <><dt>Description</dt><dd>{doc.description}</dd></>}
            {doc.doi             && <><dt>DOI</dt><dd><a href={`https://doi.org/${doc.doi}`} target="_blank" rel="noreferrer">{doc.doi}</a></dd></>}
            {doc.resume          && <><dt>Résumé</dt><dd>{doc.resume}</dd></>}
            {doc.citation_apa    && <><dt>APA</dt><dd>{doc.citation_apa}</dd></>}
            {doc.journal         && <><dt>Journal</dt><dd>{doc.journal}</dd></>}
            {doc.maison_edition  && <><dt>Maison d'édition</dt><dd>{doc.maison_edition}</dd></>}
            {doc.resolution      && <><dt>Résolution</dt><dd>{doc.resolution}</dd></>}
            {doc.format          && <><dt>Format</dt><dd>{doc.format}</dd></>}
          </dl>
          {doc.lien && (
            <div className="doc-panel-file">
              {isImg && <img src={getFileUrl(doc.lien)} alt={doc.titre} className="doc-panel-preview" />}
              {isVid && <video controls className="doc-panel-preview"><source src={getFileUrl(doc.lien)} /></video>}
              {isPdf && <iframe src={getFileUrl(doc.lien)} title={doc.titre} className="doc-panel-iframe" />}
              <div className="doc-panel-file-actions">
                <a href={getFileUrl(doc.lien)} target="_blank" rel="noreferrer" className="doc-file-link"
                  style={{ color: m.color, borderColor: `${m.color}40`, background: `${m.color}10` }}>
                  👁️ Ouvrir {ext.toUpperCase()}
                </a>
                <button onClick={handleDownload} className="doc-file-dl">⬇️ Télécharger</button>
              </div>
              <small className="doc-faint">📁 {getBasename(doc.lien)}</small>
            </div>
          )}
        </div>
        <div className="doc-panel-footer">
          {canEdit && <button className="doc-btn-ghost" onClick={() => onEdit(doc)}>✎ Modifier</button>}
          {/* ← BOUTON PUBLIER */}
          {canPublish && (
            <button
              className="doc-btn-publish"
              onClick={() => onPublish(doc.id)}
              title="Publier cet article dans la table publication"
            >
              🚀 Publier
            </button>
          )}
          {canToggleVis && (
            <button className={`doc-btn-vis ${doc.visibilite ? "private" : "visible"}`}
              onClick={() => onToggleVisibility(doc.id, !doc.visibilite)}>
              {doc.visibilite ? "🔒 Rendre privé" : "🌐 Rendre visible"}
            </button>
          )}
          {canEdit && <button className="doc-btn-danger" onClick={() => onDelete(doc.id)}>🗑️ Supprimer</button>}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function Document({ role: propRole, initialFilterUserId = null }) {
  const [docs,        setDocs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [activeType,  setActiveType]  = useState(null);
  const [selected,    setSelected]    = useState(null);
  /*
    editing.__mode :
      "ai"   → modal IA (+ Nouveau)
      "add"  → formulaire classique création depuis carte (type verrouillé)
      "edit" → formulaire classique modification
  */
  const [editing,      setEditing]      = useState(null);
  const [formLoading,  setFormLoading]  = useState(false);
  const [confirm,      setConfirm]      = useState(null);
  const [toast,        setToast]        = useState(null);
  const [search,       setSearch]       = useState("");
  const [yearFilter,   setYearFilter]   = useState("ALL");
  const [visFilter,    setVisFilter]    = useState("ALL");
  const [page,         setPage]         = useState(1);
  const [globalQ,      setGlobalQ]      = useState("");
  const perPage = 10;
  const [expandedView, setExpandedView] = useState(false);
  const [filterUserId, setFilterUserId] = useState(initialFilterUserId);

  const currentUser = propRole ? { role: propRole, id: getUserFromToken()?.id } : getUserFromToken();
  const currentUserId = currentUser?.id;
  const caps = getRoleCapabilities(currentUser?.role);

  useEffect(() => {
    if (filterUserId) return;
    const userId = sessionStorage.getItem('filterUserId');
    //const userName = sessionStorage.getItem('filterUserName');
    
    if (userId) {
      setFilterUserId(parseInt(userId));
      //showToast(`Affichage des documents de ${userName || 'cet utilisateur'}`, 'info');
      sessionStorage.removeItem('filterUserId');
      sessionStorage.removeItem('filterUserName');
    }
  }, []);
  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3200); };

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try { 
       if (filterUserId && caps.isAdmin) {
        setDocs(await apiFetch(`/documents/user/${filterUserId}`));
      } else {
        setDocs(await apiFetch("/documents"));
      }
    }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [filterUserId, caps.isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);
  // ── Lecture filtre depuis sessionStorage (appelé depuis Admin) ──
useEffect(() => {
  const typeFilter = sessionStorage.getItem('docTypeFilter');
  const openId     = sessionStorage.getItem('docOpenId');

  if (typeFilter) {
    setActiveType(typeFilter);
    setExpandedView(true);
    sessionStorage.removeItem('docTypeFilter');
  }

  if (openId) {
    // Attendre que les docs soient chargés puis ouvrir le détail
    const tryOpen = setInterval(() => {
      setDocs(current => {
        const found = current.find(d => String(d.id) === String(openId));
        if (found) {
          clearInterval(tryOpen);
          apiFetch(`/documents/${openId}`)
            .then(setSelected)
            .catch(() => {});
          sessionStorage.removeItem('docOpenId');
        }
        return current;
      });
    }, 200);
    // Timeout sécurité
    setTimeout(() => clearInterval(tryOpen), 5000);
  }
}, []);

   const visibleDocs = useMemo(() => {
  let result = caps.filterOwn ? docs.filter(d => d.auteur_id === currentUserId) : [...docs];
  
  if (filterUserId && caps.isAdmin) {
    result = result.filter(d => d.auteur_id === filterUserId);
  }
  
  return result;
}, [docs, caps.filterOwn, caps.isAdmin, currentUserId, filterUserId]);
  const countByType = DOCUMENT_TYPES.reduce((acc, t) => { acc[t] = visibleDocs.filter(d => d.type === t).length; return acc; }, {});
  const typeDocs    = activeType ? visibleDocs.filter(d => d.type === activeType) : [];
  const years       = [...new Set(typeDocs.map(d => new Date(d.date_creation).getFullYear()))].sort((a, b) => b - a);
  const isArticle   = activeType === "ARTICLE";

  const matchSearch = (d, q) => {
    const lq = q.toLowerCase();
    return d.titre?.toLowerCase().includes(lq) || d.auteur_nom?.toLowerCase().includes(lq) ||
      d.mots_cles?.toLowerCase().includes(lq) || d.projet_titre?.toLowerCase().includes(lq) ||
      new Date(d.date_creation).toLocaleDateString("fr-FR").includes(lq);
  };

  const filtered = typeDocs.filter(d => {
    const matchS = !search    || matchSearch(d, search);
    const matchY = yearFilter === "ALL" || new Date(d.date_creation).getFullYear().toString() === yearFilter;
    const matchV = visFilter  === "ALL" || (visFilter === "VISIBLE" ? d.visibilite : !d.visibilite);
    return matchS && matchY && matchV;
  });

  const totalPages    = Math.ceil(filtered.length / perPage);
  const paginated     = filtered.slice((page - 1) * perPage, page * perPage);
  const globalResults = globalQ.trim() ? docs.filter(d => matchSearch(d, globalQ)) : [];
  const statsTotal    = visibleDocs.length;
  const statsPublic   = visibleDocs.filter(d => d.visibilite).length;
  const statsPrivate  = visibleDocs.filter(d => !d.visibilite).length;

  const handleCreate = async fd => {
    setFormLoading(true);
    try { await apiFetch("/documents", { method: "POST", body: fd }); showToast("Document créé ✓"); setEditing(null); loadData(); }
    catch (e) { showToast(e.message, "error"); }
    finally { setFormLoading(false); }
  };

  const handleUpdate = async fd => {
    setFormLoading(true);
    try { await apiFetch(`/documents/${editing.id}`, { method: "PUT", body: fd }); showToast("Mis à jour ✓"); setEditing(null); setSelected(null); loadData(); }
    catch (e) { showToast(e.message, "error"); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async id => {
    try { await apiFetch(`/documents/${id}`, { method: "DELETE" }); showToast("Supprimé"); setConfirm(null); setSelected(null); loadData(); }
    catch (e) { showToast(e.message, "error"); }
  };

  const handleToggleVisibility = async (id, newVal) => {
    try {
      await apiFetch(`/documents/${id}/visibilite`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibilite: newVal }) });
      showToast(newVal ? "Document rendu visible 🌐" : "Document rendu privé 🔒");
      setSelected(null); loadData();
    } catch (e) { showToast(e.message, "error"); }
  };

  const openDetail = async doc => { try { setSelected(await apiFetch(`/documents/${doc.id}`)); } catch { setSelected(doc); } };

  const selectType = t => {
    if (activeType === t && expandedView) { setExpandedView(false); setActiveType(null); }
    else if (activeType === t) { setExpandedView(true); }
    else { setActiveType(t); setExpandedView(true); setSearch(""); setYearFilter("ALL"); setVisFilter("ALL"); setPage(1); setSelected(null); }
  };

  const clearFilters = () => { setSearch(""); setYearFilter("ALL"); setVisFilter("ALL"); };

  const classicModalTitle = () => {
    if (!editing) return "";
    if (editing.__mode === "add")  return `Ajouter — ${TYPE_META[editing.type]?.label || editing.type}`;
    if (editing.__mode === "edit") return `Modifier — ${editing.titre}`;
    return "";
  };
  const handlePublish = async (docId) => {
  try {
    await apiFetch(`/documents/${docId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    showToast("Article publié avec succès ✓");
    setSelected(null);
    loadData();
  } catch (e) {
    showToast(e.message, "error");
  }
};

  return (
    <div className="doc-root">
      {toast && <div className={`doc-toast doc-toast-${toast.type}`}>{toast.type === "success" ? "✓" : "⚠"} {toast.msg}</div>}
       {/* ✅ AJOUTER L'INDICATEUR DE FILTRE ICI */}
      {filterUserId && caps.isAdmin && (
        <div className="doc-active-filter">
          <span className="doc-filter-badge">
            <svg className="ad-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
             Filtré par utilisateur
            <button onClick={() => { setFilterUserId(null); loadData(); showToast('Filtre supprimé', 'info'); }}>
              ✕
            </button>
          </span>
        </div>
      )}
      {/* ══ HEADER ══ */}
      <div className="doc-header">
        <div className="doc-header-left">
          <h2 className="doc-header-title">Mes documents</h2>
          {!loading && (
            <div className="doc-header-stats">
              <span className="doc-stat-pill"><strong>{statsTotal}</strong> total</span>
              <span className="doc-stat-pill pub"><strong>{statsPublic}</strong> visibles</span>
              <span className="doc-stat-pill priv"><strong>{statsPrivate}</strong> privés</span>
            </div>
          )}
        </div>
        <div className="doc-header-right">
          <div className="doc-search-global">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              placeholder={caps.isAdmin ? "Rechercher par auteur, titre, mots-clés, projet, date…" : "Rechercher dans mes documents…"}
              value={globalQ} onChange={e => setGlobalQ(e.target.value)}
            />
            {globalQ && <button onClick={() => setGlobalQ("")}>✕</button>}
          </div>
          
        </div>
      </div>

      {/* ══ BODY ══ */}
      <div className="doc-body">
        {globalQ.trim() ? (
          <div className="doc-section">
            <div className="doc-section-label">{globalResults.length} résultat{globalResults.length !== 1 ? "s" : ""} pour « {globalQ} »</div>
            {globalResults.length === 0 ? (
              <div className="doc-empty">
                <div><svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div>
                <p className="doc-empty-title">Aucun résultat</p>
              </div>
            ) : (
              <DocTable
                docs={globalResults}
                isArticle={false}
                canEdit={caps.canEdit}
                onView={openDetail}
                onEdit={doc => { setEditing({ __mode: "edit", ...doc }); }}
                onDelete={id => setConfirm(id)}
                currentUserId={currentUserId}
                userRole={currentUser?.role}
              />
            )}
          </div>
        ) : (
          <>
            <div className="doc-section">
              {!loading && !error && (
                <div className={`doc-type-grid ${expandedView ? "expanded" : "compact"}`}>
                  {DOCUMENT_TYPES.map(t => {
                    const m = TYPE_META[t];
                    const count = countByType[t];
                    const active = activeType === t;
                    return (
                      <button key={t} className={`doc-type-card ${active ? "active" : ""} ${count === 0 ? "empty" : ""}`}
                        style={{ "--tc": m.color }} onClick={() => selectType(t)}>
                        <span className="doc-type-card-icon">{m.icon}</span>
                        <span className="doc-type-card-label">{m.label}</span>
                        <span className="doc-type-card-count">{count}</span>
                        {active && <span className="doc-type-card-active-bar" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {activeType && (
              <div className="doc-section">
                <div className="doc-filters-bar">
                  <div className="doc-filter-type-badge" style={{ "--tc": TYPE_META[activeType].color }}>
                    {TYPE_META[activeType].icon} {TYPE_META[activeType].label}s
                  </div>
                  <div className="doc-filter-search">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                    </svg>
                    <input placeholder="Filtrer…" value={search}
                      onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ backgroundColor: "#fefcfc" }} />
                    {search && <button onClick={() => setSearch("")}>✕</button>}
                  </div>
                  <select className="doc-filter-sel" value={yearFilter}
                    onChange={e => { setYearFilter(e.target.value); setPage(1); }} style={{ backgroundColor: "#fefcfc" }}>
                    <option value="ALL">Toutes les années</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select className="doc-filter-sel" value={visFilter}
                    onChange={e => { setVisFilter(e.target.value); setPage(1); }} style={{ backgroundColor: "#fefcfc" }}>
                    <option value="ALL">Toutes visibilités</option>
                    <option value="VISIBLE">🌐 Visible</option>
                    <option value="PRIVATE">🔒 Privé</option>
                  </select>
                  <span className="doc-filter-count">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</span>
                  {caps.canCreate && (
                    /* Ouvre le formulaire classique avec type verrouillé */
                    <button className="doc-btn-primary doc-btn-sm" style={{ marginLeft: "auto" }}
                      onClick={() => setEditing({ __mode: "add", type: activeType })}>
                      + Ajouter
                    </button>
                  )}
                </div>

                {filtered.length === 0 ? (
                  <EmptyState type={activeType} onAdd={() => setEditing({ __mode: "add", type: activeType })}
                    hasFilters={!!(search || yearFilter !== "ALL" || visFilter !== "ALL")}
                    onClear={clearFilters} canCreate={caps.canCreate} />
                ) : (
                  <>
                    <DocTable
                      docs={paginated}
                      isArticle={isArticle}
                      canEdit={caps.canEdit}
                      onView={openDetail}
                      onEdit={doc => { setEditing({ __mode: "edit", ...doc }); }}
                      onDelete={id => setConfirm(id)}
                      currentUserId={currentUserId}
                      userRole={currentUser?.role}
                    />
                    {totalPages > 1 && (
                      <div className="doc-pagination">
                        <span className="doc-page-info">Page {page} / {totalPages}</span>
                        <div className="doc-page-btns">
                          <button className="doc-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>←</button>
                          {[...Array(totalPages)].map((_, i) => {
                            const n = i + 1;
                            if (n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                              return <button key={n} className={`doc-page-btn ${page === n ? "active" : ""}`} onClick={() => setPage(n)}>{n}</button>;
                            if (Math.abs(n - page) === 2) return <span key={n} className="doc-page-dots">…</span>;
                            return null;
                          })}
                          <button className="doc-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>→</button>
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

      {/* ══ PANNEAU DÉTAIL ══ */}
      {selected && !editing && (
        <DetailPanel doc={selected} onClose={() => setSelected(null)}
          onDelete={id => { setConfirm(id); setSelected(null); }}
          onEdit={doc => { setEditing({ __mode: "edit", ...doc }); setSelected(null); }}
          onToggleVisibility={handleToggleVisibility}
          onPublish={handlePublish}
          currentUserId={currentUserId}
          userRole={currentUser?.role}
          canEdit={
            caps.isAdmin ||
            selected?.auteur_id === currentUserId ||
            (selected?.projet_createur_id != null && selected?.projet_createur_id === currentUserId)
          }
          canToggleVis={
            (caps.isAdmin || selected?.auteur_id === currentUserId) &&
            (selected?.type !== "ARTICLE" || selected?.publie === true)
          }
        />
      )}

      {/* ══ MODAL CLASSIQUE — "+ Ajouter" depuis carte (type verrouillé) ══ */}
      {editing?.__mode === "add" && (
        <DocModal title={classicModalTitle()} onClose={() => setEditing(null)}>
          <ClassicDocumentForm
            lockedType={editing.type}
            onSubmit={handleCreate}
            onCancel={() => setEditing(null)}
            loading={formLoading}
            role={currentUser?.role}
          />
        </DocModal>
      )}

      {/* ══ MODAL CLASSIQUE — Modifier ══ */}
      {editing?.__mode === "edit" && (
        <DocModal title={classicModalTitle()} onClose={() => setEditing(null)}>
          <ClassicDocumentForm
            initial={editing}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            loading={formLoading}
            role={currentUser?.role}
          />
        </DocModal>
      )}

      {/* ══ CONFIRMATION SUPPRESSION ══ */}
      {confirm && (
        <DocModal title="Confirmer la suppression" onClose={() => setConfirm(null)}>
          <div className="doc-confirm">
            <div className="doc-confirm-icon">🗑️</div>
            <p>Cette action est <strong>irréversible</strong>. Le document et son fichier seront définitivement supprimés.</p>
            <div className="doc-form-actions">
              <button className="doc-btn-ghost" onClick={() => setConfirm(null)}>Annuler</button>
              <button className="doc-btn-danger" onClick={() => handleDelete(confirm)}>Supprimer définitivement</button>
            </div>
          </div>
        </DocModal>
      )}
    </div>
  );
}