const { sql, getpool } = require("../config/db");

const ROLE_CANDIDATES = ["rol", "tipousuario", "perfil", "cargo", "tipo"];
const USER_ID_CANDIDATES = ["id", "idusuario"];

async function getTransaccionesColumns(pool) {
    const colsResult = await pool.request().query(`
        SELECT LOWER(COLUMN_NAME) AS nombre
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'transacciones';
    `);

    return new Set((colsResult.recordset || []).map((x) => x.nombre));
}

async function getProcedureParams(pool, procName) {
    const result = await pool.request().input("procName", sql.VarChar(128), procName).query(`
        SELECT LOWER(REPLACE(p.name, '@', '')) AS name
        FROM sys.parameters p
        INNER JOIN sys.objects o ON o.object_id = p.object_id
        WHERE o.type = 'P'
          AND o.name = @procName;
    `);

    return new Set((result.recordset || []).map((r) => r.name));
}

async function resolveUsuarioCajaActiva(pool, idUsuarioSolicitante, fechaReferencia = null) {
    const fechaRef = String(fechaReferencia || "").trim().slice(0, 10);
    const cajaPropia = await pool
        .request()
        .input("idUsuario", sql.Int, idUsuarioSolicitante)
        .input("fechaRef", sql.Date, fechaRef || null)
        .query(`
            SELECT TOP 1 c.idUsuario
            FROM caja c
            WHERE c.idUsuario = @idUsuario
              AND CONVERT(date, c.fecha) = COALESCE(@fechaRef, CONVERT(date, GETDATE()))
              AND LOWER(LTRIM(RTRIM(ISNULL(c.estado, '')))) IN ('abierta', 'abierto', 'open')
            ORDER BY c.id DESC;
        `);

    if (cajaPropia.recordset?.[0]?.idUsuario) {
        return Number(cajaPropia.recordset[0].idUsuario);
    }

    const colsResult = await pool.request().query(`
        SELECT LOWER(COLUMN_NAME) AS nombre
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'usuarios';
    `);

    const available = new Set((colsResult.recordset || []).map((x) => x.nombre));
    const idCol = USER_ID_CANDIDATES.find((c) => available.has(c));
    const roleCols = ROLE_CANDIDATES.filter((c) => available.has(c));

    if (idCol && roleCols.length > 0) {
                const adminCaja = await pool.request().input("fechaRef", sql.Date, fechaRef || null).query(`
            SELECT TOP 1 c.idUsuario
            FROM caja c
            INNER JOIN usuarios u ON u.${idCol} = c.idUsuario
                        WHERE CONVERT(date, c.fecha) = COALESCE(@fechaRef, CONVERT(date, GETDATE()))
              AND LOWER(LTRIM(RTRIM(ISNULL(c.estado, '')))) IN ('abierta', 'abierto', 'open')
              AND LOWER(COALESCE(${roleCols.map((c) => `CAST(u.${c} AS VARCHAR(100))`).join(", ")}, '')) LIKE '%admin%'
            ORDER BY c.id DESC;
        `);

        if (adminCaja.recordset?.[0]?.idUsuario) {
            return Number(adminCaja.recordset[0].idUsuario);
        }
    }

    const cualquierCaja = await pool.request().input("fechaRef", sql.Date, fechaRef || null).query(`
        SELECT TOP 1 c.idUsuario
        FROM caja c
        WHERE CONVERT(date, c.fecha) = COALESCE(@fechaRef, CONVERT(date, GETDATE()))
          AND LOWER(LTRIM(RTRIM(ISNULL(c.estado, '')))) IN ('abierta', 'abierto', 'open')
        ORDER BY c.id DESC;
    `);

    if (cualquierCaja.recordset?.[0]?.idUsuario) {
        return Number(cualquierCaja.recordset[0].idUsuario);
    }

    return null;
}

function hondurasFechaHoy() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tegucigalpa' }).format(new Date());
}

/**
 * Retorna { idUsuarioCaja, idCaja, fechaApertura, fecha } de la caja activa del usuario.
 * Reemplaza a resolveUsuarioCajaActiva cuando se necesita el id y fecha de apertura.
 */
async function getCajaActivaInfo(pool, idUsuarioSolicitante, fechaReferencia = null) {
    const fechaRef = String(fechaReferencia || "").trim().slice(0, 10);

    // Buscar primero la caja propia del usuario
    const cajaPropia = await pool
        .request()
        .input("idUsuario", sql.Int, idUsuarioSolicitante)
        .input("fechaRef", sql.Date, fechaRef || null)
        .query(`
            SELECT TOP 1 c.id AS idCaja, c.idUsuario, c.fechaApertura
            FROM caja c
            WHERE c.idUsuario = @idUsuario
              AND CONVERT(date, c.fecha) = COALESCE(@fechaRef, CONVERT(date, GETDATE()))
              AND LOWER(LTRIM(RTRIM(ISNULL(c.estado, '')))) IN ('abierta', 'abierto', 'open')
            ORDER BY c.id DESC;
        `);

    if (cajaPropia.recordset?.[0]?.idUsuario) {
        const row = cajaPropia.recordset[0];
        return {
            idUsuarioCaja: Number(row.idUsuario),
            idCaja: Number(row.idCaja),
            fechaApertura: row.fechaApertura ? new Date(row.fechaApertura) : null,
            fecha: fechaRef || hondurasFechaHoy(),
        };
    }

    // Fallback: buscar cualquier caja abierta del dia
    const cualquierCaja = await pool.request().input("fechaRef", sql.Date, fechaRef || null).query(`
        SELECT TOP 1 c.id AS idCaja, c.idUsuario, c.fechaApertura
        FROM caja c
        WHERE CONVERT(date, c.fecha) = COALESCE(@fechaRef, CONVERT(date, GETDATE()))
          AND LOWER(LTRIM(RTRIM(ISNULL(c.estado, '')))) IN ('abierta', 'abierto', 'open')
        ORDER BY c.id DESC;
    `);

    if (cualquierCaja.recordset?.[0]?.idUsuario) {
        const row = cualquierCaja.recordset[0];
        return {
            idUsuarioCaja: Number(row.idUsuario),
            idCaja: Number(row.idCaja),
            fechaApertura: row.fechaApertura ? new Date(row.fechaApertura) : null,
            fecha: fechaRef || hondurasFechaHoy(),
        };
    }

    return null;
}

function fechaLocalSql(fecha = new Date()) {
    const tz = 'America/Tegucigalpa';
    const p = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(fecha);
    const g = (t) => p.find(x => x.type === t)?.value ?? '00';
    const hr = String(Number(g('hour')) % 24).padStart(2, '0');
    const ms = String(fecha.getMilliseconds()).padStart(3, '0');
    return `${g('year')}-${g('month')}-${g('day')} ${hr}:${g('minute')}:${g('second')}.${ms}`;
}

function toBinaryBuffer(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    if (Buffer.isBuffer(value)) {
        return value;
    }

    if (Array.isArray(value)) {
        return Buffer.from(value);
    }

    if (typeof value === "object" && Array.isArray(value.data)) {
        return Buffer.from(value.data);
    }

    if (typeof value === "string") {
        const base64 = value.includes(",") ? value.split(",")[1] : value;
        return Buffer.from(base64, "base64");
    }

    return null;
}

function toDataUrl(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    if (typeof value === "string") {
        return value;
    }

    let bytes = null;
    if (Buffer.isBuffer(value)) {
        bytes = Array.from(value.values());
    } else if (Array.isArray(value)) {
        bytes = value;
    } else if (typeof value === "object" && Array.isArray(value.data)) {
        bytes = value.data;
    }

    if (!bytes || bytes.length === 0) {
        return null;
    }

    return `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`;
}

function normalizarAnulado(valor) {
    if (valor === null || valor === undefined || valor === "") {
        return null;
    }

    const v = String(valor).trim().toLowerCase();
    if (v === "anulado" || v === "anulada") {
        return "anulada";
    }
    if (v === "completada" || v === "completado") {
        return "completada";
    }
    return "__INVALID__";
}

exports.ListarTransacciones = async (req, res) => {
    try {
        const idBanco = req.query?.idBanco ? Number(req.query.idBanco) : null;
        const idTipo = req.query?.idTipo ? Number(req.query.idTipo) : null;

        const pool = await getpool();
        const cols = await getTransaccionesColumns(pool);

        // Detect usuarios columns for JOIN
        const uColsResult = await pool.request().query(`
            SELECT LOWER(COLUMN_NAME) AS nombre FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuarios';
        `);
        const uCols = new Set((uColsResult.recordset || []).map((x) => x.nombre));
        const uIdCol = ["id", "idusuario"].find((c) => uCols.has(c));
        const uNameCol = ["nombre", "usuario", "username"].find((c) => uCols.has(c));
        const joinUsuarios = uIdCol && uNameCol
            ? `LEFT JOIN usuarios u ON u.${uIdCol} = t.idUsuario`
            : "";
        const selectNombreUsuario = uNameCol
            ? `CAST(u.${uNameCol} AS VARCHAR(150)) AS nombreUsuario`
            : `NULL AS nombreUsuario`;

        const request = pool.request();
        let where = "WHERE 1 = 1";

        if (idBanco && !Number.isNaN(idBanco)) {
            request.input("idBanco", sql.Int, idBanco);
            where += " AND t.idBanco = @idBanco";
        }

        if (idTipo && !Number.isNaN(idTipo)) {
            request.input("idTipo", sql.Int, idTipo);
            where += " AND t.idTipoTrans = @idTipo";
        }

        const selectPhoto = cols.has("foto")
            ? "t.foto AS fotoComprobante"
            : "NULL AS fotoComprobante";

        const result = await request.query(`
            SELECT
                t.id,
                t.idBanco,
                t.idTipoTrans,
                t.idServicio,
                t.idUsuario,
                b.nombre AS banco,
                tt.nombre AS tipo,
                s.nombre AS servicio,
                t.numeroReferencia,
                t.nombreCliente,
                t.monto,
                t.comision,
                t.anulado,
                t.observacion,
                CONVERT(VARCHAR(23), t.fechaTransaccion, 121) AS fechaTransaccion,
                t.longitud,
                t.latitud,
                ${selectPhoto},
                ${selectNombreUsuario}
            FROM transacciones t
            INNER JOIN bancos b ON t.idBanco = b.id
            INNER JOIN tipo_transaccion tt ON t.idTipoTrans = tt.id
            LEFT JOIN servicios s ON t.idServicio = s.id
            ${joinUsuarios}
            ${where}
            ORDER BY t.fechaTransaccion DESC;
        `);
        res.json(result.recordset || []);
    } catch (error) {
        res.status(500).json({
            message: "Error listando transacciones",
            error: error.message,
        });
    }
};

exports.ObtenerTransaccionPorId = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id) || id <= 0) {
            return res.status(400).json({ message: "ID de transaccion invalido." });
        }

        const pool = await getpool();
        const cols = await getTransaccionesColumns(pool);
        const result = await pool
            .request()
            .input("id", sql.Int, id)
            .query(`
                SELECT TOP 1
                    t.id,
                    t.idBanco,
                    t.idTipoTrans,
                    t.idServicio,
                    t.idUsuario,
                    b.nombre AS banco,
                    tt.nombre AS tipo,
                    s.nombre AS servicio,
                    t.numeroReferencia,
                    t.nombreCliente,
                    t.monto,
                    t.comision,
                    t.anulado,
                    t.observacion,
                    CONVERT(VARCHAR(23), t.fechaTransaccion, 121) AS fechaTransaccion,
                    t.longitud,
                    t.latitud,
                    ${cols.has("foto") ? "t.foto AS fotoComprobante" : "NULL AS fotoComprobante"}
                FROM transacciones t
                INNER JOIN bancos b ON t.idBanco = b.id
                INNER JOIN tipo_transaccion tt ON t.idTipoTrans = tt.id
                LEFT JOIN servicios s ON t.idServicio = s.id
                WHERE t.id = @id;
            `);

        const row = result.recordset?.[0] || null;
        if (!row) {
            return res.status(404).json({ message: "Transaccion no encontrada." });
        }

        return res.json(row);
    } catch (error) {
        return res.status(500).json({
            message: "Error obteniendo transaccion",
            error: error.message,
        });
    }
};

exports.InsertarTransaccion = async (req, res) => {
    try {
        const {
            idBanco,
            idTipoTrans,
            idServicio,
            idUsuario,
            anulado,
            numeroReferencia,
            nombreCliente,
            monto,
            comision,
            observacion,
            longitud,
            latitud,
            fechaTransaccion,
            fotoComprobante,
            cuentaDestino,
            idBancoOrigen,
        } = req.body;

        const banco = Number(idBanco);
        const tipo = Number(idTipoTrans);
        const usuario = Number(idUsuario);
        const servicio = idServicio === null || idServicio === undefined || idServicio === ""
            ? null
            : Number(idServicio);
        const montoNum = Number(monto);
        const comisionNum = comision === null || comision === undefined || comision === ""
            ? 0
            : Number(comision);
        const longitudNum = longitud === null || longitud === undefined || longitud === ""
            ? null
            : Number(longitud);
        const latitudNum = latitud === null || latitud === undefined || latitud === ""
            ? null
            : Number(latitud);
        const fechaTransaccionTexto = fechaTransaccion
            ? String(fechaTransaccion).trim()
            : fechaLocalSql();
        const nombreClienteTexto = (String(nombreCliente || "").trim() || "Cliente no especificado");
        const anuladoNormalizado = normalizarAnulado(anulado);
        const fotoBuffer = toBinaryBuffer(fotoComprobante);
        const cuentaDestinoTexto = cuentaDestino ? String(cuentaDestino).trim() : null;
        const idBancoOrigenNum = idBancoOrigen === null || idBancoOrigen === undefined || idBancoOrigen === ""
            ? null
            : Number(idBancoOrigen);

        if (anuladoNormalizado === "__INVALID__") {
            return res.status(400).json({
                message: "Valor invalido para anulado. Use null, completada o anulada.",
            });
        }

        if (
            Number.isNaN(banco) ||
            Number.isNaN(tipo) ||
            Number.isNaN(usuario) ||
            Number.isNaN(montoNum) ||
            (servicio !== null && Number.isNaN(servicio)) ||
            Number.isNaN(comisionNum) ||
            (longitudNum !== null && Number.isNaN(longitudNum)) ||
            (latitudNum !== null && Number.isNaN(latitudNum)) ||
            !numeroReferencia ||
            false
        ) {
            return res.status(400).json({
                message: "Campos invalidos. Verifique banco, tipo, usuario, referencia, cliente y montos.",
            });
        }

        const pool = await getpool();

        // Migrar columna idBancoOrigen si no existe
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.transacciones') AND name = 'idBancoOrigen')
                ALTER TABLE dbo.transacciones ADD idBancoOrigen INT NULL;
        `);

        const cajaInfo = await getCajaActivaInfo(pool, usuario, fechaTransaccionTexto);
        if (!cajaInfo) {
            return res.status(400).json({
                message: "No hay caja abierta. Abra la caja antes de registrar transacciones.",
            });
        }
        const { idUsuarioCaja, idCaja, fechaApertura, fecha: fechaCaja } = cajaInfo;

        // ----------------------------------------------------------------
        // Obtener nombre del tipo de transaccion para saber el impacto
        // ----------------------------------------------------------------
        const tipoResult = await pool.request()
            .input("idTipo", sql.Int, tipo)
            .query("SELECT TOP 1 LOWER(LTRIM(RTRIM(ISNULL(nombre,'')))) AS nombre FROM tipo_transaccion WHERE id = @idTipo;");
        const tipoNombre = String(tipoResult.recordset?.[0]?.nombre || "");

        const esTransferencia = tipoNombre.includes("transferencia");
        const esEgresoBanco   = !esTransferencia && (tipoNombre.includes("deposit") || tipoNombre.includes("servicio") || tipoNombre.includes("tarjeta"));
        const esEfectivoSalida = !esTransferencia && (tipoNombre.includes("retiro") || tipoNombre.includes("remesa"));

        // Filtro temporal para movimientos_caja: por idCaja si existe, sino por fecha
        const filtroMovCajaEfectivo = idCaja
            ? `mc.idCaja = ${idCaja}`
            : `mc.fecha = '${fechaCaja}'`;
        const filtroMovCajaBanco = (idBancoNum, idCajaVal) => idCajaVal
            ? `mc.idCaja = ${idCajaVal} AND mc.idBanco = ${idBancoNum}`
            : `mc.fecha = '${fechaCaja}' AND mc.idBanco = ${idBancoNum}`;
        const filtroTrans = fechaApertura
            ? `t.fechaTransaccion >= '${fechaApertura.toISOString().replace('T', ' ').slice(0, 23)}'`
            : `CONVERT(date, t.fechaTransaccion) = '${fechaCaja}'`;

        // ----------------------------------------------------------------
        // Validacion: Retiro/Remesa → el cajero desembolsa efectivo
        // ----------------------------------------------------------------
        if (esEfectivoSalida && anuladoNormalizado === 'completada') {
            const efectivoCheck = await pool.request()
                .input("idUsEf", sql.Int, idUsuarioCaja)
                .input("fechaEf", sql.Date, fechaCaja)
                .query(`
                    SELECT
                        ISNULL((SELECT TOP 1 efectivoInicial FROM caja_config_apertura
                                WHERE idUsuario = @idUsEf AND fecha = @fechaEf), 0)
                        + ISNULL((
                            SELECT
                                SUM(CASE WHEN (LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%deposit%'
                                              OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%servicio%'
                                              OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%tarjeta%')
                                             AND LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI NOT LIKE '%transferencia%'
                                     THEN ISNULL(t.monto,0) ELSE 0 END)
                                - SUM(CASE WHEN (LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%retiro%'
                                              OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%remesa%')
                                             AND LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI NOT LIKE '%transferencia%'
                                     THEN ISNULL(t.monto,0) ELSE 0 END)
                            FROM transacciones t
                            LEFT JOIN tipo_transaccion tt ON tt.id = t.idTipoTrans
                            WHERE t.idUsuario = @idUsEf
                              AND ${filtroTrans}
                              AND ISNULL(t.anulado,'') = 'completada'
                        ), 0)
                        + ISNULL((SELECT SUM(mc.monto) FROM movimientos_caja mc
                                  WHERE ${filtroMovCajaEfectivo} AND mc.tipo = 'ingreso'
                                    AND (mc.modalidad = 'efectivo' OR mc.modalidad IS NULL)), 0)
                        - ISNULL((SELECT SUM(mc.monto) FROM movimientos_caja mc
                                  WHERE ${filtroMovCajaEfectivo} AND mc.tipo = 'egreso'
                                    AND (mc.modalidad = 'efectivo' OR mc.modalidad IS NULL)), 0)
                        AS efectivoActual
                `);
            const efectivoActual = Number(efectivoCheck.recordset?.[0]?.efectivoActual ?? 0);
            if (efectivoActual - montoNum < 0) {
                return res.status(422).json({
                    message: `Efectivo insuficiente para esta operacion. Efectivo disponible: ${new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(efectivoActual)}.`,
                });
            }
        }

        // ----------------------------------------------------------------
        // Validacion: Deposito/Servicio/Tarjeta → el banco disminuye saldo
        // ----------------------------------------------------------------
        if (esEgresoBanco && anuladoNormalizado === 'completada') {
            const filtroMcBanco = filtroMovCajaBanco(banco, idCaja);
            const saldoCheck = await pool.request()
                .input("idBancoVal", sql.Int, banco)
                .input("fechaVal", sql.Date, fechaCaja)
                .query(`
                    SELECT
                        ISNULL(bsg.saldoInicial, 0)
                        + ISNULL((
                            SELECT
                                SUM(CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%retiro%'
                                              OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%remesa%'
                                         THEN ISNULL(t.monto,0) ELSE 0 END)
                                - SUM(CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%deposit%'
                                              OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%servicio%'
                                              OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%tarjeta%'
                                         THEN ISNULL(t.monto,0) ELSE 0 END)
                            FROM transacciones t
                            LEFT JOIN tipo_transaccion tt ON tt.id = t.idTipoTrans
                            WHERE t.idBanco = @idBancoVal
                              AND ${filtroTrans}
                              AND ISNULL(t.anulado,'') = 'completada'
                        ), 0)
                        + ISNULL((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE ${filtroMcBanco} AND mc.tipo = 'ingreso' AND mc.modalidad = 'banco'), 0)
                        - ISNULL((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE ${filtroMcBanco} AND mc.tipo = 'egreso'  AND mc.modalidad = 'banco'), 0)
                        AS saldoActual
                    FROM banco_saldo_global bsg
                    WHERE bsg.idBanco = @idBancoVal AND bsg.fecha = @fechaVal;
                `);
            const saldoActual = Number(saldoCheck.recordset?.[0]?.saldoActual ?? 0);
            if (saldoActual - montoNum < 0) {
                const bancNombre = (await pool.request().input("bid", sql.Int, banco)
                    .query("SELECT TOP 1 nombre FROM bancos WHERE id = @bid;")).recordset?.[0]?.nombre || "banco";
                return res.status(422).json({
                    message: `Saldo insuficiente en ${bancNombre}. Saldo actual: ${new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(saldoActual)}.`,
                });
            }
        }

        // ----------------------------------------------------------------
        // Validacion: Transferencia → el banco ORIGEN disminuye saldo
        // ----------------------------------------------------------------
        if (esTransferencia && anuladoNormalizado === 'completada' && idBancoOrigenNum) {
            const filtroMcBancoOrigen = filtroMovCajaBanco(idBancoOrigenNum, idCaja);
            const saldoOrigenCheck = await pool.request()
                .input("idBancoOrig", sql.Int, idBancoOrigenNum)
                .input("fechaOrig", sql.Date, fechaCaja)
                .query(`
                    SELECT
                        ISNULL(bsg.saldoInicial, 0)
                        + ISNULL((
                            SELECT
                                SUM(CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%retiro%'
                                              OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%remesa%'
                                         THEN ISNULL(t.monto,0) ELSE 0 END)
                                - SUM(CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%deposit%'
                                              OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%servicio%'
                                              OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%tarjeta%'
                                         THEN ISNULL(t.monto,0) ELSE 0 END)
                                - SUM(CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%transferencia%'
                                         THEN ISNULL(t.monto,0) ELSE 0 END)
                            FROM transacciones t
                            LEFT JOIN tipo_transaccion tt ON tt.id = t.idTipoTrans
                            WHERE t.idBancoOrigen = @idBancoOrig
                              AND ${filtroTrans.replace('t.idUsuario = @idUsEf AND', '')}
                              AND ISNULL(t.anulado,'') = 'completada'
                        ), 0)
                        + ISNULL((SELECT SUM(t2.monto) FROM transacciones t2
                            LEFT JOIN tipo_transaccion tt2 ON tt2.id = t2.idTipoTrans
                            WHERE t2.idBancoOrigen = @idBancoOrig
                              AND ${filtroTrans.replace('t.idUsuario = @idUsEf AND', '')}
                              AND ISNULL(t2.anulado,'') = 'completada'
                              AND LOWER(LTRIM(RTRIM(ISNULL(tt2.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%transferencia%'
                        ), 0)
                        + ISNULL((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE ${filtroMcBancoOrigen} AND mc.tipo = 'ingreso' AND mc.modalidad = 'banco'), 0)
                        - ISNULL((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE ${filtroMcBancoOrigen} AND mc.tipo = 'egreso'  AND mc.modalidad = 'banco'), 0)
                        AS saldoActual
                    FROM banco_saldo_global bsg
                    WHERE bsg.idBanco = @idBancoOrig AND bsg.fecha = @fechaOrig;
                `);
            const saldoOrigen = Number(saldoOrigenCheck.recordset?.[0]?.saldoActual ?? 0);
            if (saldoOrigen - montoNum < 0) {
                const bancNombre = (await pool.request().input("bid", sql.Int, idBancoOrigenNum)
                    .query("SELECT TOP 1 nombre FROM bancos WHERE id = @bid;")).recordset?.[0]?.nombre || "banco origen";
                return res.status(422).json({
                    message: `Saldo insuficiente en ${bancNombre} para la transferencia. Saldo actual: ${new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(saldoOrigen)}.`,
                });
            }
        }
        const cols = await getTransaccionesColumns(pool);
        const requestInsert = pool
            .request()
            .input("idBanco", sql.Int, banco)
            .input("idTipoTrans", sql.Int, tipo)
            .input("idServicio", sql.Int, servicio)
            .input("idUsuario", sql.Int, idUsuarioCaja)
            .input("numeroReferencia", sql.VarChar(50), String(numeroReferencia).trim())
            .input("nombreCliente", sql.VarChar(150), nombreClienteTexto)
            .input("monto", sql.Decimal(12, 2), montoNum)
            .input("comision", sql.Decimal(10, 2), comisionNum)
            .input("anulado", sql.VarChar(20), anuladoNormalizado)
            .input("observacion", sql.VarChar(300), observacion ? String(observacion).trim() : null)
            .input("fechaTransaccion", sql.VarChar(30), fechaTransaccionTexto)
            .input("longitud", sql.Decimal(9, 6), longitudNum)
            .input("latitud", sql.Decimal(9, 6), latitudNum);

        const insertFields = [
            "idBanco",
            "idTipoTrans",
            "idServicio",
            "idUsuario",
            "numeroReferencia",
            "nombreCliente",
            "monto",
            "comision",
            "anulado",
            "observacion",
            "fechaTransaccion",
            "longitud",
            "latitud",
        ];
        const insertValues = insertFields.map((f) => `@${f}`);

        if (cols.has("foto")) {
            requestInsert.input("foto", sql.VarBinary(sql.MAX), fotoBuffer);
            insertFields.push("foto");
            insertValues.push("@foto");
        }

        if (cols.has("cuentadestino")) {
            requestInsert.input("cuentaDestino", sql.VarChar(50), cuentaDestinoTexto);
            insertFields.push("cuentaDestino");
            insertValues.push("@cuentaDestino");
        }

        if (cols.has("idbancoorigen")) {
            requestInsert.input("idBancoOrigen", sql.Int, idBancoOrigenNum);
            insertFields.push("idBancoOrigen");
            insertValues.push("@idBancoOrigen");
        }

        const result = await requestInsert.query(`
                INSERT INTO dbo.transacciones (${insertFields.join(", ")})
                VALUES (${insertValues.join(", ")});
            `);

        let idInsertado = Number(result.recordset?.[0]?.nuevoId || 0);
        if (Number.isNaN(idInsertado) || idInsertado <= 0) {
            const fallback = await pool
                .request()
                .input("idUsuario", sql.Int, idUsuarioCaja)
                .input("numeroReferencia", sql.VarChar(50), String(numeroReferencia).trim())
                .query(`
                    SELECT TOP 1 id
                    FROM transacciones
                    WHERE idUsuario = @idUsuario
                      AND numeroReferencia = @numeroReferencia
                    ORDER BY id DESC;
                `);
            idInsertado = Number(fallback.recordset?.[0]?.id || 0);
        }

        // Forzar estado final solicitado (pendiente/completada/anulada) en la fila insertada.
        if (!Number.isNaN(idInsertado) && idInsertado > 0) {
            const requestUpdate = pool
                .request()
                .input("id", sql.Int, idInsertado)
                .input("anulado", sql.VarChar(20), anuladoNormalizado);

            const updateFields = ["anulado = @anulado"];

            if (cols.has("cuentadestino")) {
                requestUpdate.input("cuentaDestino", sql.VarChar(50), cuentaDestinoTexto);
                updateFields.push("cuentaDestino = @cuentaDestino");
            }

            if (cols.has("idbancoorigen")) {
                requestUpdate.input("idBancoOrigen", sql.Int, idBancoOrigenNum);
                updateFields.push("idBancoOrigen = @idBancoOrigen");
            }

            if (cols.has("foto") && fotoBuffer) {
                requestUpdate.input("foto", sql.VarBinary(sql.MAX), fotoBuffer);
                updateFields.push("foto = @foto");
            }

            await requestUpdate.query(`
                UPDATE transacciones
                SET ${updateFields.join(", ")}
                WHERE id = @id;
            `);
        }

        res.status(201).json({
            message: "Transaccion registrada correctamente",
            nuevoId: idInsertado || null,
            anulado: anuladoNormalizado,
            idUsuarioCaja,
        });
    } catch (error) {
        const dbMessage = error?.originalError?.info?.message || error.message;

        // El trigger de caja abierta devuelve este error de negocio desde SQL Server.
        if (dbMessage && dbMessage.includes("No hay caja abierta")) {
            return res.status(400).json({
                message: dbMessage,
            });
        }

        res.status(500).json({
            message: "Error al registrar transaccion",
            error: dbMessage,
        });
    }
};

exports.ActualizarTransaccion = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const anulado = req.body?.anulado;
        const observacion = req.body?.observacion;
        const fotoComprobante = req.body?.fotoComprobante;

        if (Number.isNaN(id) || id <= 0) {
            return res.status(400).json({ message: "ID de transaccion invalido." });
        }

        const pool = await getpool();
        const cols = await getTransaccionesColumns(pool);
        const actualResult = await pool
            .request()
            .input("id", sql.Int, id)
            .query(`SELECT TOP 1 id, anulado FROM transacciones WHERE id = @id;`);

        const actual = actualResult.recordset?.[0];
        if (!actual) {
            return res.status(404).json({ message: "Transaccion no encontrada." });
        }

        const estadoActual = normalizarAnulado(actual.anulado);

        const campos = [];
        const request = pool.request().input("id", sql.Int, id);

        if (anulado !== undefined) {
            const anuladoNormalizado = normalizarAnulado(anulado);
            if (anuladoNormalizado === "__INVALID__") {
                return res.status(400).json({ message: "Valor invalido para anulado. Use null, completada o anulada." });
            }

            // Regla de negocio:
            // - Pendiente (null) puede pasar a completada o anulada.
            // - Completada puede pasar a anulada.
            // - Anulada no puede cambiar de estado.
            if (estadoActual === "anulada") {
                return res.status(409).json({
                    message: "La transaccion ya esta anulada y no puede cambiar su estado.",
                });
            }

            if (anuladoNormalizado === null) {
                return res.status(400).json({
                    message: "Estado invalido. Use completada o anulada para cerrar una pendiente.",
                });
            }

            if (estadoActual === "completada" && anuladoNormalizado !== "anulada") {
                return res.status(409).json({
                    message: "Una transaccion completada solo puede pasar a anulada.",
                });
            }

            request.input("anulado", sql.VarChar(20), anuladoNormalizado);
            campos.push("anulado = @anulado");
        }

        if (observacion !== undefined) {
            request.input("observacion", sql.VarChar(300), observacion ? String(observacion).trim() : null);
            campos.push("observacion = @observacion");
        }

        if (fotoComprobante !== undefined && cols.has("foto")) {
            const fotoBuffer = toBinaryBuffer(fotoComprobante);
            request.input("foto", sql.VarBinary(sql.MAX), fotoBuffer);
            campos.push("foto = @foto");
        }

        if (campos.length === 0) {
            return res.status(400).json({ message: "No hay campos para actualizar." });
        }

        const query = `
            UPDATE transacciones
            SET ${campos.join(", ")}
            WHERE id = @id;
        `;

        await request.query(query);

        return res.json({ message: "Transaccion actualizada correctamente." });
    } catch (error) {
        return res.status(500).json({
            message: "Error actualizando transaccion",
            error: error.message,
        });
    }
};

exports.ResumenPorBanco = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, idBanco, idTipoTrans } = req.query;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                message: "Debe enviar fechaInicio y fechaFin en query params.",
            });
        }

        const bancoNum = idBanco ? Number(idBanco) : null;
        const tipoNum = idTipoTrans ? Number(idTipoTrans) : null;

        if ((idBanco && Number.isNaN(bancoNum)) || (idTipoTrans && Number.isNaN(tipoNum))) {
            return res.status(400).json({
                message: "Filtros invalidos para idBanco o idTipoTrans.",
            });
        }

        const pool = await getpool();
        const request = pool
            .request()
            .input("fechaInicio", sql.Date, fechaInicio)
            .input("fechaFin", sql.Date, fechaFin)
            .input("idBanco", sql.Int, bancoNum)
            .input("idTipoTrans", sql.Int, tipoNum);

        const result = await request.query(`
            SELECT
                b.nombre AS banco,
                tt.nombre AS tipoTransaccion,
                COUNT(*) AS totalTransacciones,
                SUM(t.monto) AS totalMonto,
                SUM(t.comision) AS totalComisiones
            FROM transacciones t
            INNER JOIN bancos b ON t.idBanco = b.id
            INNER JOIN tipo_transaccion tt ON t.idTipoTrans = tt.id
            WHERE t.fechaTransaccion >= @fechaInicio
              AND t.fechaTransaccion < DATEADD(day, 1, @fechaFin)
              AND t.anulado = 'completada'
              AND (@idBanco IS NULL OR t.idBanco = @idBanco)
              AND (@idTipoTrans IS NULL OR t.idTipoTrans = @idTipoTrans)
            GROUP BY b.nombre, tt.nombre
            ORDER BY b.nombre, tt.nombre;
        `);

        res.json(result.recordset || []);
    } catch (error) {
        res.status(500).json({
            message: "Error al obtener resumen por banco",
            error: error.message,
        });
    }
};

exports.ResumenComisionesMetricas = async (req, res) => {
    try {
        const { idBanco, idTipoTrans, fechaInicio, fechaFin, mes } = req.query;

        const bancoNum = idBanco ? Number(idBanco) : null;
        const tipoNum = idTipoTrans ? Number(idTipoTrans) : null;

        if ((idBanco && Number.isNaN(bancoNum)) || (idTipoTrans && Number.isNaN(tipoNum))) {
            return res.status(400).json({ message: "Filtros invalidos para idBanco o idTipoTrans." });
        }

        const hoyTexto = hondurasFechaHoy();
        const [hnYear, hnMm] = hoyTexto.split('-');
        const mesActual = `${hnYear}-${hnMm}`;
        const mesFiltro = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? mes : mesActual;

        const [yearStr, monthStr] = mesFiltro.split("-");
        const year = Number(yearStr);
        const month = Number(monthStr);
        const inicioMesTexto = `${year}-${String(month).padStart(2, '0')}-01`;
        const finMesTexto = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

        const inicioRango = typeof fechaInicio === "string" && fechaInicio ? fechaInicio : inicioMesTexto;
        const finRango = typeof fechaFin === "string" && fechaFin ? fechaFin : finMesTexto;

        const finAcumuladoMes = mesFiltro === mesActual ? hoyTexto : finMesTexto;

        const pool = await getpool();
        const result = await pool
            .request()
            .input("idBanco", sql.Int, bancoNum)
            .input("idTipoTrans", sql.Int, tipoNum)
            .input("hoy", sql.Date, hoyTexto)
            .input("inicioMes", sql.Date, inicioMesTexto)
            .input("finMes", sql.Date, finMesTexto)
            .input("finAcumuladoMes", sql.Date, finAcumuladoMes)
            .input("inicioRango", sql.Date, inicioRango)
            .input("finRango", sql.Date, finRango)
            .query(`
                SELECT
                    SUM(CASE
                        WHEN CAST(t.fechaTransaccion AS DATE) = @hoy
                        THEN t.comision ELSE 0 END) AS totalComisionDiaria,
                    SUM(CASE
                        WHEN CAST(t.fechaTransaccion AS DATE) BETWEEN @inicioMes AND @finMes
                        THEN t.comision ELSE 0 END) AS totalComisionMensual,
                    SUM(CASE
                        WHEN CAST(t.fechaTransaccion AS DATE) BETWEEN @inicioMes AND @finAcumuladoMes
                        THEN t.comision ELSE 0 END) AS totalComisionHastaFecha,
                    SUM(CASE
                        WHEN CAST(t.fechaTransaccion AS DATE) BETWEEN @inicioRango AND @finRango
                        THEN t.comision ELSE 0 END) AS totalComisionRango,
                    SUM(CASE
                        WHEN CAST(t.fechaTransaccion AS DATE) = @hoy
                        THEN t.monto ELSE 0 END) AS totalMontoDiario,
                    SUM(CASE
                        WHEN CAST(t.fechaTransaccion AS DATE) BETWEEN @inicioMes AND @finMes
                        THEN t.monto ELSE 0 END) AS totalMontoMensual,
                    SUM(CASE
                        WHEN CAST(t.fechaTransaccion AS DATE) BETWEEN @inicioMes AND @finAcumuladoMes
                        THEN t.monto ELSE 0 END) AS totalMontoHastaFecha,
                    SUM(CASE
                        WHEN CAST(t.fechaTransaccion AS DATE) BETWEEN @inicioRango AND @finRango
                        THEN t.monto ELSE 0 END) AS totalMontoRango,
                    SUM(CASE
                        WHEN CAST(t.fechaTransaccion AS DATE) BETWEEN @inicioRango AND @finRango
                        THEN 1 ELSE 0 END) AS totalTransaccionesRango
                FROM transacciones t
                WHERE t.anulado = 'completada'
                  AND (@idBanco IS NULL OR t.idBanco = @idBanco)
                  AND (@idTipoTrans IS NULL OR t.idTipoTrans = @idTipoTrans);
            `);

        const row = result.recordset?.[0] || {};
        return res.json({
            mes: mesFiltro,
            fechaInicio: inicioRango,
            fechaFin: finRango,
            totalComisionDiaria: Number(row.totalComisionDiaria || 0),
            totalComisionMensual: Number(row.totalComisionMensual || 0),
            totalComisionHastaFecha: Number(row.totalComisionHastaFecha || 0),
            totalComisionRango: Number(row.totalComisionRango || 0),
            totalMontoDiario: Number(row.totalMontoDiario || 0),
            totalMontoMensual: Number(row.totalMontoMensual || 0),
            totalMontoHastaFecha: Number(row.totalMontoHastaFecha || 0),
            totalMontoRango: Number(row.totalMontoRango || 0),
            totalTransaccionesRango: Number(row.totalTransaccionesRango || 0),
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error obteniendo metricas de comisiones",
            error: error.message,
        });
    }
};
