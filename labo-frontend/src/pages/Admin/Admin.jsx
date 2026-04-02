import React, { useState, useEffect } from 'react';
import './Admin.css';
import Document from "../../composants/Document/Document";
import Projet from "../../composants/Projet/Projet";
import Rapport from "../../composants/Rapport/Rapport";

const Admin = () => {
  const [stats, setStats] = useState({
    utilisateurs_actifs: 0,
    documents: 0,
    projets: 0,
    publications: 0,
    recent_users: []
  });

  const [utilisateurs, setUtilisateurs] = useState([]);
  const [loading, setLoading] = useState({ stats: true, users: true, action: false });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    nom: '', email: '', mot_de_passe: '',
    num_telephone: '', role: 'CHERCHEUR', actif: true
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('TOUS');
  const [statusFilter, setStatusFilter] = useState('TOUS');
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 8;
  const [activeTab, setActiveTab] = useState('dashboard');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const getToken = () => localStorage.getItem('token');

  useEffect(() => { fetchStats(); fetchUtilisateurs(); }, []);

  const fetchStats = async () => {
    try {
      setLoading(p => ({ ...p, stats: true }));
      const res = await fetch('http://localhost:8000/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Erreur stats');
      setStats(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(p => ({ ...p, stats: false })); }
  };

  const fetchUtilisateurs = async () => {
    try {
      setLoading(p => ({ ...p, users: true }));
      const res = await fetch('http://localhost:8000/api/admin/utilisateurs', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Erreur utilisateurs');
      setUtilisateurs(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(p => ({ ...p, users: false })); }
  };

  const createUtilisateur = async (data) => {
    try {
      setLoading(p => ({ ...p, action: true }));
      const res = await fetch('http://localhost:8000/api/admin/utilisateurs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      await fetchUtilisateurs(); await fetchStats();
      showMsg('Utilisateur créé avec succès ✓');
      setShowUserModal(false); resetForm();
    } catch (err) { setError(err.message); }
    finally { setLoading(p => ({ ...p, action: false })); }
  };

  const updateUtilisateur = async (id, data) => {
    try {
      setLoading(p => ({ ...p, action: true }));
      const res = await fetch(`http://localhost:8000/api/admin/utilisateurs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      await fetchUtilisateurs();
      showMsg('Utilisateur mis à jour ✓');
      setShowUserModal(false); setEditingUser(null); resetForm();
    } catch (err) { setError(err.message); }
    finally { setLoading(p => ({ ...p, action: false })); }
  };

  const deleteUtilisateur = async (id) => {
    try {
      setLoading(p => ({ ...p, action: true }));
      await fetch(`http://localhost:8000/api/admin/utilisateurs/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      await fetchUtilisateurs(); await fetchStats();
      showMsg('Utilisateur supprimé ✓');
      setConfirmDelete(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(p => ({ ...p, action: false })); }
  };

  const validerUtilisateur = async (id) => {
    try {
      setLoading(p => ({ ...p, action: true }));
      const res = await fetch(`http://localhost:8000/api/admin/utilisateurs/${id}/valider`, {
        method: 'PUT', headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Erreur validation');
      await fetchUtilisateurs();
      showMsg('Compte validé et email envoyé ✓');
    } catch (err) { setError(err.message); }
    finally { setLoading(p => ({ ...p, action: false })); }
  };

  const toggleLock = async (id, locked) => {
    try {
      setLoading(p => ({ ...p, action: true }));
      await fetch(`http://localhost:8000/api/admin/utilisateurs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ compte_verrouille: !locked })
      });
      await fetchUtilisateurs();
      showMsg(locked ? 'Compte déverrouillé ✓' : 'Compte verrouillé ✓');
    } catch (err) { setError(err.message); }
    finally { setLoading(p => ({ ...p, action: false })); }
  };

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3500); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userForm.num_telephone && !/^[0-9]{8}$/.test(userForm.num_telephone)) {
      return setError('Le téléphone doit contenir exactement 8 chiffres');
    }
    editingUser ? updateUtilisateur(editingUser.id, userForm) : createUtilisateur(userForm);
  };

  const resetForm = () => setUserForm({ nom: '', email: '', mot_de_passe: '', num_telephone: '', role: 'CHERCHEUR', actif: true });

  const openEdit = (user) => {
    setEditingUser(user);
    setUserForm({ nom: user.nom, email: user.email, mot_de_passe: '', num_telephone: user.num_telephone || '', role: user.role, actif: user.actif });
    setShowUserModal(true);
  };

  const roles = ['ADMIN', 'CHERCHEUR', 'INVITE', 'CADRE_TECHNIQUE'];

  const roleConfig = {
    ADMIN: { icon: '◈', color: 'role-admin', label: 'Admin' },
    CHERCHEUR: { icon: '◉', color: 'role-chercheur', label: 'Chercheur' },
    INVITE: { icon: '◌', color: 'role-invite', label: 'Invité' },
    CADRE_TECHNIQUE: { icon: '◆', color: 'role-cadre', label: 'Cadre Tech.' },
  };

  const filtered = utilisateurs.filter(u => {
    const s = (u.nom + u.email).toLowerCase().includes(searchTerm.toLowerCase());
    const r = roleFilter === 'TOUS' || u.role === roleFilter;
    const st = statusFilter === 'TOUS' ||
      (statusFilter === 'ACTIF' && u.actif && !u.compte_verrouille) ||
      (statusFilter === 'INACTIF' && !u.actif) ||
      (statusFilter === 'VERROUILLE' && u.compte_verrouille);
    return s && r && st;
  });

  const totalPages = Math.ceil(filtered.length / usersPerPage);
  const currentUsers = filtered.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  const adminName = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').nom || 'Admin'; } catch { return 'Admin'; } })();

  const StatCard = ({ icon, label, value, sub, colorClass }) => (
    <div className={`stat-card ${colorClass}`}>
      <div className="stat-card-inner">
        <span className="stat-icon-wrap">{icon}</span>
        <div className="stat-body">
          <span className="stat-label">{label}</span>
          <span className="stat-value">
            {loading.stats ? <span className="stat-skeleton" /> : value}
          </span>
          {sub && <span className="stat-sub">{sub}</span>}
        </div>
      </div>
      <div className="stat-glow" />
    </div>
  );
  const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/Connexion';
};

  return (
    <div className="admin-root">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">⬡</span>
          <span className="brand-text">Lab<em>Admin</em></span>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <span className="nav-icon">▦</span><span>Tableau de bord</span>
          </button>
          <button className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
            <span className="nav-icon">◎</span><span>Gestion utilisateurs</span>
            <span className="nav-badge">{utilisateurs.length}</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'documents' ? 'active' : ''}`} 
            onClick={() => setActiveTab('documents')}
          >
            <span className="nav-icon">📄</span>
            <span>Gestion documents</span>
            <span className="nav-badge">{stats.documents}</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'projet' ? 'active' : ''}`} 
            onClick={() => setActiveTab('projet')}
          >
            <span className="nav-icon">📄</span>
            <span>Gestion projets</span>
            <span className="nav-badge">{stats.projet}</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="admin-avatar">{adminName.charAt(0).toUpperCase()}</div>
          <div className="admin-info">
            <span className="admin-name">{adminName}</span>
            <span className="admin-role">Administrateur</span>
          </div>
          
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">
              {activeTab === 'dashboard' && 'Tableau de bord'}
              {activeTab === 'users' && 'Gestion des utilisateurs'}
              {activeTab === 'documents' && 'Gestion des documents'}
              {activeTab === 'projet' && 'Gestion des projets'}
            </h1>
          </div>
          <div className="topbar-right">
            <button className="btn-refresh" onClick={() => { fetchStats(); fetchUtilisateurs(); showMsg('Données actualisées'); }} disabled={loading.stats || loading.users}>
              <span className={loading.stats || loading.users ? 'spin' : ''}>↺</span>
              {loading.stats || loading.users ? 'Chargement…' : 'Actualiser'}
            </button>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Déconnexion">⏻</button>

        </header>

        {/* Alerts */}
        {error && (
          <div className="alert alert-err">
            <span>⚠</span> {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {success && (
          <div className="alert alert-ok">
            <span>✓</span> {success}
            <button onClick={() => setSuccess(null)}>✕</button>
          </div>
        )}

        {/* ─── DASHBOARD TAB ─── */}
        {activeTab === 'dashboard' && (
          <div className="tab-content">
            <div className="stats-grid">
              <StatCard icon="◎" label="Utilisateurs actifs" value={stats.utilisateurs_actifs} sub={`+${stats.recent_users?.length || 0} récents`} colorClass="sc-blue" />
              <StatCard icon="▤" label="Documents" value={stats.documents} colorClass="sc-green" />
              <StatCard icon="◈" label="Projets" value={stats.projets} colorClass="sc-orange" />
              <StatCard icon="◉" label="Publications" value={stats.publications} colorClass="sc-purple" />
            </div>

            <div className="dashboard-bottom">
              <div className="recent-card">
                <div className="card-header">
                  <span className="card-title">Inscriptions récentes</span>
                  <button className="btn-link" onClick={() => setActiveTab('users')}>Voir tout →</button>
                </div>
                <div className="recent-list">
                  {loading.stats
                    ? [1,2,3].map(i => <div key={i} className="recent-skeleton" />)
                    : stats.recent_users?.length > 0
                      ? stats.recent_users.map(u => (
                          <div key={u.id} className="recent-item">
                            <div className="recent-avatar">{u.nom.charAt(0).toUpperCase()}</div>
                            <div className="recent-info">
                              <strong>{u.nom}</strong>
                              <small>{u.email}</small>
                            </div>
                            <span className={`role-chip ${roleConfig[u.role]?.color}`}>
                              {roleConfig[u.role]?.icon} {roleConfig[u.role]?.label}
                            </span>
                          </div>
                        ))
                      : <p className="empty-state">Aucun utilisateur récent</p>
                  }
                </div>
              </div>

              <div className="overview-card">
                <div className="card-header"><span className="card-title">Répartition des rôles</span></div>
                <div className="role-overview">
                  {roles.map(role => {
                    const count = utilisateurs.filter(u => u.role === role).length;
                    const pct = utilisateurs.length ? Math.round((count / utilisateurs.length) * 100) : 0;
                    return (
                      <div key={role} className="role-row">
                        <span className={`role-dot ${roleConfig[role]?.color}`}>{roleConfig[role]?.icon}</span>
                        <span className="role-name">{roleConfig[role]?.label}</span>
                        <div className="role-bar-wrap">
                          <div className="role-bar" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="role-count">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── USERS TAB ─── */}
        {activeTab === 'users' && (
          <div className="tab-content">
            <div className="toolbar">
              <div className="search-wrap">
                <span className="search-ico">⌕</span>
                <input
                  className="search-input"
                  placeholder="Rechercher nom ou email…"
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
                {searchTerm && <button className="search-clear" onClick={() => setSearchTerm('')}>✕</button>}
              </div>
              <div className="toolbar-filters">
                <select className="filter-sel" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setCurrentPage(1); }}>
                  <option value="TOUS">Tous les rôles</option>
                  {roles.map(r => <option key={r} value={r}>{roleConfig[r]?.icon} {roleConfig[r]?.label}</option>)}
                </select>
                <select className="filter-sel" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
                  <option value="TOUS">Tous statuts</option>
                  <option value="ACTIF">Actifs</option>
                  <option value="INACTIF">Inactifs</option>
                  <option value="VERROUILLE">Verrouillés</option>
                </select>
              </div>
              <button className="btn-primary" onClick={() => { setEditingUser(null); resetForm(); setShowUserModal(true); }}>
                + Nouvel utilisateur
              </button>
            </div>

            <div className="table-wrap">
              {loading.users ? (
                <div className="loader-center">
                  <div className="loader-ring" /><span>Chargement…</span>
                </div>
              ) : (
                <table className="users-table">
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
                      <tr key={user.id} className={!user.actif ? 'row-inactive' : ''}>
                        <td>
                          <div className="user-cell">
                            <div className="user-av">{user.nom.charAt(0).toUpperCase()}</div>
                            <div>
                              <div className="user-nom">{user.nom}</div>
                              <div className="user-email">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="cell-phone">
                          {user.num_telephone
                            ? <a href={`tel:${user.num_telephone}`} className="phone-link">☏ {user.num_telephone}</a>
                            : <span className="cell-empty">—</span>}
                        </td>
                        <td>
                          <span className={`role-chip ${roleConfig[user.role]?.color}`}>
                            {roleConfig[user.role]?.icon} {roleConfig[user.role]?.label}
                          </span>
                        </td>
                        <td>
                          <div className="status-stack">
                            <span className={`status-dot ${user.actif ? 'st-active' : 'st-inactive'}`}>
                              {user.actif ? 'Actif' : 'Inactif'}
                            </span>
                            {user.compte_verrouille && <span className="status-dot st-locked">Verrouillé</span>}
                          </div>
                        </td>
                        <td className="cell-date">
                          {new Date(user.date_inscription).toLocaleDateString('fr-FR')}
                        </td>
                        <td>
                          <div className="actions">
                            {!user.actif && (
                              <button className="act-btn act-validate" title="Valider" onClick={() => validerUtilisateur(user.id)} disabled={loading.action}>✓</button>
                            )}
                            <button className="act-btn act-edit" title="Modifier" onClick={() => openEdit(user)} disabled={loading.action}>✎</button>
                            <button className={`act-btn ${user.compte_verrouille ? 'act-unlock' : 'act-lock'}`} title={user.compte_verrouille ? 'Déverrouiller' : 'Verrouiller'} onClick={() => toggleLock(user.id, user.compte_verrouille)} disabled={loading.action}>
                              {user.compte_verrouille ? '⊙' : '⊗'}
                            </button>
                            <button className="act-btn act-delete" title="Supprimer" onClick={() => setConfirmDelete(user)} disabled={loading.action}>⊘</button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="6">
                        <div className="empty-table">
                          <span>⌕</span>
                          <p>Aucun utilisateur trouvé</p>
                          <button className="btn-link" onClick={() => { setSearchTerm(''); setRoleFilter('TOUS'); setStatusFilter('TOUS'); }}>Effacer les filtres</button>
                        </div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <span className="page-info">{filtered.length} utilisateur(s)</span>
                <div className="page-btns">
                  <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>←</button>
                  {[...Array(totalPages)].map((_, i) => {
                    const n = i + 1;
                    if (n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                      return <button key={n} className={`page-btn ${currentPage === n ? 'page-active' : ''}`} onClick={() => setCurrentPage(n)}>{n}</button>;
                    if (Math.abs(n - currentPage) === 2) return <span key={n} className="page-dots">…</span>;
                    return null;
                  })}
                  <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>→</button>
                </div>
              </div>
            )}
          </div>
        )}
        {/* ─── DOCUMENTS TAB ─── */}
        {activeTab === 'documents' && (
          <div className="tab-content">
            <Document key="documents-tab" />
          </div>
        )}

        {/* ─── PROJETS TAB ─── */}
        {activeTab === 'projet' && (
          <div className="tab-content">
            <Projet key="projet-tab" />
          </div>
        )}
      </main>

      {/* ─── USER MODAL ─── */}
      {showUserModal && (
        <div className="modal-backdrop" onClick={() => setShowUserModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span>{editingUser ? '✎ Modifier utilisateur' : '+ Nouvel utilisateur'}</span>
              <button className="modal-x" onClick={() => { setShowUserModal(false); setEditingUser(null); resetForm(); }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="field">
                <label>Nom complet <em>*</em></label>
                <input required value={userForm.nom} onChange={e => setUserForm({ ...userForm, nom: e.target.value })} placeholder="Prénom Nom" />
              </div>
              <div className="field">
                <label>Email <em>*</em></label>
                <input type="email" required value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} placeholder="email@exemple.com" />
              </div>
              <div className="field">
                <label>{editingUser ? 'Nouveau mot de passe' : 'Mot de passe'}{!editingUser && <em> *</em>}</label>
                <input type="password" required={!editingUser} minLength="6" value={userForm.mot_de_passe} onChange={e => setUserForm({ ...userForm, mot_de_passe: e.target.value })} placeholder={editingUser ? 'Laisser vide pour ne pas changer' : '••••••••'} />
                <small>Minimum 6 caractères</small>
              </div>
              <div className="field">
                <label>Téléphone</label>
                <input pattern="[0-9]{8}" maxLength="8" value={userForm.num_telephone} onChange={e => setUserForm({ ...userForm, num_telephone: e.target.value })} placeholder="12345678" />
                <small>8 chiffres sans indicatif</small>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Rôle <em>*</em></label>
                  <select required value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                    {roles.map(r => <option key={r} value={r}>{roleConfig[r]?.icon} {r}</option>)}
                  </select>
                </div>
                <div className="field field-check">
                  <label className="check-label">
                    <input type="checkbox" checked={userForm.actif} onChange={e => setUserForm({ ...userForm, actif: e.target.checked })} />
                    <span className="check-box" />
                    Compte actif
                  </label>
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn-secondary" onClick={() => { setShowUserModal(false); setEditingUser(null); resetForm(); }}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={loading.action}>
                  {loading.action ? <span className="btn-spin">↺</span> : null}
                  {loading.action ? 'En cours…' : editingUser ? '✎ Modifier' : '+ Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CONFIRM DELETE ─── */}
      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-head danger">
              <span>⚠ Confirmer la suppression</span>
              <button className="modal-x" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <div className="confirm-body">
              <p>Voulez-vous supprimer <strong>{confirmDelete.nom}</strong> ?</p>
              <p className="confirm-warn">Cette action est irréversible.</p>
            </div>
            <div className="modal-foot">
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Annuler</button>
              <button className="btn-danger" onClick={() => deleteUtilisateur(confirmDelete.id)} disabled={loading.action}>
                {loading.action ? '↺' : '⊘ Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;