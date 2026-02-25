// Pool de connexion PostgreSQL
// Remplace le client Supabase pour toutes les requetes BDD
import { Pool } from "pg";

// Singleton : une seule instance du pool partagee entre toutes les routes
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Limiter le nombre de connexions pour un serveur Next.js
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Verifier la connexion au demarrage (log en console serveur)
pool.on("error", (err) => {
  console.error("Erreur inattendue sur le pool PostgreSQL :", err);
});

export { pool };
