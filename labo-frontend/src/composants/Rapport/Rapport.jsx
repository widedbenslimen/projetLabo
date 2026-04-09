import { useState, useEffect, useCallback, useRef } from "react";
import "./Rapport.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function firstOfYearStr() {
  return `${new Date().getFullYear()}-01-01`;
}

function cibleToBackend(cible) {
  return cible === "labo" ? "global" : cible;
}

const CIBLE_LABELS = {
  labo: "Laboratoire (tous)",
  admin: "Admins",
  chercheur: "Chercheurs",
  cadre_technique: "Cadres techniques",
  personnel: "Mes articles",
};

/* ─── Badge ───────────────────────────────────────────────────────────────── */
function Badge({ text }) {
  if (!text || text === "—") return <span className="badge badge-default">—</span>;
  const map = {
    JOURNAL: "badge-journal",
    CONFERENCE: "badge-conference",
    CHERCHEUR: "badge-chercheur",
    CADRE_TECHNIQUE: "badge-cadre",
    ADMIN: "badge-admin",
    Visible: "badge-visible",
    Masqué: "badge-masque",
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
    { key: "", icon: "📋", label: "Tous" },
    { key: "JOURNAL", icon: "📰", label: "Journal" },
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
  const icon = active ? (sortDir === "asc" ? "↑" : "↓") : "↕";
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
  const rapportRef = useRef(null);

  /* ── State ── */
  const [dateDebut, setDateDebut] = useState(firstOfYearStr());
  const [dateFin, setDateFin] = useState(todayStr());
  const [sousType, setSousType] = useState("");
  const [cible, setCible] = useState("labo");
  const [cibleId, setCibleId] = useState("");
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [rapport, setRapport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("date_creation");
  const [sortDir, setSortDir] = useState("desc");

  /* ── Filtres & tri locaux ── */
  const allArticles = rapport?.articles ?? [];

  const filtered = allArticles
    .filter((a) => {
      if (sousType && a.sous_type !== sousType) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (a.titre || "").toLowerCase().includes(s) ||
        (a.auteur_nom || "").toLowerCase().includes(s) ||
        (a.journal || "").toLowerCase().includes(s) ||
        (a.mots_cles || "").toLowerCase().includes(s) ||
        (a.doi || "").toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      let va = a[sortKey] ?? "";
      let vb = b[sortKey] ?? "";
      if (sortKey === "date_creation") {
        va = new Date(va);
        vb = new Date(vb);
      } else {
        va = va.toString().toLowerCase();
        vb = vb.toString().toLowerCase();
      }
      return sortDir === "asc" ? (va > vb ? 1 : -1) : va < vb ? 1 : -1;
    });

  const statsFiltered = {
    total: filtered.length,
    journaux: filtered.filter((a) => a.sous_type === "JOURNAL").length,
    conferences: filtered.filter((a) => a.sous_type === "CONFERENCE").length,
    auteurs_uniques: [...new Set(filtered.map((a) => a.auteur_id))].length,
    visibles: filtered.filter((a) => a.visibilite).length,
  };

  /* ── Charger la liste d'utilisateurs ── */
  useEffect(() => {
    if (!isAdmin) return;

    const roleMap = {
      chercheur: "CHERCHEUR",
      cadre_technique: "CADRE_TECHNIQUE",
      admin: "ADMIN",
    };
    const r = roleMap[cible];

    if (!r) {
      setUtilisateurs([]);
      setCibleId("");
      return;
    }

    fetch(`${API}/rapport/articles/utilisateurs?role=${r}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setUtilisateurs(Array.isArray(data) ? data : []);
        setCibleId("");
      })
      .catch(() => {
        setUtilisateurs([]);
        setCibleId("");
      });
  }, [cible, isAdmin]);

  /* ── Générer le rapport ── */
  const generer = useCallback(async () => {
    setError("");
    setRapport(null);
    if (!dateDebut || !dateFin) {
      setError("Veuillez saisir les deux dates.");
      return;
    }
    if (dateDebut > dateFin) {
      setError("La date de début doit être antérieure à la date de fin.");
      return;
    }

    setLoading(true);
    try {
      let url = `${API}/rapport/articles?date_debut=${dateDebut}&date_fin=${dateFin}`;

      if (sousType) {
        url += `&sousType=${sousType}`;
      }

      if (isAdmin) {
        url += `&cible=${cibleToBackend(cible)}`;
        if (cibleId) url += `&cible_id=${cibleId}`;
      }

      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");
      setRapport(data);
      setSearch("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dateDebut, dateFin, sousType, cible, cibleId, isAdmin]);

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

  /* ── Télécharger le PDF avec autoTable (version correcte) ── */
  const handleDownload = useCallback(() => {
    if (!rapport || filtered.length === 0) {
      setError("Aucune donnée à exporter");
      return;
    }

    setPdfLoading(true);

    try {
      // Créer le document PDF
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Titre principal
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(13, 38, 69);
      doc.text("Rapport des Articles", pageWidth / 2, 20, { align: "center" });
      
      // Sous-titre / période
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 120);
      const periodText = `${fmtDate(dateDebut)} - ${fmtDate(dateFin)}`;
      doc.text(periodText, pageWidth / 2, 30, { align: "center" });
      
      // Périmètre (si admin)
      if (isAdmin) {
        doc.setFontSize(10);
        doc.setTextColor(150, 120, 70);
        doc.text(`Périmètre : ${CIBLE_LABELS[cible]}`, pageWidth / 2, 38, { align: "center" });
      }
      
      // Ligne de séparation
      doc.setDrawColor(201, 168, 76);
      doc.setLineWidth(0.5);
      doc.line(20, 45, pageWidth - 20, 45);
      
      // Section Statistiques
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(13, 38, 69);
      doc.text("Statistiques", 20, 58);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 80);
      
      const statsY = 68;
      const statsCols = [
        `Articles: ${statsFiltered.total}`,
        `Journaux: ${statsFiltered.journaux}`,
        `Conférences: ${statsFiltered.conferences}`,
        `Auteurs uniques: ${statsFiltered.auteurs_uniques}`,
        `Visibles: ${statsFiltered.visibles}`
      ];
      
      statsCols.forEach((stat, index) => {
        doc.text(stat, 20 + (index * 38), statsY);
      });
      
      // Espace avant le tableau
      let startY = 80;
      
      // Préparer les données du tableau
      const tableHeaders = [["Titre", "Type", "Auteur", "Journal / Éd.", "DOI", "Date", "Visibilité"]];
      
      const tableData = filtered.map((a) => [
        a.titre || "—",
        a.sous_type === "JOURNAL" ? "Journal" : a.sous_type === "CONFERENCE" ? "Conférence" : "—",
        a.auteur_nom || "—",
        a.journal || a.maison_edition || "—",
        a.doi || "—",
        fmtDate(a.date_creation),
        a.visibilite ? "Visible" : "Masqué"
      ]);
      
      // Générer le tableau avec autoTable
      autoTable(doc, {
        head: tableHeaders,
        body: tableData,
        startY: startY,
        theme: "striped",
        headStyles: {
          fillColor: [13, 38, 69],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
          halign: "left",
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [40, 40, 60],
          lineColor: [220, 220, 230],
          lineWidth: 0.1,
        },
        alternateRowStyles: {
          fillColor: [248, 248, 250],
        },
        columnStyles: {
          0: { cellWidth: 35 }, // Titre
          1: { cellWidth: 20 }, // Type
          2: { cellWidth: 20 }, // Auteur
          3: { cellWidth: 35 }, // Journal
          4: { cellWidth: 30 }, // DOI
          5: { cellWidth: 20 }, // Date
          6: { cellWidth: 20 }, // Visibilité
        },
        margin: { left: 20, right: 20 },
        pageBreak: "auto",
        tableWidth: "auto",
      });
      
      // Ajouter le footer sur chaque page
      const totalPages = doc.internal.getNumberOfPages();
      const dateNow = new Date().toLocaleDateString("fr-FR");
      
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 170);
        doc.text(
          `Généré le ${dateNow} - Page ${i}/${totalPages}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }
      
      // Sauvegarder le PDF
      doc.save(`rapport_articles_${dateDebut}_${dateFin}.pdf`);
      
    } catch (err) {
      console.error("Erreur PDF:", err);
      setError("Erreur lors de la génération du PDF: " + err.message);
    } finally {
      setPdfLoading(false);
    }
  }, [rapport, filtered, dateDebut, dateFin, isAdmin, cible, statsFiltered]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
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
          <h1 className="header-title">
            Rapport des <em>Articles</em>
          </h1>
          <p className="header-subtitle">Générez et exportez un rapport dynamique par période</p>
        </div>
      </header>

      {/* ══ Body ════════════════════════════════════════════════════════════ */}
      <main className="rapport-body">
        {/* ── Formulaire ──────────────────────────────────────────────────── */}
        <div className="rcard form-card">
          <p className="section-label">Paramètres du rapport</p>

          <div className="form-grid">
            <div className="form-field">
              <label>Date de début</label>
              <input
                type="date"
                value={dateDebut}
                max={dateFin || todayStr()}
                onChange={(e) => setDateDebut(e.target.value)}
              />
            </div>

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

            <div className="form-field">
              <label>Type d'article</label>
              <select value={sousType} onChange={(e) => setSousType(e.target.value)}>
                <option value="">Tous les types</option>
                <option value="JOURNAL">Journal</option>
                <option value="CONFERENCE">Conférence</option>
              </select>
            </div>

            {isAdmin && (
              <div className="form-field">
                <label>Périmètre du rapport</label>
                <select value={cible} onChange={(e) => {
                  setCible(e.target.value);
                  setCibleId("");
                }}>
                  <option value="labo">🌐 Rapport du Laboratoire (tous)</option>
                  <option value="admin">👑 Rapport par Admin</option>
                  <option value="chercheur">🔬 Rapport par Chercheur</option>
                  <option value="cadre_technique">🛠 Rapport par Cadre technique</option>
                  <option value="personnel">👤 Mes propres articles</option>
                </select>
              </div>
            )}

            {isAdmin && utilisateurs.length > 0 && (
              <div className="form-field">
                <label>Utilisateur (optionnel)</label>
                <select value={cibleId} onChange={(e) => setCibleId(e.target.value)}>
                  <option value="">— Tous —</option>
                  {utilisateurs.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nom} · {u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="btn-group">
              <button className="btn-generate" onClick={generer} disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" /> Génération…
                  </>
                ) : (
                  <>⚡ Générer le rapport</>
                )}
              </button>
              {(rapport || error) && (
                <button className="btn-reset" onClick={reinitialiser} title="Revenir à l'état initial">
                   Annuler
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="error-bar">
              <span>⚠</span> {error}
            </div>
          )}
        </div>

        {/* ── Résultats ───────────────────────────────────────────────────── */}
        {rapport && (
          <div ref={rapportRef}>
            <div className="results-topbar">
              <span className="period-seal">
                📅 {fmtDate(rapport.periode.date_debut)}
                <span className="period-seal-sep">→</span>
                {fmtDate(rapport.periode.date_fin)}
                {isAdmin && <span className="period-seal-scope">· {CIBLE_LABELS[cible]}</span>}
              </span>

              <div className="type-filter-wrap">
                <span className="type-filter-label">Type d'article</span>
                <TypeToggle value={sousType} onChange={setSousType} />
              </div>
            </div>

            <div className="stats-grid">
              <StatCard label="Articles" value={statsFiltered.total} />
              <StatCard label="Journaux" value={statsFiltered.journaux} />
              <StatCard label="Conférences" value={statsFiltered.conferences} />
              <StatCard label="Auteur(s) uniques" value={statsFiltered.auteurs_uniques} />
              <StatCard label="Visibles" value={statsFiltered.visibles} />
            </div>

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
                    disabled={pdfLoading || filtered.length === 0}
                    title="Télécharger le rapport en PDF"
                  >
                    {pdfLoading ? (
                      <>
                        <span className="spinner" /> PDF…
                      </>
                    ) : (
                      <>⬇ Télécharger PDF</>
                    )}
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
                        <SortTh col="titre" label="Titre" {...sortProps} />
                        <SortTh col="sous_type" label="Type" {...sortProps} />
                        <SortTh col="auteur_nom" label="Auteur" {...sortProps} />
                        <SortTh col="journal" label="Journal / Éd." {...sortProps} />
                        <th>DOI</th>
                        <SortTh col="date_creation" label="Date" {...sortProps} />
                        <th>Visibilité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((a) => (
                        <tr key={a.id}>
                          <td className="cell-titre">
                            <div className="cell-titre-main">{a.titre || "—"}</div>
                            {a.mots_cles && <div className="cell-mots-cles"># {a.mots_cles}</div>}
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
                            {a.doi ? (
                              <a
                                className="doi-link"
                                href={`https://doi.org/${a.doi}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {a.doi}
                              </a>
                            ) : (
                              <span style={{ color: "var(--ink-light)" }}>—</span>
                            )}
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
          </div>
        )}
      </main>
    </div>
  );
}