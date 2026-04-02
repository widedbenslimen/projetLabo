import React, { useState, useEffect, useCallback } from "react";
import "./CadreTechnique.css";
import Document, {
  apiFetch,
  DOCUMENT_TYPES,
  TYPE_META,
  Modal,
  DocumentForm,
  DocumentDetail,
  PubChip,
  TypeBadge,
} from "../../composants/Doc/Doc";

/* ── HELPERS ── */
const getUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); }
  catch { return {}; }
};

/* ── MINI STAT ── */
function MiniStat({ icon, label, value, color, sub }) {
  return (
    <div className="ct-mini-stat" style={{ "--ac": color }}>
      <div className="ct-mini-bar" />
      <span className="ct-mini-icon">{icon}</span>
      <div className="ct-mini-body">
        <span className="ct-mini-val">{value ?? "—"}</span>
        <span className="ct-mini-lbl">{label}</span>
        {sub && <span className="ct-mini-sub">{sub}</span>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
══════════════════════════════════════════════════════════════ */
export default function CadreTechnique() {
  const user = getUser();

  useEffect(() => {
    if (!localStorage.getItem("token")) window.location.href = "/";
  }, []);

  const [docs, setDocs]         = useState([]);
  const [myStats, setMyStats]   = useState({ total: 0, publies: 0, brouillons: 0, types: {} });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const [activeTab, setActiveTab] = useState("dashboard");

  const [selected, setSelected]       = useState(null);
  const [editing, setEditing]         = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [confirm, setConfirm]         = useState(null);
  const [toast, setToast]             = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const loadDocs = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch("/documents");
      // Filtrer uniquement les documents de l'utilisateur connecté
      const mine = data.filter(d => d.auteur_id === user.id || d.auteur_nom === user.nom);
      setDocs(mine);

      const total      = mine.length;
      const publies    = mine.filter(d => d.publie).length;
      const brouillons = total - publies;
      const types      = {};
      mine.forEach(d => { types[d.type] = (types[d.type] || 0) + 1; });
      setMyStats({ total, publies, brouillons, types });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [user.id, user.nom]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  /* CRUD */
  const handleCreate = async fd => {
    setFormLoading(true);
    try { 
      await apiFetch("/documents", { method: "POST", body: fd }); 
      showToast("Document créé ✓"); 
      setEditing(null); 
      loadDocs(); 
    }
    catch (e) { showToast(e.message, "error"); } 
    finally { setFormLoading(false); }
  };

  const handleUpdate = async fd => {
    setFormLoading(true);
    try { 
      await apiFetch(`/documents/${editing.id}`, { method: "PUT", body: fd }); 
      showToast("Mis à jour ✓"); 
      setEditing(null); 
      setSelected(null); 
      loadDocs(); 
    }
    catch (e) { showToast(e.message, "error"); } 
    finally { setFormLoading(false); }
  };

  const handleDelete = async id => {
    try { 
      await apiFetch(`/documents/${id}`, { method: "DELETE" }); 
      showToast("Supprimé"); 
      setConfirm(null); 
      setSelected(null); 
      loadDocs(); 
    }
    catch (e) { showToast(e.message, "error"); }
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
      loadDocs();
    } catch (e) { showToast(e.message, "error"); }
  };

  const openDetail = async doc => {
    try { setSelected(await apiFetch(`/documents/${doc.id}`)); }
    catch { setSelected(doc); }
  };

  const topType = Object.entries(myStats.types).sort((a, b) => b[1] - a[1])[0];
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/Connexion';
  };

  return (
    <div className="ct-root">
      {toast && <div className={`ct-toast ct-toast-${toast.type}`}>{toast.msg}</div>}

      {/* ── SIDEBAR ── */}
      <aside className="ct-sidebar">
        <div className="ct-sidebar-brand">
          <span className="ct-brand-icon">◈</span>
          <span className="ct-brand-text">Lab<em>Tech</em></span>
        </div>
        <nav className="ct-sidebar-nav">
          <button 
            className={`ct-nav-item ${activeTab === "dashboard" ? "active" : ""}`} 
            onClick={() => setActiveTab("dashboard")}
          >
            <span className="ct-nav-icon">▦</span>
            <span>Tableau de bord</span>
          </button>
          <button 
            className={`ct-nav-item ${activeTab === "documents" ? "active" : ""}`} 
            onClick={() => setActiveTab("documents")}
          >
            <span className="ct-nav-icon">📄</span>
            <span>Mes documents</span>
            <span className="ct-nav-badge">{myStats.total}</span>
          </button>
        </nav>
        <div className="ct-sidebar-footer">
          <div className="ct-avatar">{(user.nom || "T").charAt(0).toUpperCase()}</div>
          <div className="ct-user-info">
            <span className="ct-user-name">{user.nom || "Cadre Technique"}</span>
            <span className="ct-user-role">Cadre Technique</span>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="ct-main">
        {/* Topbar */}
        <header className="ct-topbar">
          <h1 className="ct-page-title">
            {activeTab === "dashboard" ? "Tableau de bord" : "Mes documents"}
          </h1>
          <div className="ct-topbar-right">
            <button className="ct-btn-refresh" onClick={loadDocs} disabled={loading}>
              <span className={loading ? "ct-spin" : ""}>↺</span>
              {loading ? "Chargement…" : "Actualiser"}
            </button>
            <button className="ch-btn-logout" onClick={handleLogout} title="Déconnexion">⏻</button>
          </div>
        </header>

        {error && (
          <div className="ct-alert ct-alert-err">
            <span>⚠</span> {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        <div className="ct-tab-content">

          {/* ── DASHBOARD TAB ── */}
          {activeTab === "dashboard" && (
            <div className="ct-dashboard">

              {/* Stats */}
              <div className="ct-stats-row">
                <MiniStat icon="📄" label="Total documents" value={myStats.total}      color="#4f8ef7" />
                <MiniStat icon="✅" label="Publiés"          value={myStats.publies}    color="#34d399" />
                <MiniStat icon="◌"  label="Brouillons"       value={myStats.brouillons} color="#f97316" />
                {topType && (
                  <MiniStat
                    icon={TYPE_META[topType[0]]?.icon || "📄"}
                    label="Type principal"
                    value={topType[0]}
                    color={TYPE_META[topType[0]]?.color || "#888"}
                    sub={`${topType[1]} doc(s)`}
                  />
                )}
              </div>

              {/* Type breakdown + recent docs */}
              <div className="ct-dash-bottom">
                <div className="ct-card">
                  <div className="ct-card-header">
                    <span className="ct-card-title">Répartition par type</span>
                    <button className="ct-btn-link" onClick={() => setActiveTab("documents")}>Voir tout →</button>
                  </div>
                  <div className="ct-type-breakdown">
                    {DOCUMENT_TYPES.map(type => {
                      const count = myStats.types[type] || 0;
                      const pct   = myStats.total ? Math.round((count / myStats.total) * 100) : 0;
                      const m     = TYPE_META[type];
                      return (
                        <div key={type} className="ct-type-row">
                          <span className="ct-type-icon">{m.icon}</span>
                          <span className="ct-type-name">{type}</span>
                          <div className="ct-type-bar-wrap">
                            <div className="ct-type-bar" style={{ width: `${pct}%`, background: m.color }} />
                          </div>
                          <span className="ct-type-count" style={{ color: m.color }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="ct-card">
                  <div className="ct-card-header">
                    <span className="ct-card-title">Documents récents</span>
                    <button className="ct-btn-link" onClick={() => setActiveTab("documents")}>Voir tout →</button>
                  </div>
                  <div className="ct-recent-list">
                    {loading
                      ? [1,2,3].map(i => <div key={i} className="ct-skeleton" />)
                      : docs.slice(0, 5).map(doc => {
                          const m = TYPE_META[doc.type] || { icon: "📄", color: "#888" };
                          return (
                            <div key={doc.id} className="ct-recent-item"
                              onClick={() => { setActiveTab("documents"); openDetail(doc); }}>
                              <span className="ct-recent-icon" style={{ color: m.color }}>{m.icon}</span>
                              <div className="ct-recent-info">
                                <strong>{doc.titre}</strong>
                                <small>{new Date(doc.date_creation).toLocaleDateString("fr-FR")}</small>
                              </div>
                              <PubChip publie={doc.publie} />
                            </div>
                          );
                        })}
                    {!loading && docs.length === 0 && (
                      <p className="ct-empty-msg">
                        Aucun document.{" "}
                        <button className="ct-btn-link" onClick={() => { setActiveTab("documents"); setEditing(true); }}>
                          Créer le premier →
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DOCUMENTS TAB : composant Document importé ── */}
          {activeTab === "documents" && (
            <Document
              docs={docs}
              loading={loading}
              error={error}
              onReload={loadDocs}
              onOpenDetail={openDetail}
              onEdit={doc => { setEditing(doc); setSelected(null); }}
              onDelete={id => setConfirm(id)}
              onPublish={handlePublish}
              onCreate={() => setEditing(true)}
            />
          )}
        </div>
      </main>

      {/* ── MODALS ── */}
      {editing === true && (
        <Modal title="Nouveau document" onClose={() => setEditing(null)}>
          <DocumentForm onSubmit={handleCreate} onCancel={() => setEditing(null)} loading={formLoading} />
        </Modal>
      )}
      {editing && editing !== true && (
        <Modal title={`Modifier — ${editing.titre}`} onClose={() => setEditing(null)}>
          <DocumentForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} loading={formLoading} />
        </Modal>
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
        <Modal title="Confirmer la suppression" onClose={() => setConfirm(null)} size="sm">
          <div className="ct-confirm">
            <p>⚠ Cette action est <strong>irréversible</strong>. Le document et son fichier seront définitivement supprimés.</p>
            <div className="ct-confirm-actions">
              <button className="ct-btn-ghost" onClick={() => setConfirm(null)}>Annuler</button>
              <button className="ct-btn-danger" onClick={() => handleDelete(confirm)}>⊘ Supprimer</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}