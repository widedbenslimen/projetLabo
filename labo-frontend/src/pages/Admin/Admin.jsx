import React, { useState, useEffect } from 'react';
import './Admin.css';
import Document from "../../composants/Document/Document";
import Projet from "../../composants/Projet/Projet";
import Rapport from "../../composants/Rapport/Rapport";
import ArticlePub from "../../composants/ArticlePub/ArticlePub";
import logo from "../../assets/image.png";
/* ─────────────────────────────────────────────
   CONSTANTS & HELPERS
───────────────────────────────────────────── */
const API_BASE = "http://localhost:8000/api";
const getToken = () => localStorage.getItem('token');

const getAdminName = () => {
  try { return JSON.parse(localStorage.getItem('user') || '{}').nom || 'Admin'; }
  catch { return 'Admin'; }
};

/* ─────────────────────────────────────────────
   NAV ITEMS
───────────────────────────────────────────── */
const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'Utilisateurs',
    statKey: 'users',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: 'documents',
    label: 'Documents',
    statKey: 'documents',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    id: 'projet',
    label: 'Projets',
    statKey: 'projets',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
  id: "articles",
  label: "Articles publiés",
  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <circle cx="12" cy="14" r="3"/>
      <path d="M12 11v-1"/>
    </svg>
  ),
},
  {
    id: "rapport",
    label: "Gérer Rapport",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
];

/* ─────────────────────────────────────────────
   ROLE CONFIG
───────────────────────────────────────────── */
const roles = ['ADMIN', 'CHERCHEUR', 'INVITE', 'CADRE_TECHNIQUE'];

const roleConfig = {
  ADMIN:          { icon: '◈', color: 'role-admin',    label: 'Admin' },
  CHERCHEUR:      { icon: '◉', color: 'role-chercheur', label: 'Chercheur' },
  INVITE:         { icon: '◌', color: 'role-invite',   label: 'Invité' },
  CADRE_TECHNIQUE:{ icon: '◆', color: 'role-cadre',    label: 'Cadre Tech.' },
};

/* ─────────────────────────────────────────────
   STAT CARD
───────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, accent, loading , onClick}) {
  return (
     <div
        className={`ad-stat-card ${onClick ? 'ad-stat-card-clickable' : ''}`}
        style={{ '--sa': accent }}
        onClick={onClick}
      >
        <div className="ad-stat-glow" />
        <div className="ad-stat-header">
          <span className="ad-stat-icon">{icon}</span>
          <span className="ad-stat-label">{label}</span>
        </div>
        <div className="ad-stat-value">
          {loading ? <span className="ad-stat-skeleton" /> : (value ?? '—')}
        </div>
        {sub && <div className="ad-stat-sub">{sub}</div>}
      </div>
    
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const Admin = () => {
  const adminName = getAdminName();
  // ✅ Récupération de l'utilisateur depuis localStorage
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();

  const [stats, setStats] = useState({ utilisateurs_actifs: 0, documents: 0, projets: 0, articlesPublies: 0, recent_users: [] });
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [loading, setLoading]     = useState({ stats: true, users: true, action: false });
  const [error, setError]         = useState(null);
  const [success, setSuccess]     = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  

  
  /* User modal */
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser,   setEditingUser]   = useState(null);
  const [userForm, setUserForm] = useState({ nom: '', email: '', mot_de_passe: '', num_telephone: '', role: 'CHERCHEUR', actif: true });

  /* Filters */
  const [searchTerm,    setSearchTerm]    = useState('');
  const [roleFilter,    setRoleFilter]    = useState('TOUS');
  const [statusFilter,  setStatusFilter]  = useState('TOUS');
  const [currentPage,   setCurrentPage]   = useState(1);
  const usersPerPage = 8;

  /* Confirm delete */
  const [confirmDelete, setConfirmDelete] = useState(null);

  /* ── API calls ── */
  const apiFetch = async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Authorization': `Bearer ${getToken()}`, ...(options.headers || {}) },
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.statusText); }
    return res.json();
  };

  const fetchStats = async () => {
    try {
      setLoading(p => ({ ...p, stats: true }));
      
      // 1. Récupérer les statistiques de base depuis /admin/stats
      const baseStats = await apiFetch('/admin/stats');
      
      // 2. Récupérer le nombre réel d'articles publiés
      let articlesPubliesCount = 0;
      try {
        const articlesResponse = await apiFetch('/documents/articles');
        articlesPubliesCount = articlesResponse.length;
      } catch (err) {
        console.error("Erreur lors de la récupération des articles publiés:", err);
        // Fallback : utiliser la valeur existante si disponible
        articlesPubliesCount = baseStats.articlesPublies || baseStats.articles || 0;
      }
      
      // 3. Fusionner les résultats
      setStats({
        utilisateurs_actifs: baseStats.utilisateurs_actifs || 0,
        documents: baseStats.documents || 0,
        projets: baseStats.projets || 0,
        articles: baseStats.articles || 0,
        articlesPublies: articlesPubliesCount,  // ← Valeur corrigée
        recent_users: baseStats.recent_users || []
      });
      
    } catch (err) { 
      setError(err.message); 
    } finally { 
      setLoading(p => ({ ...p, stats: false })); 
    }
  };

  const fetchUtilisateurs = async () => {
    try {
      setLoading(p => ({ ...p, users: true }));
      setUtilisateurs(await apiFetch('/admin/utilisateurs'));
    } catch (err) { setError(err.message); }
    finally { setLoading(p => ({ ...p, users: false })); }
  };

  useEffect(() => { fetchStats(); fetchUtilisateurs(); }, []);

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3500); };

  const createUtilisateur = async (data) => {
    try {
      setLoading(p => ({ ...p, action: true }));
      await apiFetch('/admin/utilisateurs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await fetchUtilisateurs(); await fetchStats();
      showMsg('Utilisateur créé avec succès ✓');
      setShowUserModal(false); resetForm();
    } catch (err) { setError(err.message); }
    finally { setLoading(p => ({ ...p, action: false })); }
  };

  const updateUtilisateur = async (id, data) => {
    try {
      setLoading(p => ({ ...p, action: true }));
      await apiFetch(`/admin/utilisateurs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await fetchUtilisateurs();
      showMsg('Utilisateur mis à jour ✓');
      setShowUserModal(false); setEditingUser(null); resetForm();
    } catch (err) { setError(err.message); }
    finally { setLoading(p => ({ ...p, action: false })); }
  };

  const deleteUtilisateur = async (id) => {
    try {
      setLoading(p => ({ ...p, action: true }));
      await apiFetch(`/admin/utilisateurs/${id}`, { method: 'DELETE' });
      await fetchUtilisateurs(); await fetchStats();
      showMsg('Utilisateur supprimé ✓');
      setConfirmDelete(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(p => ({ ...p, action: false })); }
  };

  const toggleLock = async (id, locked) => {
    try {
      setLoading(p => ({ ...p, action: true }));
      await apiFetch(`/admin/utilisateurs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compte_verrouille: !locked }),
      });
      await fetchUtilisateurs();
      showMsg(locked ? 'Compte déverrouillé ✓' : 'Compte verrouillé ✓');
    } catch (err) { setError(err.message); }
    finally { setLoading(p => ({ ...p, action: false })); }
  };
  // Ajoutez cette fonction après toggleLock ou avant handleSubmit
const viewUserDocuments = (user) => {
  // Stocker l'ID de l'utilisateur à filtrer dans sessionStorage
  sessionStorage.setItem('filterUserId', user.id);
  sessionStorage.setItem('filterUserName', user.nom);
  // Naviguer vers l'onglet documents
  setActiveTab('documents');
  // Fermer la sidebar si ouverte
  setSidebarOpen(false);
  // Afficher un message de confirmation
  showMsg(`Affichage des documents de ${user.nom}`);
};
  const handleSubmit = (e) => {
    e.preventDefault();
    if (userForm.num_telephone && !/^[0-9]{8}$/.test(userForm.num_telephone)) {
      return setError('Le téléphone doit contenir exactement 8 chiffres');
    }
    editingUser ? updateUtilisateur(editingUser.id, userForm) : createUtilisateur(userForm);
  };

  const resetForm = () => setUserForm({ nom: '', email: '', mot_de_passe: '', num_telephone: '', role: 'CHERCHEUR', actif: true });

  const validerUtilisateur = async (id) => {
  try {
    setLoading(p => ({ ...p, action: true }));
    await apiFetch(`/admin/utilisateurs/${id}/valider`, { method: 'PUT' });
    await fetchUtilisateurs();
    await fetchStats();
    showMsg('Compte validé et email envoyé ✓');
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(p => ({ ...p, action: false }));
  }
};
  const openEdit = (user) => {
    setEditingUser(user);
    setUserForm({ nom: user.nom, email: user.email, mot_de_passe: '', num_telephone: user.num_telephone || '', role: user.role, actif: user.actif });
    setShowUserModal(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/Connexion';
  };

  const navigate = (tab) => { 
    setActiveTab(tab); 
    setSidebarOpen(false);
    
  };

  /* ── Filters ── */
  const filtered = utilisateurs.filter(u => {
    const s  = (u.nom + u.email).toLowerCase().includes(searchTerm.toLowerCase());
    const r  = roleFilter === 'TOUS' || u.role === roleFilter;
    const st = statusFilter === 'TOUS' ||
      (statusFilter === 'ACTIF'      && u.actif && !u.compte_verrouille) ||
      (statusFilter === 'INACTIF'    && !u.actif) ||
      (statusFilter === 'VERROUILLE' && u.compte_verrouille);
    return s && r && st;
  });

  const totalPages   = Math.ceil(filtered.length / usersPerPage);
  const currentUsers = filtered.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  /* Nav badge counts */
  const navStats = { users: utilisateurs.length, documents: stats.documents, projets: stats.projets, articles: stats.articles };
  
  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <div className="ad-root">

      {/* ── Alerts ── */}
      {error && (
        <div className="ad-alert ad-alert-err">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}
      {success && (
        <div className="ad-alert ad-alert-ok">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          {success}
          <button onClick={() => setSuccess(null)}>✕</button>
        </div>
      )}

      {/* ── Mobile overlay ── */}
      {sidebarOpen && <div className="ad-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ══════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════ */}
      <aside className={`ad-sidebar ${sidebarOpen ? 'open' : ''}`}>

        {/* Brand */}
        <div className="ad-brand">
          <div className="ad-brand-mark">
          <img src={logo} alt="logo" className="ad-logo" />
        </div>
          <div className="ad-brand-text">
            <span className="ad-brand-title">LESOR</span>
            <span className="ad-brand-sub">Laboratoire Economie et SOciétés Rurales</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="ad-nav">
          <span className="ad-nav-group-label">Navigation</span>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`ad-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => navigate(item.id)}
            >
              <span className="ad-nav-icon">{item.icon}</span>
              <span className="ad-nav-label">{item.label}</span>
              {item.statKey && navStats[item.statKey] > 0 && (
                <span className="ad-nav-badge">{navStats[item.statKey]}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Profile */}
        <div className="ad-sidebar-profile">
          <div className="ad-profile-avatar">{adminName.charAt(0).toUpperCase()}</div>
          <div className="ad-profile-info">
            <span className="ad-profile-name">{adminName}</span>
            <span className="ad-profile-role">
              <span className="ad-profile-dot" />
              Administrateur
            </span>
          </div>
          <button className="ad-btn-logout" onClick={handleLogout} title="Déconnexion">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════
          MAIN
      ══════════════════════════════════════ */}
      <main className="ad-main">

        {/* Topbar */}
        <header className="ad-topbar">
          <div className="ad-topbar-left">
            <button className="ad-btn-menu" onClick={() => setSidebarOpen(s => !s)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div className="ad-topbar-breadcrumb">
              <span className="ad-breadcrumb-home">LESOR</span>
              <span className="ad-breadcrumb-sep">/</span>
              <span className="ad-breadcrumb-current">
                {NAV_ITEMS.find(n => n.id === activeTab)?.label || activeTab}
              </span>
            </div>
          </div>
          <div className="ad-topbar-right">
            <button
              className="ad-btn-refresh"
              onClick={() => { fetchStats(); fetchUtilisateurs(); showMsg('Données actualisées'); }}
              disabled={loading.stats || loading.users}
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                className={(loading.stats || loading.users) ? 'ad-spin' : ''}
              >
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              {(loading.stats || loading.users) ? 'Chargement…' : 'Actualiser'}
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="ad-content">

          {/* ═══════════ DASHBOARD ═══════════ */}
          {activeTab === 'dashboard' && (
            <div className="ad-dashboard">

              {/* Greeting */}
              <div className="ad-greeting">
                <div className="ad-greeting-text">
                  <h2>Bonjour, {adminName} 👋</h2>
                  <p>Vue d'ensemble de la plateforme.</p>
                </div>
                <span className="ad-greeting-date">
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>

              {/* Stats */}
              <div className="ad-stats-grid">
                <StatCard
                  onClick={() => navigate('users')}
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                  label="Utilisateurs actifs" value={stats.utilisateurs_actifs}
                  sub={`+${stats.recent_users?.length || 0} récents`}
                  accent="#2e6b8a" loading={loading.stats}
                />
                <StatCard
                  onClick={() => navigate('documents')}
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                  label="Documents" value={stats.documents}
                  accent="#4a7c59" loading={loading.stats}
                />
                <StatCard
                  onClick={() => navigate('projet')}
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>}
                  label="Projets" value={stats.projets}
                  accent="#d4691e" loading={loading.stats}
                />
                <StatCard onClick={() => navigate('articles')} label="Articles publiés"            value={stats.articlesPublies}
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>}
                  accent="#6b4c8a" loading={loading.stats}
                />
              </div>

              {/* Bottom grid */}
              <div className="ad-dash-grid">

                {/* Inscriptions récentes */}
                <div className="ad-card">
                  <div className="ad-card-header">
                    <span className="ad-card-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                      Inscriptions récentes
                    </span>
                    <button className="ad-card-link" onClick={() => navigate('users')}>
                      Voir tout
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  </div>
                  <div className="ad-recent-list">
                    {loading.stats ? (
                      [1,2,3].map(i => <div key={i} className="ad-skeleton-row" />)
                    ) : stats.recent_users?.length > 0 ? (
                      stats.recent_users.map(u => (
                        <div key={u.id} className="ad-recent-item">
                          <div className="ad-recent-avatar">{u.nom.charAt(0).toUpperCase()}</div>
                          <div className="ad-recent-info">
                            <strong>{u.nom}</strong>
                            <small>{u.email}</small>
                          </div>
                          <span className={`ad-role-chip ${roleConfig[u.role]?.color}`}>
                            {roleConfig[u.role]?.icon} {roleConfig[u.role]?.label}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="ad-empty-inline"><span>👥</span><span>Aucun utilisateur récent</span></div>
                    )}
                  </div>
                </div>

                {/* Répartition des rôles */}
                <div className="ad-card">
                  <div className="ad-card-header">
                    <span className="ad-card-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Répartition des rôles
                    </span>
                  </div>
                  <div className="ad-role-overview">
                    {roles.map(role => {
                      const count = utilisateurs.filter(u => u.role === role).length;
                      const pct   = utilisateurs.length ? Math.round((count / utilisateurs.length) * 100) : 0;
                      return (
                        <div key={role} className="ad-role-row">
                          <span className={`ad-role-dot ${roleConfig[role]?.color}`}>{roleConfig[role]?.icon}</span>
                          <span className="ad-role-name">{roleConfig[role]?.label}</span>
                          <div className="ad-role-bar-wrap">
                            <div className="ad-role-bar" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="ad-role-count">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ═══════════ USERS ═══════════ */}
          {activeTab === 'users' && (
            <div className="ad-section">

              {/* Toolbar */}
              <div className="ad-toolbar">
                <div className="ad-search-wrap">
                  <svg className="ad-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input
                    className="ad-search-input"
                    placeholder="Rechercher nom ou email…"
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  />
                  {searchTerm && <button className="ad-search-clear" onClick={() => setSearchTerm('')}>✕</button>}
                </div>
                <div className="ad-toolbar-filters">
                  <select className="ad-filter-sel" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setCurrentPage(1); }}>
                    <option value="TOUS">Tous les rôles</option>
                    {roles.map(r => <option key={r} value={r}>{roleConfig[r]?.icon} {roleConfig[r]?.label}</option>)}
                  </select>
                  <select className="ad-filter-sel" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
                    <option value="TOUS">Tous statuts</option>
                    <option value="ACTIF">Actifs</option>
                    <option value="INACTIF">Inactifs</option>
                    <option value="VERROUILLE">Verrouillés</option>
                  </select>
                </div>
                <button
                  className="ad-btn-primary"
                  onClick={() => { setEditingUser(null); resetForm(); setShowUserModal(true); }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                  Nouvel utilisateur
                </button>
              </div>

              {/* Table */}
              <div className="ad-table-wrap">
                {loading.users ? (
                  <div className="ad-loading">
                    <div className="ad-spinner" /><span>Chargement…</span>
                  </div>
                ) : (
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>Utilisateur</th>
                        <th>Contact</th>
                        <th>Rôle</th>
                        <th>Statut</th>
                        <th>Inscription</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentUsers.length > 0 ? currentUsers.map(user => (
                        <tr key={user.id} className={!user.actif ? 'ad-row-inactive' : ''}>
                          <td>
                            <div className="ad-user-cell">
                              <div className="ad-user-av">{user.nom.charAt(0).toUpperCase()}</div>
                              <div>
                                <div className="ad-user-nom">{user.nom}</div>
                                <div className="ad-user-email">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            {user.num_telephone
                              ? <a href={`tel:${user.num_telephone}`} className="ad-phone-link">☏ {user.num_telephone}</a>
                              : <span className="ad-faint">—</span>}
                          </td>
                          <td>
                            <span className={`ad-role-chip ${roleConfig[user.role]?.color}`}>
                              {roleConfig[user.role]?.icon} {roleConfig[user.role]?.label}
                            </span>
                          </td>
                          <td>
                            <div className="ad-status-stack">
                              <span className={`ad-status-dot ${user.actif ? 'st-active' : 'st-inactive'}`}>
                                {user.actif ? 'Actif' : 'Inactif'}
                              </span>
                              {user.compte_verrouille && (
                                <span className="ad-status-dot st-locked">Verrouillé</span>
                              )}
                            </div>
                          </td>
                          <td className="ad-cell-date">
                            {new Date(user.date_inscription).toLocaleDateString('fr-FR')}
                          </td>
                          <td>
                            <div className="ad-actions">
                              {/* ✅ Bouton Valider — visible uniquement si compte inactif */}
                              {!user.actif && (
                                <button
                                  className="ad-act-btn ad-act-validate"
                                  title="Valider le compte"
                                  onClick={() => validerUtilisateur(user.id)}
                                  disabled={loading.action}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                      stroke="currentColor" strokeWidth="2.5"
                                      strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                </button>
                              )}
                              {/* Modifier */}
                              <button
                                className="ad-act-btn ad-act-edit"
                                title="Modifier"
                                onClick={() => openEdit(user)}
                                disabled={loading.action}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/>
                                </svg>
                              </button>
                              {/* Verrouiller / Déverrouiller */}
                              <button
                                className={`ad-act-btn ${user.compte_verrouille ? 'ad-act-unlock' : 'ad-act-lock'}`}
                                title={user.compte_verrouille ? 'Déverrouiller' : 'Verrouiller'}
                                onClick={() => toggleLock(user.id, user.compte_verrouille)}
                                disabled={loading.action}
                              >
                                {user.compte_verrouille ? (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                                  </svg>
                                ) : (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                  </svg>
                                )}
                              </button>
                              {/* Supprimer */}
                              <button
                                className="ad-act-btn ad-act-delete"
                                title="Supprimer"
                                onClick={() => setConfirmDelete(user)}
                                disabled={loading.action}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                  <path d="M10 11v6M14 11v6"/>
                                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                </svg>
                              </button>
                              {/* ✅ NOUVEAU BOUTON VOIR */}
                            <button
                              className="ad-act-btn ad-act-view"
                              title={`Voir les documents de ${user.nom}`}
                              onClick={() => viewUserDocuments(user)}
                              disabled={loading.action}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                            </button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan="6">
                          <div className="ad-empty-table">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                            <p>Aucun utilisateur trouvé</p>
                            <button className="ad-card-link" onClick={() => { setSearchTerm(''); setRoleFilter('TOUS'); setStatusFilter('TOUS'); }}>
                              Effacer les filtres
                            </button>
                          </div>
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="ad-pagination">
                  <span className="ad-page-info">{filtered.length} utilisateur(s)</span>
                  <div className="ad-page-btns">
                    <button className="ad-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>←</button>
                    {[...Array(totalPages)].map((_, i) => {
                      const n = i + 1;
                      if (n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                        return <button key={n} className={`ad-page-btn ${currentPage === n ? 'active' : ''}`} onClick={() => setCurrentPage(n)}>{n}</button>;
                      if (Math.abs(n - currentPage) === 2) return <span key={n} className="ad-page-dots">…</span>;
                      return null;
                    })}
                    <button className="ad-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>→</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════ DOCUMENTS ═══════════ */}
          {activeTab === 'documents' && (
            <div className="ad-tab-pane">
              <Document role="ADMIN" />
            </div>
          )}

          {/* ═══════════ PROJETS ═══════════ */}
          {activeTab === 'projet' && (
            <div className="ad-tab-pane">
              <Projet key="projet-tab" user={user} showOnlyUserProjets={false} />
            </div>
          )}
          {activeTab === 'articles' && (
            <div className="ad-tab-pane">
              <ArticlePub userRole="ADMIN" />
            </div>
          )}
          {/* ═══════════ RAPPORT ═══════════ */}
          {activeTab === "rapport" && (
            <div className="ch-tab-pane">
                <Rapport userRole="ADMIN" />
            </div>
          )}

        </div>
      </main>

      {/* ══ MODAL UTILISATEUR ══ */}
      {showUserModal && (
        <div className="ad-modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h3>{editingUser ? 'Modifier utilisateur' : 'Nouvel utilisateur'}</h3>
              <button className="ad-modal-close" onClick={() => { setShowUserModal(false); setEditingUser(null); resetForm(); }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="ad-form">
              <div className="ad-form-grid">
                <div className="ad-field ad-field-span">
                  <label>Nom complet <em>*</em></label>
                  <input required value={userForm.nom} onChange={e => setUserForm({ ...userForm, nom: e.target.value })} placeholder="Prénom Nom" />
                </div>
                <div className="ad-field ad-field-span">
                  <label>Email <em>*</em></label>
                  <input type="email" required value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} placeholder="email@exemple.com" />
                </div>
                <div className="ad-field">
                  <label>{editingUser ? 'Nouveau mot de passe' : 'Mot de passe'}{!editingUser && <em> *</em>}</label>
                  <input type="password" required={!editingUser} minLength="6" value={userForm.mot_de_passe} onChange={e => setUserForm({ ...userForm, mot_de_passe: e.target.value })} placeholder={editingUser ? 'Laisser vide pour conserver' : '••••••••'} />
                  <small>Minimum 6 caractères</small>
                </div>
                <div className="ad-field">
                  <label>Téléphone</label>
                  <input pattern="[0-9]{8}" maxLength="8" value={userForm.num_telephone} onChange={e => setUserForm({ ...userForm, num_telephone: e.target.value })} placeholder="12345678" />
                  <small>8 chiffres sans indicatif</small>
                </div>
                <div className="ad-field">
                  <label>Rôle <em>*</em></label>
                  <select required value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                    {roles.map(r => <option key={r} value={r}>{roleConfig[r]?.icon} {r}</option>)}
                  </select>
                </div>
                <div className="ad-field ad-field-check">
                  <label className="ad-check-label">
                    <input type="checkbox" checked={userForm.actif} onChange={e => setUserForm({ ...userForm, actif: e.target.checked })} />
                    <span className="ad-check-box" />
                    Compte actif
                  </label>
                </div>
              </div>
              <div className="ad-form-actions">
                <button type="button" className="ad-btn-ghost" onClick={() => { setShowUserModal(false); setEditingUser(null); resetForm(); }}>Annuler</button>
                <button type="submit" className="ad-btn-primary" disabled={loading.action}>
                  {loading.action ? <><span className="ad-btn-spinner" /> En cours…</> : editingUser ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ CONFIRM DELETE ══ */}
      {confirmDelete && (
        <div className="ad-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="ad-modal ad-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="ad-modal-header ad-modal-header-danger">
              <h3>Confirmer la suppression</h3>
              <button className="ad-modal-close" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <div className="ad-confirm">
              <div className="ad-confirm-icon">🗑️</div>
              <p>Voulez-vous supprimer <strong>{confirmDelete.nom}</strong> ?</p>
              <p className="ad-confirm-warn">Cette action est irréversible.</p>
            </div>
            <div className="ad-form-actions">
              <button className="ad-btn-ghost" onClick={() => setConfirmDelete(null)}>Annuler</button>
              <button className="ad-btn-danger" onClick={() => deleteUtilisateur(confirmDelete.id)} disabled={loading.action}>
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;