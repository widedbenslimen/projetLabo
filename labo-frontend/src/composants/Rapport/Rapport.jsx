// Rapport.jsx
import { useState, useEffect, useCallback } from "react";
import "./Rapport.css";

/* ─── Config ──────────────────────────────────────────────────────────────── */
const API = "http://localhost:8000/api";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  "Content-Type": "application/json",
});

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function fmtDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function todayStr()       { return new Date().toISOString().split("T")[0]; }
function firstOfYearStr() { return `${new Date().getFullYear()}-01-01`; }

/**
 * Traduit la valeur locale `cible` (ex. "labo") vers la valeur attendue par le backend.
 * Centralisé ici pour éviter de le répéter dans generer() ET handleDownload().
 */
function cibleToBackend(cible) {
  return cible === "labo" ? "global" : cible;
}

/* ─── Labels lisibles pour les options admin ──────────────────────────────── */
const CIBLE_LABELS = {
  labo:            "Laboratoire (tous)",
  admin:           "Admins",
  chercheur:       "Chercheurs",
  cadre_technique: "Cadres techniques",
  personnel:       "Mes articles",
};

/* ─── Badge ───────────────────────────────────────────────────────────────── */
function Badge({ text }) {
  if (!text || text === "—") return <span className="badge badge-default">—</span>;
  const map = {
    JOURNAL:         "badge-journal",
    CONFERENCE:      "badge-conference",
    CHERCHEUR:       "badge-chercheur",
    CADRE_TECHNIQUE: "badge-cadre",
    ADMIN:           "badge-admin",
    Visible:         "badge-visible",
    Masqué:          "badge-masque",
  };
  const labelMap = { CADRE_TECHNIQUE: "Cadre tech." };
  return (
    <span className={`badge ${map[text] || "badge-default"}`}>
      {labelMap[text] || text}
    </span>
  );
}

/* ─── Type Toggle ─────────────────────────────────────────────────────────── */
function TypeToggle({ value, onChange }) {
  const opts = [
    { key: "",           icon: "📋", label: "Tous"       },
    { key: "JOURNAL",    icon: "📰", label: "Journal"    },
    { key: "CONFERENCE", icon: "🎤", label: "Conférence" },
  ];
  return (
    <div className="type-toggle">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          className={`type-toggle-btn${value === o.key ? " active" : ""}`}
          onClick={() => onChange(o.key)}
        >
          <span>{o.icon}</span> {o.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Stat Card ───────────────────────────────────────────────────────────── */
function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/* ─── Sort Header ─────────────────────────────────────────────────────────── */
function SortTh({ col, label, sortKey, sortDir, onSort }) {
  const active = sortKey === col;
  const icon   = active ? (sortDir === "asc" ? "↑" : "↓") : "↕";
  return (
    <th className={active ? "active" : ""} onClick={() => onSort(col)}>
      {label} <span className="sort-icon">{icon}</span>
    </th>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Composant principal                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Rapport({ userRole = "CHERCHEUR" }) {
  const isAdmin = userRole === "ADMIN";

  /* ── State ── */
  const [dateDebut,     setDateDebut]     = useState(firstOfYearStr());
  const [dateFin,       setDateFin]       = useState(todayStr());
  const [sousType,      setSousType]      = useState("");         // "" | "JOURNAL" | "CONFERENCE"
  const [cible,         setCible]         = useState("labo");     // admin only
  const [cibleId,       setCibleId]       = useState("");
  const [utilisateurs,  setUtilisateurs]  = useState([]);
  const [rapport,       setRapport]       = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [pdfLoading,    setPdfLoading]    = useState(false);
  const [error,         setError]         = useState("");
  const [search,        setSearch]        = useState("");
  const [sortKey,       setSortKey]       = useState("date_creation");
  const [sortDir,       setSortDir]       = useState("desc");

  /* ── Charger la liste d'utilisateurs selon le périmètre admin ── */
  useEffect(() => {
    if (!isAdmin) return;

    const roleMap = {
      chercheur:       "CHERCHEUR",
      cadre_technique: "CADRE_TECHNIQUE",
      admin:           "ADMIN",
    };
    const r = roleMap[cible];

    // Pour "labo" et "personnel" il n'y a pas de liste d'utilisateurs à afficher
    if (!r) { setUtilisateurs([]); setCibleId(""); return; }

    fetch(`${API}/rapport/articles/utilisateurs?role=${r}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => { setUtilisateurs(Array.isArray(data) ? data : []); setCibleId(""); })
      .catch(() => { setUtilisateurs([]); setCibleId(""); });
  }, [cible, isAdmin]);

  /* ── Générer le rapport ── */
  const generer = useCallback(async () => {
    setError("");
    setRapport(null);
    if (!dateDebut || !dateFin) { setError("Veuillez saisir les deux dates."); return; }
    if (dateDebut > dateFin)    { setError("La date de début doit être antérieure à la date de fin."); return; }

    setLoading(true);
    try {
      let url = `${API}/rapport/articles?date_debut=${dateDebut}&date_fin=${dateFin}`;
      if (isAdmin) {
        url += `&cible=${cibleToBackend(cible)}`;
        if (cibleId) url += `&cible_id=${cibleId}`;
      }
      const res  = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");
      setRapport(data);
      setSearch("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dateDebut, dateFin, cible, cibleId, isAdmin]);

  /* ── Réinitialiser ── */
  const reinitialiser = useCallback(() => {
    setDateDebut(firstOfYearStr());
    setDateFin(todayStr());
    setSousType("");
    setCible("labo");
    setCibleId("");
    setRapport(null);
    setError("");
    setSearch("");
    setSortKey("date_creation");
    setSortDir("desc");
  }, []);

  /* ── Télécharger le PDF ── */
  const handleDownload = useCallback(async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/rapport/articles/pdf`, {
        method:  "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date_debut: dateDebut,
          date_fin:   dateFin,
          cible:      cibleToBackend(cible), // ← mapping cohérent avec generer()
          cible_id:   cibleId || undefined,
          sousType:   sousType || undefined,
        }),
      });

      if (!res.ok) {
        // Tenter de lire un message d'erreur JSON si le backend en renvoie un
        let msg = "Erreur lors de la génération du PDF1";
        try { const j = await res.json(); msg = j.error || msg; } 
        catch (err) {
          console.warn("Erreur de parsing JSON:", err.message);
        }
        throw new Error(msg);
      }

      // Déclencher le téléchargement dans le navigateur
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `rapport_articles_${dateDebut}_${dateFin}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      setError(err.message);
    } finally {
      setPdfLoading(false);
    }
  }, [dateDebut, dateFin, cible, cibleId, sousType, pdfLoading]);

  /* ── Filtres & tri locaux ── */
  const allArticles = rapport?.articles ?? [];

  const filtered = allArticles
    .filter((a) => {
      if (sousType && a.sous_type !== sousType) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (a.titre      || "").toLowerCase().includes(s) ||
        (a.auteur_nom || "").toLowerCase().includes(s) ||
        (a.journal    || "").toLowerCase().includes(s) ||
        (a.mots_cles  || "").toLowerCase().includes(s) ||
        (a.doi        || "").toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      let va = a[sortKey] ?? "";
      let vb = b[sortKey] ?? "";
      if (sortKey === "date_creation") { va = new Date(va); vb = new Date(vb); }
      else { va = va.toString().toLowerCase(); vb = vb.toString().toLowerCase(); }
      return sortDir === "asc" ? (va > vb ? 1 : -1) : va < vb ? 1 : -1;
    });

  /* Stats recalculées sur les articles actuellement affichés */
  const statsFiltered = {
    total:           filtered.length,
    journaux:        filtered.filter(a => a.sous_type === "JOURNAL").length,
    conferences:     filtered.filter(a => a.sous_type === "CONFERENCE").length,
    auteurs_uniques: [...new Set(filtered.map(a => a.auteur_id))].length,
    visibles:        filtered.filter(a => a.visibilite).length,
  };

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sortProps = { sortKey, sortDir, onSort: toggleSort };

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="rapport-root">

      {/* ══ Header ══════════════════════════════════════════════════════════ */}
      <header className="rapport-header">
        <div className="header-inner">
          <div className="header-eyebrow">
            <span className="header-eyebrow-line" />
            <span className="header-eyebrow-text">Laboratoire de recherche</span>
          </div>
          <h1 className="header-title">Rapport des <em>Articles</em></h1>
          <p className="header-subtitle">Générez et exportez un rapport dynamique par période</p>
        </div>
      </header>

      {/* ══ Body ════════════════════════════════════════════════════════════ */}
      <main className="rapport-body">

        {/* ── Formulaire ──────────────────────────────────────────────────── */}
        <div className="rcard form-card">
          <p className="section-label">Paramètres du rapport</p>

          <div className="form-grid">

            {/* Date début */}
            <div className="form-field">
              <label>Date de début</label>
              <input
                type="date"
                value={dateDebut}
                max={dateFin || todayStr()}
                onChange={(e) => setDateDebut(e.target.value)}
              />
            </div>

            {/* Date fin */}
            <div className="form-field">
              <label>Date de fin</label>
              <input
                type="date"
                value={dateFin}
                min={dateDebut}
                max={todayStr()}
                onChange={(e) => setDateFin(e.target.value)}
              />
            </div>

            {/* Admin – périmètre du rapport */}
            {isAdmin && (
              <div className="form-field">
                <label>Périmètre du rapport</label>
                <select
                  value={cible}
                  onChange={(e) => { setCible(e.target.value); setCibleId(""); }}
                >
                  <option value="labo">🌐 Rapport du Laboratoire (tous)</option>
                  <option value="admin">👑 Rapport par Admin</option>
                  <option value="chercheur">🔬 Rapport par Chercheur</option>
                  <option value="cadre_technique">🛠 Rapport par Cadre technique</option>
                  <option value="personnel">👤 Mes propres articles</option>
                </select>
              </div>
            )}

            {/* Admin – utilisateur précis (affiché seulement si la liste est peuplée) */}
            {isAdmin && utilisateurs.length > 0 && (
              <div className="form-field">
                <label>Utilisateur (optionnel)</label>
                <select value={cibleId} onChange={(e) => setCibleId(e.target.value)}>
                  <option value="">— Tous —</option>
                  {utilisateurs.map((u) => (
                    <option key={u.id} value={u.id}>{u.nom} · {u.email}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Boutons */}
            <div className="btn-group">
              <button className="btn-generate" onClick={generer} disabled={loading}>
                {loading
                  ? <><span className="spinner" /> Génération…</>
                  : <>⚡ Générer le rapport</>}
              </button>
              {(rapport || error) && (
                <button className="btn-reset" onClick={reinitialiser} title="Revenir à l'état initial">
                  ✕ Annuler
                </button>
              )}
            </div>
          </div>

          {/* Message d'erreur */}
          {error && <div className="error-bar"><span>⚠</span> {error}</div>}
        </div>

        {/* ── Résultats ───────────────────────────────────────────────────── */}
        {rapport && (
          <>
            {/* Barre : période + filtre type */}
            <div className="results-topbar">
              <span className="period-seal">
                📅 {fmtDate(rapport.periode.date_debut)}
                <span className="period-seal-sep">→</span>
                {fmtDate(rapport.periode.date_fin)}
                {isAdmin && (
                  <span className="period-seal-scope">
                    · {CIBLE_LABELS[cible]}
                  </span>
                )}
              </span>

              <div className="type-filter-wrap">
                <span className="type-filter-label">Type d'article</span>
                <TypeToggle value={sousType} onChange={setSousType} />
              </div>
            </div>

            {/* Statistiques */}
            <div className="stats-grid">
              <StatCard label="Articles"           value={statsFiltered.total} />
              <StatCard label="Journaux"           value={statsFiltered.journaux} />
              <StatCard label="Conférences"        value={statsFiltered.conferences} />
              <StatCard label="Auteur(s) uniques"  value={statsFiltered.auteurs_uniques} />
              <StatCard label="Visibles"           value={statsFiltered.visibles} />
            </div>

            {/* Tableau */}
            <div className="rcard table-card">
              <div className="table-toolbar">
                <div className="toolbar-left">
                  <span className="result-count">
                    {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
                    {(search || sousType) && ` / ${allArticles.length}`}
                  </span>
                </div>
                <div className="toolbar-right">
                  <div className="search-wrap">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Rechercher…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn-download"
                    onClick={handleDownload}
                    disabled={pdfLoading}
                    title="Télécharger le rapport en PDF"
                  >
                    {pdfLoading
                      ? <><span className="spinner" /> PDF…</>
                      : <>⬇ Télécharger PDF</>}
                  </button>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <p className="empty-title">Aucun article trouvé</p>
                  <p className="empty-sub">
                    {search || sousType
                      ? "Modifiez les filtres pour voir plus de résultats"
                      : "Aucun article ne correspond à cette période"}
                  </p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="rapport-table">
                    <thead>
                      <tr>
                        <SortTh col="titre"         label="Titre"         {...sortProps} />
                        <SortTh col="sous_type"     label="Type"          {...sortProps} />
                        <SortTh col="auteur_nom"    label="Auteur"        {...sortProps} />
                        <SortTh col="journal"       label="Journal / Éd." {...sortProps} />
                        <th>DOI</th>
                        <SortTh col="date_creation" label="Date"          {...sortProps} />
                        <th>Visibilité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((a) => (
                        <tr key={a.id}>
                          <td className="cell-titre">
                            <div className="cell-titre-main">{a.titre || "—"}</div>
                            {a.mots_cles && (
                              <div className="cell-mots-cles"># {a.mots_cles}</div>
                            )}
                          </td>
                          <td><Badge text={a.sous_type} /></td>
                          <td>
                            <div className="cell-auteur-name">{a.auteur_nom || "—"}</div>
                            <Badge text={a.auteur_role} />
                          </td>
                          <td>
                            {a.journal || a.maison_edition || (
                              <span style={{ color: "var(--ink-light)" }}>—</span>
                            )}
                          </td>
                          <td>
                            {a.doi
                              ? (
                                <a
                                  className="doi-link"
                                  href={`https://doi.org/${a.doi}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {a.doi}
                                </a>
                              )
                              : <span style={{ color: "var(--ink-light)" }}>—</span>
                            }
                          </td>
                          <td className="cell-date">{fmtDate(a.date_creation)}</td>
                          <td><Badge text={a.visibilite ? "Visible" : "Masqué"} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}