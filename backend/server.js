const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// LOGIN
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const query = `SELECT u.*, r.nombre_rol FROM usuarios u JOIN roles r ON u.role_id = r.id WHERE LOWER(u.email) = LOWER($1) AND u.password_text = $2`;
        const result = await pool.query(query, [email, password]);
        if (result.rows.length > 0) res.json(result.rows[0]);
        else res.status(401).json({ error: "Credenciales incorrectas" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// CATALOGOS (Para no usar IDs en el frontend)
app.get('/api/catalogos', async (req, res) => {
    try {
        const unidades = await pool.query('SELECT id, nombre FROM unidades_medicas');
        const transportistas = await pool.query('SELECT id, nombre_completo FROM usuarios WHERE role_id = 2');
        res.json({ unidades: unidades.rows, transportistas: transportistas.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// CREAR ORDEN (Farmacia)
app.post('/api/ordenes', async (req, res) => {
    const { numero_pedido, destino_id, transportista_id, creador_id } = req.body;
    const trz = `TRZ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
        const result = await pool.query(
            'INSERT INTO ordenes_envio (codigo_trz, numero_pedido, unidad_destino_id, transportista_id, creador_id, estado_id) VALUES ($1, $2, $3, $4, $5, 1) RETURNING *',
            [trz, numero_pedido, destino_id, transportista_id, creador_id]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// LISTAR ORDENES DETALLADAS
app.get('/api/ordenes/lista/:rol/:id', async (req, res) => {
    const { rol, id } = req.params;
    let query = `
        SELECT o.*, e.nombre_estado, u.nombre as unidad_nombre, t.nombre_completo as transportista_nombre 
        FROM ordenes_envio o 
        JOIN estados_orden e ON o.estado_id = e.id 
        JOIN unidades_medicas u ON o.unidad_destino_id = u.id
        JOIN usuarios t ON o.transportista_id = t.id`;
    
    if (rol === 'TRANSPORTISTA') query += ` WHERE o.transportista_id = ${id} AND o.estado_id = 1`;
    if (rol === 'RECEPTOR') query += ` WHERE o.estado_id = 2`;
    
    const result = await pool.query(query);
    res.json(result.rows);
});

// ACTUALIZAR ESTADO
app.put('/api/ordenes/estado', async (req, res) => {
    const { orden_id, nuevo_estado_id } = req.body;
    await pool.query('UPDATE ordenes_envio SET estado_id = $1 WHERE id = $2', [nuevo_estado_id, orden_id]);
    res.json({ success: true });
});

// STATS (Gerente)
app.get('/api/stats', async (req, res) => {
    const total = await pool.query('SELECT COUNT(*) FROM ordenes_envio');
    const ruta = await pool.query('SELECT COUNT(*) FROM ordenes_envio WHERE estado_id = 2');
    res.json({ total: total.rows[0].count, en_ruta: ruta.rows[0].count });
});

app.listen(process.env.PORT || 3000, () => console.log("Servidor ISSS Listo"));