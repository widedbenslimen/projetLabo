require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
 service: "gmail",
 auth: {
   user: process.env.EMAIL_USER,
   pass: process.env.EMAIL_PASS
 }
});

async function sendValidationEmail(email, nom){

 await transporter.sendMail({
   from: process.env.EMAIL_USER,
   to:email,
   subject: "Compte validé ✔",
   html: `
   <h2>Bonjour ${nom}</h2>
    <p>Votre inscription est validée par l'administrateur.</p>
   <p>Vous pouvez maintenant se connecter à la plateforme.</p>
   `
 });

}

module.exports = {sendValidationEmail};