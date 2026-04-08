/**
 * rapport-periode.js
 * Routes Express pour la génération de rapports par période
 * Sécurisé JWT — Compatible PostgreSQL
 *
 * Monter ce routeur sur /api/rapport dans app.js :
 *   app.use('/api/rapport', require('./routes/rapport-periode'));
 */

const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const auth    = require('../middleware/auth');

// ── Helpers ──────────────────────────────────────────────────
const isAdmin     = (req) => req.user.role?.toUpperCase() === 'ADMIN';
const isChercheur = (req) => ['CHERCHEUR', 'ADMIN'].includes(req.user.role?.toUpperCase());

const validerPeriode = (date_debut, date_fin) => {
  if (!date_debut || !date_fin)
    return 'Les dates de début et de fin sont obligatoires';
  const d = new Date(date_debut);
  const f = new Date(date_fin);
  if (isNaN(d.getTime()) || isNaN(f.getTime()))
    return 'Format de date invalide (YYYY-MM-DD attendu)';
  if (f < d)
    return 'La date de fin doit être postérieure à la date de début';
  return null;
};

// ── Fragment SQL réutilisable : chevauchement de période ─────
const periodeOverlap = (alias = 'p') => `(
  (${alias}.date_debut BETWEEN $1 AND $2)
  OR (${alias}.date_fin  BETWEEN $1 AND $2)
  OR (${alias}.date_debut <= $1 AND (${alias}.date_fin >= $2 OR ${alias}.date_fin IS NULL))
)`;

// ─────────────────────────────────────────────────────────────
// GET /api/rapport/projets
// Retourne les projets d'une période avec filtrage par rôle
//
// Query params : date_debut, date_fin, domaine, statut
// Chercheur → ses projets uniquement
// Admin     → tous les projets du laboratoire
// ─────────────────────────────────────────────────────────────
router.get('/projets', auth, async (req, res) => {
  const { date_debut, date_fin, domaine, statut } = req.query;

  const erreur = validerPeriode(date_debut, date_fin);
  if (erreur) return res.status(400).json({ error: erreur });

  const conditions = [];
  const params     = [date_debut, date_fin];
  let   i          = 3;

  conditions.push(periodeOverlap('p'));

  if (!isAdmin(req)) {
    conditions.push(`(
      p.createur_id = $${i}
      OR p.id IN (SELECT projet_id FROM participation WHERE utilisateur_id = $${i})
    )`);
    params.push(req.user.id);
    i++;
  }

  if (domaine) {
    conditions.push(`p.domaine ILIKE $${i++}`);
    params.push(`%${domaine}%`);
  }
  if (statut) {
    conditions.push(`p.statut = $${i++}`);
    params.push(statut);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.titre,
        p.description,
        p.domaine,
        p.mots_cles,
        p.statut,
        p.date_debut,
        p.date_fin,
        p.annee_publication,
        p.createur_id,
        c.nom   AS createur_nom,
        c.email AS createur_email,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id',    u.id,
              'nom',   u.nom,
              'email', u.email,
              'role',  u.role
            )
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'::json
        ) AS participants,

        COUNT(DISTINCT d.id) AS nombre_documents

      FROM projet p
      LEFT JOIN utilisateur c    ON c.id  = p.createur_id
      LEFT JOIN participation pa ON pa.projet_id = p.id
      LEFT JOIN utilisateur u    ON u.id  = pa.utilisateur_id
      LEFT JOIN document d       ON d.projet_id  = p.id
      ${where}
      GROUP BY
        p.id, p.titre, p.description, p.domaine, p.mots_cles,
        p.statut, p.date_debut, p.date_fin, p.annee_publication,
        p.createur_id, c.nom, c.email
      ORDER BY p.date_debut ASC NULLS LAST, p.titre ASC
    `, params);

    res.json({
      periode: { date_debut, date_fin },
      total:   result.rows.length,
      projets: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/rapport/stats
// Statistiques agrégées pour une période
// ─────────────────────────────────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  const { date_debut, date_fin } = req.query;

  const erreur = validerPeriode(date_debut, date_fin);
  if (erreur) return res.status(400).json({ error: erreur });

  const baseParams = [date_debut, date_fin];

  // FIX : roleFilter doit filtrer avec $3, pas répéter $1/$2
  let roleFilter = '';
  const roleParams = [];
  if (!isAdmin(req)) {
    roleFilter = `AND (
      p.createur_id = $3
      OR p.id IN (SELECT projet_id FROM participation WHERE utilisateur_id = $3)
    )`;
    roleParams.push(req.user.id);
  }

  const allParams = [...baseParams, ...roleParams];
  const overlap   = periodeOverlap('p');

  try {
    const [totalRes, parStatutRes, parDomaineRes, chercheurRes] = await Promise.all([

      pool.query(
        `SELECT COUNT(DISTINCT p.id) AS total
         FROM projet p
         WHERE ${overlap} ${roleFilter}`,
        allParams
      ),

      pool.query(
        `SELECT p.statut, COUNT(*) AS total
         FROM projet p
         WHERE ${overlap} ${roleFilter}
         GROUP BY p.statut
         ORDER BY total DESC`,
        allParams
      ),

      pool.query(
        `SELECT COALESCE(p.domaine, 'Non défini') AS domaine, COUNT(*) AS total
         FROM projet p
         WHERE ${overlap} ${roleFilter}
         GROUP BY p.domaine
         ORDER BY total DESC
         LIMIT 8`,
        allParams
      ),

      // par_chercheur : admin seulement, utilise baseParams (pas de roleFilter)
      isAdmin(req)
        ? pool.query(
            `SELECT u.nom, u.email, COUNT(p.id) AS total
             FROM projet p
             JOIN utilisateur u ON u.id = p.createur_id
             WHERE ${overlap}
             GROUP BY u.id, u.nom, u.email
             ORDER BY total DESC
             LIMIT 10`,
            baseParams
          )
        : Promise.resolve({ rows: [] }),
    ]);

    res.json({
      periode:       { date_debut, date_fin },
      total_projets: parseInt(totalRes.rows[0].total, 10),
      par_statut:    parStatutRes.rows,
      par_domaine:   parDomaineRes.rows,
      par_chercheur: chercheurRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/rapport/generer
// Crée un enregistrement rapport en BD et retourne ses données
// ─────────────────────────────────────────────────────────────
router.post('/generer', auth, async (req, res) => {
  if (!isChercheur(req))
    return res.status(403).json({ error: 'Accès refusé' });

  const {
    titre,
    date_debut,
    date_fin,
    projet_ids,
    description,
    type = 'activite',
  } = req.body;

  const erreur = validerPeriode(date_debut, date_fin);
  if (erreur) return res.status(400).json({ error: erreur });

  if (!titre?.trim())
    return res.status(400).json({ error: 'Le titre est obligatoire' });

  try {
    // 1. Récupérer les projets de la période
    const conditions = [];
    const params     = [date_debut, date_fin];
    let   i          = 3;

    conditions.push(periodeOverlap('p'));

    if (!isAdmin(req)) {
      conditions.push(`(
        p.createur_id = $${i}
        OR p.id IN (SELECT projet_id FROM participation WHERE utilisateur_id = $${i})
      )`);
      params.push(req.user.id);
      i++;
    }

    if (projet_ids?.length > 0) {
      conditions.push(`p.id = ANY($${i++}::int[])`);
      params.push(projet_ids);
    }

    const projetsRes = await pool.query(`
      SELECT
        p.id, p.titre, p.description, p.domaine, p.statut,
        p.date_debut, p.date_fin, p.annee_publication, p.mots_cles,
        c.nom AS createur_nom, c.email AS createur_email,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('nom', u.nom, 'role', u.role)
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'::json
        ) AS participants,
        COUNT(DISTINCT d.id) AS nombre_documents
      FROM projet p
      LEFT JOIN utilisateur c    ON c.id  = p.createur_id
      LEFT JOIN participation pa ON pa.projet_id = p.id
      LEFT JOIN utilisateur u    ON u.id  = pa.utilisateur_id
      LEFT JOIN document d       ON d.projet_id  = p.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY p.id, c.nom, c.email
      ORDER BY p.date_debut ASC NULLS LAST
    `, params);

    // 2. Récupérer le nom de l'auteur depuis la BD (ne pas se fier uniquement au JWT)
    const auteurRes = await pool.query(
      'SELECT nom FROM utilisateur WHERE id = $1',
      [req.user.id]
    );
    const auteurNom = auteurRes.rows[0]?.nom || `Utilisateur #${req.user.id}`;

    // 3. Sauvegarder le rapport
    const contenu = JSON.stringify({
      projets: projetsRes.rows,
      meta:    { genere_le: new Date().toISOString(), genere_par: req.user.id },
    });

    const rapportRes = await pool.query(`
      INSERT INTO rapport (
        titre, type, description,
        periode_debut, periode_fin,
        contenu, auteur_id, statut, date_creation
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'brouillon', CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      titre.trim(),
      type,
      description?.trim() ||
        `Rapport généré automatiquement pour la période du ${date_debut} au ${date_fin}.`,
      date_debut,
      date_fin,
      contenu,
      req.user.id,
    ]);

    const rapport = rapportRes.rows[0];

    res.status(201).json({
      rapport,
      projets:       projetsRes.rows,
      total_projets: projetsRes.rows.length,
      meta: {
        genere_le:  rapport.date_creation,
        genere_par: auteurNom,          // FIX : récupéré depuis la BD
        role:       req.user.role,
        is_admin:   isAdmin(req),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/rapport/:rapport_id/export
// Retourne les données structurées pour génération PDF côté client
// ─────────────────────────────────────────────────────────────
router.get('/:rapport_id/export', auth, async (req, res) => {
  const { rapport_id } = req.params;

  // FIX : valider que rapport_id est un entier avant de frapper la BD
  if (!/^\d+$/.test(rapport_id))
    return res.status(400).json({ error: 'Identifiant de rapport invalide' });

  try {
    const result = await pool.query(`
      SELECT r.*, u.nom AS auteur_nom, u.email AS auteur_email
      FROM rapport r
      JOIN utilisateur u ON u.id = r.auteur_id
      WHERE r.id = $1
    `, [rapport_id]);

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Rapport non trouvé' });

    const rapport = result.rows[0];

    if (!isAdmin(req) && rapport.auteur_id !== req.user.id)
      return res.status(403).json({ error: 'Accès non autorisé' });

    let projets = [];
    try {
      const parsed = JSON.parse(rapport.contenu || '{}');
      projets = parsed.projets || [];
    } catch {
      // contenu non JSON — on renvoie un tableau vide
    }

    res.json({
      rapport: {
        id:            rapport.id,
        titre:         rapport.titre,
        type:          rapport.type,
        description:   rapport.description,
        periode_debut: rapport.periode_debut,
        periode_fin:   rapport.periode_fin,
        date_creation: rapport.date_creation,
        statut:        rapport.statut,
      },
      auteur: {
        nom:   rapport.auteur_nom,
        email: rapport.auteur_email,
        role:  req.user.role,
      },
      projets,
      stats: {
        total_projets:    projets.length,
        projets_actifs:   projets.filter(p => p.statut === 'en_cours').length,
        projets_termines: projets.filter(p =>
          ['accepte', 'publie'].includes(p.statut)
        ).length,
        total_documents:  projets.reduce(
          (s, p) => s + parseInt(p.nombre_documents || 0, 10), 0
        ),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;