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
    const result = await pool.query('SELECT u.*, r.nombre_rol FROM usuarios u JOIN roles r ON u.role_id = r.id WHERE LOWER(u.email) = LOWER($1) AND u.password_text = $2', [email, password]);
    if (result.rows.length > 0) res.json(result.rows[0]);
    else res.status(401).json({ error: "No autorizado" });
});

// CREAR PEDIDO (Generación automática de Número de Pedido)
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
        res.json({ success: true, codigo: trz });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).send(e.message); }
    finally { client.release(); }
});

// ACTUALIZAR ESTADO + AUDITORIA
app.put('/api/ordenes/estado', async (req, res) => {
    const { orden_id, nuevo_estado_id, usuario_id, nombre_estado, recibido_por } = req.body;
    const fecha = nuevo_estado_id === 3 ? ', fecha_entrega = NOW(), recibido_por = $3' : '';
    const params = [nuevo_estado_id, orden_id];
    if(recibido_por) params.push(recibido_por);

    await pool.query(`UPDATE ordenes_envio SET estado_id = $1 ${fecha} WHERE id = $2`, params);
    await pool.query('INSERT INTO auditoria_estados (orden_id, estado_nuevo, usuario_id) VALUES ($1, $2, $3)', [orden_id, nombre_estado, usuario_id]);
    res.json({ success: true });
});

// LISTADO COMPLETO CON DETALLE DE MEDICAMENTOS Y CADENA DE FRÍO
app.get('/api/ordenes/reporte/:rol/:id', async (req, res) => {
    const { rol, id } = req.params;
    let filter = '';
    if(rol === 'TRANSPORTISTA') filter = `WHERE transportista_id = ${id} AND estado_id IN (1,2)`;
    if(rol === 'RECEPTOR') filter = `WHERE o.estado_id IN (2,3)`;
    if(rol === 'GERENTE' || rol === 'ADMIN') filter = ``;

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

// CATALOGOS PARA ADMIN
app.get('/api/admin/usuarios', async (req, res) => {
    const resu = await pool.query('SELECT u.*, r.nombre_rol FROM usuarios u JOIN roles r ON u.role_id = r.id');
    res.json(resu.rows);
});

app.listen(3000, () => console.log("Sistema ISSS V4 Online"));