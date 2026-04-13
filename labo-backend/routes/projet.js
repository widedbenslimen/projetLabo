const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const auth    = require('../middleware/auth');

// ── Valeurs valides ──────────────────────────────────────────
const STATUTS_VALIDES = ['en_cours', 'termine'];

// ── Helper : requête projet avec participants + docs ─────────
// Mutualisé pour GET / et GET /:id (évite la duplication)
const PROJET_SELECT = `
  SELECT
    p.id, p.titre, p.description, p.domaine, p.mots_cles,
    p.annee_publication, p.date_debut, p.date_fin, p.statut, p.createur_id,
    c.nom AS createur_nom,
    COALESCE(
      json_agg(
        DISTINCT jsonb_build_object(
          'id',                 u.id,
          'nom',                u.nom,
          'email',              u.email,
          'role',               u.role,
          'date_participation', pa.date_participation
        )
      ) FILTER (WHERE u.id IS NOT NULL),
      '[]'::json
    ) AS participants,
    COUNT(DISTINCT d.id) AS nombre_documents
  FROM projet p
  LEFT JOIN utilisateur c  ON c.id = p.createur_id
  LEFT JOIN participation pa ON pa.projet_id = p.id
  LEFT JOIN utilisateur u  ON u.id = pa.utilisateur_id
  LEFT JOIN document      d  ON d.projet_id = p.id
`;

// ── Middleware : créateur du projet ou ADMIN ─────────────────
const estAdminProjet = async (req, res, next) => {
  const projet_id      = req.params.id;
  const utilisateur_id = req.user.id;
  const role           = req.user.role?.toUpperCase();

  if (role === 'ADMIN') return next();

  try {
    const result = await pool.query(
      `SELECT createur_id FROM projet WHERE id = $1`,
      [projet_id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Projet non trouvé' });

    if (result.rows[0].createur_id !== utilisateur_id)
      return res.status(403).json({ error: "Accès réservé au créateur ou admin" });

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/projet — Liste tous les projets
// ─────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { statut, domaine, annee_publication } = req.query;

    const conditions = [];
    const params     = [];
    let   i          = 1;

    if (statut && STATUTS_VALIDES.includes(statut)) {
      conditions.push(`p.statut = $${i++}`); params.push(statut);
    }
    if (domaine) {
      conditions.push(`p.domaine ILIKE $${i++}`); params.push(`%${domaine}%`);
    }
    const year = parseInt(annee_publication);
    if (!isNaN(year)) {
      conditions.push(`p.annee_publication = $${i++}`); params.push(year);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      ${PROJET_SELECT}
      ${where}
      GROUP BY p.id, p.titre, p.description, p.domaine, p.mots_cles,
        p.annee_publication, p.date_debut, p.date_fin, p.statut, p.createur_id, c.nom
      ORDER BY p.annee_publication DESC NULLS LAST, p.date_debut DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/projet/mes-projets — Projets de l'utilisateur courant
// ✅ FIX: Cette route DOIT être avant /:id pour ne pas être capturée
// ─────────────────────────────────────────────────────────────
router.get('/mes-projets', auth, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(`
      ${PROJET_SELECT}
      WHERE
        p.createur_id = $1
        OR p.id IN (
          SELECT projet_id FROM participation WHERE utilisateur_id = $1
        )
      GROUP BY p.id, p.titre, p.description, p.domaine, p.mots_cles,
        p.annee_publication, p.date_debut, p.date_fin, p.statut, p.createur_id, c.nom
      ORDER BY p.date_debut DESC NULLS LAST
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/projet/:id — Détail complet (participants + documents)
// ─────────────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const role   = req.user.role?.toUpperCase();
  const userId = req.user.id;

  try {
    const projet = await pool.query(`
      SELECT p.*, c.nom AS createur_nom
      FROM projet p
      LEFT JOIN utilisateur c ON c.id = p.createur_id
      WHERE p.id = $1
    `, [id]);

    if (projet.rows.length === 0)
      return res.status(404).json({ error: 'Projet non trouvé' });

    const participants = await pool.query(`
      SELECT u.id, u.nom, u.email, u.role, pa.date_participation
      FROM participation pa
      JOIN utilisateur u ON u.id = pa.utilisateur_id
      WHERE pa.projet_id = $1
      ORDER BY (u.id = $2) DESC, pa.date_participation ASC
    `, [id, projet.rows[0].createur_id]);

    let docQuery  = `
      SELECT d.id, d.titre, d.type, d.sous_type, d.description,
             d.mots_cles, d.lien, d.visibilite, d.date_creation,
             u.id AS auteur_id, u.nom AS auteur_nom
      FROM document d
      LEFT JOIN utilisateur u ON u.id = d.auteur_id
      WHERE d.projet_id = $1
    `;
    const docParams = [id];

    if (role === 'INVITE') {
      docQuery += ' AND d.visibilite = true';
    } else if (role !== 'ADMIN') {
      docQuery += ' AND (d.auteur_id = $2 OR d.visibilite = true)';
      docParams.push(userId);
    }
    docQuery += ' ORDER BY d.date_creation DESC';

    const documents = await pool.query(docQuery, docParams);

    res.json({
      ...projet.rows[0],
      participants: participants.rows,
      documents:    documents.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/projet — Créer un projet
// Accès : CHERCHEUR, ADMIN
// ─────────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  const {
    titre, description, domaine, mots_cles,
    annee_publication, date_debut, date_fin, statut
  } = req.body;

  const role       = req.user.role?.toUpperCase();
  const createur_id = req.user.id;

  if (!['CHERCHEUR', 'ADMIN'].includes(role))
    return res.status(403).json({
      error: "Seuls les CHERCHEUR et ADMIN peuvent créer un projet."
    });

  if (!titre?.trim())
    return res.status(400).json({ error: 'Le titre est obligatoire' });

  if (statut && !STATUTS_VALIDES.includes(statut))
    return res.status(400).json({ error: `statut doit être : ${STATUTS_VALIDES.join(', ')}` });

  // ✅ FIX: Validation cohérente des dates (même logique que PUT)
  if (date_debut && date_fin && date_fin < date_debut)
    return res.status(400).json({ error: "La date de fin doit être postérieure à la date de début" });

  try {
    const result = await pool.query(`
      INSERT INTO projet (
        titre, description, domaine, mots_cles,
        annee_publication, date_debut, date_fin,
        statut, createur_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [
      titre.trim(), description || null,
      domaine || null, mots_cles || null,
      annee_publication ? parseInt(annee_publication) : null,
      date_debut || null, date_fin || null,
      statut || 'en_cours',
      createur_id
    ]);

    const projet = result.rows[0];

    // Créateur = 1er participant automatiquement
    await pool.query(
      'INSERT INTO participation (utilisateur_id, projet_id, date_participation) VALUES ($1, $2, CURRENT_DATE)',
      [createur_id, projet.id]
    );

    res.status(201).json(projet);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/projet/:id — Modifier un projet
// Accès : créateur ou ADMIN
// ─────────────────────────────────────────────────────────────
router.put('/:id', auth, estAdminProjet, async (req, res) => {
  const { id } = req.params;
  const {
    titre, description, domaine, mots_cles,
    annee_publication, date_debut, date_fin, statut
  } = req.body;

  if (statut && !STATUTS_VALIDES.includes(statut))
    return res.status(400).json({ error: `statut doit être : ${STATUTS_VALIDES.join(', ')}` });

  if (date_debut && date_fin && date_fin < date_debut)
    return res.status(400).json({ error: "La date de fin doit être postérieure à la date de début" });

  try {
    const exist = await pool.query('SELECT id FROM projet WHERE id = $1', [id]);
    if (exist.rows.length === 0)
      return res.status(404).json({ error: 'Projet non trouvé' });

    const result = await pool.query(`
      UPDATE projet SET
        titre             = COALESCE($1, titre),
        description       = COALESCE($2, description),
        domaine           = COALESCE($3, domaine),
        mots_cles         = COALESCE($4, mots_cles),
        annee_publication = COALESCE($5, annee_publication),
        date_debut        = COALESCE($6, date_debut),
        date_fin          = COALESCE($7, date_fin),
        statut            = COALESCE($8, statut)
      WHERE id = $9
      RETURNING *
    `, [
      titre || null, 
      description !== undefined ? description : null,
      domaine !== undefined ? domaine : null,
      mots_cles !== undefined ? mots_cles : null,
      annee_publication ? parseInt(annee_publication) : null,
      date_debut !== undefined ? date_debut : null,
      date_fin !== undefined ? date_fin : null,
      statut || null,
      id
    ]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/projet/:id/statut
// ─────────────────────────────────────────────────────────────
router.patch('/:id/statut', auth, estAdminProjet, async (req, res) => {
  const { id }     = req.params;
  const { statut } = req.body;

  if (!statut || !STATUTS_VALIDES.includes(statut))
    return res.status(400).json({ error: `statut doit être : ${STATUTS_VALIDES.join(', ')}` });

  try {
    const result = await pool.query(
      'UPDATE projet SET statut = $1 WHERE id = $2 RETURNING *',
      [statut, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Projet non trouvé' });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
// ─────────────────────────────────────────────────────────────
// DELETE /api/projet/:id/documents/:docId
// Retire un document du projet (projet_id → NULL)
// sans le supprimer globalement.
// Accès : créateur du projet ou ADMIN
// ─────────────────────────────────────────────────────────────
router.delete('/:id/documents/:docId', auth, estAdminProjet, async (req, res) => {
  const { id, docId } = req.params;

  try {
    // Vérifier que le document appartient bien à ce projet
    const docCheck = await pool.query(
      'SELECT id, auteur_id, titre FROM document WHERE id = $1 AND projet_id = $2',
      [docId, id]
    );

    if (docCheck.rows.length === 0)
      return res.status(404).json({
        error: 'Document non trouvé dans ce projet'
      });

    // ✅ Détacher le document du projet (projet_id → NULL)
    // Le document reste accessible dans l'espace personnel de son auteur.
    await pool.query(
      `UPDATE document
         SET projet_id = NULL,
             date_modification = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [docId]
    );

    res.json({
      message: `Document "${docCheck.rows[0].titre}" retiré du projet. Il reste disponible dans l'espace personnel de son auteur.`,
      document_id: docCheck.rows[0].id,
      auteur_id:   docCheck.rows[0].auteur_id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
// ─────────────────────────────────────────────────────────────
// DELETE /api/projet/:id/participants/:uid
// ─────────────────────────────────────────────────────────────
router.delete('/:id/participants/:uid', auth, estAdminProjet, async (req, res) => {
  const { id, uid } = req.params;
  const role        = req.user.role?.toUpperCase();

  try {
    const projet = await pool.query(
      'SELECT createur_id FROM projet WHERE id = $1', [id]
    );

    if (!projet.rows.length)
      return res.status(404).json({ error: 'Projet non trouvé' });

    // ✅ FIX: Protection créateur même pour ADMIN (cohérent avec le frontend)
    if (projet.rows[0].createur_id === parseInt(uid) && role !== 'ADMIN')
      return res.status(400).json({ error: 'Le créateur du projet ne peut pas être retiré' });
    await pool.query(
      `UPDATE document
         SET projet_id = NULL,
             date_modification = CURRENT_TIMESTAMP
       WHERE projet_id = $1
         AND auteur_id = $2`,
      [id, uid]
    );

    const result = await pool.query(
      'DELETE FROM participation WHERE projet_id = $1 AND utilisateur_id = $2 RETURNING *',
      [id, uid]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Participant non trouvé dans ce projet' });

    res.json({ message: 'Participant retiré avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
// ─────────────────────────────────────────────────────────────
// DELETE /api/projet/:id
// ─────────────────────────────────────────────────────────────
router.delete('/:id', auth, estAdminProjet, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM projet WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Projet non trouvé' });

    res.json({ message: 'Projet supprimé avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/projet/:id/participants
// Accès : créateur ou ADMIN
// ─────────────────────────────────────────────────────────────
router.post('/:id/participants', auth, estAdminProjet, async (req, res) => {
  const { id }             = req.params;
  const { utilisateur_id } = req.body;

  if (!utilisateur_id)
    return res.status(400).json({ error: 'utilisateur_id requis' });

  try {
    const user = await pool.query(
      'SELECT id, nom, role FROM utilisateur WHERE id = $1 AND actif = true',
      [utilisateur_id]
    );
    if (user.rows.length === 0)
      return res.status(404).json({ error: 'Utilisateur non trouvé ou inactif' });

    const roleUser = user.rows[0].role?.toUpperCase();

    // ✅ FIX: Message d'erreur cohérent avec le frontend (rôle refusé)
    if (!['CHERCHEUR', 'CADRE_TECHNIQUE', 'ADMIN'].includes(roleUser))
      return res.status(403).json({
        error: `Le rôle ${roleUser} ne peut pas participer à un projet.`
      });

    const dejaParticipant = await pool.query(
      'SELECT 1 FROM participation WHERE projet_id = $1 AND utilisateur_id = $2',
      [id, utilisateur_id]
    );
    if (dejaParticipant.rows.length > 0)
      return res.status(409).json({ error: 'Cet utilisateur est déjà participant' });

    await pool.query(
      'INSERT INTO participation (utilisateur_id, projet_id, date_participation) VALUES ($1, $2, CURRENT_DATE)',
      [utilisateur_id, id]
    );

    res.status(201).json({ message: `${user.rows[0].nom} ajouté au projet avec succès` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;