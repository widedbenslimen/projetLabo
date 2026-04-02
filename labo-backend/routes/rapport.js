const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// ── Helpers de rôles ──────────────────────────────────────────────
const isAdmin = (req) => req.user.role?.toUpperCase() === 'ADMIN';
const isChercheur = (req) => ['CHERCHEUR', 'ADMIN'].includes(req.user.role?.toUpperCase());


// ═════════════════════════════════════════════════════════════════
// GET /api/rapport/chercheur
// Rapport par chercheur : ses propres projets + stats
// Accès : CHERCHEUR (ses projets) | ADMIN (tous les chercheurs)
// ═════════════════════════════════════════════════════════════════
router.get('/chercheur', auth, async (req, res) => {
  if (!isChercheur(req))
    return res.status(403).json({ error: 'Accès réservé aux chercheurs et administrateurs' });

  // Un chercheur ne voit que ses propres données ; l'admin peut filtrer par chercheur_id
  const targetId = isAdmin(req) && req.query.chercheur_id
    ? parseInt(req.query.chercheur_id)
    : req.user.id;

  try {
    // ── 1. Infos du chercheur ──────────────────────────────────
    const userRes = await pool.query(
      `SELECT id, nom, email, role FROM utilisateur WHERE id = $1 AND actif = true`,
      [targetId]
    );
    if (userRes.rows.length === 0)
      return res.status(404).json({ error: 'Chercheur non trouvé' });

    const chercheur = userRes.rows[0];

    // ── 2. Projets du chercheur ────────────────────────────────
    const projetsRes = await pool.query(`
      SELECT
        p.id,
        p.titre,
        p.type_publication,
        p.statut,
        p.annee_publication,
        p.journal_ou_conference,
        p.domaine,
        p.langue,
        p.doi,
        p.date_debut,
        p.date_fin,
        p.url_texte_complet,
        pa.date_participation,
        -- Est-il le créateur ? (premier participant)
        (
          SELECT utilisateur_id FROM participation
          WHERE projet_id = p.id
          ORDER BY date_participation ASC LIMIT 1
        ) = $1 AS est_createur,
        -- Nombre de participants
        (SELECT COUNT(*) FROM participation WHERE projet_id = p.id) AS nb_participants,
        -- Liste des coauteurs (hors lui-même)
        COALESCE(
          (SELECT json_agg(json_build_object('id', u2.id, 'nom', u2.nom, 'email', u2.email))
           FROM participation pa2
           JOIN utilisateur u2 ON u2.id = pa2.utilisateur_id
           WHERE pa2.projet_id = p.id AND pa2.utilisateur_id != $1),
          '[]'
        ) AS coauteurs
      FROM projet p
      JOIN participation pa ON pa.projet_id = p.id AND pa.utilisateur_id = $1
      ORDER BY p.annee_publication DESC NULLS LAST, p.date_debut DESC NULLS LAST
    `, [targetId]);

    const projets = projetsRes.rows;

    // ── 3. Statistiques globales ───────────────────────────────
    const totalProjets = projets.length;
    const parStatut = {};
    const parType = {};
    const parAnnee = {};
    const parDomaine = {};

    projets.forEach(p => {
      // par statut
      parStatut[p.statut] = (parStatut[p.statut] || 0) + 1;
      // par type
      const type = p.type_publication || 'inconnu';
      parType[type] = (parType[type] || 0) + 1;
      // par année
      if (p.annee_publication) {
        const a = String(p.annee_publication);
        parAnnee[a] = (parAnnee[a] || 0) + 1;
      }
      // par domaine
      if (p.domaine) {
        parDomaine[p.domaine] = (parDomaine[p.domaine] || 0) + 1;
      }
    });

    // Projets publiés
    const projetsPublies   = projets.filter(p => p.statut === 'publie').length;
    const projetsEnCours   = projets.filter(p => p.statut === 'en_cours').length;
    const projetsAcceptes  = projets.filter(p => p.statut === 'accepte').length;
    const projetsSoumis    = projets.filter(p => p.statut === 'soumis').length;
    const projetsCreateur  = projets.filter(p => p.est_createur).length;

    // Collaborateurs uniques
    const collaborateursIds = new Set();
    projets.forEach(p => {
      (p.coauteurs || []).forEach(c => collaborateursIds.add(c.id));
    });

    // ── 4. Réponse ─────────────────────────────────────────────
    res.json({
      chercheur,
      statistiques: {
        total_projets:       totalProjets,
        projets_publies:     projetsPublies,
        projets_en_cours:    projetsEnCours,
        projets_acceptes:    projetsAcceptes,
        projets_soumis:      projetsSoumis,
        projets_createur:    projetsCreateur,
        total_collaborateurs: collaborateursIds.size,
        par_statut:  parStatut,
        par_type:    parType,
        par_annee:   parAnnee,
        par_domaine: parDomaine,
      },
      projets,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// ═════════════════════════════════════════════════════════════════
// GET /api/rapport/chercheurs
// Liste de tous les chercheurs avec leurs stats résumées
// Accès : ADMIN uniquement
// ═════════════════════════════════════════════════════════════════
router.get('/chercheurs', auth, async (req, res) => {
  if (!isAdmin(req))
    return res.status(403).json({ error: 'Accès réservé à l\'administrateur' });

  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.nom,
        u.email,
        u.role,
        COUNT(DISTINCT pa.projet_id)                                          AS total_projets,
        COUNT(DISTINCT CASE WHEN p.statut = 'publie'   THEN p.id END)        AS projets_publies,
        COUNT(DISTINCT CASE WHEN p.statut = 'en_cours' THEN p.id END)        AS projets_en_cours,
        COUNT(DISTINCT CASE WHEN p.statut = 'accepte'  THEN p.id END)        AS projets_acceptes,
        -- Projets dont il est créateur (premier participant)
        COUNT(DISTINCT CASE
          WHEN (
            SELECT utilisateur_id FROM participation p2
            WHERE p2.projet_id = pa.projet_id
            ORDER BY p2.date_participation ASC LIMIT 1
          ) = u.id THEN pa.projet_id
        END) AS projets_createur
      FROM utilisateur u
      LEFT JOIN participation pa ON pa.utilisateur_id = u.id
      LEFT JOIN projet p ON p.id = pa.projet_id
      WHERE u.actif = true
        AND u.role IN ('CHERCHEUR', 'ADMIN')
      GROUP BY u.id, u.nom, u.email, u.role
      ORDER BY total_projets DESC, u.nom ASC
    `);

    res.json({
      total_chercheurs: result.rows.length,
      chercheurs: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// ═════════════════════════════════════════════════════════════════
// GET /api/rapport/projet/:id
// Rapport détaillé d'un projet spécifique
// Accès : ADMIN (tous) | CHERCHEUR (ses projets uniquement)
// ═════════════════════════════════════════════════════════════════
router.get('/projet/:id', auth, async (req, res) => {
  if (!isChercheur(req))
    return res.status(403).json({ error: 'Accès non autorisé' });

  const { id } = req.params;

  try {
    // Vérifier l'accès au projet
    if (!isAdmin(req)) {
      const access = await pool.query(
        'SELECT 1 FROM participation WHERE projet_id = $1 AND utilisateur_id = $2',
        [id, req.user.id]
      );
      if (access.rows.length === 0)
        return res.status(403).json({ error: 'Accès refusé : vous ne participez pas à ce projet' });
    }

    // ── 1. Données du projet ───────────────────────────────────
    const projetRes = await pool.query(
      'SELECT * FROM projet WHERE id = $1',
      [id]
    );
    if (projetRes.rows.length === 0)
      return res.status(404).json({ error: 'Projet non trouvé' });

    const projet = projetRes.rows[0];

    // ── 2. Participants avec détails ───────────────────────────
    const participantsRes = await pool.query(`
      SELECT
        u.id,
        u.nom,
        u.email,
        u.role,
        pa.date_participation,
        -- Est-il le créateur ?
        (pa.date_participation = (
          SELECT MIN(date_participation) FROM participation WHERE projet_id = $1
        )) AS est_createur
      FROM participation pa
      JOIN utilisateur u ON u.id = pa.utilisateur_id
      WHERE pa.projet_id = $1
      ORDER BY pa.date_participation ASC
    `, [id]);

    const participants = participantsRes.rows;
    const createur = participants.find(p => p.est_createur) || participants[0] || null;

    // ── 3. Historique des statuts (si table existe) ────────────
    // (optionnel — on renvoie le statut courant et les dates dispo)
    const dureeJours = projet.date_debut && projet.date_fin
      ? Math.ceil(
          (new Date(projet.date_fin) - new Date(projet.date_debut)) / (1000 * 60 * 60 * 24)
        )
      : null;

    // ── 4. Réponse ─────────────────────────────────────────────
    res.json({
      projet,
      createur,
      participants,
      statistiques: {
        nb_participants: participants.length,
        duree_jours: dureeJours,
        a_pdf: !!projet.url_texte_complet,
        a_doi: !!projet.doi,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// ═════════════════════════════════════════════════════════════════
// GET /api/rapport/projets
// Rapport global de tous les projets (résumé)
// Accès : ADMIN uniquement
// ═════════════════════════════════════════════════════════════════
router.get('/projets', auth, async (req, res) => {
  if (!isAdmin(req))
    return res.status(403).json({ error: 'Accès réservé à l\'administrateur' });

  try {
    // ── 1. Tous les projets avec participants ──────────────────
    const projetsRes = await pool.query(`
      SELECT
        p.*,
        COUNT(pa.utilisateur_id)::INT AS nb_participants,
        COALESCE(
          json_agg(
            json_build_object(
              'id',    u.id,
              'nom',   u.nom,
              'email', u.email,
              'date_participation', pa.date_participation
            )
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS participants
      FROM projet p
      LEFT JOIN participation pa ON pa.projet_id = p.id
      LEFT JOIN utilisateur u    ON u.id = pa.utilisateur_id
      GROUP BY p.id
      ORDER BY p.annee_publication DESC NULLS LAST, p.date_debut DESC NULLS LAST
    `);

    const projets = projetsRes.rows;

    // ── 2. Statistiques globales ───────────────────────────────
    const totalProjets = projets.length;

    const parStatut  = {};
    const parType    = {};
    const parAnnee   = {};
    const parDomaine = {};
    const parLangue  = {};
    let   avecPdf    = 0;
    let   avecDoi    = 0;

    projets.forEach(p => {
      parStatut[p.statut || 'inconnu']           = (parStatut[p.statut || 'inconnu'] || 0) + 1;
      parType[p.type_publication || 'inconnu']   = (parType[p.type_publication || 'inconnu'] || 0) + 1;
      parLangue[p.langue || 'inconnu']           = (parLangue[p.langue || 'inconnu'] || 0) + 1;
      if (p.annee_publication) {
        const a = String(p.annee_publication);
        parAnnee[a] = (parAnnee[a] || 0) + 1;
      }
      if (p.domaine) parDomaine[p.domaine] = (parDomaine[p.domaine] || 0) + 1;
      if (p.url_texte_complet) avecPdf++;
      if (p.doi) avecDoi++;
    });

    // Top domaines (3 premiers)
    const topDomaines = Object.entries(parDomaine)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domaine, count]) => ({ domaine, count }));

    // Projets avec le plus de participants
    const topProjetsParParticipants = [...projets]
      .sort((a, b) => b.nb_participants - a.nb_participants)
      .slice(0, 5)
      .map(p => ({ id: p.id, titre: p.titre, nb_participants: p.nb_participants, statut: p.statut }));

    // ── 3. Stats par chercheur (participation) ─────────────────
    const chercheursRes = await pool.query(`
      SELECT
        u.id,
        u.nom,
        u.email,
        COUNT(DISTINCT pa.projet_id)                                   AS total_projets,
        COUNT(DISTINCT CASE WHEN p.statut = 'publie' THEN p.id END)   AS projets_publies
      FROM utilisateur u
      JOIN participation pa ON pa.utilisateur_id = u.id
      JOIN projet p          ON p.id = pa.projet_id
      WHERE u.actif = true
      GROUP BY u.id, u.nom, u.email
      ORDER BY total_projets DESC
      LIMIT 10
    `);

    // ── 4. Réponse ─────────────────────────────────────────────
    res.json({
      statistiques: {
        total_projets:    totalProjets,
        avec_pdf:         avecPdf,
        avec_doi:         avecDoi,
        par_statut:       parStatut,
        par_type:         parType,
        par_annee:        parAnnee,
        par_domaine:      parDomaine,
        par_langue:       parLangue,
        top_domaines:     topDomaines,
        top_projets_par_participants: topProjetsParParticipants,
      },
      top_chercheurs: chercheursRes.rows,
      projets,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// ═════════════════════════════════════════════════════════════════
// GET /api/rapport/global
// Tableau de bord global : indicateurs clés pour l'admin
// Accès : ADMIN uniquement
// ═════════════════════════════════════════════════════════════════
router.get('/global', auth, async (req, res) => {
  if (!isAdmin(req))
    return res.status(403).json({ error: 'Accès réservé à l\'administrateur' });

  try {
    // KPIs en une seule requête
    const kpiRes = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM projet)                                                  AS total_projets,
        (SELECT COUNT(*) FROM projet WHERE statut = 'publie')                         AS projets_publies,
        (SELECT COUNT(*) FROM projet WHERE statut = 'en_cours')                       AS projets_en_cours,
        (SELECT COUNT(*) FROM projet WHERE statut = 'soumis')                         AS projets_soumis,
        (SELECT COUNT(*) FROM projet WHERE statut = 'en_revision')                    AS projets_en_revision,
        (SELECT COUNT(*) FROM projet WHERE statut = 'accepte')                        AS projets_acceptes,
        (SELECT COUNT(*) FROM projet WHERE statut = 'retire')                         AS projets_retires,
        (SELECT COUNT(*) FROM projet WHERE url_texte_complet IS NOT NULL)             AS projets_avec_pdf,
        (SELECT COUNT(*) FROM projet WHERE doi IS NOT NULL)                           AS projets_avec_doi,
        (SELECT COUNT(*) FROM utilisateur WHERE actif = true)                         AS total_utilisateurs,
        (SELECT COUNT(*) FROM utilisateur WHERE actif = true AND role = 'CHERCHEUR')  AS total_chercheurs,
        (SELECT COUNT(*) FROM utilisateur WHERE actif = true AND role = 'ADMIN')      AS total_admins,
        (SELECT COUNT(*) FROM participation)                                           AS total_participations
    `);

    const kpi = kpiRes.rows[0];

    // Évolution par année
    const evolutionRes = await pool.query(`
      SELECT
        annee_publication AS annee,
        COUNT(*)::INT     AS total,
        COUNT(CASE WHEN statut = 'publie' THEN 1 END)::INT AS publies
      FROM projet
      WHERE annee_publication IS NOT NULL
      GROUP BY annee_publication
      ORDER BY annee_publication ASC
    `);

    // Répartition par type
    const typeRes = await pool.query(`
      SELECT type_publication AS type, COUNT(*)::INT AS count
      FROM projet
      GROUP BY type_publication
      ORDER BY count DESC
    `);

    // Top domaines
    const domaineRes = await pool.query(`
      SELECT domaine, COUNT(*)::INT AS count
      FROM projet
      WHERE domaine IS NOT NULL AND domaine != ''
      GROUP BY domaine
      ORDER BY count DESC
      LIMIT 8
    `);

    // Activité récente (derniers projets créés / modifiés)
    const recentRes = await pool.query(`
      SELECT
        p.id, p.titre, p.statut, p.type_publication, p.annee_publication,
        p.date_debut,
        u.nom AS createur_nom
      FROM projet p
      LEFT JOIN LATERAL (
        SELECT utilisateur_id FROM participation
        WHERE projet_id = p.id
        ORDER BY date_participation ASC LIMIT 1
      ) pa ON true
      LEFT JOIN utilisateur u ON u.id = pa.utilisateur_id
      ORDER BY p.id DESC
      LIMIT 10
    `);

    res.json({
      kpi,
      evolution_par_annee:  evolutionRes.rows,
      repartition_par_type: typeRes.rows,
      top_domaines:         domaineRes.rows,
      activite_recente:     recentRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
module.exports = router;