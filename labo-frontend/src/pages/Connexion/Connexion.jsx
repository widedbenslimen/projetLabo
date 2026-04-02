import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";


function Connexion() {
  const [type, setType] = useState("signIn");
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    mot_de_passe: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleOnClick = (text) => {
    if (text !== type) {
      setType(text);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const res = await axios.post("http://localhost:8000/api/connexion", form);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.utilisateur));

      setMessage("Connexion réussie ✅");
      const role = res.data.utilisateur.role;

      const roleRoutes = {
        ADMIN: "/admin",
        CHERCHEUR: "/chercheur",
        INVITE: "/invite",
        CADRE_TECHNIQUE: "/CadreTechnique",
      };

      setTimeout(() => {
        navigate(roleRoutes[role] || "/");
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de la connexion");
    }
  };

  const containerClass = "container " + (type === "signUp" ? "right-panel-active" : "");

  return (
    <div className="auth-page">
      <div className={containerClass} id="container">

        {/* Panneau d'inscription (côté gauche, visible en mode signUp) */}
        <div className="form-container sign-up-container">
          <form>
            <h1>Créer un compte</h1>
            
            
            <p style={{ marginTop: "20px", fontSize: "13px", color: "#555" }}>
              Pas encore inscrit ?
            </p>
            <button
              type="button"
              onClick={() => navigate("/Inscription")}
            >
              S'inscrire
            </button>
          </form>
        </div>

        {/* Panneau de connexion (côté droit par défaut) */}
        <div className="form-container sign-in-container">
          <form onSubmit={handleSubmit}>
            <h1>Connexion</h1>
            
            <input
              type="email"
              name="email"
              placeholder="Adresse Email"
              value={form.email}
              onChange={handleChange}
              required
            />

            <input
              type="password"
              name="mot_de_passe"
              placeholder="Mot de passe"
              value={form.mot_de_passe}
              onChange={handleChange}
              required
            />

            
            <button type="submit">Se connecter</button>

            {message && <p className="success">{message}</p>}
            {error && <p className="error">{error}</p>}
          </form>
        </div>

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

export default Connexion;