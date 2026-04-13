require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendValidationEmail(email, nom) {
  await transporter.sendMail({
    from: `"LabLESOR" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "✔ Votre compte a été validé — LabLESOR",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;
                  padding: 30px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2e6b8a;">Bonjour ${nom},</h2>
        <p>Votre inscription a été <strong>validée par l'administrateur</strong>.</p>
        <p>Vous pouvez maintenant <strong>vous connecter</strong> à la plateforme LabLESOR.</p>
        <a href="http://localhost:5173/Connexion"
           style="display:inline-block; margin-top:20px; padding:12px 24px;
                  background-color:#2e6b8a; color:#fff; text-decoration:none;
                  border-radius:5px; font-weight:bold;">
          Se connecter
        </a>
        <hr style="margin-top:30px; border:none; border-top:1px solid #eee;">
        <p style="font-size:12px; color:#888;">
          Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.
        </p>
      </div>
    `,
  });
}

async function sendNewUserNotificationToAdmin(adminEmail, nomUtilisateur, emailUtilisateur) {
  await transporter.sendMail({
    from: `"LabLESOR" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: "🔔 Nouvelle inscription en attente de validation",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;
                  padding: 30px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2e6b8a;">Nouvelle inscription</h2>
        <p>Un nouvel utilisateur attend votre validation :</p>
        <table style="width:100%; border-collapse:collapse; margin-top:15px;">
          <tr>
            <td style="padding:8px; background:#f5f5f5; font-weight:bold;">Nom</td>
            <td style="padding:8px;">${nomUtilisateur}</td>
          </tr>
          <tr>
            <td style="padding:8px; background:#f5f5f5; font-weight:bold;">Email</td>
            <td style="padding:8px;">${emailUtilisateur}</td>
          </tr>
        </table>
        <a href="http://localhost:5173/admin"
           style="display:inline-block; margin-top:20px; padding:12px 24px;
                  background-color:#2e6b8a; color:#fff; text-decoration:none;
                  border-radius:5px; font-weight:bold;">
          Accéder au panneau admin
        </a>
      </div>
    `,
  });
}

module.exports = { sendValidationEmail, sendNewUserNotificationToAdmin };