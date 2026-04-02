import React, { useState, useEffect, useCallback } from "react";
import "./Projet.css";

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

// ── BADGE STATUT ─────────────────────────────────────────────
const statutColors = {
  en_cours:    { bg: "#e8f0fe", color: "#1a73e8", label: "En cours" },
  soumis:      { bg: "#fce8b2", color: "#f29900", label: "Soumis" },
  en_revision: { bg: "#fce8b2", color: "#e37400", label: "En révision" },
  accepte:     { bg: "#e6f4ea", color: "#1e8e3e", label: "Accepté" },
  publie:      { bg: "#e6f4ea", color: "#0d652d", label: "Publié" },
  retire:      { bg: "#fce8e6", color: "#c5221f", label: "Retiré" },
};

const TYPE_ICONS = {
  ENQUETE: "📋", RAPPORT: "📊", IMAGE: "🖼️",
  VIDEO: "🎬", CARTE: "🗺️", ARTICLE: "📰",
};

function StatutBadge({ statut }) {
  const s = statutColors[statut] || { bg: "#f1f3f4", color: "#5f6368", label: statut };
  return (
    <span className="pj-statut-badge" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── MODAL ────────────────────────────────────────────────────
function PjModal({ title, onClose, children, wide }) {
  return (
    <div className="pj-overlay" onClick={onClose}>
      <div className={`pj-modal ${wide ? "pj-modal-wide" : ""}`} onClick={e => e.stopPropagation()}>
        <div className="pj-modal-head">
          <span className="pj-modal-title">{title}</span>
          <button className="pj-modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="pj-modal-body">{children}</div>
      </div>
    </div>
  );
}

// ── FORM ─────────────────────────────────────────────────────
function ProjetForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    titre:             "",
    description:       "",
    domaine:           "",
    mots_cles:         "",
    annee_publication: "",
    date_debut:        "",
    date_fin:          "",
    statut:            "en_cours",
    ...(initial || {}),
  });

  const [participantEmail,     setParticipantEmail]     = useState("");
  const [participants,         setParticipants]         = useState(
    initial?.participants?.map(p => ({ id: p.id, nom: p.nom, email: p.email })) || []
  );
  const [participantError,     setParticipantError]     = useState("");
  const [participantSearching, setParticipantSearching] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addParticipantByEmail = async () => {
    setParticipantError("");
    const val = participantEmail.trim();
    if (!val) return;
    setParticipantSearching(true);
    try {
      const users = await apiFetch(`/utilisateur?email=${encodeURIComponent(val)}`);
      const user  = Array.isArray(users) ? users[0] : users;
      if (!user?.id) { setParticipantError("Aucun utilisateur trouvé avec cet email."); return; }
      if (participants.some(p => p.id === user.id)) { setParticipantError("Ce participant est déjà dans la liste."); return; }
      setParticipants(prev => [...prev, { id: user.id, nom: user.nom, email: user.email }]);
      setParticipantEmail("");
    } catch {
      setParticipantError("Utilisateur introuvable ou erreur serveur.");
    } finally { setParticipantSearching(false); }
  };

  const removeParticipant = id => setParticipants(prev => prev.filter(p => p.id !== id));

  const handleSubmit = e => {
    e.preventDefault();
    const body = {};
    Object.entries(form).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") body[k] = v;
    });
    const creatorId          = initial?.createur_id;
    const participantsToSync = creatorId
      ? participants.filter(p => p.id !== creatorId)
      : participants;
    onSubmit(body, participantsToSync);
  };

  return (
    <form className="pj-form" onSubmit={handleSubmit}>
      <div className="pj-form-section">
        <div className="pj-form-section-title">Informations générales</div>
        <div className="pj-field pj-full">
          <label>Titre *</label>
          <input required value={form.titre} onChange={e => set("titre", e.target.value)} placeholder="Titre du projet" />
        </div>
        <div className="pj-field pj-full">
          <label>Description</label>
          <textarea rows={4} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Description du projet..." />
        </div>
        <div className="pj-field">
          <label>Statut</label>
          <select value={form.statut} onChange={e => set("statut", e.target.value)}>
            {Object.entries(statutColors).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="pj-form-section">
        <div className="pj-form-section-title">Métadonnées</div>
        <div className="pj-field">
          <label>Domaine</label>
          <input value={form.domaine} onChange={e => set("domaine", e.target.value)} placeholder="ex: Informatique, Biologie..." />
        </div>
        <div className="pj-field">
          <label>Année de publication</label>
          <input type="number" min="1900" max="2100" value={form.annee_publication}
            onChange={e => set("annee_publication", e.target.value)} placeholder="ex: 2024" />
        </div>
        <div className="pj-field pj-full">
          <label>Mots-clés</label>
          <input value={form.mots_cles} onChange={e => set("mots_cles", e.target.value)} placeholder="mot1, mot2, mot3..." />
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

      <div className="pj-form-section">
        <div className="pj-form-section-title">Participants</div>
        <div className="pj-field pj-full">
          <label>Ajouter un participant par email</label>
          <div className="pj-participant-add-row">
            <input type="email" value={participantEmail}
              onChange={e => { setParticipantEmail(e.target.value); setParticipantError(""); }}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addParticipantByEmail())}
              placeholder="email@exemple.com" className="pj-participant-email-input" />
            <button type="button" className="pj-btn-add-participant"
              onClick={addParticipantByEmail} disabled={participantSearching}>
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
                      onClick={() => removeParticipant(p.id)} title="Retirer">✕</button>
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
          {loading ? "Enregistrement…" : initial ? "✎ Modifier" : "+ Créer"}
        </button>
      </div>
    </form>
  );
}

// ── DOCUMENT ROW dans le détail projet ───────────────────────
// Affiche nom + icône type + lien cliquable pour ouvrir le fichier
function ProjetDocRow({ doc }) {
  const fileUrl = doc.lien
    ? `http://localhost:8000/${doc.lien.replace(/\\/g, "/")}`
    : null;

  const ext = doc.lien ? doc.lien.split(".").pop().toLowerCase() : "";
  const isImg = ["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext);
  const isPdf = ext === "pdf";
  const isVid = ["mp4", "webm", "avi", "mov", "mkv"].includes(ext);

  const [preview, setPreview] = useState(false);

  return (
    <div className="pj-doc-row">
      {/* Icône type */}
      <span className="pj-doc-type-icon">{TYPE_ICONS[doc.type] || "📄"}</span>

      {/* Infos */}
      <div className="pj-doc-info">
        <span className="pj-doc-titre">{doc.titre}</span>
        <div className="pj-doc-meta">
          <span className="pj-doc-type-label">{doc.type}</span>
          {doc.sous_type && <span className="pj-doc-sous-type">{doc.sous_type}</span>}
          {doc.auteur_nom && <span className="pj-doc-auteur">— {doc.auteur_nom}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="pj-doc-actions">
        {fileUrl ? (
          <>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="pj-doc-btn pj-doc-btn-open"
              title="Ouvrir le fichier"
            >
              👁️ Ouvrir
            </a>
            {(isImg || isPdf || isVid) && (
              <button
                className="pj-doc-btn pj-doc-btn-preview"
                onClick={() => setPreview(v => !v)}
                title="Aperçu"
              >
                {preview ? "▲ Fermer" : "▼ Aperçu"}
              </button>
            )}
          </>
        ) : (
          <span className="pj-doc-no-file">Pas de fichier</span>
        )}
      </div>

      {/* Aperçu inline */}
      {preview && fileUrl && (
        <div className="pj-doc-preview">
          {isImg && <img src={fileUrl} alt={doc.titre} style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6 }} />}
          {isPdf && <iframe src={fileUrl} title={doc.titre} style={{ width: "100%", height: 300, borderRadius: 6, border: "1px solid #ddd" }} />}
          {isVid && <video controls style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6 }}><source src={fileUrl} /></video>}
        </div>
      )}
    </div>
  );
}

// ── DETAIL PROJET ────────────────────────────────────────────
function ProjetDetail({ projet, onClose, onDelete, onEdit }) {
  const auteurs = projet.participants?.map(p => p.nom).join(", ") || "—";

  return (
    <PjModal title="" onClose={onClose} wide>
      <div className="pj-detail">
        <h2 className="pj-detail-title">{projet.titre}</h2>

        <div className="pj-detail-meta-grid">
          {projet.participants?.length > 0 && (
            <div className="pj-meta-row">
              <span className="pj-meta-key">Participants</span>
              <span className="pj-meta-val">{auteurs}</span>
            </div>
          )}
          {projet.createur_nom && (
            <div className="pj-meta-row">
              <span className="pj-meta-key">Créateur</span>
              <span className="pj-meta-val">{projet.createur_nom}</span>
            </div>
          )}
          {projet.annee_publication && (
            <div className="pj-meta-row">
              <span className="pj-meta-key">Année</span>
              <span className="pj-meta-val">{projet.annee_publication}</span>
            </div>
          )}
          {projet.domaine && (
            <div className="pj-meta-row">
              <span className="pj-meta-key">Domaine</span>
              <span className="pj-meta-val">{projet.domaine}</span>
            </div>
          )}
          {projet.date_debut && (
            <div className="pj-meta-row">
              <span className="pj-meta-key">Date de début</span>
              <span className="pj-meta-val">{new Date(projet.date_debut).toLocaleDateString("fr-FR")}</span>
            </div>
          )}
          {projet.date_fin && (
            <div className="pj-meta-row">
              <span className="pj-meta-key">Date de fin</span>
              <span className="pj-meta-val">{new Date(projet.date_fin).toLocaleDateString("fr-FR")}</span>
            </div>
          )}
          <div className="pj-meta-row">
            <span className="pj-meta-key">Statut</span>
            <span className="pj-meta-val"><StatutBadge statut={projet.statut} /></span>
          </div>
        </div>

        {projet.description && (
          <div className="pj-detail-desc-block">
            <span className="pj-meta-key">Description</span>
            <p className="pj-detail-desc-text">{projet.description}</p>
          </div>
        )}

        {projet.mots_cles && (
          <div className="pj-detail-keywords">
            {projet.mots_cles.split(",").map((k, i) => (
              <span key={i} className="pj-keyword-chip">{k.trim()}</span>
            ))}
          </div>
        )}

        {/* ── Documents du projet avec liens cliquables ── */}
        <div className="pj-detail-docs-section">
          <div className="pj-detail-docs-header">
            <span className="pj-meta-key">
              Documents ({projet.documents?.length || 0})
            </span>
          </div>

          {!projet.documents || projet.documents.length === 0 ? (
            <div className="pj-no-docs">
              <span>📂</span>
              <span>Aucun document associé à ce projet</span>
            </div>
          ) : (
            <div className="pj-docs-list">
              {projet.documents.map(doc => (
                <ProjetDocRow key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </div>

        <div className="pj-detail-actions">
          <button className="pj-btn-ghost" onClick={() => onEdit(projet)}>✎ Modifier</button>
          <button className="pj-btn-danger" onClick={() => onDelete(projet.id)}>⊘ Supprimer</button>
        </div>
      </div>
    </PjModal>
  );
}

// ── SCHOLAR SIDEBAR ───────────────────────────────────────────
function ScholarSidebar({ projets }) {
  const [showAll, setShowAll] = useState(false);
  const safeProjets = projets || [];

  const totalPubs       = safeProjets.length;
  const publie          = safeProjets.filter(p => p.statut === "publie").length;
  const enCours         = safeProjets.filter(p => p.statut === "en_cours").length;

  const coauteurMap = {};
  safeProjets.forEach(p => {
    (p.participants || []).forEach(u => {
      if (!coauteurMap[u.id])
        coauteurMap[u.id] = { id: u.id, nom: u.nom, email: u.email, count: 0 };
      coauteurMap[u.id].count += 1;
    });
  });
  const coauteurs        = Object.values(coauteurMap).sort((a, b) => b.count - a.count);
  const visibleCoauteurs = showAll ? coauteurs : coauteurs.slice(0, 6);

  return (
    <aside className="pj-sidebar">
      <div className="pj-sidebar-card">
        <div className="pj-sidebar-card-title">Statistiques</div>
        <table className="pj-scholar-stat-table">
          <thead><tr><th></th><th>Total</th><th>Publiés</th></tr></thead>
          <tbody>
            <tr><td className="pj-stat-label">Projets</td><td className="pj-stat-val">{totalPubs}</td><td className="pj-stat-val">{publie}</td></tr>
            <tr><td className="pj-stat-label">Participants</td><td className="pj-stat-val">{coauteurs.length}</td><td className="pj-stat-val">—</td></tr>
            <tr><td className="pj-stat-label">En cours</td><td className="pj-stat-val">{enCours}</td><td className="pj-stat-val">—</td></tr>
          </tbody>
        </table>
      </div>

      {coauteurs.length > 0 && (
        <div className="pj-sidebar-card">
          <div className="pj-sidebar-card-title">
            Participants
            {coauteurs.length > 6 && (
              <span className="pj-sidebar-voir-tout" onClick={() => setShowAll(s => !s)}>
                {showAll ? "RÉDUIRE" : "TOUT AFFICHER"}
              </span>
            )}
          </div>
          <div className="pj-coauteurs-list">
            {visibleCoauteurs.map(c => (
              <div key={c.id} className="pj-coauteur-row">
                <div className="pj-coauteur-avatar">{c.nom?.[0]?.toUpperCase()}</div>
                <div className="pj-coauteur-info">
                  <span className="pj-coauteur-nom">{c.nom}</span>
                  {c.email && <span className="pj-coauteur-email">{c.email}</span>}
                </div>
                <span className="pj-coauteur-arrow">›</span>
              </div>
            ))}
            {!showAll && coauteurs.length > 6 && (
              <div style={{ textAlign: "center", padding: "6px 0", fontSize: 12, color: "#5f6368" }}>
                +{coauteurs.length - 6} autres
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

// ── MAIN ─────────────────────────────────────────────────────
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

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch("/projet");
      const list = showOnlyUserProjets && user
        ? data.filter(p => p.participants?.some(x => x.id === user.id))
        : data;
      setProjets(list);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [showOnlyUserProjets, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = projets.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q
      || p.titre?.toLowerCase().includes(q)
      || p.description?.toLowerCase().includes(q)
      || p.mots_cles?.toLowerCase().includes(q)
      || p.domaine?.toLowerCase().includes(q)
      || p.createur_nom?.toLowerCase().includes(q);
    return matchQ && (!filterStatut || p.statut === filterStatut);
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated  = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

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
      showToast("Projet créé ✓");
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

  // openDetail charge le détail complet (avec documents et leurs liens)
  const openDetail = async p => {
    try { setSelected(await apiFetch(`/projet/${p.id}`)); }
    catch { setSelected(p); }
  };

  return (
    <div className="pj-root">
      {toast && <div className={`pj-toast pj-toast-${toast.type}`}>{toast.msg}</div>}

      <div className="pj-header">
        <div className="pj-header-left">
          <h1 className="pj-page-title">Projets</h1>
          <p className="pj-page-sub">Gérez vos projets de recherche</p>
        </div>
        <button className="pj-btn-primary pj-btn-new" onClick={() => setEditing(true)}>
          + Nouveau projet
        </button>
      </div>

      <div className="pj-toolbar">
        <div className="pj-search-wrap">
          <span className="pj-search-icon">🔍</span>
          <input className="pj-search-input" placeholder="Rechercher..."
            value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} />
          {search && <button className="pj-search-clear" onClick={() => setSearch("")}>✕</button>}
        </div>
        <select className="pj-filter-select" value={filterStatut}
          onChange={e => { setFilterStatut(e.target.value); setCurrentPage(1); }}>
          <option value="">Tous les statuts</option>
          {Object.entries(statutColors).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button className="pj-btn-refresh" onClick={loadData} disabled={loading} title="Actualiser">
          <span className={loading ? "pj-spin" : ""}>↺</span>
        </button>
      </div>

      <div className="pj-body-layout">
        <div className="pj-main-col">
          {loading ? (
            <div className="pj-center-state"><div className="pj-spinner" /><span>Chargement...</span></div>
          ) : error ? (
            <div className="pj-center-state pj-err">
              <span>⚠ {error}</span>
              <button className="pj-btn-ghost" onClick={loadData}>Réessayer</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="pj-center-state">
              <span style={{ fontSize: 40 }}>📁</span>
              <span>Aucun projet trouvé</span>
              {search && <button className="pj-btn-ghost" onClick={() => setSearch("")}>Effacer</button>}
            </div>
          ) : (
            <>
              <div className="pj-list">
                <div className="pj-list-header">
                  <span className="pj-list-col-title">TITRE</span>
                  <span className="pj-list-col">PARTICIPANTS</span>
                  <span className="pj-list-col">ANNÉE</span>
                  <span className="pj-list-col">STATUT</span>
                  <span className="pj-list-col">ACTIONS</span>
                </div>
                {paginated.map(p => (
                  <div key={p.id} className="pj-list-row" onClick={() => openDetail(p)}>
                    <div className="pj-list-main">
                      <span className="pj-list-title">{p.titre}</span>
                      {p.participants?.length > 0 && (
                        <div className="pj-list-authors">
                          {p.participants.map(x => x.nom).join(", ")}
                        </div>
                      )}
                      {p.domaine && <div className="pj-list-journal">{p.domaine}</div>}
                      {p.mots_cles && (
                        <div className="pj-list-keywords">
                          {p.mots_cles.split(",").slice(0, 4).map((k, i) => (
                            <span key={i} className="pj-kw">{k.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="pj-list-col pj-cited">
                      <span className="pj-cited-val">{p.participants?.length || 0}</span>
                    </div>
                    <div className="pj-list-col pj-year">{p.annee_publication || "—"}</div>
                    <div className="pj-list-col"><StatutBadge statut={p.statut} /></div>
                    <div className="pj-list-col pj-actions-col" onClick={e => e.stopPropagation()}>
                      <button className="pj-act-btn" title="Modifier" onClick={() => { setEditing(p); setSelected(null); }}>✎</button>
                      <button className="pj-act-btn pj-act-del" title="Supprimer" onClick={() => setConfirm(p.id)}>⊘</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pj-list-footer">{filtered.length} projet(s) trouvé(s)</div>

              {totalPages > 1 && (
                <div className="pj-pagination">
                  <span className="pj-page-info">Page {currentPage} / {totalPages}</span>
                  <div className="pj-page-btns">
                    <button className="pj-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>←</button>
                    {[...Array(totalPages)].map((_, i) => {
                      const n = i + 1;
                      if (n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                        return <button key={n} className={`pj-page-btn ${currentPage === n ? "pj-page-active" : ""}`} onClick={() => setCurrentPage(n)}>{n}</button>;
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
        <ScholarSidebar projets={projets} />
      </div>

      {editing === true && (
        <PjModal title="Nouveau projet" onClose={() => setEditing(null)} wide>
          <ProjetForm onSubmit={handleCreate} onCancel={() => setEditing(null)} loading={formLoading} />
        </PjModal>
      )}
      {editing && editing !== true && (
        <PjModal title={`Modifier — ${editing.titre}`} onClose={() => setEditing(null)} wide>
          <ProjetForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} loading={formLoading} />
        </PjModal>
      )}
      {selected && !editing && (
        <ProjetDetail
          projet={selected}
          onClose={() => setSelected(null)}
          onDelete={id => { setConfirm(id); setSelected(null); }}
          onEdit={p => { setEditing(p); setSelected(null); }}
        />
      )}
      {confirm && (
        <PjModal title="Confirmer la suppression" onClose={() => setConfirm(null)}>
          <div className="pj-confirm">
            <p>⚠ Cette action est <strong>irréversible</strong>.</p>
            <div className="pj-form-actions">
              <button className="pj-btn-ghost" onClick={() => setConfirm(null)}>Annuler</button>
              <button className="pj-btn-danger" onClick={() => handleDelete(confirm)}>⊘ Supprimer</button>
            </div>
          </div>
        </PjModal>
      )}
    </div>
  );
}