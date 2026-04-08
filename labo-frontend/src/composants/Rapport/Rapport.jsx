/**
 * RapportPeriode.jsx
 * Génération de rapport par période — Chercheur & Admin
 * PDF via jsPDF + jspdf-autotable (CDN)
 *
 * Dépendances CDN à ajouter dans index.html :
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
 */

import React, { useState, useCallback, useRef } from 'react';
import './Rapport.css';

// ── Constantes ───────────────────────────────────────────────
const STATUT_LABELS = {
  en_cours:    'En cours',
  soumis:      'Soumis',
  en_revision: 'En révision',
  accepte:     'Accepté',
  publie:      'Publié',
  retire:      'Retiré',
};

const STATUT_COLORS = {
  en_cours:    'info',
  soumis:      'warning',
  en_revision: 'warning',
  accepte:     'success',
  publie:      'success',
  retire:      'danger',
};

const TYPE_RAPPORT = [
  { value: 'activite',    label: 'Activité' },
  { value: 'annuel',      label: 'Annuel' },
  { value: 'semestriel',  label: 'Semestriel' },
  { value: 'trimestriel', label: 'Trimestriel' },
  { value: 'projet',      label: 'Projet' },
  { value: 'autre',       label: 'Autre' },
];

// ── API helper ───────────────────────────────────────────────
// FIX : préfixe /api/rapport aligné sur le mount du routeur Express
const api = async (method, path, body) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/rapport${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
};

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : '—';

const formatDateShort = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

// ── PDF Generation ───────────────────────────────────────────
const genererPDF = (data) => {
  const { rapport, auteur, projets, stats } = data;

  // FIX : vérification robuste de jsPDF
  if (!window.jspdf?.jsPDF) {
    alert(
      'jsPDF non chargé. Ajoutez les scripts CDN dans votre index.html :\n' +
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js\n' +
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
    );
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const bleuNuit  = [15,  31,  61];
  const bleuRoyal = [30,  77, 183];
  const or        = [201, 168, 76];
  const gris      = [100, 116, 139];
  const grisLight = [241, 245, 249];

  const W = 210, margin = 18;
  let y = 0;

  // Page 1 : En-tête
  doc.setFillColor(...bleuNuit);
  doc.rect(0, 0, W, 52, 'F');

  doc.setFillColor(...or);
  doc.rect(0, 52, W, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(rapport.titre, margin, 24);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...or);
  doc.text(
    `Rapport ${TYPE_RAPPORT.find(t => t.value === rapport.type)?.label || rapport.type} — ${auteur.nom}`,
    margin, 34
  );

  doc.setTextColor(200, 215, 235);
  doc.setFontSize(9);
  doc.text(
    `Période : ${formatDate(rapport.periode_debut)} → ${formatDate(rapport.periode_fin)}`,
    margin, 43
  );
  doc.text(`Généré le ${formatDate(rapport.date_creation)}`, margin, 49);

  y = 66;

  // Bloc auteur
  doc.setFillColor(...grisLight);
  doc.roundedRect(margin, y, W - 2 * margin, 22, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...bleuNuit);
  doc.text('Auteur', margin + 5, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gris);
  doc.text(
    `${auteur.nom}  ·  ${auteur.email}  ·  ${auteur.role}`,
    margin + 5, y + 14
  );

  y += 30;

  // Description
  if (rapport.description) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...gris);
    const lignes = doc.splitTextToSize(rapport.description, W - 2 * margin);
    doc.text(lignes, margin, y);
    y += lignes.length * 5 + 8;
  }

  // Stats visuelles
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...bleuNuit);
  doc.text('Synthèse', margin, y);
  y += 6;

  const statCols = [
    { label: 'Projets',   val: stats.total_projets },
    { label: 'En cours',  val: stats.projets_actifs },
    { label: 'Terminés',  val: stats.projets_termines },
    { label: 'Documents', val: stats.total_documents },
  ];

  const cardW = (W - 2 * margin - 9) / 4;
  statCols.forEach((s, idx) => {
    const x = margin + idx * (cardW + 3);
    doc.setFillColor(...bleuNuit);
    doc.roundedRect(x, y, cardW, 16, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(String(s.val), x + cardW / 2, y + 9, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 200, 230);
    doc.text(s.label, x + cardW / 2, y + 14, { align: 'center' });
  });

  y += 24;

  // Table des projets
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...bleuNuit);
  doc.text('Liste des projets', margin, y);
  y += 4;

  const tableHead = [['#', 'Titre', 'Domaine', 'Responsable', 'Période', 'Statut']];
  const tableBody = projets.map((p, idx) => [
    String(idx + 1),
    p.titre,
    p.domaine || '—',
    p.createur_nom,
    `${formatDateShort(p.date_debut)} → ${formatDateShort(p.date_fin)}`,
    STATUT_LABELS[p.statut] || p.statut,
  ]);

  // FIX : vérification de doc.autoTable uniquement (jsPDF est déjà instancié)
  if (typeof doc.autoTable === 'function') {
    doc.autoTable({
      startY:     y,
      head:       tableHead,
      body:       tableBody,
      margin:     { left: margin, right: margin },
      headStyles: {
        fillColor:   bleuNuit,
        textColor:   [255, 255, 255],
        fontStyle:   'bold',
        fontSize:    8,
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize:    8,
        cellPadding: 3,
        textColor:   [51, 65, 85],
      },
      alternateRowStyles: { fillColor: grisLight },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        1: { cellWidth: 55 },
        2: { cellWidth: 30 },
        3: { cellWidth: 32 },
        4: { cellWidth: 35 },
        5: { cellWidth: 20, halign: 'center' },
      },
      didParseCell: ({ cell, row, column }) => {
        if (column.index === 5 && row.section === 'body') {
          const statut = projets[row.index]?.statut;
          if (['accepte', 'publie'].includes(statut)) {
            cell.styles.textColor = [21, 128, 61];
            cell.styles.fontStyle = 'bold';
          } else if (statut === 'en_cours') {
            cell.styles.textColor = [29, 78, 216];
          } else if (statut === 'retire') {
            cell.styles.textColor = [190, 18, 60];
          }
        }
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    // Fallback si autoTable non disponible
    projets.forEach((p, idx) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...bleuNuit);
      doc.text(`${idx + 1}. ${p.titre}`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...gris);
      doc.text(
        `${p.createur_nom}  ·  ${p.domaine || '—'}  ·  ` +
        `${formatDateShort(p.date_debut)} → ${formatDateShort(p.date_fin)}  ·  ` +
        `${STATUT_LABELS[p.statut] || p.statut}`,
        margin + 3, y + 5
      );
      y += 13;
    });
  }

  // Détails projets (pages suivantes)
  projets.forEach((p, idx) => {
    doc.addPage();

    doc.setFillColor(...bleuRoyal);
    doc.rect(0, 0, W, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`Projet ${idx + 1} — ${p.titre}`, margin, 12);

    y = 28;

    const infos = [
      ['Responsable',   p.createur_nom],
      ['Domaine',       p.domaine || '—'],
      ['Statut',        STATUT_LABELS[p.statut] || p.statut],
      ['Date de début', formatDate(p.date_debut)],
      ['Date de fin',   formatDate(p.date_fin)],
      ['Documents',     String(p.nombre_documents || 0)],
    ];

    infos.forEach(([label, val]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...gris);
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...bleuNuit);
      doc.text(val, margin + 40, y);
      y += 7;
    });

    if (p.description) {
      y += 3;
      doc.setFillColor(...grisLight);
      const descLines = doc.splitTextToSize(p.description, W - 2 * margin - 10);
      doc.roundedRect(margin, y, W - 2 * margin, descLines.length * 5 + 8, 2, 2, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(...gris);
      doc.text(descLines, margin + 5, y + 6);
      y += descLines.length * 5 + 14;
    }

    if (p.participants?.length > 0) {
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...bleuNuit);
      doc.text('Participants', margin, y);
      y += 5;
      p.participants.forEach((part) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...gris);
        doc.text(`• ${part.nom}  (${part.role})`, margin + 3, y);
        y += 5;
      });
    }

    if (p.mots_cles?.length > 0) {
      y += 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...bleuNuit);
      doc.text('Mots-clés', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...gris);
      const mots = Array.isArray(p.mots_cles)
        ? p.mots_cles.join(', ')
        : p.mots_cles;
      doc.text(mots, margin + 3, y);
    }
  });

  // Pied de page sur toutes les pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let n = 1; n <= totalPages; n++) {
    doc.setPage(n);
    doc.setFillColor(...bleuNuit);
    doc.rect(0, 287, W, 10, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(160, 185, 220);
    doc.text(`Laboratoire — ${rapport.titre}`, margin, 293);
    doc.text(`Page ${n} / ${totalPages}`, W - margin, 293, { align: 'right' });
  }

  const nomFichier =
    `rapport_${rapport.titre.replace(/\s+/g, '_').toLowerCase()}_` +
    `${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(nomFichier);
};

// ════════════════════════════════════════════════════════════
// Composant principal
// ════════════════════════════════════════════════════════════
export default function Rapport({ user }) {
  const admin = user?.role?.toUpperCase() === 'ADMIN';

  const [etape, setEtape]     = useState('selection');
  const [loading, setLoading] = useState(false);
  const [erreur,  setErreur]  = useState('');

  const [form, setForm] = useState({
    date_debut:  '',
    date_fin:    '',
    domaine:     '',
    statut:      '',
    titre:       '',
    type:        'activite',
    description: '',
  });
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const [projets,     setProjets]     = useState([]);
  const [selection,   setSelection]   = useState(new Set());
  const [stats,       setStats]       = useState(null);
  const [rapportData, setRapportData] = useState(null);
  const [genLoading,  setGenLoading]  = useState(false);

  const rapportRef = useRef(null);

  // ── Step 1 : Charger projets de la période ───────────────
  const chargerProjets = useCallback(async () => {
    if (!form.date_debut || !form.date_fin) {
      setErreur('Veuillez sélectionner une date de début et de fin.');
      return;
    }
    setLoading(true);
    setErreur('');
    try {
      const params = new URLSearchParams({
        date_debut: form.date_debut,
        date_fin:   form.date_fin,
        ...(form.domaine ? { domaine: form.domaine } : {}),
        ...(form.statut  ? { statut:  form.statut  } : {}),
      });

      // FIX : chemins relatifs sans /api/rapport (déjà dans le helper api())
      const [projetRes, statsRes] = await Promise.all([
        api('GET', `/projets?${params}`),
        api('GET', `/stats?${params}`),
      ]);

      setProjets(projetRes.projets);
      setStats(statsRes);
      setSelection(new Set(projetRes.projets.map(p => p.id)));
      setEtape('projets');
    } catch (e) {
      setErreur(e.message);
    } finally {
      setLoading(false);
    }
  }, [form.date_debut, form.date_fin, form.domaine, form.statut]);

  // ── Step 2 : Générer le rapport ──────────────────────────
  const genererRapport = useCallback(async () => {
    if (!form.titre.trim()) {
      setErreur('Veuillez donner un titre au rapport.');
      return;
    }
    if (selection.size === 0) {
      setErreur('Veuillez sélectionner au moins un projet.');
      return;
    }
    setGenLoading(true);
    setErreur('');
    try {
      const data = await api('POST', '/generer', {
        titre:       form.titre.trim(),
        type:        form.type,
        description: form.description,
        date_debut:  form.date_debut,
        date_fin:    form.date_fin,
        projet_ids:  [...selection],
      });

      // FIX : charger exportData dans la même séquence,
      //       puis faire un seul setRapportData avec tout
      const exportData = await api('GET', `/${data.rapport.id}/export`);
      setRapportData({ ...data, exportData });
      setEtape('rapport');
    } catch (e) {
      setErreur(e.message);
    } finally {
      setGenLoading(false);
    }
  }, [form, selection]);

  // ── Toggle sélection ─────────────────────────────────────
  const toggleProjet = (id) =>
    setSelection(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const tousSelectionnes =
    projets.length > 0 && selection.size === projets.length;

  const toggleTous = () =>
    setSelection(
      tousSelectionnes ? new Set() : new Set(projets.map(p => p.id))
    );

  // ── PDF ──────────────────────────────────────────────────
  // FIX : guard complet avant d'appeler genererPDF
  const telechargerPDF = () => {
    const data = rapportData?.exportData;
    if (!data) {
      setErreur('Les données du rapport ne sont pas encore disponibles.');
      return;
    }
    try {
      genererPDF(data);
    } catch (e) {
      console.error(e);
      setErreur('Erreur lors de la génération du PDF : ' + e.message);
    }
  };

  // ── Réinitialisation ─────────────────────────────────────
  const nouveauRapport = () => {
    setEtape('selection');
    setRapportData(null);
    setProjets([]);
    setStats(null);
    setSelection(new Set());
    setForm(f => ({ ...f, titre: '', description: '' }));
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="rp-page">

      {/* En-tête */}
      <div className="rp-header">
        <div className="rp-header-inner">
          <div>
            <div className="rp-badge">{admin ? 'Laboratoire' : 'Chercheur'}</div>
            <h1 className="rp-title">Rapport par période</h1>
            <p className="rp-subtitle">
              {admin
                ? 'Générez un rapport consolidé de tous les projets du laboratoire'
                : 'Générez un rapport de vos projets sur une période donnée'}
            </p>
          </div>

          {/* Stepper */}
          <div className="rp-stepper">
            {['Période', 'Projets', 'Rapport'].map((label, idx) => {
              const step  = ['selection', 'projets', 'rapport'][idx];
              const order = ['selection', 'projets', 'rapport'].indexOf(etape);
              const done  = order > idx;
              const actif = etape === step;
              return (
                <React.Fragment key={step}>
                  {idx > 0 && (
                    <div className={`rp-step-line${done ? ' done' : ''}`} />
                  )}
                  <div
                    className={`rp-step${actif ? ' actif' : ''}${done ? ' done' : ''}`}
                  >
                    <div className="rp-step-dot">{done ? '✓' : idx + 1}</div>
                    <span className="rp-step-label">{label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rp-body">

        {/* Erreur */}
        {erreur && (
          <div className="rp-alert">
            <span>⚠</span> {erreur}
            <button onClick={() => setErreur('')}>✕</button>
          </div>
        )}

        {/* ══ ÉTAPE 1 : Sélection période ══ */}
        {etape === 'selection' && (
          <div className="rp-card">
            <div className="rp-card-head">
              <h2 className="rp-section-title">1 — Définir la période</h2>
            </div>
            <div className="rp-card-body">
              <div className="rp-form-grid">
                <div className="rp-fg">
                  <label className="rp-label">
                    Date de début <span>*</span>
                  </label>
                  <input
                    type="date"
                    className="rp-input"
                    value={form.date_debut}
                    onChange={e => setF('date_debut', e.target.value)}
                  />
                </div>
                <div className="rp-fg">
                  <label className="rp-label">
                    Date de fin <span>*</span>
                  </label>
                  <input
                    type="date"
                    className="rp-input"
                    value={form.date_fin}
                    min={form.date_debut}
                    onChange={e => setF('date_fin', e.target.value)}
                  />
                </div>
                <div className="rp-fg">
                  <label className="rp-label">Domaine (optionnel)</label>
                  <input
                    type="text"
                    className="rp-input"
                    placeholder="Ex : Intelligence Artificielle"
                    value={form.domaine}
                    onChange={e => setF('domaine', e.target.value)}
                  />
                </div>
                <div className="rp-fg">
                  <label className="rp-label">Statut (optionnel)</label>
                  <select
                    className="rp-select"
                    value={form.statut}
                    onChange={e => setF('statut', e.target.value)}
                  >
                    <option value="">— Tous les statuts —</option>
                    {Object.entries(STATUT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Raccourcis période */}
              <div className="rp-shortcuts">
                <span className="rp-shortcuts-label">Raccourcis :</span>
                {[
                  {
                    label: 'Cette année',
                    fn: () => {
                      const y = new Date().getFullYear();
                      setF('date_debut', `${y}-01-01`);
                      setF('date_fin',   `${y}-12-31`);
                    },
                  },
                  {
                    label: 'Année précédente',
                    fn: () => {
                      const y = new Date().getFullYear() - 1;
                      setF('date_debut', `${y}-01-01`);
                      setF('date_fin',   `${y}-12-31`);
                    },
                  },
                  {
                    label: '6 derniers mois',
                    fn: () => {
                      const now  = new Date();
                      const past = new Date();
                      past.setMonth(past.getMonth() - 6);
                      setF('date_debut', past.toISOString().slice(0, 10));
                      setF('date_fin',   now.toISOString().slice(0, 10));
                    },
                  },
                  {
                    label: '12 derniers mois',
                    fn: () => {
                      const now  = new Date();
                      const past = new Date();
                      past.setFullYear(past.getFullYear() - 1);
                      setF('date_debut', past.toISOString().slice(0, 10));
                      setF('date_fin',   now.toISOString().slice(0, 10));
                    },
                  },
                ].map(s => (
                  <button key={s.label} className="rp-shortcut" onClick={s.fn}>
                    {s.label}
                  </button>
                ))}
              </div>

              <button
                className="rp-btn rp-btn-primary rp-btn-lg"
                onClick={chargerProjets}
                disabled={loading || !form.date_debut || !form.date_fin}
              >
                {loading
                  ? <><span className="rp-spin" /> Chargement...</>
                  : '🔍 Sélectionner les projets'}
              </button>
            </div>
          </div>
        )}

        {/* ══ ÉTAPE 2 : Projets ══ */}
        {etape === 'projets' && (
          <>
            {stats && (
              <div className="rp-stats-grid">
                <div className="rp-stat-card">
                  <div className="rp-stat-val">{stats.total_projets}</div>
                  <div className="rp-stat-lbl">Projets trouvés</div>
                </div>
                {stats.par_statut.map(s => (
                  <div key={s.statut} className="rp-stat-card">
                    <div className="rp-stat-val">{s.total}</div>
                    <div className="rp-stat-lbl">
                      {STATUT_LABELS[s.statut] || s.statut}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rp-periode-banner">
              <span>📅</span>
              <strong>Période :</strong> {formatDate(form.date_debut)} →{' '}
              {formatDate(form.date_fin)}
              <button
                className="rp-link"
                onClick={() => setEtape('selection')}
              >
                Modifier
              </button>
            </div>

            <div className="rp-card">
              <div
                className="rp-card-head"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <h2 className="rp-section-title">
                  2 — Sélectionner les projets
                </h2>
                <button className="rp-link" onClick={toggleTous}>
                  {tousSelectionnes ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>
              <div className="rp-card-body" style={{ padding: 0 }}>
                {projets.length === 0 ? (
                  <div className="rp-empty">
                    <span>📂</span>
                    <p>Aucun projet trouvé pour cette période.</p>
                    <button
                      className="rp-btn rp-btn-ghost"
                      onClick={() => setEtape('selection')}
                    >
                      Modifier la période
                    </button>
                  </div>
                ) : (
                  <div className="rp-projets-list">
                    {projets.map(p => (
                      <div
                        key={p.id}
                        className={`rp-projet-row${selection.has(p.id) ? ' selected' : ''}`}
                        onClick={() => toggleProjet(p.id)}
                      >
                        <div className="rp-check">
                          <div
                            className={`rp-checkbox${selection.has(p.id) ? ' on' : ''}`}
                          >
                            {selection.has(p.id) && '✓'}
                          </div>
                        </div>
                        <div className="rp-projet-info">
                          <div className="rp-projet-titre">{p.titre}</div>
                          <div className="rp-projet-meta">
                            {admin && <span>👤 {p.createur_nom} · </span>}
                            {p.domaine && <span>🏷 {p.domaine} · </span>}
                            <span>
                              📅 {formatDateShort(p.date_debut)} →{' '}
                              {formatDateShort(p.date_fin)}
                            </span>
                            {p.nombre_documents > 0 && (
                              <span> · 📎 {p.nombre_documents} doc(s)</span>
                            )}
                          </div>
                          {p.description && (
                            <div className="rp-projet-desc">
                              {p.description.slice(0, 120)}
                              {p.description.length > 120 ? '…' : ''}
                            </div>
                          )}
                        </div>
                        <div className="rp-projet-right">
                          <span
                            className={`rp-badge-statut ${STATUT_COLORS[p.statut] || ''}`}
                          >
                            {STATUT_LABELS[p.statut] || p.statut}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {projets.length > 0 && (
              <div className="rp-card">
                <div className="rp-card-head">
                  <h2 className="rp-section-title">
                    3 — Paramètres du rapport
                  </h2>
                </div>
                <div className="rp-card-body">
                  <div className="rp-form-grid">
                    <div className="rp-fg rp-full">
                      <label className="rp-label">
                        Titre du rapport <span>*</span>
                      </label>
                      <input
                        type="text"
                        className="rp-input"
                        placeholder="Ex : Rapport d'activité 2024-2025"
                        value={form.titre}
                        onChange={e => setF('titre', e.target.value)}
                      />
                    </div>
                    <div className="rp-fg">
                      <label className="rp-label">Type</label>
                      <select
                        className="rp-select"
                        value={form.type}
                        onChange={e => setF('type', e.target.value)}
                      >
                        {TYPE_RAPPORT.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="rp-fg rp-full">
                      <label className="rp-label">
                        Description (optionnelle)
                      </label>
                      <textarea
                        className="rp-textarea"
                        placeholder="Objectifs, contexte, observations..."
                        value={form.description}
                        onChange={e => setF('description', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="rp-selection-info">
                    <span>✅ {selection.size} projet(s) sélectionné(s)</span>
                  </div>

                  <div className="rp-actions">
                    <button
                      className="rp-btn rp-btn-ghost"
                      onClick={() => setEtape('selection')}
                    >
                      ← Modifier la période
                    </button>
                    <button
                      className="rp-btn rp-btn-primary"
                      onClick={genererRapport}
                      disabled={
                        genLoading ||
                        selection.size === 0 ||
                        !form.titre.trim()
                      }
                    >
                      {genLoading
                        ? <><span className="rp-spin" /> Génération...</>
                        : '📄 Générer le rapport'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ ÉTAPE 3 : Rapport généré ══ */}
        {etape === 'rapport' && rapportData && (
          <>
            <div className="rp-success-banner">
              <div className="rp-success-left">
                <div className="rp-success-icon">✓</div>
                <div>
                  <strong>Rapport généré avec succès</strong>
                  <p>
                    Sauvegardé en brouillon · {rapportData.total_projets} projet(s)
                  </p>
                </div>
              </div>
              <div className="rp-success-actions">
                <button
                  className="rp-btn rp-btn-ghost"
                  onClick={() => setEtape('projets')}
                >
                  ← Modifier la sélection
                </button>
                {/* FIX : bouton désactivé jusqu'à ce que exportData soit disponible */}
                <button
                  className="rp-btn rp-btn-primary"
                  onClick={telechargerPDF}
                  disabled={!rapportData.exportData}
                >
                  {rapportData.exportData ? '⬇ Télécharger PDF' : '⏳ Chargement...'}
                </button>
              </div>
            </div>

            {/* Aperçu du rapport */}
            <div className="rp-rapport-preview" ref={rapportRef}>

              <div className="rp-cover">
                <div className="rp-cover-meta">
                  {TYPE_RAPPORT.find(t => t.value === rapportData.rapport.type)?.label ||
                    rapportData.rapport.type}
                </div>
                <h1 className="rp-cover-title">{rapportData.rapport.titre}</h1>
                <div className="rp-cover-periode">
                  📅 {formatDate(rapportData.rapport.periode_debut)} —{' '}
                  {formatDate(rapportData.rapport.periode_fin)}
                </div>
                <div className="rp-cover-auteur">
                  Préparé par{' '}
                  <strong>
                    {rapportData.meta?.genere_par || user?.nom}
                  </strong>
                  {' · '}{rapportData.meta?.role}
                  {' · '}Généré le {formatDate(rapportData.rapport.date_creation)}
                </div>
                {rapportData.rapport.description && (
                  <p className="rp-cover-desc">
                    {rapportData.rapport.description}
                  </p>
                )}
              </div>

              {/* Stats */}
              {rapportData.exportData?.stats && (
                <div className="rp-rapport-stats">
                  {[
                    ['Projets',   rapportData.exportData.stats.total_projets],
                    ['En cours',  rapportData.exportData.stats.projets_actifs],
                    ['Terminés',  rapportData.exportData.stats.projets_termines],
                    ['Documents', rapportData.exportData.stats.total_documents],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="rp-rapport-stat">
                      <div className="rp-rapport-stat-val">{val}</div>
                      <div className="rp-rapport-stat-lbl">{lbl}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tableau récapitulatif */}
              <div className="rp-rapport-section">
                <h2 className="rp-rapport-section-title">Liste des projets</h2>
                <div className="rp-rapport-table-wrap">
                  <table className="rp-rapport-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Titre</th>
                        <th>Domaine</th>
                        {admin && <th>Responsable</th>}
                        <th>Période</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rapportData.projets.map((p, idx) => (
                        <tr key={p.id}>
                          <td>{idx + 1}</td>
                          <td><strong>{p.titre}</strong></td>
                          <td>{p.domaine || '—'}</td>
                          {admin && <td>{p.createur_nom}</td>}
                          <td>
                            {formatDateShort(p.date_debut)} →{' '}
                            {formatDateShort(p.date_fin)}
                          </td>
                          <td>
                            <span
                              className={`rp-badge-statut ${STATUT_COLORS[p.statut] || ''}`}
                            >
                              {STATUT_LABELS[p.statut] || p.statut}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fiches détail */}
              <div className="rp-rapport-section">
                <h2 className="rp-rapport-section-title">Détail des projets</h2>
                {rapportData.projets.map((p, idx) => (
                  <div key={p.id} className="rp-fiche">
                    <div className="rp-fiche-head">
                      <span className="rp-fiche-num">{idx + 1}</span>
                      <h3 className="rp-fiche-title">{p.titre}</h3>
                      <span
                        className={`rp-badge-statut ${STATUT_COLORS[p.statut] || ''}`}
                      >
                        {STATUT_LABELS[p.statut] || p.statut}
                      </span>
                    </div>
                    <div className="rp-fiche-grid">
                      <div className="rp-fiche-item">
                        <span className="rp-fiche-lbl">Responsable</span>
                        <span className="rp-fiche-val">{p.createur_nom}</span>
                      </div>
                      <div className="rp-fiche-item">
                        <span className="rp-fiche-lbl">Domaine</span>
                        <span className="rp-fiche-val">{p.domaine || '—'}</span>
                      </div>
                      <div className="rp-fiche-item">
                        <span className="rp-fiche-lbl">Début</span>
                        <span className="rp-fiche-val">
                          {formatDate(p.date_debut)}
                        </span>
                      </div>
                      <div className="rp-fiche-item">
                        <span className="rp-fiche-lbl">Fin</span>
                        <span className="rp-fiche-val">
                          {formatDate(p.date_fin)}
                        </span>
                      </div>
                      {p.nombre_documents > 0 && (
                        <div className="rp-fiche-item">
                          <span className="rp-fiche-lbl">Documents</span>
                          <span className="rp-fiche-val">
                            {p.nombre_documents}
                          </span>
                        </div>
                      )}
                    </div>
                    {p.description && (
                      <p className="rp-fiche-desc">{p.description}</p>
                    )}
                    {p.participants?.length > 0 && (
                      <div className="rp-fiche-participants">
                        <span className="rp-fiche-lbl">Participants :</span>
                        {p.participants.map((pt, i) => (
                          <span key={i} className="rp-participant-chip">
                            {pt.nom}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

            </div>

            {/* Actions bas de page */}
            <div className="rp-bottom-actions">
              <button className="rp-btn rp-btn-ghost" onClick={nouveauRapport}>
                + Nouveau rapport
              </button>
              <button
                className="rp-btn rp-btn-primary"
                onClick={telechargerPDF}
                disabled={!rapportData.exportData}
              >
                {rapportData.exportData ? '⬇ Télécharger PDF' : '⏳ Chargement...'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}