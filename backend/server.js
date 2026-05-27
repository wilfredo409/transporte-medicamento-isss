const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// Configuración de CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// CONFIGURACIÓN DE CONEXIÓN DEFINITIVA
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // Esta es la línea mágica que elimina el error de "self-signed certificate"
    rejectUnauthorized: false 
  }
});

// Probar conexión al iniciar (ver esto en logs de Render)
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error("❌ ERROR EN DB:", err.message);
  } else {
    console.log("✅ CONEXIÓN SEGURA ESTABLECIDA CON SUPABASE");
  }
});

// RUTA DE LOGIN
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const query = `
            SELECT u.id, u.nombre_completo, u.email, r.nombre_rol 
            FROM usuarios u
            INNER JOIN roles r ON u.role_id = r.id 
            WHERE LOWER(u.email) = LOWER($1) AND u.password_text = $2
        `;
        const result = await pool.query(query, [email, password]);

        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(401).json({ error: "Correo o clave incorrectos" });
        }
    } catch (err) {
        console.error("Error en login:", err.message);
        res.status(500).json({ error: "Error en base de datos: " + err.message });
    }
});

// ... Copia aquí abajo el resto de tus rutas (ordenes, stats) que ya tenías ...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});