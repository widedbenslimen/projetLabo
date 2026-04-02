import React, { useState, useEffect } from "react";
import "./Doc.css";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
export const API_BASE = "http://localhost:8000/api";

export const DOCUMENT_TYPES = ["ENQUETE", "RAPPORT", "IMAGE", "VIDEO", "CARTE", "ARTICLE"];

export const TYPE_META = {
  ENQUETE: { icon: "📋", color: "#4f8ef7" },
  RAPPORT: { icon: "📊", color: "#a78bfa" },
  IMAGE:   { icon: "🖼️", color: "#34d399" },
  VIDEO:   { icon: "🎬", color: "#f97316" },
  CARTE:   { icon: "🗺️", color: "#06b6d4" },
  ARTICLE: { icon: "📰", color: "#ec4899" },
};

export const getToken = () => localStorage.getItem("token");

export async function apiFetch(path, options = {}) {
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
export function TypeBadge({ type }) {
  const m = TYPE_META[type] || { icon: "📄", color: "#888" };
  return (
    <span className="doc-type-badge" style={{ "--bc": m.color }}>
      {m.icon} {type}
    </span>
  );
}

export function PubChip({ publie }) {
  return (
    <span className={`doc-pub-chip ${publie ? "pub" : "draft"}`}>
      {publie ? "✓ Publié" : "◌ Brouillon"}
    </span>
  );
}

/* ─────────────────────────────────────────────
   MODAL
───────────────────────────────────────────── */
export function Modal({ title, onClose, children, size = "md" }) {
  return (
    <div className="doc-modal-overlay" onClick={onClose}>
      <div className={`doc-modal-box doc-modal-${size}`} onClick={e => e.stopPropagation()}>
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
   FIXES :
   1. Dropdown projets = uniquement les projets
      dont l'utilisateur connecté est participant
   2. En mode édition, projet_id est correctement
      pré-sélectionné et NE se réinitialise PAS
      si on sélectionne "— Aucun projet —"
───────────────────────────────────────────── */
export function DocumentForm({ initial, onSubmit, onCancel, loading }) {
  const getCurrentUser = () => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); }
    catch { return {}; }
  };

  const [form, setForm] = useState({
    titre:        "",
    description:  "",
    mots_cles:    "",
    type:         "RAPPORT",
    // projet_id : string (valeur du <select>)
    // "" = aucun projet, "null" = effacer le projet existant
    projet_id:    "",
    doi:          "",
    resume:       "",
    citation_APA: "",
    sous_type:    "JOURNAL",
    resolution:   "",
    format:       "",
    ...(initial
      ? {
          ...initial,
          // Normaliser projet_id en string pour le <select>
          projet_id: initial.projet_id != null ? String(initial.projet_id) : "",
        }
      : {}),
  });

  const [file,    setFile]    = useState(null);
  // Uniquement les projets dont l'utilisateur est participant
  const [projets, setProjets] = useState([]);
  const [projetsLoading, setProjetsLoading] = useState(true);

  /* Charger SEULEMENT les projets de l'utilisateur */
  useEffect(() => {
    const currentUser = getCurrentUser();
    setProjetsLoading(true);
    apiFetch("/projet")
      .then(data => {
        // Filtrer : seulement les projets où l'utilisateur est participant
        const mesProjets = data.filter(p =>
          p.participants?.some(x => x.id === currentUser.id)
        );
        setProjets(mesProjets);
      })
      .catch(() => setProjets([]))
      .finally(() => setProjetsLoading(false));
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

    // Champs de base
    ["titre", "description", "mots_cles", "type"].forEach(k => {
      if (form[k] !== undefined && form[k] !== "") fd.append(k, form[k]);
    });

    // projet_id :
    // - "" → pas de projet (nouvelle création sans projet)
    // - "null" → on envoie "null" pour effacer l'association en modification
    // - "123" → on associe au projet 123
    if (form.projet_id === "") {
      // En mode création : ne pas envoyer projet_id
      // En mode édition : envoyer null pour effacer
      if (initial) fd.append("projet_id", "null");
    } else {
      fd.append("projet_id", form.projet_id);
    }

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
          <label>Titre <em>*</em></label>
          <input
            required
            value={form.titre}
            onChange={e => set("titre", e.target.value)}
            placeholder="Titre du document"
          />
        </div>

        {/* Type */}
        <div className="doc-field">
          <label>Type <em>*</em></label>
          <select value={form.type} onChange={e => set("type", e.target.value)}>
            {DOCUMENT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Projet — dropdown filtré sur les projets de l'utilisateur */}
        <div className="doc-field">
          <label>Projet associé</label>
          {projetsLoading ? (
            <select disabled><option>Chargement…</option></select>
          ) : (
            <select
              value={form.projet_id}
              onChange={e => set("projet_id", e.target.value)}
            >
              <option value="">— Aucun projet —</option>
              {projets.map(p => (
                <option key={p.id} value={String(p.id)}>
                  {p.titre}
                </option>
              ))}
            </select>
          )}
          {!projetsLoading && projets.length === 0 && (
            <small style={{ color: "#f97316", marginTop: 4, display: "block" }}>
              ⚠ Vous n'êtes participant d'aucun projet
            </small>
          )}
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
              <label>Sous-type <em>*</em></label>
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
              <input value={form.resolution} onChange={e => set("resolution", e.target.value)} placeholder="1920x1080" />
            </div>
            <div className="doc-field">
              <label>Format</label>
              <input value={form.format} onChange={e => set("format", e.target.value)} placeholder="jpg, png…" />
            </div>
          </>
        )}

        {/* Fichier */}
        <div className="doc-field doc-field-span">
          <label>Fichier</label>
          <input type="file" onChange={e => setFile(e.target.files[0])} />
          {initial?.lien && (
            <small className="doc-field-hint">
              Fichier actuel : {initial.lien.split(/[\\/]/).pop()} — laisser vide pour le conserver
            </small>
          )}
        </div>

      </div>

      <div className="doc-form-actions">
        <button type="button" className="doc-btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="doc-btn-primary" disabled={loading}>
          {loading ? <span className="doc-spin">↺</span> : null}
          {loading ? "Enregistrement…" : initial ? "✎ Enregistrer" : "+ Créer"}
        </button>
      </div>
    </form>
  );
}

/* ─────────────────────────────────────────────
   DOCUMENT DETAIL
───────────────────────────────────────────── */
export function DocumentDetail({ doc, onClose, onPublish, onDelete, onEdit }) {
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
      a.href     = url;
      a.download = `${doc.titre}.${getExt(doc.lien)}`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch { alert("Erreur téléchargement"); }
  };

  const ext   = getExt(doc.lien);
  const isImg = ["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext);
  const isPdf = ext === "pdf";
  const isVid = ["mp4", "webm", "avi", "mov", "mkv"].includes(ext);

  return (
    <Modal title="Détail du document" onClose={onClose} size="lg">
      <div className="doc-detail">
        <div
          className="doc-detail-hero"
          style={{
            background: `linear-gradient(135deg, ${m.color}18, ${m.color}30)`,
            borderLeft: `3px solid ${m.color}`,
          }}
        >
          <span style={{ fontSize: 36 }}>{m.icon}</span>
          <div>
            <h2>{doc.titre}</h2>
            <div className="doc-detail-chips">
              <TypeBadge type={doc.type} />
              <PubChip publie={doc.publie} />
              {doc.type === "ARTICLE" && doc.sous_type && (
                <span className="doc-sous-type-chip">
                  {doc.sous_type === "JOURNAL" ? "📰" : "🎤"} {doc.sous_type}
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="doc-detail-grid">
          <dt>Auteur</dt>
          <dd>{doc.auteur_nom || "—"}{doc.auteur_email && <em> · {doc.auteur_email}</em>}</dd>

          <dt>Projet</dt>
          <dd>{doc.projet_titre || <em>—</em>}</dd>

          <dt>Description</dt>
          <dd>{doc.description || <em>—</em>}</dd>

          <dt>Mots-clés</dt>
          <dd>{doc.mots_cles || <em>—</em>}</dd>

          <dt>Créé le</dt>
          <dd>{new Date(doc.date_creation).toLocaleString("fr-FR")}</dd>

          <dt>Modifié le</dt>
          <dd>{new Date(doc.date_modification).toLocaleString("fr-FR")}</dd>

          {doc.doi && (
            <>
              <dt>DOI</dt>
              <dd><a href={`https://doi.org/${doc.doi}`} target="_blank" rel="noreferrer">{doc.doi}</a></dd>
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
                    <img src={getFileUrl(doc.lien)} alt={doc.titre}
                      style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6, border: `1px solid ${m.color}40` }} />
                  )}
                  {isVid && (
                    <video controls style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6 }}>
                      <source src={getFileUrl(doc.lien)} />
                    </video>
                  )}
                  {isPdf && (
                    <iframe src={getFileUrl(doc.lien)} title={doc.titre}
                      style={{ width: "100%", height: 280, border: `1px solid ${m.color}40`, borderRadius: 6 }} />
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <a href={getFileUrl(doc.lien)} target="_blank" rel="noreferrer"
                      className="doc-file-btn" style={{ "--fc": m.color }}>
                      👁️ Ouvrir <span>{ext.toUpperCase()}</span>
                    </a>
                    <button className="doc-file-btn" style={{ "--fc": m.color }} onClick={handleDownload}>
                      ⬇️ Télécharger
                    </button>
                  </div>
                  <small style={{ color: "var(--doc-text-muted)" }}>📁 {getBasename(doc.lien)}</small>
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
    </Modal>
  );
}

/* ─────────────────────────────────────────────
   DOCUMENT TABLE (composant réutilisable)
───────────────────────────────────────────── */
export default function Document({
  docs,
  loading,
  error,
  onReload,
  onOpenDetail,
  onEdit,
  onDelete,
  onPublish,
  onCreate,
}) {
  const [search,      setSearch]      = useState("");
  const [filterType,  setFilterType]  = useState("ALL");
  const [filterPub,   setFilterPub]   = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const docsPerPage = 10;

  const filtered = docs.filter(d => {
    const q  = search.toLowerCase();
    const mQ = !q || d.titre?.toLowerCase().includes(q) || d.mots_cles?.toLowerCase().includes(q);
    const mT = filterType === "ALL" || d.type === filterType;
    const mP = filterPub  === "ALL" || (filterPub === "PUBLIE" ? d.publie : !d.publie);
    return mQ && mT && mP;
  });

  const totalPages = Math.ceil(filtered.length / docsPerPage);
  const paginated  = filtered.slice((currentPage - 1) * docsPerPage, currentPage * docsPerPage);

  return (
    <div className="doc-tab">
      <div className="doc-toolbar">
        <div className="doc-search-wrap">
          <span className="doc-search-icon">⌕</span>
          <input className="doc-search-input" placeholder="Rechercher par titre, mots-clés…"
            value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} />
          {search && <button className="doc-search-clear" onClick={() => setSearch("")}>✕</button>}
        </div>
        <div className="doc-toolbar-filters">
          <select className="doc-filter-sel" value={filterType}
            onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}>
            <option value="ALL">Tous les types</option>
            {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t]?.icon} {t}</option>)}
          </select>
          <select className="doc-filter-sel" value={filterPub}
            onChange={e => { setFilterPub(e.target.value); setCurrentPage(1); }}>
            <option value="ALL">Tous statuts</option>
            <option value="PUBLIE">Publiés</option>
            <option value="DRAFT">Brouillons</option>
          </select>
          <button className="doc-btn-ghost doc-btn-sm" onClick={onReload} disabled={loading}>
            <span className={loading ? "doc-spin" : ""}>↺</span>
          </button>
        </div>
        <button className="doc-btn-primary" onClick={onCreate}>+ Nouveau</button>
      </div>

      {loading ? (
        <div className="doc-state-center"><div className="doc-spinner" /><span>Chargement…</span></div>
      ) : error ? (
        <div className="doc-state-center doc-state-err">
          <span>⚠ {error}</span>
          <button className="doc-btn-ghost" onClick={onReload}>Réessayer</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="doc-state-center">
          <span style={{ fontSize: 36 }}>🗃️</span>
          <span>Aucun document trouvé</span>
          {(search || filterType !== "ALL" || filterPub !== "ALL") && (
            <button className="doc-btn-ghost doc-btn-sm"
              onClick={() => { setSearch(""); setFilterType("ALL"); setFilterPub("ALL"); }}>
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
                  <th>Type</th><th>Sous-type</th><th>Titre</th>
                  <th>Projet</th><th>Statut</th><th>Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(doc => (
                  <tr key={doc.id} className="doc-row" onClick={() => onOpenDetail(doc)}>
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
                    <td className="doc-cell-sm">
                      {doc.projet_titre
                        ? <span className="doc-projet-tag">📁 {doc.projet_titre}</span>
                        : <span className="doc-muted">—</span>}
                    </td>
                    <td><PubChip publie={doc.publie} /></td>
                    <td className="doc-cell-date">{new Date(doc.date_creation).toLocaleDateString("fr-FR")}</td>
                    <td className="doc-cell-actions" onClick={e => e.stopPropagation()}>
                      <button className="doc-act-btn" title="Modifier" onClick={() => onEdit(doc)}>✎</button>
                      {!doc.publie && doc.type === "ARTICLE" && (
                        <button className="doc-act-btn doc-act-pub" title="Publier" onClick={() => onPublish(doc.id)}>📢</button>
                      )}
                      <button className="doc-act-btn doc-act-del" title="Supprimer" onClick={() => onDelete(doc.id)}>⊘</button>
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
                <button className="doc-page-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>←</button>
                {[...Array(totalPages)].map((_, i) => {
                  const n = i + 1;
                  if (n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                    return (
                      <button key={n} className={`doc-page-btn ${currentPage === n ? "doc-page-active" : ""}`}
                        onClick={() => setCurrentPage(n)}>{n}</button>
                    );
                  if (Math.abs(n - currentPage) === 2)
                    return <span key={n} className="doc-page-dots">…</span>;
                  return null;
                })}
                <button className="doc-page-btn"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>→</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}