import { useState, useEffect, useCallback } from "react";
import "./Doc.css";

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

const getToken = () => localStorage.getItem("token");

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {})
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || res.statusText);
  }
  return res.json();
}

function getUserFromToken() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { id: payload.id, role: payload.role };
  } catch {
    return null;
  }
}

function TypeBadge({ type }) {
  const m = TYPE_META[type] || { icon: "📄", color: "#888" };
  return <span className="doc-type-badge" style={{ "--bc": m.color }}>{m.icon} {m.label || type}</span>;
}

function VisibilityChip({ visibilite }) {
  return (
    <span className={`doc-vis-chip ${visibilite ? "public" : "private"}`}>
      {visibilite ? "🌐 Public" : "🔒 Privé"}
    </span>
  );
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

function DocumentForm({ initial, defaultType, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    titre: "", description: "", mots_cles: "",
    type: defaultType || "RAPPORT", projet_id: "",
    doi: "", resume: "", citation_APA: "",
    sous_type: "JOURNAL", journal: "", maison_edition: "",
    resolution: "", format: "",
    visibilite: false,
    ...(initial || {}),
  });
  const [file, setFile] = useState(null);
  const [projets, setProjets] = useState([]);

  useEffect(() => {
    apiFetch("/projet/mes-projets").then(setProjets).catch(() => setProjets([]));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = e => {
    e.preventDefault();
    const fd = new FormData();
    ["titre", "description", "mots_cles", "type"].forEach(k => {
      if (form[k] !== undefined && form[k] !== "") fd.append(k, form[k]);
    });
    if (form.projet_id && form.projet_id !== "") fd.append("projet_id", form.projet_id);
    fd.append("visibilite", form.visibilite ? "true" : "false");

    if (form.type === "ARTICLE") {
      if (form.sous_type)    fd.append("sous_type", form.sous_type);
      if (form.doi)          fd.append("doi", form.doi);
      if (form.resume)       fd.append("resume", form.resume);
      if (form.citation_APA) fd.append("citation_APA", form.citation_APA);
      if (form.journal)      fd.append("journal", form.journal);
      if (form.maison_edition) fd.append("maison_edition", form.maison_edition);
    }
    if (form.type === "RAPPORT" && form.doi) fd.append("doi", form.doi);
    if (form.type === "IMAGE") {
      if (form.resolution) fd.append("resolution", form.resolution);
      if (form.format)     fd.append("format", form.format);
    }
    if (file) fd.append("file", file);
    onSubmit(fd);
  };
  

  return (
    <form className="doc-form" onSubmit={handleSubmit}>
      <div className="doc-form-grid">
        <div className="doc-field doc-field-span">
          <label>Titre *</label>
          <input required value={form.titre} onChange={e => set("titre", e.target.value)} placeholder="Titre du document" />
        </div>

        <div className="doc-field">
          <label>Type *</label>
          <select
            value={form.type}
            onChange={e => {
              const t = e.target.value;
              setForm(f => ({
                ...f, type: t,
                ...(t !== "ARTICLE" ? { doi: "", resume: "", citation_APA: "", sous_type: "JOURNAL", journal: "", maison_edition: "" } : {}),
                ...(t !== "RAPPORT" ? { doi: "" } : {}),
                ...(t !== "IMAGE"   ? { resolution: "", format: "" } : {}),
              }));
            }}
            disabled={!!initial || (!!defaultType && !initial)}
            className={initial ? "doc-field-locked" : ""}
          >
            {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t]?.icon} {TYPE_META[t]?.label}</option>)}
          </select>
          {initial && <small className="doc-field-hint">Le type ne peut pas être modifié</small>}
        </div>

        <div className="doc-field">
          <label>Projet associé</label>
          <select value={form.projet_id || ""} onChange={e => set("projet_id", e.target.value || null)}>
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
            role="switch"
            aria-checked={form.visibilite}
            tabIndex={0}
            onKeyDown={e => e.key === " " && set("visibilite", !form.visibilite)}
          >
            <span className="doc-vis-track"><span className="doc-vis-thumb" /></span>
            <div className="doc-vis-text">
              <span className="doc-vis-state">{form.visibilite ? "🌐 Public" : "🔒 Privé"}</span>
              <small className="doc-field-hint">
                {form.visibilite
                  ? "Visible par tous les utilisateurs connectés"
                  : "Visible uniquement par vous et l'administrateur"}
              </small>
            </div>
          </div>
        </div>

        {form.type === "RAPPORT" && (
          <div className="doc-field doc-field-span">
            <label>DOI</label>
            <input value={form.doi || ""} onChange={e => set("doi", e.target.value)} placeholder="10.xxxx/xxxxx" />
          </div>
        )}

        {form.type === "ARTICLE" && (<>
          <div className="doc-field">
            <label>Sous-type *</label>
            <select value={form.sous_type || "JOURNAL"} onChange={e => set("sous_type", e.target.value)}
              disabled={!!initial} className={initial ? "doc-field-locked" : ""}>
              <option value="JOURNAL">📰 Journal</option>
              <option value="CONFERENCE">🎤 Conférence</option>
            </select>
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

        {form.type === "IMAGE" && (<>
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
          {initial?.lien && (
            <small className="doc-field-hint">Fichier actuel : {initial.lien.split(/[\\/]/).pop()} — laisser vide pour conserver</small>
          )}
        </div>
      </div>

      <div className="doc-form-actions">
        <button type="button" className="doc-btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="doc-btn-primary" disabled={loading}>
          {loading ? <><span className="doc-btn-spinner" /> Enregistrement…</> : initial ? "✎ Enregistrer" : "+ Créer"}
        </button>
      </div>
    </form>
  );
}

function DetailPanel({ doc, onClose, onDelete, onEdit, onToggleVisibility }) {
  const m = TYPE_META[doc.type] || { icon: "📄", color: "#888" };
  const isArticle = doc.type === "ARTICLE";
  const getFileUrl  = lien => lien ? `http://localhost:8000/${lien.replace(/\\/g, "/")}` : null;
  const getExt      = lien => lien ? lien.split(".").pop().toLowerCase() : "";
  const getBasename = lien => lien ? lien.split(/[\\/]/).pop() : "";
  
  const handleDownload = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Erreur");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; 
      a.download = `${doc.titre}.${getExt(doc.lien)}`;
      document.body.appendChild(a); 
      a.click();
      URL.revokeObjectURL(url); 
      a.remove();
    } catch { 
      alert("Erreur lors du téléchargement"); 
    }
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
                <span className="doc-chip-sub">
                  {doc.sous_type === "JOURNAL" ? "📰" : "🎤"} {doc.sous_type}
                </span>
              )}
            </div>
          </div>

          <dl className="doc-panel-meta">
            {doc.projet_titre && <><dt>Projet</dt><dd>📁 {doc.projet_titre}</dd></>}
            <dt>Date de création</dt>
            <dd>{new Date(doc.date_creation).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</dd>
            {doc.mots_cles && <><dt>Mots-clés</dt><dd>{doc.mots_cles}</dd></>}
            {doc.description && <><dt>Description</dt><dd>{doc.description}</dd></>}
            {doc.doi && <><dt>DOI</dt><dd><a href={`https://doi.org/${doc.doi}`} target="_blank" rel="noreferrer">{doc.doi}</a></dd></>}
            {doc.resume && <><dt>Résumé</dt><dd>{doc.resume}</dd></>}
            {doc.citation_apa && <><dt>APA</dt><dd>{doc.citation_apa}</dd></>}
            {doc.journal && <><dt>Journal</dt><dd>{doc.journal}</dd></>}
            {doc.maison_edition && <><dt>Maison d'édition</dt><dd>{doc.maison_edition}</dd></>}
            {doc.resolution && <><dt>Résolution</dt><dd>{doc.resolution}</dd></>}
            {doc.format && <><dt>Format</dt><dd>{doc.format}</dd></>}
          </dl>

          {doc.lien && (
            <div className="doc-panel-file">
              {isImg && <img src={getFileUrl(doc.lien)} alt={doc.titre} className="doc-panel-preview" />}
              {isVid && <video controls className="doc-panel-preview"><source src={getFileUrl(doc.lien)} /></video>}
              {isPdf && <iframe src={getFileUrl(doc.lien)} title={doc.titre} className="doc-panel-iframe" />}
              <div className="doc-panel-file-actions">
                <a href={getFileUrl(doc.lien)} target="_blank" rel="noreferrer"
                   className="doc-file-link" style={{ color: m.color, borderColor: `${m.color}40`, background: `${m.color}10` }}>
                  👁️ Ouvrir {ext.toUpperCase()}
                </a>
                <button onClick={handleDownload} className="doc-file-dl">⬇️ Télécharger</button>
              </div>
              <small className="doc-faint">📁 {getBasename(doc.lien)}</small>
            </div>
          )}
        </div>

        <div className="doc-panel-footer">
          <button className="doc-btn-ghost" onClick={() => onEdit(doc)}>✎ Modifier</button>
          <button
            className={`doc-btn-vis ${doc.visibilite ? "private" : "public"}`}
            onClick={() => onToggleVisibility(doc.id, !doc.visibilite)}
            title={doc.visibilite ? "Rendre privé" : "Rendre public"}
          >
            {doc.visibilite ? "🔒 Rendre privé" : "🌐 Rendre public"}
          </button>
          
          <button className="doc-btn-danger" onClick={() => onDelete(doc.id)}>🗑️ Supprimer</button>
        </div>
      </div>
    </>
  );
}

function EmptyState({ type, onAdd, hasFilters, onClear }) {
  const m = type ? TYPE_META[type] : null;
  return (
    <div className="doc-empty">
      <div className="doc-empty-icon">{m ? m.icon : "📂"}</div>
      <p className="doc-empty-title">{hasFilters ? "Aucun résultat" : `Aucun ${m?.label?.toLowerCase() || "document"} trouvé`}</p>
      <p className="doc-empty-sub">{hasFilters ? "Ajustez vos filtres." : "Commencez par ajouter votre premier document."}</p>
      {hasFilters
        ? <button className="doc-btn-ghost doc-btn-sm" onClick={onClear}>Effacer les filtres</button>
        : <button className="doc-btn-primary doc-btn-sm" onClick={onAdd}>+ Ajouter</button>}
    </div>
  );
}

export default function Doc() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeType, setActiveType] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [visFilter, setVisFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [globalQ, setGlobalQ] = useState("");

  const currentUser = getUserFromToken();
  const currentUserId = currentUser?.id;
  const currentRole   = currentUser?.role;
  const needsFilter = currentRole === "CHERCHEUR" || currentRole === "CADRE_TECHNIQUE";

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const loadData = useCallback(async () => {
    setLoading(true); 
    setError(null);
    try {
      const all = await apiFetch("/documents");
      // Le backend filtre déjà les documents selon les permissions
      setDocs(all);
    } catch (e) { 
      setError(e.message); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const myDocs = needsFilter ? docs.filter(d => d.auteur_id === currentUserId) : docs;
  const countByType = DOCUMENT_TYPES.reduce((acc, t) => {
    acc[t] = myDocs.filter(d => d.type === t).length;
    return acc;
  }, {});

  const typeDocs = activeType ? myDocs.filter(d => d.type === activeType) : [];
  const years = [...new Set(typeDocs.map(d => new Date(d.date_creation).getFullYear()))].sort((a, b) => b - a);
  const isArticle = activeType === "ARTICLE";

  const matchSearch = (d, q) => {
    const lq = q.toLowerCase();
    return (
      d.titre?.toLowerCase().includes(lq) ||
      d.mots_cles?.toLowerCase().includes(lq) ||
      d.projet_titre?.toLowerCase().includes(lq) ||
      new Date(d.date_creation).toLocaleDateString("fr-FR").includes(lq)
    );
  };

  const filtered = typeDocs.filter(d => {
    const matchS = !search || matchSearch(d, search);
    const matchY = yearFilter === "ALL" || new Date(d.date_creation).getFullYear().toString() === yearFilter;
    const matchV = visFilter === "ALL" || (visFilter === "PUBLIC" ? d.visibilite : !d.visibilite);
    return matchS && matchY && matchV;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated  = filtered.slice((page - 1) * perPage, page * perPage);
  const globalResults = globalQ.trim() ? docs.filter(d => matchSearch(d, globalQ)) : [];

  const handleCreate = async fd => {
    setFormLoading(true);
    try { 
      await apiFetch("/documents", { method: "POST", body: fd }); 
      showToast("Document créé ✓"); 
      setEditing(null); 
      loadData(); 
    } catch (e) { 
      showToast(e.message, "error"); 
    } finally { 
      setFormLoading(false); 
    }
  };

  const handleUpdate = async fd => {
    setFormLoading(true);
    try { 
      await apiFetch(`/documents/${editing.id}`, { method: "PUT", body: fd }); 
      showToast("Mis à jour ✓"); 
      setEditing(null); 
      setSelected(null); 
      loadData(); 
    } catch (e) { 
      showToast(e.message, "error"); 
    } finally { 
      setFormLoading(false); 
    }
  };

  const handleDelete = async id => {
    try { 
      await apiFetch(`/documents/${id}`, { method: "DELETE" }); 
      showToast("Supprimé"); 
      setConfirm(null); 
      setSelected(null); 
      loadData(); 
    } catch (e) { 
      showToast(e.message, "error"); 
    }
  };

  const handlePublish = async id => {
    try {
      await apiFetch(`/documents/${id}/publish`, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({}) 
      });
       
      setSelected(null); 
      loadData();
    } catch (e) { 
      showToast(e.message, "error"); 
    }
  };

  const handleToggleVisibility = async (id, newVal) => {
    try {
      await apiFetch(`/documents/${id}/visibilite`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibilite: newVal }),
      });
      showToast(newVal ? "Document rendu public 🌐" : "Document rendu privé 🔒");
      setSelected(null); 
      loadData();
    } catch (e) { 
      showToast(e.message, "error"); 
    }
  };

  const openDetail = async doc => {
    try { 
      setSelected(await apiFetch(`/documents/${doc.id}`)); 
    } catch { 
      setSelected(doc); 
    }
  };

  const selectType = t => { 
    setActiveType(t); 
    setSearch(""); 
    setYearFilter("ALL"); 
    setVisFilter("ALL"); 
    setPage(1); 
    setSelected(null); 
  };
  
  const openAdd = () => setEditing({ __new: true, defaultType: activeType || DOCUMENT_TYPES[0] });

  return (
    <div className="doc-root">
      {toast && <div className={`doc-toast doc-toast-${toast.type}`}>{toast.type === "success" ? "✓" : "⚠"} {toast.msg}</div>}

      <div className="doc-header">
        <div className="doc-header-left">
          <h2 className="doc-header-title">Mes documents</h2>
          {!loading && (
            <div className="doc-header-stats">
              <span className="doc-stat-pill"><strong>{myDocs.length}</strong> total</span>
              <span className="doc-stat-pill pub"><strong>{myDocs.filter(d => d.visibilite).length}</strong> publics</span>
              <span className="doc-stat-pill priv"><strong>{myDocs.filter(d => !d.visibilite).length}</strong> privés</span>
            </div>
          )}
        </div>
        <div className="doc-header-right">
          <div className="doc-search-global">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input placeholder="Rechercher dans mes documents…" value={globalQ} onChange={e => setGlobalQ(e.target.value)} />
            {globalQ && <button onClick={() => setGlobalQ("")}>✕</button>}
          </div>
          <button className="doc-btn-primary" onClick={openAdd}>+ Nouveau</button>
        </div>
      </div>

      <div className="doc-body">
        {globalQ.trim() ? (
          <div className="doc-section">
            <div className="doc-section-label">{globalResults.length} résultat{globalResults.length !== 1 ? "s" : ""} pour « {globalQ} »</div>
            {globalResults.length === 0
              ? <div className="doc-empty"><div className="doc-empty-icon">🔍</div><p className="doc-empty-title">Aucun résultat</p></div>
              : <DocTable docs={globalResults} isArticle={false} onView={openDetail} onDelete={id => setConfirm(id)} />}
          </div>
        ) : (
          <>
            <div className="doc-section">
              <div className="doc-section-label">Mes documents par type</div>
              {loading ? (
                <div className="doc-loading"><div className="doc-spinner" /><span>Chargement…</span></div>
              ) : error ? (
                <div className="doc-error"><span>⚠ {error}</span><button className="doc-btn-ghost doc-btn-sm" onClick={loadData}>Réessayer</button></div>
              ) : (
                <div className="doc-type-grid">
                  {DOCUMENT_TYPES.map(t => {
                    const m = TYPE_META[t];
                    const count = countByType[t];
                    const active = activeType === t;
                    return (
                      <button key={t} className={`doc-type-card ${active ? "active" : ""} ${count === 0 ? "empty" : ""}`}
                        style={{ "--tc": m.color }} onClick={() => selectType(active ? null : t)}>
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
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input placeholder="Filtrer…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                    {search && <button onClick={() => setSearch("")}>✕</button>}
                  </div>
                  <select className="doc-filter-sel" value={yearFilter} onChange={e => { setYearFilter(e.target.value); setPage(1); }}>
                    <option value="ALL">Toutes les années</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select className="doc-filter-sel" value={visFilter} onChange={e => { setVisFilter(e.target.value); setPage(1); }}>
                    <option value="ALL">Toute visibilité</option>
                    <option value="PUBLIC">🌐 Public</option>
                    <option value="PRIVATE">🔒 Privé</option>
                  </select>
                  <span className="doc-filter-count">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</span>
                  <button className="doc-btn-primary doc-btn-sm" style={{ marginLeft: "auto" }} onClick={openAdd}>+ Ajouter</button>
                </div>

                {filtered.length === 0 ? (
                  <EmptyState type={activeType} onAdd={openAdd}
                    hasFilters={!!(search || yearFilter !== "ALL" || visFilter !== "ALL")}
                    onClear={() => { setSearch(""); setYearFilter("ALL"); setVisFilter("ALL"); }} />
                ) : (
                  <>
                    <DocTable docs={paginated} isArticle={isArticle} onView={openDetail} onDelete={id => setConfirm(id)} />
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

      {selected && !editing && (
        <DetailPanel doc={selected} onClose={() => setSelected(null)}
          onPublish={handlePublish} onDelete={id => { setConfirm(id); setSelected(null); }}
          onEdit={doc => { setEditing(doc); setSelected(null); }}
          onToggleVisibility={handleToggleVisibility} />
      )}

      {editing && editing.__new && (
        <DocModal title={`Nouveau ${TYPE_META[editing.defaultType]?.label || "document"}`} onClose={() => setEditing(null)}>
          <DocumentForm defaultType={editing.defaultType} onSubmit={handleCreate} onCancel={() => setEditing(null)} loading={formLoading} />
        </DocModal>
      )}
      {editing && !editing.__new && (
        <DocModal title={`Modifier — ${editing.titre}`} onClose={() => setEditing(null)}>
          <DocumentForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} loading={formLoading} />
        </DocModal>
      )}
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

function DocTable({ docs, isArticle, onView, onDelete }) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table">
        <thead>
          <tr>
            <th>Type</th>
            {isArticle && <th>Sous-type</th>}
            <th>Titre</th>
            <th>Visibilité</th>
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
              <td><span className={`doc-vis-chip-sm ${doc.visibilite ? "public" : "private"}`}>{doc.visibilite ? "🌐" : "🔒"}</span></td>
              <td className="doc-cell-date">{new Date(doc.date_creation).toLocaleDateString("fr-FR")}</td>
              <td className="doc-cell-actions" onClick={e => e.stopPropagation()}>
                <button className="doc-act-btn" title="Voir" onClick={() => onView(doc)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button className="doc-act-btn doc-act-del" title="Supprimer" onClick={() => onDelete(doc.id)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="doc-table-footer">{docs.length} document{docs.length !== 1 ? "s" : ""}</div>
    </div>
  );
}