import { useState, useEffect, useCallback } from "react";
import "./Rapport.css";

// ─── URL de base du backend ───────────────────────────────────────
const API_BASE = "http://localhost:8000";

// ─── Icônes SVG inline ────────────────────────────────────────────
const Icon = {
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  cal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  filter: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
};

// ─── Helpers ─────────────────────────────────────────────────────
const statutLabel = {
  publie: "Publié",
  en_cours: "En cours",
  accepte: "Accepté",
  soumis: "Soumis",
  en_revision: "En révision",
  retire: "Retiré",
};

const statutColor = {
  publie: "badge--publie",
  en_cours: "badge--en-cours",
  accepte: "badge--accepte",
  soumis: "badge--soumis",
  en_revision: "badge--revision",
  retire: "badge--retire",
};

// ─── Lecture sécurisée du localStorage ───────────────────────────
const getStoredUser = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const getStoredToken = () => {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
};

// ─── Sous-composants ──────────────────────────────────────────────
function Badge({ statut }) {
  return (
    <span className={`badge ${statutColor[statut] || "badge--default"}`}>
      {statutLabel[statut] || statut}
    </span>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`stat-card ${accent ? "stat-card--accent" : ""}`}>
      <span className="stat-card__value">{value ?? "—"}</span>
      <span className="stat-card__label">{label}</span>
    </div>
  );
}

function BarChart({ data, label }) {
  if (!data || Object.keys(data).length === 0) return null;
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div className="bar-chart">
      <p className="bar-chart__title">{label}</p>
      {entries.map(([key, val]) => (
        <div className="bar-chart__row" key={key}>
          <span className="bar-chart__key">{key}</span>
          <div className="bar-chart__track">
            <div
              className="bar-chart__fill"
              style={{ width: `${(val / max) * 100}%` }}
            />
          </div>
          <span className="bar-chart__count">{val}</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// VUE CHERCHEUR
// ════════════════════════════════════════════════════════════════
function VueChercheur({ data, filters, setFilters }) {
  if (!data) return null;
  const { chercheur, statistiques: s, projets } = data;

  const annees = [
    ...new Set(projets.map((p) => p.annee_publication).filter(Boolean)),
  ].sort((a, b) => b - a);

  const filtered = projets.filter((p) => {
    if (filters.statut && p.statut !== filters.statut) return false;
    if (filters.annee && String(p.annee_publication) !== String(filters.annee)) return false;
    if (
      filters.annee_debut &&
      p.annee_publication &&
      p.annee_publication < parseInt(filters.annee_debut)
    )
      return false;
    if (
      filters.annee_fin &&
      p.annee_publication &&
      p.annee_publication > parseInt(filters.annee_fin)
    )
      return false;
    return true;
  });

  return (
    <div className="vue">
      {/* En-tête chercheur */}
      <div className="chercheur-header">
        <div className="chercheur-avatar">
          {chercheur.nom?.charAt(0).toUpperCase() || "?"}
        </div>
        <div>
          <h2 className="chercheur-nom">{chercheur.nom}</h2>
          <p className="chercheur-email">{chercheur.email}</p>
          <span className="role-pill">{chercheur.role}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Total projets" value={s.total_projets} accent />
        <StatCard label="Publiés" value={s.projets_publies} />
        <StatCard label="En cours" value={s.projets_en_cours} />
        <StatCard label="Acceptés" value={s.projets_acceptes} />
        <StatCard label="Soumis" value={s.projets_soumis} />
        <StatCard label="Créateur de" value={s.projets_createur} />
        <StatCard label="Collaborateurs" value={s.total_collaborateurs} />
      </div>

      {/* Graphiques */}
      <div className="charts-row">
        <BarChart data={s.par_statut} label="Par statut" />
        <BarChart data={s.par_type} label="Par type" />
        <BarChart data={s.par_annee} label="Par année" />
        <BarChart data={s.par_domaine} label="Par domaine" />
      </div>

      {/* Filtres */}
      <div className="filters-bar">
        <span className="filters-bar__icon">{Icon.filter}</span>

        <select
          value={filters.statut}
          onChange={(e) => setFilters((f) => ({ ...f, statut: e.target.value }))}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(statutLabel).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filters.annee}
          onChange={(e) => setFilters((f) => ({ ...f, annee: e.target.value }))}
        >
          <option value="">Toutes les années</option>
          {annees.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <div className="filters-bar__range">
          <input
            type="number"
            placeholder="Année début"
            value={filters.annee_debut}
            onChange={(e) => setFilters((f) => ({ ...f, annee_debut: e.target.value }))}
          />
          <span>→</span>
          <input
            type="number"
            placeholder="Année fin"
            value={filters.annee_fin}
            onChange={(e) => setFilters((f) => ({ ...f, annee_fin: e.target.value }))}
          />
        </div>

        {(filters.statut || filters.annee || filters.annee_debut || filters.annee_fin) && (
          <button
            className="filters-bar__reset"
            onClick={() =>
              setFilters({ statut: "", annee: "", annee_debut: "", annee_fin: "" })
            }
          >
            Réinitialiser
          </button>
        )}

        <span className="filters-bar__count">{filtered.length} projet(s)</span>
      </div>

      {/* Liste projets */}
      <div className="projets-list">
        {filtered.length === 0 && (
          <p className="empty-state">Aucun projet ne correspond aux filtres.</p>
        )}
        {filtered.map((p) => (
          <ProjetCard key={p.id} projet={p} />
        ))}
      </div>
    </div>
  );
}

function ProjetCard({ projet: p }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`projet-card ${open ? "projet-card--open" : ""}`}>
      <div className="projet-card__header" onClick={() => setOpen(!open)}>
        <div className="projet-card__meta">
          <Badge statut={p.statut} />
          {p.est_createur && <span className="creator-badge">Créateur</span>}
          {p.annee_publication && (
            <span className="projet-card__year">{p.annee_publication}</span>
          )}
        </div>
        <h3 className="projet-card__titre">{p.titre}</h3>
        <div className="projet-card__sub">
          {p.type_publication && <span>{p.type_publication}</span>}
          {p.journal_ou_conference && <span>{p.journal_ou_conference}</span>}
          {p.domaine && <span>{p.domaine}</span>}
        </div>
        <span className={`projet-card__chevron ${open ? "projet-card__chevron--open" : ""}`}>
          ▾
        </span>
      </div>

      {open && (
        <div className="projet-card__body">
          <div className="projet-card__details">
            {p.date_debut && (
              <div className="detail-row">
                {Icon.cal}
                <span>
                  {new Date(p.date_debut).toLocaleDateString("fr-FR")}
                  {p.date_fin && ` → ${new Date(p.date_fin).toLocaleDateString("fr-FR")}`}
                </span>
              </div>
            )}
            {p.langue && (
              <div className="detail-row">
                <span className="detail-label">Langue :</span>
                <span>{p.langue}</span>
              </div>
            )}
            {p.doi && (
              <div className="detail-row">
                {Icon.link}
                <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">
                  {p.doi}
                </a>
              </div>
            )}
            {p.url_texte_complet && (
              <div className="detail-row">
                {Icon.download}
                <a href={p.url_texte_complet} target="_blank" rel="noreferrer">
                  Texte complet
                </a>
              </div>
            )}
          </div>

          {p.coauteurs?.length > 0 && (
            <div className="coauteurs">
              <p className="coauteurs__title">Co-auteurs ({p.coauteurs.length})</p>
              <div className="coauteurs__list">
                {p.coauteurs.map((c) => (
                  <span key={c.id} className="coauteur-chip">
                    {c.nom}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// VUE ADMIN — Rapport par projet
// ════════════════════════════════════════════════════════════════
function VueAdmin({ data, filters, setFilters }) {
  if (!data) return null;
  const { statistiques: s, projets, top_chercheurs } = data;

  const annees = [
    ...new Set(projets.map((p) => p.annee_publication).filter(Boolean)),
  ].sort((a, b) => b - a);

  const filtered = projets.filter((p) => {
    if (filters.statut && p.statut !== filters.statut) return false;
    if (filters.type && p.type_publication !== filters.type) return false;
    if (filters.annee && String(p.annee_publication) !== String(filters.annee)) return false;
    if (
      filters.annee_debut &&
      p.annee_publication &&
      p.annee_publication < parseInt(filters.annee_debut)
    )
      return false;
    if (
      filters.annee_fin &&
      p.annee_publication &&
      p.annee_publication > parseInt(filters.annee_fin)
    )
      return false;
    if (filters.domaine && p.domaine !== filters.domaine) return false;
    if (filters.langue && p.langue !== filters.langue) return false;
    return true;
  });

  const types = [...new Set(projets.map((p) => p.type_publication).filter(Boolean))];
  const domaines = [...new Set(projets.map((p) => p.domaine).filter(Boolean))];
  const langues = [...new Set(projets.map((p) => p.langue).filter(Boolean))];

  return (
    <div className="vue">
      {/* KPI globaux */}
      <div className="kpi-band">
        <div className="kpi-item">
          <span className="kpi-item__val">{s.total_projets}</span>
          <span className="kpi-item__lbl">Projets</span>
        </div>
        <div className="kpi-divider" />
        <div className="kpi-item">
          <span className="kpi-item__val kpi-item__val--green">
            {s.par_statut?.publie ?? 0}
          </span>
          <span className="kpi-item__lbl">Publiés</span>
        </div>
        <div className="kpi-divider" />
        <div className="kpi-item">
          <span className="kpi-item__val kpi-item__val--blue">
            {s.par_statut?.en_cours ?? 0}
          </span>
          <span className="kpi-item__lbl">En cours</span>
        </div>
        <div className="kpi-divider" />
        <div className="kpi-item">
          <span className="kpi-item__val">{s.avec_pdf}</span>
          <span className="kpi-item__lbl">Avec PDF</span>
        </div>
        <div className="kpi-divider" />
        <div className="kpi-item">
          <span className="kpi-item__val">{s.avec_doi}</span>
          <span className="kpi-item__lbl">Avec DOI</span>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-row">
        <BarChart data={s.par_statut} label="Par statut" />
        <BarChart data={s.par_type} label="Par type" />
        <BarChart data={s.par_annee} label="Par année" />
        <BarChart data={s.par_domaine} label="Par domaine" />
      </div>

      {/* Top chercheurs */}
      {top_chercheurs?.length > 0 && (
        <div className="top-section">
          <h3 className="top-section__title">Top chercheurs</h3>
          <div className="top-table">
            <div className="top-table__head">
              <span></span>
              <span>Nom</span>
              <span>Total</span>
              <span>Publiés</span>
            </div>
            {top_chercheurs.map((c, i) => (
              <div className="top-table__row" key={c.id}>
                <span className="top-rank">#{i + 1}</span>
                <span>{c.nom}</span>
                <span>{c.total_projets}</span>
                <span>{c.projets_publies}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="filters-bar filters-bar--admin">
        <span className="filters-bar__icon">{Icon.filter}</span>

        <select
          value={filters.statut}
          onChange={(e) => setFilters((f) => ({ ...f, statut: e.target.value }))}
        >
          <option value="">Tous statuts</option>
          {Object.entries(statutLabel).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
        >
          <option value="">Tous types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filters.annee}
          onChange={(e) => setFilters((f) => ({ ...f, annee: e.target.value }))}
        >
          <option value="">Toutes années</option>
          {annees.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        <div className="filters-bar__range">
          <input
            type="number"
            placeholder="Année début"
            value={filters.annee_debut}
            onChange={(e) => setFilters((f) => ({ ...f, annee_debut: e.target.value }))}
          />
          <span>→</span>
          <input
            type="number"
            placeholder="Année fin"
            value={filters.annee_fin}
            onChange={(e) => setFilters((f) => ({ ...f, annee_fin: e.target.value }))}
          />
        </div>

        <select
          value={filters.domaine}
          onChange={(e) => setFilters((f) => ({ ...f, domaine: e.target.value }))}
        >
          <option value="">Tous domaines</option>
          {domaines.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          value={filters.langue}
          onChange={(e) => setFilters((f) => ({ ...f, langue: e.target.value }))}
        >
          <option value="">Toutes langues</option>
          {langues.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>

        {Object.values(filters).some(Boolean) && (
          <button
            className="filters-bar__reset"
            onClick={() =>
              setFilters({
                statut: "", type: "", annee: "", annee_debut: "", annee_fin: "",
                domaine: "", langue: "",
              })
            }
          >
            Réinitialiser
          </button>
        )}

        <span className="filters-bar__count">{filtered.length} projet(s)</span>
      </div>

      {/* Table projets admin */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Titre</th>
              <th>Statut</th>
              <th>Type</th>
              <th>Domaine</th>
              <th>Langue</th>
              <th>Année pub.</th>
              <th>Début</th>
              <th>Fin</th>
              <th>Participants</th>
              <th>PDF</th>
              <th>DOI</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="empty-state">
                  Aucun projet trouvé.
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <AdminProjetRow key={p.id} projet={p} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminProjetRow({ projet: p }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className={`admin-table__row ${open ? "admin-table__row--open" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <td className="admin-table__titre">{p.titre}</td>
        <td><Badge statut={p.statut} /></td>
        <td>{p.type_publication || "—"}</td>
        <td>{p.domaine || "—"}</td>
        <td>{p.langue || "—"}</td>
        <td>{p.annee_publication || "—"}</td>
        <td>
          {p.date_debut ? new Date(p.date_debut).toLocaleDateString("fr-FR") : "—"}
        </td>
        <td>
          {p.date_fin ? new Date(p.date_fin).toLocaleDateString("fr-FR") : "—"}
        </td>
        <td className="text-center">{p.nb_participants}</td>
        <td className="text-center">{p.url_texte_complet ? "✓" : "—"}</td>
        <td className="text-center">{p.doi ? "✓" : "—"}</td>
      </tr>
      {open && (
        <tr className="admin-table__detail-row">
          <td colSpan={11}>
            <div className="admin-detail">
              {p.journal_ou_conference && (
                <span>
                  <b>Journal/Conf :</b> {p.journal_ou_conference}
                </span>
              )}
              {p.doi && (
                <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">
                  DOI : {p.doi}
                </a>
              )}
              {p.url_texte_complet && (
                <a href={p.url_texte_complet} target="_blank" rel="noreferrer">
                  Texte complet ↗
                </a>
              )}
              {p.participants?.length > 0 && (
                <span>
                  <b>Participants :</b>{" "}
                  {p.participants.map((u) => u.nom).join(", ")}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ════════════════════════════════════════════════════════════════
export default function Rapport({ user: userProp }) {
  // ── 1. Résolution de l'utilisateur ─────────────────────────────
  // Priorité : prop > localStorage
  const [user] = useState(() => userProp || getStoredUser() || {});
  const role = (user?.role || "").toUpperCase();
  const isAdmin = role === "ADMIN";
  const isChercheur = ["CHERCHEUR", "ADMIN"].includes(role);

  // ── 2. État ────────────────────────────────────────────────────
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [vueAdmin, setVueAdmin] = useState("projets"); // "projets" | "chercheur"

  const [filtersChercheur, setFiltersChercheur] = useState({
    statut: "", annee: "", annee_debut: "", annee_fin: "",
  });
  const [filtersAdmin, setFiltersAdmin] = useState({
    statut: "", type: "", annee: "", annee_debut: "", annee_fin: "",
    domaine: "", langue: "",
  });

  // ── 3. fetchData mémoïsé (évite la boucle infinie) ────────────
  const fetchData = useCallback(async (url) => {
    const token = getStoredToken();
    if (!token) {
      setError("Token d'authentification manquant. Veuillez vous reconnecter.");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${API_BASE}${url}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []); // stable, pas de dépendances variables

  // ── 4. Déclenchement du fetch selon le rôle / vue ─────────────
  useEffect(() => {
    if (!isChercheur) return;

    const url =
      isAdmin && vueAdmin === "projets"
        ? "/api/rapport/projets"
        : "/api/rapport/chercheur";

    fetchData(url);
  }, [isChercheur, isAdmin, vueAdmin, fetchData]);

  // ── 5. URL de retry ───────────────────────────────────────────
  const retryUrl =
    isAdmin && vueAdmin === "projets"
      ? "/api/rapport/projets"
      : "/api/rapport/chercheur";

  // ── 6. Garde d'accès ─────────────────────────────────────────
  if (!isChercheur) {
    return (
      <div className="rapport-error">
        Accès non autorisé.{" "}
        {!user?.role && (
          <small>(Aucun utilisateur détecté — vérifiez que la prop <code>user</code> est bien transmise ou que le localStorage contient la clé <code>user</code>.)</small>
        )}
      </div>
    );
  }

  return (
    <div className="rapport">
      {/* Titre + onglets */}
      <div className="rapport__head">
        <div className="rapport__title-row">
          <span className="rapport__icon">{Icon.chart}</span>
          <h1 className="rapport__title">Rapports</h1>
        </div>

        {isAdmin && (
          <div className="rapport__tabs">
            <button
              className={`rapport__tab ${vueAdmin === "projets" ? "rapport__tab--active" : ""}`}
              onClick={() => {
                setVueAdmin("projets");
                setData(null);
              }}
            >
              {Icon.folder} Tous les projets
            </button>
            <button
              className={`rapport__tab ${vueAdmin === "chercheur" ? "rapport__tab--active" : ""}`}
              onClick={() => {
                setVueAdmin("chercheur");
                setData(null);
              }}
            >
              {Icon.users} Mon profil chercheur
            </button>
          </div>
        )}
      </div>

      {/* Corps */}
      <div className="rapport__body">
        {loading && (
          <div className="rapport__loader">
            <div className="spinner" />
            <p>Chargement du rapport…</p>
          </div>
        )}

        {!loading && error && (
          <div className="rapport__error">
            <p>⚠ {error}</p>
            <button onClick={() => fetchData(retryUrl)}>Réessayer</button>
          </div>
        )}

        {!loading && !error && data && (
          isAdmin && vueAdmin === "projets" ? (
            <VueAdmin
              data={data}
              filters={filtersAdmin}
              setFilters={setFiltersAdmin}
            />
          ) : (
            <VueChercheur
              data={data}
              filters={filtersChercheur}
              setFilters={setFiltersChercheur}
            />
          )
        )}
      </div>
    </div>
  );
}