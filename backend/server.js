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
    // 1. Verificamos que los datos lleguen al servidor
    const { email, password } = req.body;
    console.log("Datos recibidos en el servidor:", email, password);

    if (!email || !password) {
        return res.status(400).json({ error: "Faltan datos de usuario o clave" });
    }

    try {
        // 2. Intentamos la consulta
        // IMPORTANTE: Asegúrate de que los nombres de las tablas coincidan con Supabase
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
            res.status(401).json({ error: "Correo o contraseña no válidos" });
        }
    } catch (err) {
        // 3. Si falla, el servidor nos dirá EXACTAMENTE por qué en los Logs de Render
        console.error("DETALLE DEL ERROR EN DB:", err.message);
        res.status(500).json({ error: "Error en la base de datos: " + err.message });
    }
});

// ... (El resto de tus rutas: ordenes, stats, etc, se mantienen igual)
// Asegúrate de tenerlas abajo o cópialas del código anterior

app.listen(process.env.PORT || 3000, () => console.log("Servidor activo"));
  