import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";


function SignUpForm({ onSubmit, form, handleChange, phoneError, emailError }) {
  return (
    <div className="form-container sign-up-container">
      <form onSubmit={onSubmit}>
        <h1>Créer un compte</h1>
        

        <input
          type="text"
          name="nom"
          placeholder="Nom complet"
          value={form.nom}
          onChange={handleChange}
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Adresse Email"
          value={form.email}
          onChange={handleChange}
          required
        />
        {emailError && <p className="error">{emailError}</p>}

        <input
          type="password"
          name="mot_de_passe"
          placeholder="Mot de passe"
          value={form.mot_de_passe}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="num_telephone"
          placeholder="Numéro de téléphone (8 chiffres)"
          value={form.num_telephone}
          onChange={handleChange}
        />
        {phoneError && <p className="error">{phoneError}</p>}

        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          required
        >
          <option value="" disabled>
            -- Sélectionner un rôle --
          </option>
          <option value="CHERCHEUR">Chercheur</option>
          <option value="INVITE">Invité</option>
          <option value="ADMIN">Admin</option>
          <option value="CADRE_TECHNIQUE">Cadre Technique</option>
        </select>

        <button type="submit">S'inscrire</button>
      </form>
    </div>
  );
}

function Inscription() {
  const [type, setType] = useState("signIn");
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nom: "",
    email: "",
    mot_de_passe: "",
    num_telephone: "",
    role: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");

  const handleOnClick = (text) => {
    if (text !== type) {
      setType(text);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "num_telephone") {
      if (!/^\d*$/.test(value)) {
        setPhoneError("Veuillez entrer uniquement des chiffres");
        return;
      }
      if (value.length > 8) {
        setPhoneError("Le numéro ne doit pas dépasser 8 chiffres");
        return;
      }
      setPhoneError("");
    }

    if (name === "email") {
      if (value && !/^\S+@\S+\.\S+$/.test(value)) {
        setEmailError("Email sous format : nom@domaine.com");
      } else {
        setEmailError("");
      }
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) {
      setEmailError("Email sous format : nom@domaine.com");
      return;
    }

    if (!form.num_telephone || !/^[0-9]{8}$/.test(form.num_telephone)) {
      setPhoneError("Le numéro doit contenir exactement 8 chiffres");
      return;
    }

    try {
      await axios.post("http://localhost:8000/api/inscription", form);
      setMessage("Inscription réussie ✅");
      setTimeout(() => {
        setMessage("");
        navigate("/Connexion");
      }, 2000);

      setForm({ nom: "", email: "", mot_de_passe: "", num_telephone: "", role: "" });
      setEmailError("");
      setPhoneError("");
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de l'inscription");
    }
  };

  const containerClass = "container " + (type === "signUp" ? "right-panel-active" : "");

  return (
    <div className="auth-page">
      <div className={containerClass} id="container">
        <SignUpForm
          onSubmit={handleSubmit}
          form={form}
          handleChange={handleChange}
          phoneError={phoneError}
          emailError={emailError}
        />

        {/* Panneau de connexion (côté gauche) */}
        <div className="form-container sign-in-container">
          <form>
            <h1>Connexion</h1>
            
            <p style={{ marginTop: "20px", fontSize: "13px", color: "#555" }}>
              Vous avez déjà un compte ?
            </p>
            <button
              type="button"
              onClick={() => navigate("/Connexion")}
            >
              Se connecter
            </button>
          </form>
        </div>

        {message && (
          <p className="success" style={{ position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", zIndex: 200 }}>
            {message}
          </p>
        )}
        {error && (
          <p className="error" style={{ position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", zIndex: 200 }}>
            {error}
          </p>
        )}

        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">
              <h1>Bon retour !</h1>
              <p>Pour rester connecté, veuillez vous connecter avec vos informations personnelles</p>
              <button
                className="ghost"
                onClick={() => handleOnClick("signIn")}
              >
                Se connecter
              </button>
            </div>
            <div className="overlay-panel overlay-right">
              <h1>Bonjour !</h1>
              <p>Entrez vos informations personnelles et commencez votre aventure avec nous</p>
              <button
                className="ghost"
                onClick={() => handleOnClick("signUp")}
              >
                S'inscrire
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Inscription;