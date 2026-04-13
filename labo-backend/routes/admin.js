// routes/admin.js
// À ajouter dans server.js : const adminRoutes = require('./routes/admin'); app.use('/api/admin', adminRoutes);
require("dotenv").config();

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const auth = require("../middleware/auth");

const { sendValidationEmail } = require("../config/email");

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'laboratoire_bd',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
});


function requireAdmin(req,res,next){
 if(req.user?.role !== "ADMIN"){
   return res.status(403).json({
     error:"Accès administrateur refusé"
   });
 }
 next();
}
// ─── STATS ────────────────────────────────────────────────────────────────────
// GET /api/admin/stats
router.get('/stats', auth, requireAdmin, async (req, res) => {
  try {
    const [u, d, p, pub, recent] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM utilisateur WHERE actif = TRUE"),
      pool.query("SELECT COUNT(*) FROM document"),
      pool.query("SELECT COUNT(*) FROM projet"),
      pool.query("SELECT COUNT(*) FROM publication"),
      pool.query("SELECT id, nom, email, role, date_inscription FROM utilisateur ORDER BY date_inscription DESC LIMIT 5"),
    ]);
    res.json({
      utilisateurs_actifs: parseInt(u.rows[0].count),
      documents: parseInt(d.rows[0].count),
      projets: parseInt(p.rows[0].count),
      publications: parseInt(pub.rows[0].count),
      recent_users: recent.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── UTILISATEURS ─────────────────────────────────────────────────────────────
// GET /api/admin/utilisateurs
router.get('/utilisateurs', auth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nom, email, num_telephone, role, actif, email_confirme, compte_verrouille, tentatives_login, date_inscription FROM utilisateur ORDER BY date_inscription DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/utilisateurs
router.post('/utilisateurs', auth, requireAdmin, async (req,res)=>{

 try{

 const {nom,email,mot_de_passe,num_telephone,role,actif}=req.body;

 if(!nom || !email || !mot_de_passe || !role){
   return res.status(400).json({
     error:"Champs obligatoires manquants"
   });
 }

 if(!/^\S+@\S+\.\S+$/.test(email)){
   return res.status(400).json({error:"Email invalide"});
 }

 const roles=["ADMIN","CHERCHEUR","INVITE","CADRE_TECHNIQUE"];

 if(!roles.includes(role)){
   return res.status(400).json({
    error:"Role invalide"
    });
 }

 if(num_telephone && !/^[0-9]{8}$/.test(num_telephone)){
   return res.status(400).json({
     error:"Téléphone doit contenir 8 chiffres"
   });
 }

 const hashed = await bcrypt.hash(mot_de_passe,10);

 const result = await pool.query(
 `INSERT INTO utilisateur
 (nom,email,mot_de_passe,num_telephone,role,actif,email_confirme)
 VALUES($1,$2,$3,$4,$5,$6,TRUE)
 RETURNING id,nom,email,role,actif,date_inscription`,

 [nom,email,hashed,num_telephone||null,role,actif??true]
 );

 res.status(201).json(result.rows[0]);

 }catch(err){

 if(err.code==="23505"){
   return res.status(409).json({
     error:"Email déjà utilisé"
   });
 }

 console.error(err);
 res.status(500).json({error:"Erreur serveur"});
 }

});

// PUT /api/admin/utilisateurs/:id
const allowedRoles = [
  "ADMIN",
  "CHERCHEUR",
  "INVITE",
  "CADRE_TECHNIQUE"
];
router.put('/utilisateurs/:id', auth, requireAdmin, async (req,res)=>{

 try{

 const id=req.params.id;
 const {nom,email,mot_de_passe,num_telephone,role,actif,compte_verrouille}=req.body;

 if(email && !/^\S+@\S+\.\S+$/.test(email)){
   return res.status(400).json({error:"Email invalide"});
 }

  if(role && !allowedRoles.includes(role)){
   return res.status(400).json({message:"Role invalide"});
 }

 if(num_telephone && !/^[0-9]{8}$/.test(num_telephone)){
   return res.status(400).json({
     error:"Téléphone doit contenir 8 chiffres"
   });
 }

 let query,params;

 if(mot_de_passe){
   const hashed=await bcrypt.hash(mot_de_passe,10);

   query=`
   UPDATE utilisateur SET
   nom=COALESCE($1,nom),
   email=COALESCE($2,email),
   mot_de_passe=$3,
   num_telephone=COALESCE($4,num_telephone),
   role=COALESCE($5,role),
   actif=COALESCE($6,actif),
   compte_verrouille=COALESCE($7,compte_verrouille),
   date_modification=NOW()
   WHERE id=$8
   RETURNING *
   `;

   params=[nom,email,hashed,num_telephone,role,actif,compte_verrouille??false,id];

 }else{

   query=`
   UPDATE utilisateur SET
   nom=COALESCE($1,nom),
   email=COALESCE($2,email),
   num_telephone=COALESCE($3,num_telephone),
   role=COALESCE($4,role),
   actif=COALESCE($5,actif),
   compte_verrouille=COALESCE($6,compte_verrouille),
   date_modification=NOW()
   WHERE id=$7
   RETURNING *
   `;


   params=[nom,email,num_telephone,role,actif,compte_verrouille??false,id];
 }

 const result=await pool.query(query,params);

 if(result.rows.length===0){
   return res.status(404).json({error:"Utilisateur non trouvé"});
 }

 res.json(result.rows[0]);

 }catch(err){
 console.error(err);
 res.status(500).json({error:"Erreur serveur"});
 }

});
// DELETE /api/admin/utilisateurs/:id
router.delete('/utilisateurs/:id', auth, requireAdmin, async (req,res)=>{

 try{

 await pool.query(
   "DELETE FROM utilisateur WHERE id=$1",
   [req.params.id]
 );

 res.json({message:"Utilisateur supprimé"});

 }catch(err){
 console.error(err);
 res.status(500).json({error:"Erreur serveur"});
 }

});

// Route Validation Admin

router.put("/utilisateurs/:id/valider", auth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    const user = await pool.query(
      "SELECT nom, email FROM utilisateur WHERE id = $1",
      [id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // ✅ Activer le compte
    await pool.query(
      "UPDATE utilisateur SET actif = TRUE, email_confirme = TRUE WHERE id = $1",
      [id]
    );

    // ✅ Envoyer l'email de confirmation à l'utilisateur
    await sendValidationEmail(user.rows[0].email, user.rows[0].nom);

    res.json({ message: "Compte validé et email envoyé" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


module.exports = router;