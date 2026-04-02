import { useEffect } from "react";
function Invite() {
  const user = JSON.parse(localStorage.getItem("user"));
  useEffect(() => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/";
  }
}, []);

  return (
    <div>
      <h1>Dashboard Invite</h1>
      <p>Bienvenue {user?.nom}</p>
    </div>
  );
}

export default Invite;