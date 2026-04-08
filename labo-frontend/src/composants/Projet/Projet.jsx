import React, { useState, useEffect, useCallback } from "react";
import "./Projet.css";

/* ─────────────────────────────────────────────
   CONSTANTS & HELPERS
───────────────────────────────────────────── */
const API_BASE = "http://localhost:8000/api";
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
   STATUT CONFIG
───────────────────────────────────────────── */
const STATUT_CONFIG = {
  en_cours:    { label: "En cours",    color: "#6366f1", bg: "rgba(99,102,241,.10)",  border: "rgba(99,102,241,.28)" },
  soumis:      { label: "Soumis",      color: "#f59e0b", bg: "rgba(245,158,11,.10)",  border: "rgba(245,158,11,.28)" },
  en_revision: { label: "En révision", color: "#f97316", bg: "rgba(249,115,22,.10)",  border: "rgba(249,115,22,.28)" },
  accepte:     { label: "Accepté",     color: "#4a7c59", bg: "rgba(74,124,89,.10)",   border: "rgba(74,124,89,.28)" },
  publie:      { label: "Publié",      color: "#0d9488", bg: "rgba(13,148,136,.10)",  border: "rgba(13,148,136,.28)" },
  retire:      { label: "Retiré",      color: "#c0392b", bg: "rgba(192,57,43,.10)",   border: "rgba(192,57,43,.28)" },
};

const TYPE_ICONS = {
  ENQUETE: "📋", RAPPORT: "📊", IMAGE: "🖼️",
  VIDEO: "🎬", CARTE: "🗺️", ARTICLE: "📰",
};

/* ─────────────────────────────────────────────
   STATUT BADGE
───────────────────────────────────────────── */
function StatutBadge({ statut }) {
  const s = STATUT_CONFIG[statut] || { label: statut, color: "#888", bg: "rgba(128,128,128,.10)", border: "rgba(128,128,128,.25)" };
  return (
    <span
      className="pj-statut-badge"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
    >
      <span className="pj-statut-dot" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

/* ─────────────────────────────────────────────
   MODAL (formulaire / confirmation)
───────────────────────────────────────────── */
function PjModal({ title, onClose, children, wide }) {
  return (
    <div className="pj-overlay" onClick={onClose}>
      <div className={`pj-modal ${wide ? "pj-modal-wide" : ""}`} onClick={e => e.stopPropagation()}>
        {title && (
          <div className="pj-modal-head">
            <span className="pj-modal-title">{title}</span>
            <button className="pj-modal-x" onClick={onClose}>✕</button>
          </div>
        )}
        <div className="pj-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FORMULAIRE PROJET
───────────────────────────────────────────── */
function ProjetForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    titre: "", description: "", domaine: "", mots_cles: "",
    annee_publication: "", date_debut: "", date_fin: "", statut: "en_cours",
    ...(initial || {}),
  });
  const [participantEmail,     setParticipantEmail]     = useState("");
  const [participants,         setParticipants]         = useState(
    initial?.participants?.map(p => ({ id: p.id, nom: p.nom, email: p.email })) || []
  );
  const [participantError,     setParticipantError]     = useState("");
  const [participantSearching, setParticipantSearching] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addParticipant = async () => {
    setParticipantError("");
    const val = participantEmail.trim();
    if (!val) return;
    setParticipantSearching(true);
    try {
      const users = await apiFetch(`/utilisateur?email=${encodeURIComponent(val)}`);
      const user  = Array.isArray(users) ? users[0] : users;
      if (!user?.id) { setParticipantError("Aucun utilisateur trouvé."); return; }
      if (participants.some(p => p.id === user.id)) { setParticipantError("Participant déjà ajouté."); return; }
      setParticipants(prev => [...prev, { id: user.id, nom: user.nom, email: user.email }]);
      setParticipantEmail("");
    } catch { setParticipantError("Utilisateur introuvable ou erreur serveur."); }
    finally { setParticipantSearching(false); }
  };

  const removeParticipant = id => setParticipants(prev => prev.filter(p => p.id !== id));

  const handleSubmit = e => {
    e.preventDefault();
    const body = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== null && v !== undefined && v !== "")
    );
    const creatorId = initial?.createur_id;
    const toSync    = creatorId ? participants.filter(p => p.id !== creatorId) : participants;
    onSubmit(body, toSync);
  };

  return (
    <form className="pj-form" onSubmit={handleSubmit}>
      {/* ── Section 1 ── */}
      <div className="pj-form-section">
        <div className="pj-form-section-title">Informations générales</div>
        <div className="pj-field pj-full">
          <label>Titre <em>*</em></label>
          <input required value={form.titre} onChange={e => set("titre", e.target.value)} placeholder="Titre du projet" />
        </div>
        <div className="pj-field pj-full">
          <label>Description</label>
          <textarea rows={4} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Description du projet…" />
        </div>
        <div className="pj-field">
          <label>Statut</label>
          <select value={form.statut} onChange={e => set("statut", e.target.value)}>
            {Object.entries(STATUT_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Section 2 ── */}
      <div className="pj-form-section">
        <div className="pj-form-section-title">Métadonnées</div>
        <div className="pj-field">
          <label>Domaine</label>
          <input value={form.domaine} onChange={e => set("domaine", e.target.value)} placeholder="ex: Informatique, Biologie…" />
        </div>
        <div className="pj-field">
          <label>Année de publication</label>
          <input type="number" min="1900" max="2100" value={form.annee_publication}
            onChange={e => set("annee_publication", e.target.value)} placeholder="ex: 2024" />
        </div>
        <div className="pj-field pj-full">
          <label>Mots-clés</label>
          <input value={form.mots_cles} onChange={e => set("mots_cles", e.target.value)} placeholder="mot1, mot2, mot3…" />
        </div>
        <div className="pj-field">
          <label>Date de début</label>
          <input type="date" value={form.date_debut} onChange={e => set("date_debut", e.target.value)} />
        </div>
        <div className="pj-field">
          <label>Date de fin</label>
          <input type="date" value={form.date_fin} onChange={e => set("date_fin", e.target.value)} />
        </div>
      </div>

      {/* ── Section 3 ── */}
      <div className="pj-form-section">
        <div className="pj-form-section-title">Participants</div>
        <div className="pj-field pj-full">
          <label>Ajouter par email</label>
          <div className="pj-participant-add-row">
            <input
              type="email"
              value={participantEmail}
              onChange={e => { setParticipantEmail(e.target.value); setParticipantError(""); }}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addParticipant())}
              placeholder="email@exemple.com"
              className="pj-participant-email-input"
            />
            <button type="button" className="pj-btn-add-participant"
              onClick={addParticipant} disabled={participantSearching}>
              {participantSearching ? "Recherche…" : "+ Ajouter"}
            </button>
          </div>
          {participantError && <span className="pj-participant-error">{participantError}</span>}
        </div>
        {participants.length > 0 && (
          <div className="pj-field pj-full">
            <div className="pj-participants-chips">
              {participants.map(p => (
                <div key={p.id} className="pj-participant-chip">
                  <span className="pj-chip-avatar">{p.nom?.[0]?.toUpperCase()}</span>
                  <span className="pj-chip-info">
                    <span className="pj-chip-nom">{p.nom}</span>
                    <span className="pj-chip-email">{p.email}</span>
                  </span>
                  {p.id === initial?.createur_id ? (
                    <span className="pj-chip-creator">Créateur</span>
                  ) : (
                    <button type="button" className="pj-chip-remove"
                      onClick={() => removeParticipant(p.id)}>✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pj-form-actions">
        <button type="button" className="pj-btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="pj-btn-primary" disabled={loading}>
          {loading ? (
            <><span className="pj-btn-spinner" /> Enregistrement…</>
          ) : initial ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
              Enregistrer
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Créer le projet
            </>
          )}
        </button>
      </div>
    </form>
  );
}

/* ─────────────────────────────────────────────
   DOCUMENT ROW (dans le détail)
───────────────────────────────────────────── */
function ProjetDocRow({ doc }) {
  const fileUrl = doc.lien ? `http://localhost:8000/${doc.lien.replace(/\\/g, "/")}` : null;
  const ext     = doc.lien ? doc.lien.split(".").pop().toLowerCase() : "";
  const isImg   = ["jpg","jpeg","png","gif","svg","webp"].includes(ext);
  const isPdf   = ext === "pdf";
  const isVid   = ["mp4","webm","avi","mov","mkv"].includes(ext);
  const [preview, setPreview] = useState(false);

  return (
    <div className="pj-doc-row">
      <span className="pj-doc-type-icon">{TYPE_ICONS[doc.type] || "📄"}</span>
      <div className="pj-doc-info">
        <span className="pj-doc-titre">{doc.titre}</span>
        <div className="pj-doc-meta">
          <span className="pj-doc-type-label">{doc.type}</span>
          {doc.sous_type && <span className="pj-doc-sous-type">{doc.sous_type}</span>}
          {doc.auteur_nom && <span className="pj-doc-auteur">— {doc.auteur_nom}</span>}
        </div>
      </div>
      <div className="pj-doc-actions">
        {fileUrl ? (
          <>
            <a href={fileUrl} target="_blank" rel="noreferrer"
              className="pj-doc-btn pj-doc-btn-open">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Ouvrir
            </a>
            {(isImg || isPdf || isVid) && (
              <button className="pj-doc-btn pj-doc-btn-preview" onClick={() => setPreview(v => !v)}>
                {preview ? "▲ Fermer" : "▼ Aperçu"}
              </button>
            )}
          </>
        ) : (
          <span className="pj-doc-no-file">Pas de fichier</span>
        )}
      </div>
      {preview && fileUrl && (
        <div className="pj-doc-preview">
          {isImg && <img src={fileUrl} alt={doc.titre} />}
          {isPdf && <iframe src={fileUrl} title={doc.titre} />}
          {isVid && <video controls><source src={fileUrl} /></video>}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   PANNEAU DÉTAIL (slide-in latéral)
───────────────────────────────────────────── */
function DetailPanel({ projet, onClose, onEdit, onDelete }) {
  const s = STATUT_CONFIG[projet.statut] || STATUT_CONFIG.en_cours;

  return (
    <>
      <div className="pj-panel-backdrop" onClick={onClose} />
      <div className="pj-detail-panel">

        {/* Header */}
        <div className="pj-panel-header" style={{ "--pc": s.color }}>
          <div className="pj-panel-header-left">
            <span className="pj-panel-header-title">Détail du projet</span>
          </div>
          <button className="pj-panel-close" onClick={onClose}>✕</button>
        </div>

        {/* Corps */}
        <div className="pj-panel-body">

          {/* Hero */}
          <div className="pj-panel-hero" style={{ borderLeftColor: s.color, background: `${s.color}0d` }}>
            <h2 className="pj-panel-titre">{projet.titre}</h2>
            <div className="pj-panel-chips">
              <StatutBadge statut={projet.statut} />
              {projet.domaine && (
                <span className="pj-panel-domaine">{projet.domaine}</span>
              )}
            </div>
          </div>

          {/* Métadonnées */}
          <dl className="pj-panel-meta">
            {projet.createur_nom && (
              <><dt>Créateur</dt><dd>{projet.createur_nom}</dd></>
            )}
            {projet.participants?.length > 0 && (
              <><dt>Participants</dt>
              <dd>
                <div className="pj-panel-participants">
                  {projet.participants.map(p => (
                    <span key={p.id} className="pj-panel-participant">
                      <span className="pj-panel-participant-av">{p.nom?.[0]?.toUpperCase()}</span>
                      {p.nom}
                    </span>
                  ))}
                </div>
              </dd></>
            )}
            {projet.annee_publication && (
              <><dt>Année</dt><dd>{projet.annee_publication}</dd></>
            )}
            {projet.date_debut && (
              <><dt>Date début</dt><dd>{new Date(projet.date_debut).toLocaleDateString("fr-FR")}</dd></>
            )}
            {projet.date_fin && (
              <><dt>Date fin</dt><dd>{new Date(projet.date_fin).toLocaleDateString("fr-FR")}</dd></>
            )}
            {projet.mots_cles && (
              <><dt>Mots-clés</dt>
              <dd>
                <div className="pj-panel-keywords">
                  {projet.mots_cles.split(",").map((k, i) => (
                    <span key={i} className="pj-keyword-chip">{k.trim()}</span>
                  ))}
                </div>
              </dd></>
            )}
          </dl>

          {/* Description */}
          {projet.description && (
            <div className="pj-panel-desc">
              <span className="pj-panel-section-label">Description</span>
              <p>{projet.description}</p>
            </div>
          )}

          {/* Documents */}
          <div className="pj-panel-docs">
            <span className="pj-panel-section-label">
              Documents
              <span className="pj-panel-docs-count">{projet.documents?.length || 0}</span>
            </span>
            {!projet.documents || projet.documents.length === 0 ? (
              <div className="pj-no-docs">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>Aucun document associé</span>
              </div>
            ) : (
              <div className="pj-docs-list">
                {projet.documents.map(doc => (
                  <ProjetDocRow key={doc.id} doc={doc} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="pj-panel-footer">
          <button className="pj-btn-ghost" onClick={() => onEdit(projet)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
            Modifier
          </button>
          <button className="pj-btn-danger" onClick={() => onDelete(projet.id)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Supprimer
          </button>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   SIDEBAR SCHOLAR
───────────────────────────────────────────── */
function ScholarSidebar({ projets }) {
  const [showAll, setShowAll] = useState(false);
  const safe = projets || [];

  const publie  = safe.filter(p => p.statut === "publie").length;
  const enCours = safe.filter(p => p.statut === "en_cours").length;

  const coMap = {};
  safe.forEach(p => {
    (p.participants || []).forEach(u => {
      if (!coMap[u.id]) coMap[u.id] = { id: u.id, nom: u.nom, email: u.email, count: 0 };
      coMap[u.id].count += 1;
    });
  });
  const coauteurs = Object.values(coMap).sort((a, b) => b.count - a.count);
  const visible   = showAll ? coauteurs : coauteurs.slice(0, 6);

  const statRows = [
    { label: "Total",    value: safe.length },
    { label: "Publiés",  value: publie },
    { label: "En cours", value: enCours },
    { label: "Participants", value: coauteurs.length },
  ];

  return (
    <aside className="pj-sidebar">

      {/* Stats */}
      <div className="pj-sidebar-card">
        <div className="pj-sidebar-card-title">Statistiques</div>
        <div className="pj-stat-list">
          {statRows.map(r => (
            <div key={r.label} className="pj-stat-row">
              <span className="pj-stat-label">{r.label}</span>
              <span className="pj-stat-value">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Participants */}
      {coauteurs.length > 0 && (
        <div className="pj-sidebar-card">
          <div className="pj-sidebar-card-title">
            Participants
            {coauteurs.length > 6 && (
              <button className="pj-sidebar-toggle" onClick={() => setShowAll(s => !s)}>
                {showAll ? "Réduire" : `Tout afficher (${coauteurs.length})`}
              </button>
            )}
          </div>
          <div className="pj-coauteurs-list">
            {visible.map(c => (
              <div key={c.id} className="pj-coauteur-row">
                <div className="pj-coauteur-avatar">{c.nom?.[0]?.toUpperCase()}</div>
                <div className="pj-coauteur-info">
                  <span className="pj-coauteur-nom">{c.nom}</span>
                  {c.email && <span className="pj-coauteur-email">{c.email}</span>}
                </div>
                <span className="pj-coauteur-count">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

/* ─────────────────────────────────────────────
   COMPOSANT PRINCIPAL
───────────────────────────────────────────── */
export default function Projet({ user, showOnlyUserProjets = false }) {
  const [projets,      setProjets]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [currentPage,  setCurrentPage]  = useState(1);
  const perPage = 10;

  const [selected,    setSelected]    = useState(null);
  const [editing,     setEditing]     = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [confirm,     setConfirm]     = useState(null);
  const [toast,       setToast]       = useState(null);

  /* ── Toast ── */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  /* ── Chargement ── */
  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch("/projet");
      const list = showOnlyUserProjets && user
        ? data.filter(p => p.participants?.some(x => x.id === user.id || x.id === String(user.id)))
        : data;
      setProjets(list);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [showOnlyUserProjets, user]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Filtrage ── */
  const filtered = projets.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q
      || p.titre?.toLowerCase().includes(q)
      || p.description?.toLowerCase().includes(q)
      || p.mots_cles?.toLowerCase().includes(q)
      || p.domaine?.toLowerCase().includes(q)
      || p.createur_nom?.toLowerCase().includes(q)
      || p.participants?.some(x => x.nom?.toLowerCase().includes(q));
    return matchQ && (!filterStatut || p.statut === filterStatut);
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated  = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  /* ── CRUD ── */
  const handleCreate = async (body, participants) => {
    setFormLoading(true);
    try {
      const projet = await apiFetch("/projet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      for (const p of participants) {
        try {
          await apiFetch(`/projet/${projet.id}/participants`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ utilisateur_id: Number(p.id) }),
          });
        } catch { /* ignore */ }
      }
      showToast("Projet créé avec succès ✓");
      setEditing(null);
      loadData();
    } catch (e) { showToast(e.message, "error"); }
    finally { setFormLoading(false); }
  };

  const handleUpdate = async (body, participants) => {
    setFormLoading(true);
    try {
      await apiFetch(`/projet/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const current    = editing.participants || [];
      const creatorId  = String(editing.createur_id);
      const currentIds = current.map(p => String(p.id));
      const newIds     = participants.map(p => String(p.id));

      for (const p of participants) {
        if (!currentIds.includes(String(p.id))) {
          try {
            await apiFetch(`/projet/${editing.id}/participants`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ utilisateur_id: Number(p.id) }),
            });
          } catch { /* ignore */ }
        }
      }
      for (const p of current) {
        if (String(p.id) !== creatorId && !newIds.includes(String(p.id))) {
          try {
            await apiFetch(`/projet/${editing.id}/participants/${p.id}`, { method: "DELETE" });
          } catch { /* ignore */ }
        }
      }
      showToast("Projet modifié ✓");
      setEditing(null); setSelected(null);
      loadData();
    } catch (e) { showToast(e.message, "error"); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async id => {
    try {
      await apiFetch(`/projet/${id}`, { method: "DELETE" });
      showToast("Projet supprimé");
      setConfirm(null); setSelected(null);
      loadData();
    } catch (e) { showToast(e.message, "error"); }
  };

  const openDetail = async p => {
    try { setSelected(await apiFetch(`/projet/${p.id}`)); }
    catch { setSelected(p); }
  };

  const resetFilters = () => { setSearch(""); setFilterStatut(""); setCurrentPage(1); };

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <div className="pj-root">

      {/* Toast */}
      {toast && (
        <div className={`pj-toast pj-toast-${toast.type}`}>
          {toast.type === "success" ? "✓" : "⚠"} {toast.msg}
        </div>
      )}

      {/* ── Topbar ── */}
      <div className="pj-topbar">
        <div className="pj-topbar-left">
          <h1 className="pj-page-title">Projets</h1>
          {!loading && (
            <span className="pj-count-pill">{projets.length} projet{projets.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <button className="pj-btn-primary" onClick={() => setEditing(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Nouveau projet
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="pj-toolbar">
        <div className="pj-search-wrap">
          <svg className="pj-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            className="pj-search-input"
            placeholder="Rechercher titre, domaine, participants…"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          />
          {search && <button className="pj-search-clear" onClick={() => setSearch("")}>✕</button>}
        </div>

        <select
          className="pj-filter-select"
          value={filterStatut}
          onChange={e => { setFilterStatut(e.target.value); setCurrentPage(1); }}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <button className="pj-btn-refresh" onClick={loadData} disabled={loading} title="Actualiser">
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className={loading ? "pj-spin" : ""}
          >
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      {/* ── Body ── */}
      <div className="pj-body-layout">

        {/* Colonne principale */}
        <div className="pj-main-col">
          {loading ? (
            <div className="pj-state-center">
              <div className="pj-spinner" />
              <span>Chargement des projets…</span>
            </div>
          ) : error ? (
            <div className="pj-state-center pj-state-err">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{error}</span>
              <button className="pj-btn-ghost pj-btn-sm" onClick={loadData}>Réessayer</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="pj-state-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span>Aucun projet trouvé</span>
              {(search || filterStatut) && (
                <button className="pj-btn-ghost pj-btn-sm" onClick={resetFilters}>Effacer les filtres</button>
              )}
            </div>
          ) : (
            <>
              {/* En-tête tableau */}
              <div className="pj-list-header">
                <span className="pj-col-title">Titre</span>
                <span className="pj-col-center">Participants</span>
                <span className="pj-col-center">Année</span>
                <span className="pj-col-center">Statut</span>
                <span className="pj-col-center">Actions</span>
              </div>

              {/* Lignes */}
              <div className="pj-list">
                {paginated.map(p => (
                  <div key={p.id} className="pj-list-row" onClick={() => openDetail(p)}>
                    <div className="pj-list-main">
                      <span className="pj-list-title">{p.titre}</span>
                      {p.participants?.length > 0 && (
                        <div className="pj-list-authors">
                          {p.participants.map(x => x.nom).join(", ")}
                        </div>
                      )}
                      {p.domaine && (
                        <div className="pj-list-domaine">{p.domaine}</div>
                      )}
                      {p.mots_cles && (
                        <div className="pj-list-keywords">
                          {p.mots_cles.split(",").slice(0, 4).map((k, i) => (
                            <span key={i} className="pj-kw">{k.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pj-col-center">
                      <span className="pj-participants-count">{p.participants?.length || 0}</span>
                    </div>

                    <div className="pj-col-center pj-year">
                      {p.annee_publication || "—"}
                    </div>

                    <div className="pj-col-center">
                      <StatutBadge statut={p.statut} />
                    </div>

                    <div className="pj-col-center pj-actions-col" onClick={e => e.stopPropagation()}>
                      <button
                        className="pj-act-btn"
                        title="Modifier"
                        onClick={() => { setEditing(p); setSelected(null); }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                      </button>
                      <button
                        className="pj-act-btn pj-act-del"
                        title="Supprimer"
                        onClick={() => setConfirm(p.id)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="pj-list-footer">{filtered.length} projet{filtered.length !== 1 ? "s" : ""}</div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pj-pagination">
                  <span className="pj-page-info">Page {currentPage} / {totalPages}</span>
                  <div className="pj-page-btns">
                    <button className="pj-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>←</button>
                    {[...Array(totalPages)].map((_, i) => {
                      const n = i + 1;
                      if (n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                        return (
                          <button
                            key={n}
                            className={`pj-page-btn ${currentPage === n ? "pj-page-active" : ""}`}
                            onClick={() => setCurrentPage(n)}
                          >{n}</button>
                        );
                      if (Math.abs(n - currentPage) === 2) return <span key={n} className="pj-page-dots">…</span>;
                      return null;
                    })}
                    <button className="pj-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>→</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <ScholarSidebar projets={projets} />
      </div>

      {/* ── Panneau détail (slide-in) ── */}
      {selected && !editing && (
        <DetailPanel
          projet={selected}
          onClose={() => setSelected(null)}
          onEdit={p => { setEditing(p); setSelected(null); }}
          onDelete={id => { setConfirm(id); setSelected(null); }}
        />
      )}

      {/* ── Modal création ── */}
      {editing === true && (
        <PjModal title="Nouveau projet" onClose={() => setEditing(null)} wide>
          <ProjetForm onSubmit={handleCreate} onCancel={() => setEditing(null)} loading={formLoading} />
        </PjModal>
      )}

      {/* ── Modal édition ── */}
      {editing && editing !== true && (
        <PjModal title={`Modifier — ${editing.titre}`} onClose={() => setEditing(null)} wide>
          <ProjetForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} loading={formLoading} />
        </PjModal>
      )}

      {/* ── Modal confirmation suppression ── */}
      {confirm && (
        <PjModal title="Confirmer la suppression" onClose={() => setConfirm(null)}>
          <div className="pj-confirm">
            <div className="pj-confirm-icon">🗑️</div>
            <p>Cette action est <strong>irréversible</strong>. Le projet sera définitivement supprimé.</p>
            <div className="pj-form-actions">
              <button className="pj-btn-ghost" onClick={() => setConfirm(null)}>Annuler</button>
              <button className="pj-btn-danger" onClick={() => handleDelete(confirm)}>Supprimer</button>
            </div>
          </div>
        </PjModal>
      )}
    </div>
  );
}