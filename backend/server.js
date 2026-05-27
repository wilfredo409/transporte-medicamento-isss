const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Para servir los archivos HTML

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// LOGIN REDIRECCIONADO
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const result = await pool.query('SELECT u.*, r.nombre_rol FROM usuarios u JOIN roles r ON u.role_id = r.id WHERE LOWER(u.email) = LOWER($1) AND u.password_text = $2', [email, password]);
    if (result.rows.length > 0) {
        const user = result.rows[0];
        let redirect = '';
        if(user.role_id === 1) redirect = 'dash-farmacia.html';
        if(user.role_id === 2) redirect = 'dash-transporte.html';
        if(user.role_id === 3) redirect = 'dash-receptor.html';
        if(user.role_id === 4 || user.role_id === 5) redirect = 'dash-gerente.html';
        res.json({ user, redirect });
    } else {
        res.status(401).json({ error: "No autorizado" });
    }
});

// CATALOGOS
app.get('/api/catalogos', async (req, res) => {
    const unidades = await pool.query('SELECT id, nombre FROM unidades_medicas');
    const trans = await pool.query('SELECT id, nombre_completo FROM usuarios WHERE role_id = 2');
    const meds = await pool.query('SELECT id, nombre, requiere_frio FROM medicamentos');
    res.json({ unidades: unidades.rows, transportistas: trans.rows, medicamentos: meds.rows });
});

// CREAR ORDEN
app.post('/api/ordenes', async (req, res) => {
    const { destino_id, transportista_id, creador_id, productos } = req.body;
    const count = await pool.query('SELECT COUNT(*) FROM ordenes_envio');
    const numPed = `PED-2026-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;
    const trz = `TRZ-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const order = await pool.query(
        'INSERT INTO ordenes_envio (codigo_trz, numero_pedido, unidad_destino_id, transportista_id, creador_id, estado_id) VALUES ($1, $2, $3, $4, $5, 1) RETURNING id',
        [trz, numPed, destino_id, transportista_id, creador_id]
    );

    for (let p of productos) {
        await pool.query('INSERT INTO detalle_pedido (orden_id, medicamento_id, cantidad) VALUES ($1, $2, $3)', [order.rows[0].id, p.id, p.cantidad]);
    }
    res.json({ success: true });
});

// LISTA POR ROL (FILTRADA)
app.get('/api/ordenes/lista/:rol/:id', async (req, res) => {
    const { rol, id } = req.params;
    let filter = '';
    if (rol === 'TRANSPORTISTA') filter = `WHERE o.transportista_id = ${id} AND o.estado_id IN (1,2)`;
    else if (rol === 'RECEPTOR') filter = `WHERE o.estado_id IN (2,3)`;
    else if (rol === 'FARMACIA') filter = `WHERE o.creador_id = ${id}`;

    const query = `
        SELECT o.*, e.nombre_estado, u.nombre as destino_nombre, t.nombre_completo as transportista_nombre,
        (SELECT json_agg(json_build_object('nombre', m.nombre, 'cantidad', dp.cantidad, 'frio', m.requiere_frio)) 
         FROM detalle_pedido dp JOIN medicamentos m ON dp.medicamento_id = m.id WHERE dp.orden_id = o.id) as productos
        FROM ordenes_envio o
        JOIN estados_orden e ON o.estado_id = e.id
        JOIN unidades_medicas u ON o.unidad_destino_id = u.id
        JOIN usuarios t ON o.transportista_id = t.id
        ${filter} ORDER BY o.fecha_creacion DESC`;
    
    const result = await pool.query(query);
    res.json(result.rows);
});

// ACTUALIZAR ESTADO
app.put('/api/ordenes/estado', async (req, res) => {
    const { orden_id, nuevo_estado_id, firma } = req.body;
    let extra = '';
    if (nuevo_estado_id === 3) extra = `, fecha_entrega = NOW(), recibido_por = '${firma}'`;
    await pool.query(`UPDATE ordenes_envio SET estado_id = $1 ${extra} WHERE id = $2`, [nuevo_estado_id, orden_id]);
    res.json({ success: true });
});

app.listen(process.env.PORT || 3000, () => console.log("Servidor ISSS Listo"));