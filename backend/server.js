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
        const result = await pool.query('SELECT u.*, r.nombre_rol FROM usuarios u JOIN roles r ON u.role_id = r.id WHERE LOWER(u.email) = LOWER($1) AND u.password_text = $2', [email, password]);
        if (result.rows.length > 0) res.json(result.rows[0]);
        else res.status(401).json({ error: "Credenciales inválidas" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// CATALOGOS
app.get('/api/catalogos', async (req, res) => {
    const unidades = await pool.query('SELECT id, nombre FROM unidades_medicas');
    const transportistas = await pool.query('SELECT id, nombre_completo FROM usuarios WHERE role_id = 2');
    const medicamentos = await pool.query('SELECT id, nombre, requiere_frio FROM medicamentos');
    res.json({ unidades: unidades.rows, transportistas: transportistas.rows, medicamentos: medicamentos.rows });
});

// CREAR ORDEN (Auto-generación de números)
app.post('/api/ordenes', async (req, res) => {
    const { destino_id, transportista_id, creador_id, productos } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const count = await client.query('SELECT COUNT(*) FROM ordenes_envio');
        const numPedido = `PED-2026-${String(parseInt(count.rows[0].count) + 1).padStart(4, '0')}`;
        const trz = `TRZ-2026-${Math.floor(1000 + Math.random() * 9000)}`;

        const order = await client.query(
            'INSERT INTO ordenes_envio (codigo_trz, numero_pedido, unidad_destino_id, transportista_id, creador_id, estado_id) VALUES ($1, $2, $3, $4, $5, 1) RETURNING id',
            [trz, numPedido, destino_id, transportista_id, creador_id]
        );

        for (let p of productos) {
            await client.query('INSERT INTO detalle_pedido (orden_id, medicamento_id, cantidad) VALUES ($1, $2, $3)', [order.rows[0].id, p.id, p.cantidad]);
        }
        await client.query('INSERT INTO auditoria_estados (orden_id, estado_nuevo, usuario_id) VALUES ($1, $2, $3)', [order.rows[0].id, 'PREPARACION', creador_id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({error: e.message}); }
    finally { client.release(); }
});

// LISTA DINAMICA POR ROL
app.get('/api/ordenes/lista/:rol/:id', async (req, res) => {
    const { rol, id } = req.params;
    let filter = '';
    if (rol === 'TRANSPORTISTA') filter = `WHERE o.transportista_id = ${id} AND o.estado_id IN (1, 2)`;
    else if (rol === 'RECEPTOR') filter = `WHERE o.estado_id IN (2, 3)`;
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
    const { orden_id, nuevo_estado_id, usuario_id, nombre_estado, firma } = req.body;
    let extra = '';
    if (nuevo_estado_id === 3) extra = `, fecha_entrega = NOW(), recibido_por = '${firma}'`;
    
    await pool.query(`UPDATE ordenes_envio SET estado_id = $1 ${extra} WHERE id = $2`, [nuevo_estado_id, orden_id]);
    await pool.query('INSERT INTO auditoria_estados (orden_id, estado_nuevo, usuario_id) VALUES ($1, $2, $3)', [orden_id, nombre_estado, usuario_id]);
    res.json({ success: true });
});

app.get('/api/stats', async (req, res) => {
    const r = await pool.query('SELECT estado_id, COUNT(*) FROM ordenes_envio GROUP BY estado_id');
    res.json(r.rows);
});

app.listen(process.env.PORT || 3000, () => console.log("Backend ISSS Activo"));