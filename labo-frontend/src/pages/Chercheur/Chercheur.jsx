import React, { useState, useEffect, useCallback } from "react";
import "./Chercheur.css";
import Document, {
  apiFetch,
  DOCUMENT_TYPES,
  TYPE_META,
  Modal,
  DocumentForm,
  DocumentDetail,
  PubChip,
} from "../../composants/Doc/Doc";
import Projet from "../../composants/Projet/Projet"; // ← Import correct
import Rapport from "../../composants/Rapport/Rapport";

/* ── HELPERS ── */
const getUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); }
  catch { return {}; }
};

/* ── MINI STAT ── */
function MiniStat({ icon, label, value, color, sub }) {
  return (
    <div className="ch-mini-stat" style={{ "--ac": color }}>
      <div className="ch-mini-bar" />
      <span className="ch-mini-icon">{icon}</span>
      <div className="ch-mini-body">
        <span className="ch-mini-val">{value ?? "—"}</span>
        <span className="ch-mini-lbl">{label}</span>
        {sub && <span className="ch-mini-sub">{sub}</span>}
      </div>
    </div>
  );
}

// StatCard pour les projets
function StatCard({ icon, label, value, colorClass }) {
  return (
    <div className={`ch-stat-card ${colorClass}`}>
      <div className="ch-stat-card-inner">
        <span className="ch-stat-icon-wrap">{icon}</span>
        <div className="ch-stat-body">
          <span className="ch-stat-label">{label}</span>
          <span className="ch-stat-value">{value}</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE COMPONENT
═══════════════════════════════════════════ */
export default function Chercheur() {
  const user = getUser();

  useEffect(() => {
    if (!localStorage.getItem("token")) window.location.href = "/";
  }, []);

  const [docs, setDocs]         = useState([]);
  const [projets, setProjets]   = useState([]);
  const [myStats, setMyStats]   = useState({ total: 0, publies: 0, projets: 0, brouillons: 0, types: {} });
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
      const mine = data.filter(d => d.auteur_id === user.id || d.auteur_nom === user.nom);
      setDocs(mine);

      const total      = mine.length;
      const publies    = mine.filter(d => d.publie).length;
      const brouillons = total - publies;
      const types      = {};
      mine.forEach(d => { types[d.type] = (types[d.type] || 0) + 1; });
      setMyStats(prev => ({ ...prev, total, publies, brouillons, types }));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [user.id, user.nom]);

  const loadProjets = useCallback(async () => {
    try {
      const data = await apiFetch("/projet");
      // Filtrer les projets où l'utilisateur est participant
      const userProjets = data.filter(projet => 
        projet.participants?.some(p => p.id === user.id)
      );
      setProjets(userProjets);
      setMyStats(prev => ({ ...prev, projets: userProjets.length }));
    } catch (e) {
      console.error("Erreur chargement projets:", e);
    }
  }, [user.id]);

  useEffect(() => { 
    loadDocs(); 
    loadProjets(); 
  }, [loadDocs, loadProjets]);

  /* CRUD pour documents */
  const handleCreate = async fd => {
    setFormLoading(true);
    try { await apiFetch("/documents", { method: "POST", body: fd }); showToast("Document créé ✓"); setEditing(null); loadDocs(); }
    catch (e) { showToast(e.message, "error"); } finally { setFormLoading(false); }
  };

  const handleUpdate = async fd => {
    setFormLoading(true);
    try { await apiFetch(`/documents/${editing.id}`, { method: "PUT", body: fd }); showToast("Mis à jour ✓"); setEditing(null); setSelected(null); loadDocs(); }
    catch (e) { showToast(e.message, "error"); } finally { setFormLoading(false); }
  };

  const handleDelete = async id => {
    try { await apiFetch(`/documents/${id}`, { method: "DELETE" }); showToast("Supprimé"); setConfirm(null); setSelected(null); loadDocs(); }
    catch (e) { showToast(e.message, "error"); }
  };

  const handlePublish = async id => {
    try {
      await apiFetch(`/documents/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      showToast("Document publié 📢"); setSelected(null); loadDocs();
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
    <div className="ch-root">
      {toast && <div className={`ch-toast ch-toast-${toast.type}`}>{toast.msg}</div>}

      {/* ── SIDEBAR ── */}
      <aside className="ch-sidebar">
        <div className="ch-sidebar-brand">
          <span className="ch-brand-icon">◉</span>
          <span className="ch-brand-text">Lab<em>Chercheur</em></span>
        </div>
        <nav className="ch-sidebar-nav">
          <button className={`ch-nav-item ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>
            <span className="ch-nav-icon">▦</span><span>Tableau de bord</span>
          </button>
          <button className={`ch-nav-item ${activeTab === "documents" ? "active" : ""}`} onClick={() => setActiveTab("documents")}>
            <span className="ch-nav-icon">📄</span><span>Mes documents</span>
            <span className="ch-nav-badge">{myStats.total}</span>
          </button>
          <button 
            className={`ch-nav-item ${activeTab === 'projet' ? 'active' : ''}`} 
            onClick={() => setActiveTab('projet')}
          >
            <span className="ch-nav-icon">📁</span>
            <span>Mes projets</span>
            <span className="ch-nav-badge">{myStats.projets}</span>
          </button>
          <button 
            className={`ch-nav-item ${activeTab === 'rapport' ? 'active' : ''}`} 
            onClick={() => setActiveTab('rapport')}
          >
            <span className="ch-nav-icon">📊</span>
            <span>Gérer Rapport</span>
          </button>
        </nav>
        <div className="ch-sidebar-footer">
          <div className="ch-avatar">{(user.nom || "C").charAt(0).toUpperCase()}</div>
          <div className="ch-user-info">
            <span className="ch-user-name">{user.nom || "Chercheur"}</span>
            <span className="ch-user-role">Chercheur</span>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="ch-main">
        {/* Topbar */}
        <header className="ch-topbar">
          <h1 className="ch-page-title">
            {activeTab === "dashboard" && "Tableau de bord"}
            {activeTab === "documents" && "Mes documents"}
            {activeTab === "projet" && "Mes projets"}
            {activeTab === "rapport" && "Gérer Rapport"}
          </h1>
          <div className="ch-topbar-right">
            <button className="ch-btn-refresh" onClick={() => { loadDocs(); loadProjets(); }} disabled={loading}>
              <span className={loading ? "ch-spin" : ""}>↺</span>
              {loading ? "Chargement…" : "Actualiser"}
            </button>
            <button className="ch-btn-logout" onClick={handleLogout} title="Déconnexion">⏻</button>
          </div>
        </header>

        {error && (
          <div className="ch-alert ch-alert-err">
            <span>⚠</span> {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* ── DASHBOARD TAB ── */}
        {activeTab === "dashboard" && (
          <div className="ch-dashboard">
            {/* Stats */}
            <div className="ch-stats-row">
              <MiniStat icon="📄" label="Total documents" value={myStats.total}      color="#4f8ef7" />
              <MiniStat icon="✅" label="Publiés"          value={myStats.publies}    color="#34d399" />
              <MiniStat icon="◌"  label="Brouillons"       value={myStats.brouillons} color="#f97316" />
              <StatCard icon="📁" label="Projets" value={myStats.projets} colorClass="sc-orange" />
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

            {/* Type breakdown + recent docs + recent projets */}
            <div className="ch-dash-bottom">
              <div className="ch-card">
                <div className="ch-card-header">
                  <span className="ch-card-title">Répartition par type</span>
                  <button className="ch-btn-link" onClick={() => setActiveTab("documents")}>Voir tout →</button>
                </div>
                <div className="ch-type-breakdown">
                  {DOCUMENT_TYPES.map(type => {
                    const count = myStats.types[type] || 0;
                    const pct   = myStats.total ? Math.round((count / myStats.total) * 100) : 0;
                    const m     = TYPE_META[type];
                    return (
                      <div key={type} className="ch-type-row">
                        <span className="ch-type-icon">{m.icon}</span>
                        <span className="ch-type-name">{type}</span>
                        <div className="ch-type-bar-wrap">
                          <div className="ch-type-bar" style={{ width: `${pct}%`, background: m.color }} />
                        </div>
                        <span className="ch-type-count" style={{ color: m.color }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="ch-card">
                <div className="ch-card-header">
                  <span className="ch-card-title">Documents récents</span>
                  <button className="ch-btn-link" onClick={() => setActiveTab("documents")}>Voir tout →</button>
                </div>
                <div className="ch-recent-list">
                  {loading
                    ? [1,2,3].map(i => <div key={i} className="ch-skeleton" />)
                    : docs.slice(0, 5).map(doc => {
                        const m = TYPE_META[doc.type] || { icon: "📄", color: "#888" };
                        return (
                          <div key={doc.id} className="ch-recent-item"
                            onClick={() => { setActiveTab("documents"); openDetail(doc); }}>
                            <span className="ch-recent-icon" style={{ color: m.color }}>{m.icon}</span>
                            <div className="ch-recent-info">
                              <strong>{doc.titre}</strong>
                              <small>{new Date(doc.date_creation).toLocaleDateString("fr-FR")}</small>
                            </div>
                            <PubChip publie={doc.publie} />
                          </div>
                        );
                      })}
                  {!loading && docs.length === 0 && (
                    <p className="ch-empty-msg">
                      Aucun document.{" "}
                      <button className="ch-btn-link" onClick={() => setActiveTab("documents")}>Créer le premier →</button>
                    </p>
                  )}
                </div>
              </div>

              {/* Projets récents */}
              <div className="ch-card">
                <div className="ch-card-header">
                  <span className="ch-card-title">Projets récents</span>
                  <button className="ch-btn-link" onClick={() => setActiveTab("projet")}>Voir tout →</button>
                </div>
                <div className="ch-recent-list">
                  {projets.slice(0, 5).map(projet => (
                    <div 
                      key={projet.id} 
                      className="ch-recent-item"
                      onClick={() => setActiveTab("projet")}
                    >
                      <span className="ch-recent-icon">📁</span>
                      <div className="ch-recent-info">
                        <strong>{projet.titre}</strong>
                        <small>
                          {projet.participants?.length || 0} participant(s)
                          {projet.date_debut && ` • Début: ${new Date(projet.date_debut).toLocaleDateString("fr-FR")}`}
                        </small>
                      </div>
                    </div>
                  ))}
                  {projets.length === 0 && (
                    <p className="ch-empty-msg">Aucun projet pour le moment.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DOCUMENTS TAB ── */}
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

        {/* ─── PROJETS TAB ─── */}
        {activeTab === 'projet' && (
          <div className="ch-tab-content">
            <Projet key="projet-tab" user={user} showOnlyUserProjets={true} />
          </div>
        )}
        {activeTab === 'rapport' && (
          <div className="ch-tab-content">
            <Rapport user={user} />  {/* ← passer user */}
          </div>
        )}
      </main>

      {/* ── MODALS pour documents ── */}
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
          <div className="ch-confirm">
            <p>⚠ Cette action est <strong>irréversible</strong>. Le document et son fichier seront définitivement supprimés.</p>
            <div className="ch-confirm-actions">
              <button className="ch-btn-ghost" onClick={() => setConfirm(null)}>Annuler</button>
              <button className="ch-btn-danger" onClick={() => handleDelete(confirm)}>⊘ Supprimer</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}