// routes/rapport.js
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const auth    = require('../middleware/auth');

/* ─────────────────────────────────────────────────────────────────────────────
   Helper partagé : construit le filtre SQL selon le rôle de l'utilisateur.
   Utilisé à la fois par GET /articles et POST /articles/pdf.
───────────────────────────────────────────────────────────────────────────── */
function buildRoleFilter({ userRole, userId, cible, cible_id, startIdx }) {
  let sql    = '';
  const vals = [];
  let idx    = startIdx;

  if (userRole === 'CHERCHEUR' || userRole === 'CADRE_TECHNIQUE') {
    // Uniquement ses propres articles
    sql += ` AND d.auteur_id = $${idx++}`;
    vals.push(userId);

  } else if (userRole === 'ADMIN') {
    const cibleNorm = (cible || 'global').toLowerCase();

    switch (cibleNorm) {
      case 'global':
        break; // Tous les articles – aucun filtre supplémentaire

      case 'chercheur':
        sql += ` AND u.role = 'CHERCHEUR'`;
        if (cible_id) { sql += ` AND d.auteur_id = $${idx++}`; vals.push(cible_id); }
        break;

      case 'cadre_technique':
        sql += ` AND u.role = 'CADRE_TECHNIQUE'`;
        if (cible_id) { sql += ` AND d.auteur_id = $${idx++}`; vals.push(cible_id); }
        break;

      case 'admin':
        sql += ` AND u.role = 'ADMIN'`;
        if (cible_id) { sql += ` AND d.auteur_id = $${idx++}`; vals.push(cible_id); }
        break;

      case 'personnel':
        sql += ` AND d.auteur_id = $${idx++}`;
        vals.push(userId);
        break;

      default:
        throw new Error(`cible_invalide:${cible}`);
    }
  } else {
    throw new Error('acces_interdit');
  }

  return { extraSQL: sql, values: vals, nextIdx: idx };
}

/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/rapport/articles
   Query params : date_debut, date_fin, cible (admin), cible_id (admin, optionnel)
───────────────────────────────────────────────────────────────────────────── */
router.get('/articles', auth, async (req, res) => {
  try {
    const { date_debut, date_fin, cible, cible_id, sousType } = req.query;
    const { role: userRole, id: userId }            = req.user;

    // ── Validation dates ─────────────────────────────────────────
    if (!date_debut || !date_fin)
      return res.status(400).json({ error: 'date_debut et date_fin sont requis' });
    if (new Date(date_debut) > new Date(date_fin))
      return res.status(400).json({ error: 'date_debut doit être antérieure à date_fin' });

    // ── Requête de base ───────────────────────────────────────────
    let query = `
      SELECT
        d.id,
        d.titre,
        d.sous_type,
        d.journal,
        d.maison_edition,
        d.doi,
        d.resume,
        d.citation_APA,
        d.mots_cles,
        d.visibilite,
        d.date_creation,
        d.date_modification,
        u.id    AS auteur_id,
        u.nom   AS auteur_nom,
        u.email AS auteur_email,
        u.role  AS auteur_role,
        p.titre AS projet_titre
      FROM document d
      LEFT JOIN utilisateur u ON d.auteur_id = u.id
      LEFT JOIN projet       p ON d.projet_id = p.id
      WHERE d.type = 'ARTICLE'
        AND d.date_creation >= $1
        AND d.date_creation <  ($2::date + INTERVAL '1 day')
    `;
    const values = [date_debut, date_fin];

    // ── Filtre rôle ───────────────────────────────────────────────
    let roleFilter;
    try {
      roleFilter = buildRoleFilter({ userRole, userId, cible, cible_id, startIdx: 3 });
    } catch (e) {
      if (e.message === 'acces_interdit')
        return res.status(403).json({ error: 'Accès non autorisé' });
      if (e.message.startsWith('cible_invalide'))
        return res.status(400).json({ error: `cible invalide : ${cible}` });
      throw e;
    }

    query += roleFilter.extraSQL;
    values.push(...roleFilter.values);
    
    // ── Filtre sous_type (optionnel) ─────────────────────────────
    if (sousType && (sousType === 'JOURNAL' || sousType === 'CONFERENCE')) {
      query += ` AND d.sous_type = $${values.length + 1}`;
      values.push(sousType);
    }
    
    query += ' ORDER BY d.date_creation DESC';

    const result   = await pool.query(query, values);
    const articles = result.rows;

    // ── Statistiques ──────────────────────────────────────────────
    const stats = {
      total          : articles.length,
      journaux       : articles.filter(a => a.sous_type === 'JOURNAL').length,
      conferences    : articles.filter(a => a.sous_type === 'CONFERENCE').length,
      visibles       : articles.filter(a => a.visibilite).length,
      auteurs_uniques: [...new Set(articles.map(a => a.auteur_id))].length,
    };

    res.json({ periode: { date_debut, date_fin }, stats, articles });

  } catch (err) {
    console.error('Erreur rapport articles:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/rapport/articles/utilisateurs
   Admin only – liste des utilisateurs pour le sélecteur de filtre
───────────────────────────────────────────────────────────────────────────── */
router.get('/articles/utilisateurs', auth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN')
      return res.status(403).json({ error: "Accès réservé à l'administrateur" });

    const { role } = req.query; // optionnel : CHERCHEUR | CADRE_TECHNIQUE | ADMIN
    let query      = `SELECT id, nom, email, role FROM utilisateur WHERE actif = true`;
    const vals     = [];

    if (role) { query += ` AND role = $1`; vals.push(role.toUpperCase()); }
    query += ' ORDER BY nom';

    const result = await pool.query(query, vals);
    res.json(result.rows);

  } catch (err) {
    console.error('Erreur utilisateurs rapport:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;