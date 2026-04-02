import { useState, useEffect, useCallback } from "react";
import "./Document.css";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const API_BASE      = "http://localhost:8000/api";
const DOCUMENT_TYPES = ["ENQUETE", "RAPPORT", "IMAGE", "VIDEO", "CARTE", "ARTICLE"];
const SOUS_TYPES     = ["JOURNAL", "CONFERENCE"];

const TYPE_META = {
  ENQUETE: { icon: "📋", color: "#4f8ef7" },
  RAPPORT: { icon: "📊", color: "#a78bfa" },
  IMAGE:   { icon: "🖼️", color: "#34d399" },
  VIDEO:   { icon: "🎬", color: "#f97316" },
  CARTE:   { icon: "🗺️", color: "#06b6d4" },
  ARTICLE: { icon: "📰", color: "#ec4899" },
};

const getToken = () => localStorage.getItem("token");

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

/* ─────────────────────────────────────────────
   TINY HELPERS
───────────────────────────────────────────── */
function TypeBadge({ type }) {
  const m = TYPE_META[type] || { icon: "📄", color: "#888" };
  return (
    <span className="doc-type-badge" style={{ "--bc": m.color }}>
      {m.icon} {type}
    </span>
  );
}

function MiniStat({ icon, label, value, color, sub }) {
  return (
    <div className="doc-mini-stat" style={{ "--ac": color }}>
      <div className="doc-mini-bar" />
      <span className="doc-mini-icon">{icon}</span>
      <div className="doc-mini-body">
        <span className="doc-mini-val">{value ?? "—"}</span>
        <span className="doc-mini-lbl">{label}</span>
        {sub && <span className="doc-mini-sub">{sub}</span>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MODAL
───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   DOCUMENT FORM
   • projet_id → dropdown (un document = un projet ou aucun)
   • Un projet peut avoir plusieurs documents
   • Pas de checkbox publie ici → passer par POST /:id/publish
───────────────────────────────────────────── */
function DocumentForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    titre: "", description: "", mots_cles: "",
    type: "RAPPORT", projet_id: "",
    doi: "", resume: "", citation_APA: "",
    sous_type: "JOURNAL",
    resolution: "", format: "",
    ...(initial || {}),
  });
  const [file,    setFile]    = useState(null);
  const [projets, setProjets] = useState([]);

  /* Charger la liste des projets pour le dropdown */
  useEffect(() => {
    apiFetch("/projet")
      .then(data => setProjets(data))
      .catch(() => setProjets([]));
  }, []);

  /* Réinitialiser les champs spécifiques quand le type change (création seulement) */
  useEffect(() => {
    if (initial) return;
    if (form.type !== "ARTICLE") {
      setForm(f => ({ ...f, doi: "", resume: "", citation_APA: "", sous_type: "JOURNAL" }));
    }
    if (form.type !== "IMAGE") {
      setForm(f => ({ ...f, resolution: "", format: "" }));
    }
  }, [form.type]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = e => {
    e.preventDefault();
    const fd = new FormData();

    // Champs communs
    ["titre", "description", "mots_cles", "type"].forEach(k => {
      if (form[k] !== undefined) fd.append(k, form[k]);
    });

    // projet_id optionnel (dropdown → string vide = aucun projet)
    if (form.projet_id && form.projet_id !== "") fd.append("projet_id", form.projet_id);

    // Champs ARTICLE
    if (form.type === "ARTICLE") {
      if (form.sous_type)    fd.append("sous_type",    form.sous_type);
      if (form.doi)          fd.append("doi",          form.doi);
      if (form.resume)       fd.append("resume",       form.resume);
      if (form.citation_APA) fd.append("citation_APA", form.citation_APA);
    }

    // Champs IMAGE
    if (form.type === "IMAGE") {
      if (form.resolution) fd.append("resolution", form.resolution);
      if (form.format)     fd.append("format",     form.format);
    }

    if (file) fd.append("file", file);
    onSubmit(fd);
  };

  return (
    <form className="doc-form" onSubmit={handleSubmit}>
      <div className="doc-form-grid">

        {/* Titre */}
        <div className="doc-field doc-field-span">
          <label>Titre *</label>
          <input
            required
            value={form.titre}
            onChange={e => set("titre", e.target.value)}
            placeholder="Titre du document"
          />
        </div>

        {/* Type */}
        <div className="doc-field">
          <label>Type *</label>
          <select value={form.type} onChange={e => set("type", e.target.value)}>
            {DOCUMENT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Projet — dropdown, un document → un seul projet (ou aucun) */}
        <div className="doc-field">
          <label>Projet associé</label>
          <select value={form.projet_id} onChange={e => set("projet_id", e.target.value)}>
            <option value="">— Aucun projet —</option>
            {projets.map(p => (
              <option key={p.id} value={p.id}>{p.titre}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="doc-field doc-field-span">
          <label>Description</label>
          <textarea
            value={form.description}
            onChange={e => set("description", e.target.value)}
            rows={3}
          />
        </div>

        {/* Mots-clés */}
        <div className="doc-field doc-field-span">
          <label>Mots-clés</label>
          <input
            value={form.mots_cles}
            onChange={e => set("mots_cles", e.target.value)}
            placeholder="mot1, mot2, …"
          />
        </div>

        {/* Champs ARTICLE */}
        {form.type === "ARTICLE" && (
          <>
            <div className="doc-field">
              <label>Sous-type *</label>
              <select value={form.sous_type} onChange={e => set("sous_type", e.target.value)}>
                <option value="JOURNAL">📰 Journal</option>
                <option value="CONFERENCE">🎤 Conférence</option>
              </select>
            </div>
            <div className="doc-field">
              <label>DOI</label>
              <input value={form.doi} onChange={e => set("doi", e.target.value)} />
            </div>
            <div className="doc-field">
              <label>Citation APA</label>
              <input value={form.citation_APA} onChange={e => set("citation_APA", e.target.value)} />
            </div>
            <div className="doc-field doc-field-span">
              <label>Résumé</label>
              <textarea value={form.resume} onChange={e => set("resume", e.target.value)} rows={2} />
            </div>
          </>
        )}

        {/* Champs IMAGE */}
        {form.type === "IMAGE" && (
          <>
            <div className="doc-field">
              <label>Résolution</label>
              <input
                value={form.resolution}
                onChange={e => set("resolution", e.target.value)}
                placeholder="1920x1080"
              />
            </div>
            <div className="doc-field">
              <label>Format</label>
              <input
                value={form.format}
                onChange={e => set("format", e.target.value)}
                placeholder="jpg, png…"
              />
            </div>
          </>
        )}

        {/* Fichier */}
        <div className="doc-field doc-field-span">
          <label>Fichier</label>
          <input type="file" onChange={e => setFile(e.target.files[0])} />
          {initial?.lien && (
            <small style={{ color: "#888", marginTop: 4, display: "block" }}>
              Fichier actuel : {initial.lien.split(/[\\/]/).pop()} — laisser vide pour le conserver
            </small>
          )}
        </div>

      </div>

      <div className="doc-form-actions">
        <button type="button" className="doc-btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="doc-btn-primary" disabled={loading}>
          {loading ? "Enregistrement…" : initial ? "✎ Enregistrer" : "+ Créer"}
        </button>
      </div>
    </form>
  );
}

/* ─────────────────────────────────────────────
   DOCUMENT DETAIL
───────────────────────────────────────────── */
function DocumentDetail({ doc, onClose, onPublish, onDelete, onEdit }) {
  const m = TYPE_META[doc.type] || { icon: "📄", color: "#888" };

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
    } catch { alert("Erreur lors du téléchargement"); }
  };

  const ext   = getExt(doc.lien);
  const isImg = ["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext);
  const isPdf = ext === "pdf";
  const isVid = ["mp4", "webm", "avi", "mov", "mkv"].includes(ext);

  return (
    <DocModal title="Détail du document" onClose={onClose}>
      <div className="doc-detail">
        <div
          className="doc-detail-hero"
          style={{
            background: `linear-gradient(135deg, ${m.color}18, ${m.color}30)`,
            borderLeft: `3px solid ${m.color}`,
          }}
        >
          <span className="doc-detail-type-icon">{m.icon}</span>
          <div>
            <h2>{doc.titre}</h2>
            <div className="doc-detail-chips">
              <TypeBadge type={doc.type} />
              <span className={`doc-pub-chip ${doc.publie ? "pub" : "draft"}`}>
                {doc.publie ? "✓ Publié" : "◌ Brouillon"}
              </span>
              {doc.type === "ARTICLE" && doc.sous_type && (
                <span style={{ fontSize: 12, color: "#888" }}>
                  {doc.sous_type === "JOURNAL" ? "📰" : "🎤"} {doc.sous_type}
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="doc-detail-grid">
          <dt>Auteur</dt>
          <dd>
            {doc.auteur_nom || "—"}
            {doc.auteur_email && <em> · {doc.auteur_email}</em>}
          </dd>

          <dt>Projet</dt>
          <dd>
            {doc.projet_titre
              ? <span>📁 {doc.projet_titre}</span>
              : <span className="doc-muted">—</span>}
          </dd>

          <dt>Description</dt>
          <dd>{doc.description || <span className="doc-muted">—</span>}</dd>

          <dt>Mots-clés</dt>
          <dd>{doc.mots_cles || <span className="doc-muted">—</span>}</dd>

          <dt>Créé le</dt>
          <dd>{new Date(doc.date_creation).toLocaleString("fr-FR")}</dd>

          <dt>Modifié le</dt>
          <dd>{new Date(doc.date_modification).toLocaleString("fr-FR")}</dd>

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
          {doc.resume      && <><dt>Résumé</dt><dd>{doc.resume}</dd></>}
          {doc.citation_APA && <><dt>Citation APA</dt><dd style={{ fontSize: 12 }}>{doc.citation_APA}</dd></>}

          {doc.lien && (
            <>
              <dt>Fichier</dt>
              <dd>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {isImg && (
                    <img
                      src={getFileUrl(doc.lien)}
                      alt={doc.titre}
                      style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 4, border: `1px solid ${m.color}40` }}
                    />
                  )}
                  {isVid && (
                    <video controls style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 4 }}>
                      <source src={getFileUrl(doc.lien)} />
                    </video>
                  )}
                  {isPdf && (
                    <iframe
                      src={getFileUrl(doc.lien)}
                      title={doc.titre}
                      style={{ width: "100%", height: 300, border: `1px solid ${m.color}40`, borderRadius: 4 }}
                    />
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <a
                      href={getFileUrl(doc.lien)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: m.color, textDecoration: "none",
                        padding: "8px 16px", border: `1px solid ${m.color}40`,
                        borderRadius: 4, background: `${m.color}10`,
                        fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6,
                      }}
                    >
                      👁️ Ouvrir {ext.toUpperCase()}
                    </a>
                    <button
                      onClick={handleDownload}
                      style={{
                        background: "none", border: `1px solid ${m.color}40`,
                        borderRadius: 4, padding: "8px 16px", cursor: "pointer",
                        color: "#4789cc", background: `${m.color}10`,
                        fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6,
                      }}
                    >
                      ⬇️ Télécharger
                    </button>
                  </div>
                  <small style={{ color: "#6b7387" }}>📁 {getBasename(doc.lien)}</small>
                </div>
              </dd>
            </>
          )}
        </dl>

        <div className="doc-detail-actions">
          <button className="doc-btn-ghost" onClick={() => onEdit(doc)}>✎ Modifier</button>
          {!doc.publie && doc.type === "ARTICLE" && (
            <button className="doc-btn-success" onClick={() => onPublish(doc.id)}>📢 Publier</button>
          )}
          <button className="doc-btn-danger" onClick={() => onDelete(doc.id)}>⊘ Supprimer</button>
        </div>
      </div>
    </DocModal>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function Document() {
  const [docs,        setDocs]        = useState([]);
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  const [search,      setSearch]      = useState("");
  const [filterType,  setFilterType]  = useState("ALL");
  const [filterPub,   setFilterPub]   = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const docsPerPage = 10;

  const [selected,    setSelected]    = useState(null);
  const [editing,     setEditing]     = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [confirm,     setConfirm]     = useState(null);
  const [toast,       setToast]       = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [docsData, statsData] = await Promise.all([
        apiFetch("/documents"),
        apiFetch("/documents/stats/global"),
      ]);
      setDocs(docsData);
      setStats(statsData);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* Filtres */
  const filtered = docs.filter(d => {
    const q    = search.toLowerCase();
    const matchQ = !q || d.titre?.toLowerCase().includes(q)
                       || d.auteur_nom?.toLowerCase().includes(q)
                       || d.mots_cles?.toLowerCase().includes(q);
    const matchT = filterType === "ALL" || d.type === filterType;
    const matchP = filterPub  === "ALL" || (filterPub === "PUBLIE" ? d.publie : !d.publie);
    return matchQ && matchT && matchP;
  });
  const totalPages = Math.ceil(filtered.length / docsPerPage);
  const paginated  = filtered.slice((currentPage - 1) * docsPerPage, currentPage * docsPerPage);

  /* CRUD */
  const handleCreate = async fd => {
    setFormLoading(true);
    try {
      await apiFetch("/documents", { method: "POST", body: fd });
      showToast("Document créé ✓");
      setEditing(null);
      loadData();
    } catch (e) { showToast(e.message, "error"); }
    finally { setFormLoading(false); }
  };

  const handleUpdate = async fd => {
    setFormLoading(true);
    try {
      await apiFetch(`/documents/${editing.id}`, { method: "PUT", body: fd });
      showToast("Mis à jour ✓");
      setEditing(null);
      setSelected(null);
      loadData();
    } catch (e) { showToast(e.message, "error"); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async id => {
    try {
      await apiFetch(`/documents/${id}`, { method: "DELETE" });
      showToast("Supprimé");
      setConfirm(null);
      setSelected(null);
      loadData();
    } catch (e) { showToast(e.message, "error"); }
  };

  const handlePublish = async id => {
    try {
      await apiFetch(`/documents/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      showToast("Document publié 📢");
      setSelected(null);
      loadData();
    } catch (e) { showToast(e.message, "error"); }
  };

  const openDetail = async doc => {
    try { setSelected(await apiFetch(`/documents/${doc.id}`)); }
    catch { setSelected(doc); }
  };

  return (
    <div className="doc-embedded">
      {toast && <div className={`doc-toast doc-toast-${toast.type}`}>{toast.msg}</div>}

      {/* Stats */}
      {stats && (
        <div className="doc-stats-row">
          <MiniStat icon="📄" label="Total"   value={stats.global?.total_documents} color="#4f8ef7" />
          <MiniStat icon="👤" label="Auteurs" value={stats.global?.total_auteurs}   color="#a78bfa" />
          {stats.par_type?.map(s => (
            <MiniStat
              key={s.type}
              icon={TYPE_META[s.type]?.icon || "📄"}
              label={s.type}
              value={s.total}
              color={TYPE_META[s.type]?.color || "#888"}
              sub={`${s.publies} publié(s)`}
            />
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="doc-toolbar">
        <div className="doc-search-wrap">
          <span className="doc-search-icon">⌕</span>
          <input
            className="doc-search-input"
            placeholder="Rechercher…"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          />
          {search && <button className="doc-search-clear" onClick={() => setSearch("")}>✕</button>}
        </div>
        <div className="doc-filters">
          <select className="doc-filter-sel" value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}>
            <option value="ALL">Tous les types</option>
            {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t]?.icon} {t}</option>)}
          </select>
          <select className="doc-filter-sel" value={filterPub} onChange={e => { setFilterPub(e.target.value); setCurrentPage(1); }}>
            <option value="ALL">Tous statuts</option>
            <option value="PUBLIE">Publiés</option>
            <option value="DRAFT">Brouillons</option>
          </select>
          <button className="doc-btn-ghost doc-btn-sm" onClick={loadData} disabled={loading}>
            <span className={loading ? "doc-spin" : ""}>↺</span>
          </button>
        </div>
        <button className="doc-btn-primary" onClick={() => setEditing(true)}>+ Nouveau</button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="doc-state-center"><div className="doc-spinner" /><span>Chargement…</span></div>
      ) : error ? (
        <div className="doc-state-center doc-state-err">
          <span>⚠ {error}</span>
          <button className="doc-btn-ghost" onClick={loadData}>Réessayer</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="doc-state-center">
          <span style={{ fontSize: 36 }}>🗃️</span>
          <span>Aucun document trouvé</span>
          {(search || filterType !== "ALL" || filterPub !== "ALL") && (
            <button
              className="doc-btn-ghost doc-btn-sm"
              onClick={() => { setSearch(""); setFilterType("ALL"); setFilterPub("ALL"); }}
            >
              Effacer les filtres
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Sous-type</th>
                  <th>Titre</th>
                  <th>Auteur</th>
                  <th>Projet</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(doc => (
                  <tr key={doc.id} className="doc-row" onClick={() => openDetail(doc)}>
                    <td><TypeBadge type={doc.type} /></td>
                    <td>
                      {doc.type === "ARTICLE" && doc.sous_type
                        ? <span style={{ fontSize: 12, color: "#888" }}>
                            {doc.sous_type === "JOURNAL" ? "📰" : "🎤"} {doc.sous_type}
                          </span>
                        : <span className="doc-muted">—</span>}
                    </td>
                    <td className="doc-title-cell">
                      <span className="doc-title-text">{doc.titre}</span>
                      {doc.mots_cles && <span className="doc-kw">{doc.mots_cles}</span>}
                    </td>
                    <td className="doc-cell-sm">{doc.auteur_nom || <span className="doc-muted">—</span>}</td>
                    <td className="doc-cell-sm">
                      {doc.projet_titre
                        ? <span>📁 {doc.projet_titre}</span>
                        : <span className="doc-muted">—</span>}
                    </td>
                    <td>
                      <span className={`doc-pub-chip ${doc.publie ? "pub" : "draft"}`}>
                        {doc.publie ? "✓ Publié" : "◌ Brouillon"}
                      </span>
                    </td>
                    <td className="doc-cell-date">
                      {new Date(doc.date_creation).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="doc-cell-actions" onClick={e => e.stopPropagation()}>
                      <button className="doc-act-btn" title="Modifier" onClick={() => { setEditing(doc); setSelected(null); }}>✎</button>
                      {!doc.publie && doc.type === "ARTICLE" && (
                        <button className="doc-act-btn doc-act-pub" title="Publier" onClick={() => handlePublish(doc.id)}>📢</button>
                      )}
                      <button className="doc-act-btn doc-act-del" title="Supprimer" onClick={() => setConfirm(doc.id)}>⊘</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="doc-table-footer">{filtered.length} document(s)</div>
          </div>

          {totalPages > 1 && (
            <div className="doc-pagination">
              <span className="doc-page-info">Page {currentPage} / {totalPages}</span>
              <div className="doc-page-btns">
                <button className="doc-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>←</button>
                {[...Array(totalPages)].map((_, i) => {
                  const n = i + 1;
                  if (n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                    return (
                      <button
                        key={n}
                        className={`doc-page-btn ${currentPage === n ? "doc-page-active" : ""}`}
                        onClick={() => setCurrentPage(n)}
                      >{n}</button>
                    );
                  if (Math.abs(n - currentPage) === 2)
                    return <span key={n} className="doc-page-dots">…</span>;
                  return null;
                })}
                <button className="doc-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>→</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {editing === true && (
        <DocModal title="Nouveau document" onClose={() => setEditing(null)}>
          <DocumentForm onSubmit={handleCreate} onCancel={() => setEditing(null)} loading={formLoading} />
        </DocModal>
      )}
      {editing && editing !== true && (
        <DocModal title={`Modifier — ${editing.titre}`} onClose={() => setEditing(null)}>
          <DocumentForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} loading={formLoading} />
        </DocModal>
      )}
      {selected && !editing && (
        <DocumentDetail
          doc={selected}
          onClose={() => setSelected(null)}
          onPublish={handlePublish}
          onDelete={id => { setConfirm(id); setSelected(null); }}
          onEdit={doc => { setEditing(doc); setSelected(null); }}
        />
      )}
      {confirm && (
        <DocModal title="Confirmer la suppression" onClose={() => setConfirm(null)}>
          <div className="doc-confirm">
            <p>⚠ Cette action est <strong>irréversible</strong>. Le document et son fichier seront définitivement supprimés.</p>
            <div className="doc-form-actions">
              <button className="doc-btn-ghost" onClick={() => setConfirm(null)}>Annuler</button>
              <button className="doc-btn-danger" onClick={() => handleDelete(confirm)}>⊘ Supprimer</button>
            </div>
          </div>
        </DocModal>
      )}
    </div>
  );
}