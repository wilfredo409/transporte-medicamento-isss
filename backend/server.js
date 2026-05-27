const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Configuración de conexión ultra-compatible
const pool = new Pool({
    
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Esto permite la conexión segura con Supabase/Render
  }
});

// Probar conexión al iniciar
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error("❌ ERROR CRÍTICO DE CONEXIÓN A DB:", err);
  else console.log("✅ CONECTADO A SUPABASE CORRECTAMENTE");
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    // Log para ver qué llega (Esto lo verás en la pestaña LOGS de Render)
    console.log(`Intentando login para: ${email}`);

    try {
        // Usamos LOWER() para que no importe si escriben con mayúsculas
        const query = `
            SELECT usuarios.*, roles.nombre_rol 
            FROM usuarios 
            JOIN roles ON usuarios.role_id = roles.id 
            WHERE LOWER(email) = LOWER($1) AND password_text = $2
        `;
        const user = await pool.query(query, [email, password]);

        if (user.rows.length > 0) {
            console.log("✅ Usuario encontrado:", user.rows[0].nombre_completo);
            res.json(user.rows[0]);
        } else {
            console.log("⚠️ Credenciales no coinciden en la base de datos");
            res.status(401).json({ error: "El correo o la contraseña no existen en el sistema" });
        }
    } catch (err) {
        console.error("❌ Error en la consulta SQL:", err.message);
        res.status(500).json({ error: "Error interno del servidor: " + err.message });
    }
});

// ... (El resto de tus rutas: ordenes, stats, etc, se mantienen igual)
// Asegúrate de tenerlas abajo o cópialas del código anterior

app.listen(process.env.PORT || 3000, () => console.log("Servidor activo"));
  