const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// RECUERDA: Cambia esto por tu cadena de conexión de Supabase
const pool = new Pool({
  connectionString: "TU_CADENA_DE_CONEXION_DE_SUPABASE" 
});

// 1. LOGIN
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await pool.query('SELECT usuarios.*, roles.nombre_rol FROM usuarios JOIN roles ON usuarios.role_id = roles.id WHERE email = $1 AND password_text = $2', [email, password]);
        if (user.rows.length > 0) res.json(user.rows[0]);
        else res.status(401).json({ error: "Datos incorrectos" });
    } catch (err) { res.status(500).send(err.message); }
});

// 2. LISTAR ORDENES SEGUN ROL
app.get('/api/ordenes/:rol/:id', async (req, res) => {
    const { rol, id } = req.params;
    let query = 'SELECT ordenes_envio.*, estados_orden.nombre_estado FROM ordenes_envio JOIN estados_orden ON ordenes_envio.estado_id = estados_orden.id';
    
    if (rol === 'TRANSPORTISTA') query += ` WHERE transportista_id = ${id} AND estado_id = 1`;
    if (rol === 'RECEPTOR') query += ` WHERE estado_id = 2`; // Ve las que están en ruta
    
    try {
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
});

// 3. ACTUALIZAR ESTADO (RN-01: Secuencia de estados)
app.put('/api/ordenes/estado', async (req, res) => {
    const { orden_id, nuevo_estado_id } = req.body;
    try {
        await pool.query('UPDATE ordenes_envio SET estado_id = $1 WHERE id = $2', [nuevo_estado_id, orden_id]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// 4. CREAR ORDEN (Farmacia)
app.post('/api/ordenes', async (req, res) => {
    const { destino_id, transportista_id, creador_id } = req.body;
    const trz = `TRZ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
        const newOrder = await pool.query(
            'INSERT INTO ordenes_envio (codigo_trz, unidad_destino_id, transportista_id, creador_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [trz, destino_id, transportista_id, creador_id]
        );
        res.json(newOrder.rows[0]);
    } catch (err) { res.status(500).send(err.message); }
});

// 5. ESTADISTICAS (Gerente)
app.get('/api/stats', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) as total FROM ordenes_envio');
        res.json(result.rows[0]);
    } catch (err) { res.status(500).send(err.message); }
});

app.listen(3000, () => console.log("Servidor en puerto 3000"));