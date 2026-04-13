const { sql, getpool } = require("../config/db");

const LOGIN_CANDIDATES = ["usuario", "correo", "email", "nombre", "username"];
const PASS_CANDIDATES = ["passwordhash", "password", "clave", "contrasena", "contrasenia"];
const ROLE_CANDIDATES = ["rol", "tipousuario", "perfil", "cargo", "tipo"];
const ID_CANDIDATES = ["id", "idusuario"];

function hondurasFechaHoy() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tegucigalpa' }).format(new Date());
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

async function autenticarCajero(pool, credencial, clave) {
    const colsResult = await pool.request().query(`
        SELECT LOWER(COLUMN_NAME) AS nombre
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'usuarios';
    `);

    const available = new Set((colsResult.recordset || []).map((x) => x.nombre));

    const idCol = ID_CANDIDATES.find((c) => available.has(c));
    const loginCols = LOGIN_CANDIDATES.filter((c) => available.has(c));
    const passCols = PASS_CANDIDATES.filter((c) => available.has(c));
    const roleCols = ROLE_CANDIDATES.filter((c) => available.has(c));

    if (!idCol || loginCols.length === 0 || passCols.length === 0) {
        throw new Error("No se pudo autenticar cajero: revise columnas de usuarios (id, usuario/correo y clave). ");
    }

    if (roleCols.length === 0) {
        throw new Error("No se pudo validar rol: agregue una columna de rol/tipo en usuarios.");
    }

    const roleExpr = `COALESCE(${roleCols.map((c) => `CAST(u.${c} AS VARCHAR(100))`).join(", ")}, '')`;
    const nameExpr = available.has("nombre")
        ? "CAST(u.nombre AS VARCHAR(150))"
        : available.has("usuario")
            ? "CAST(u.usuario AS VARCHAR(150))"
            : "CAST(u." + idCol + " AS VARCHAR(150))";

    const query = `
        SELECT TOP 1
            u.${idCol} AS idUsuario,
            ${nameExpr} AS nombre,
            ${roleExpr} AS rol
        FROM usuarios u
        WHERE (${loginCols.map((c) => `u.${c} = @credencial`).join(" OR ")})
          AND (${passCols.map((c) => `u.${c} = @clave`).join(" OR ")});
    `;

    const authResult = await pool
        .request()
        .input("credencial", sql.VarChar(150), String(credencial).trim())
        .input("clave", sql.VarChar(150), String(clave))
        .query(query);

    const user = authResult.recordset?.[0];
    if (!user) {
        return { ok: false, message: "Credenciales invalidas." };
    }

    const rol = String(user.rol || "").toLowerCase();
    if (!rol.includes("cajero")) {
        if (rol.includes("admin")) {
            return { ok: false, message: "El administrador no puede abrir caja. Solo el cajero puede hacerlo." };
        }
        return { ok: false, message: "Solo usuarios con rol cajero pueden abrir caja." };
    }

    return {
        ok: true,
        idUsuario: Number(user.idUsuario),
        nombre: user.nombre,
        rol: user.rol,
    };
}

async function ensureConfigAperturaTables(pool) {
    await pool.request().query(`
        IF OBJECT_ID('dbo.banco_saldo_global', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.banco_saldo_global (
                id INT IDENTITY(1,1) PRIMARY KEY,
                fecha DATE NOT NULL,
                idBanco INT NOT NULL,
                saldoInicial DECIMAL(12,2) NOT NULL DEFAULT(0),
                fechaRegistro DATETIME NOT NULL DEFAULT(GETDATE()),
                CONSTRAINT UQ_banco_saldo_global_fecha_banco UNIQUE (fecha, idBanco)
            );
        END;

        IF OBJECT_ID('dbo.caja_config_apertura', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.caja_config_apertura (
                id INT IDENTITY(1,1) PRIMARY KEY,
                idUsuario INT NOT NULL,
                fecha DATE NOT NULL,
                efectivoInicial DECIMAL(12,2) NOT NULL DEFAULT(0),
                fechaRegistro DATETIME NOT NULL DEFAULT(GETDATE()),
                CONSTRAINT UQ_caja_config_apertura_usuario_fecha UNIQUE (idUsuario, fecha)
            );
        END;

        IF OBJECT_ID('dbo.caja_config_apertura_banco', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.caja_config_apertura_banco (
                id INT IDENTITY(1,1) PRIMARY KEY,
                idConfigApertura INT NOT NULL,
                idBanco INT NOT NULL,
                saldoInicialBanco DECIMAL(12,2) NOT NULL DEFAULT(0),
                CONSTRAINT UQ_caja_config_apertura_banco UNIQUE (idConfigApertura, idBanco)
            );
        END;

        IF OBJECT_ID('dbo.movimientos_caja', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.movimientos_caja (
                id INT IDENTITY(1,1) PRIMARY KEY,
                idUsuario INT NOT NULL,
                tipo VARCHAR(10) NOT NULL,
                monto DECIMAL(12,2) NOT NULL,
                concepto VARCHAR(200) NULL,
                subtipoIngreso VARCHAR(30) NULL,
                modalidad VARCHAR(10) NULL,
                idBanco INT NULL,
                fecha DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
                fechaRegistro DATETIME NOT NULL DEFAULT GETDATE()
            );
        END
        ELSE
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'movimientos_caja' AND COLUMN_NAME = 'modalidad')
                ALTER TABLE dbo.movimientos_caja ADD modalidad VARCHAR(10) NULL;
            IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'movimientos_caja' AND COLUMN_NAME = 'idBanco')
                ALTER TABLE dbo.movimientos_caja ADD idBanco INT NULL;
            IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'movimientos_caja' AND COLUMN_NAME = 'idCaja')
                ALTER TABLE dbo.movimientos_caja ADD idCaja INT NULL;
        END;

        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'caja' AND COLUMN_NAME = 'fechaApertura')
            ALTER TABLE dbo.caja ADD fechaApertura DATETIME NULL;
    `);
}

exports.ObtenerConfigApertura = async (req, res) => {
    try {
        const idUsuario = Number(req.params.idUsuario);
        const fecha = String(req.query?.fecha || '').trim() || hondurasFechaHoy();

        if (Number.isNaN(idUsuario) || idUsuario <= 0) {
            return res.status(400).json({ message: 'ID de usuario invalido.' });
        }

        const pool = await getpool();
        await ensureConfigAperturaTables(pool);

        const cabeceraResult = await pool
            .request()
            .input('idUsuario', sql.Int, idUsuario)
            .input('fecha', sql.Date, fecha)
            .query(`
                SELECT TOP 1
                    id,
                    idUsuario,
                    fecha,
                    efectivoInicial
                FROM caja_config_apertura
                WHERE idUsuario = @idUsuario
                  AND fecha = @fecha;
            `);

        const cabecera = cabeceraResult.recordset?.[0] || null;
        if (!cabecera) {
            return res.json({
                idUsuario,
                fecha,
                efectivoInicial: 0,
                saldosBancos: [],
            });
        }

        const detalleResult = await pool
            .request()
            .input('fecha', sql.Date, fecha)
            .query(`
                SELECT
                    idBanco,
                    saldoInicial AS saldoInicialBanco
                FROM banco_saldo_global
                WHERE fecha = @fecha
                ORDER BY idBanco ASC;
            `);

        return res.json({
            idUsuario: Number(cabecera.idUsuario),
            fecha: fecha,
            efectivoInicial: Number(cabecera.efectivoInicial || 0),
            saldosBancos: (detalleResult.recordset || []).map((x) => ({
                idBanco: Number(x.idBanco),
                saldoInicialBanco: Number(x.saldoInicialBanco || 0),
            })),
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Error al obtener configuracion de apertura.',
            error: error.message,
        });
    }
};

exports.GuardarConfigApertura = async (req, res) => {
    let tx;
    try {
        const idUsuario = Number(req.body?.idUsuario);
        const fecha = String(req.body?.fecha || '').trim() || hondurasFechaHoy();
        const efectivoInicial = Number(req.body?.efectivoInicial || 0);
        const saldosBancos = Array.isArray(req.body?.saldosBancos) ? req.body.saldosBancos : [];

        if (Number.isNaN(idUsuario) || idUsuario <= 0) {
            return res.status(400).json({ message: 'ID de usuario invalido.' });
        }

        if (Number.isNaN(efectivoInicial) || efectivoInicial < 0) {
            return res.status(400).json({ message: 'Efectivo inicial invalido.' });
        }

        const detallesLimpios = saldosBancos
            .map((item) => ({
                idBanco: Number(item?.idBanco),
                saldoInicialBanco: Number(item?.saldoInicialBanco || 0),
            }))
            .filter((item) => !Number.isNaN(item.idBanco) && item.idBanco > 0 && !Number.isNaN(item.saldoInicialBanco) && item.saldoInicialBanco >= 0);

        const pool = await getpool();
        await ensureConfigAperturaTables(pool);

        tx = new sql.Transaction(pool);
        await tx.begin();

        const upsertResult = await new sql.Request(tx)
            .input('idUsuario', sql.Int, idUsuario)
            .input('fecha', sql.Date, fecha)
            .input('efectivoInicial', sql.Decimal(12, 2), efectivoInicial)
            .query(`
                MERGE caja_config_apertura AS target
                USING (SELECT @idUsuario AS idUsuario, @fecha AS fecha) AS source
                ON target.idUsuario = source.idUsuario AND target.fecha = source.fecha
                WHEN MATCHED THEN
                    UPDATE SET efectivoInicial = @efectivoInicial
                WHEN NOT MATCHED THEN
                    INSERT (idUsuario, fecha, efectivoInicial)
                    VALUES (@idUsuario, @fecha, @efectivoInicial)
                OUTPUT inserted.id;
            `);

        const idConfigApertura = Number(upsertResult.recordset?.[0]?.id || 0);

        for (const item of detallesLimpios) {
            await new sql.Request(tx)
                .input('fecha', sql.Date, fecha)
                .input('idBanco', sql.Int, item.idBanco)
                .input('saldoInicial', sql.Decimal(12, 2), item.saldoInicialBanco)
                .query(`
                    MERGE banco_saldo_global AS target
                    USING (SELECT @fecha AS fecha, @idBanco AS idBanco) AS source
                    ON target.fecha = source.fecha AND target.idBanco = source.idBanco
                    WHEN MATCHED THEN
                        UPDATE SET saldoInicial = @saldoInicial
                    WHEN NOT MATCHED THEN
                        INSERT (fecha, idBanco, saldoInicial)
                        VALUES (@fecha, @idBanco, @saldoInicial);
                `);
        }

        await tx.commit();

        return res.json({
            message: 'Configuracion de apertura guardada correctamente.',
            idUsuario,
            fecha,
        });
    } catch (error) {
        if (tx) {
            try { await tx.rollback(); } catch {}
        }

        return res.status(500).json({
            message: 'Error al guardar configuracion de apertura.',
            error: error.message,
        });
    }
};

exports.AbrirCaja = async (req, res) => {
    try {
        const { credencial, clave, idUsuario, saldoInicial, fechaAperturaDispositivo, fechaAperturaDispositivoMs } = req.body;

        const saldo = Number(saldoInicial);

        if (Number.isNaN(saldo)) {
            return res.status(400).json({
                message: "Campos invalidos. saldoInicial es obligatorio.",
            });
        }

        const pool = await getpool();
        let usuarioApertura = null;

        // Compatibilidad: permitir abrir por idUsuario (flujo actual del frontend)
        if (!Number.isNaN(Number(idUsuario)) && Number(idUsuario) > 0) {
            usuarioApertura = {
                idUsuario: Number(idUsuario),
                nombre: null,
            };
        } else {
            if (!credencial || !clave) {
                return res.status(400).json({
                    message: "Campos invalidos. Envie idUsuario o bien credencial+clave junto con saldoInicial.",
                });
            }

            const auth = await autenticarCajero(pool, credencial, clave);
            if (!auth.ok) {
                return res.status(403).json({ message: auth.message });
            }

            usuarioApertura = {
                idUsuario: Number(auth.idUsuario),
                nombre: auth.nombre,
            };
        }

        const result = await pool
            .request()
            .input("idUsuario", sql.Int, usuarioApertura.idUsuario)
            .input("saldoInicial", sql.Decimal(12, 2), saldo)
            .execute("sp_AbrirCaja");

        const cajaId = Number(result.recordset?.[0]?.cajaId || 0);
        const fechaAperturaTexto = String(fechaAperturaDispositivo || "").trim() || (
            fechaAperturaDispositivoMs !== undefined && fechaAperturaDispositivoMs !== null
                ? fechaLocalSql(new Date(Number(fechaAperturaDispositivoMs)))
                : ""
        );

        if (cajaId > 0 && fechaAperturaTexto) {
            await pool
                .request()
                .input("idCaja", sql.Int, cajaId)
                .input("fechaApertura", sql.VarChar(30), fechaAperturaTexto)
                .query(`
                    UPDATE caja
                    SET fechaApertura = TRY_CONVERT(datetime, @fechaApertura, 121)
                    WHERE id = @idCaja;
                `);
        }

        res.status(201).json({
            message: "Caja abierta correctamente",
            cajaId: result.recordset?.[0]?.cajaId || null,
            idUsuario: usuarioApertura.idUsuario,
            nombreUsuario: usuarioApertura.nombre,
        });
    } catch (error) {
        const dbMessage = error?.originalError?.info?.message || error.message;

        if (dbMessage && dbMessage.includes("Ya existe una caja abierta")) {
            return res.status(400).json({
                message: dbMessage,
            });
        }

        res.status(500).json({
            message: "Error al abrir caja",
            error: dbMessage,
        });
    }
};

exports.CajaHoyPorUsuario = async (req, res) => {
    try {
        const idUsuario = Number(req.params.idUsuario);
        const fecha = String(req.query?.fecha || "").trim();
        if (Number.isNaN(idUsuario)) {
            return res.status(400).json({ message: "ID de usuario invalido." });
        }

        const pool = await getpool();
        const request = pool
            .request()
            .input("idUsuario", sql.Int, idUsuario);

        const whereFecha = fecha ? "AND CONVERT(date, c.fecha) = @fecha" : "AND CONVERT(date, c.fecha) = CONVERT(date, GETDATE())";
        if (fecha) {
            request.input("fecha", sql.Date, fecha);
        }

        const result = await request.query(`
            SELECT TOP 1
                c.id,
                c.idUsuario,
                c.fecha,
                c.saldoInicial,
                c.totalIngresos,
                c.totalEgresos,
                c.saldoFinal,
                c.estado,
                c.fechaCierre,
                c.fechaApertura
            FROM caja c
            WHERE c.idUsuario = @idUsuario
              ${whereFecha}
            ORDER BY c.id DESC;
        `);

        const row = result.recordset?.[0] || null;
        return res.json(row);
    } catch (error) {
        return res.status(500).json({
            message: "Error al obtener caja del dia.",
            error: error.message,
        });
    }
};

exports.SaldosActualesPorBanco = async (req, res) => {
    try {
        const idUsuario = Number(req.params.idUsuario);
        if (Number.isNaN(idUsuario) || idUsuario <= 0) {
            return res.status(400).json({ message: "ID de usuario invalido." });
        }

        const fecha = String(req.query?.fecha || "").trim() || hondurasFechaHoy();
        // Filtrar movimientos_caja por sesion de caja (idCaja) para que cada apertura arranque en 0
        const idCajaParam = req.query?.idCaja ? Number(req.query.idCaja) : null;
        // fechaApertura se mantiene como fallback para transacciones (no tienen idCaja)
        const fechaApertura = String(req.query?.fechaApertura || "").trim() || null;
        const pool = await getpool();
        await ensureConfigAperturaTables(pool);

        const bancosColsResult = await pool.request().query(`
            SELECT LOWER(COLUMN_NAME) AS nombre
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'bancos';
        `);
        const bancosCols = new Set((bancosColsResult.recordset || []).map((x) => x.nombre));
        const whereBancoActivo = bancosCols.has('estado')
            ? "WHERE ISNULL(CAST(b.estado AS INT), 1) = 1"
            : "";

        const request = pool
            .request()
            .input("idUsuario", sql.Int, idUsuario)
            .input("fecha", sql.Date, fecha);

        // Si hay fechaApertura, filtrar desde ese momento exacto (sesion actual de caja)
        // Asi al cerrar y reabrir caja el mismo dia, los movimientos anteriores no se suman
        const usarFechaApertura = !!fechaApertura;
        if (usarFechaApertura) {
            request.input("fechaApertura", sql.DateTime, new Date(fechaApertura));
        }
        // Transacciones: filtrar por fechaApertura (por sesion) o por fecha (por dia)
        const filtroFechaTrans = usarFechaApertura
            ? "t.fechaTransaccion >= @fechaApertura"
            : "CONVERT(date, t.fechaTransaccion) = @fecha";
        // movimientos_caja: filtrar por idCaja (sesion exacta) si esta disponible; fallback a fecha
        let filtroFechaMovCaja;
        if (idCajaParam && !Number.isNaN(idCajaParam)) {
            request.input("idCajaFiltro", sql.Int, idCajaParam);
            filtroFechaMovCaja = "mc.idCaja = @idCajaFiltro";
        } else if (usarFechaApertura) {
            filtroFechaMovCaja = "mc.fechaRegistro >= @fechaApertura";
        } else {
            filtroFechaMovCaja = "mc.fecha = @fecha";
        }

        const result = await request
            .query(`
                WITH all_mov AS (
                    -- Transacciones regulares (no transferencia): clasificadas por tipo, vinculadas al idBanco
                    SELECT
                        t.idBanco AS bancoId,
                        CASE
                            WHEN (LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%retiro%'
                                 OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%remesa%')
                                 AND LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI NOT LIKE '%transferencia%'
                                THEN ISNULL(t.monto, 0)
                            ELSE 0
                        END AS ingreso,
                        CASE
                            WHEN (LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%deposit%'
                                 OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%servicio%'
                                 OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%tarjeta%')
                                 AND LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI NOT LIKE '%transferencia%'
                                THEN ISNULL(t.monto, 0)
                            ELSE 0
                        END AS egreso
                    FROM transacciones t
                    LEFT JOIN tipo_transaccion tt ON tt.id = t.idTipoTrans
                    WHERE ${filtroFechaTrans}
                      AND ISNULL(t.anulado, '') = 'completada'
                      AND t.idUsuario = @idUsuario
                      AND LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI NOT LIKE '%transferencia%'

                    UNION ALL

                    -- Transferencias: banco ORIGEN (idBanco) disminuye su saldo
                    SELECT
                        t.idBanco AS bancoId,
                        0 AS ingreso,
                        ISNULL(t.monto, 0) AS egreso
                    FROM transacciones t
                    LEFT JOIN tipo_transaccion tt ON tt.id = t.idTipoTrans
                    WHERE ${filtroFechaTrans}
                      AND ISNULL(t.anulado, '') = 'completada'
                      AND t.idUsuario = @idUsuario
                      AND LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%transferencia%'

                    UNION ALL

                    -- Transferencias: banco DESTINO (idBancoOrigen) aumenta su saldo
                    SELECT
                        t.idBancoOrigen AS bancoId,
                        ISNULL(t.monto, 0) AS ingreso,
                        0 AS egreso
                    FROM transacciones t
                    LEFT JOIN tipo_transaccion tt ON tt.id = t.idTipoTrans
                    WHERE ${filtroFechaTrans}
                      AND ISNULL(t.anulado, '') = 'completada'
                      AND t.idUsuario = @idUsuario
                      AND LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%transferencia%'
                      AND t.idBancoOrigen IS NOT NULL

                ),
                -- Ingresos de Capital y Gastos en banco (desde Control de Caja)
                capital_banco AS (
                    SELECT mc.idBanco AS bancoId,
                        ISNULL(SUM(CASE WHEN mc.tipo = 'ingreso' THEN mc.monto ELSE 0 END), 0) AS ingreso,
                        ISNULL(SUM(CASE WHEN mc.tipo = 'egreso'  THEN mc.monto ELSE 0 END), 0) AS egreso
                    FROM movimientos_caja mc
                    WHERE ${filtroFechaMovCaja}
                      AND mc.modalidad = 'banco'
                      AND mc.idUsuario = @idUsuario
                      AND mc.idBanco IS NOT NULL
                    GROUP BY mc.idBanco
                ),
                agg_mov AS (
                    SELECT bancoId, SUM(ingreso) AS totalIngreso, SUM(egreso) AS totalEgreso
                    FROM all_mov
                    GROUP BY bancoId
                )
                SELECT
                    b.id AS idBanco,
                    b.nombre AS banco,
                    ISNULL(bsg.saldoInicial, 0) AS saldoInicialBanco,
                    ISNULL(agg.totalIngreso, 0) + ISNULL(cb.ingreso, 0) AS totalIngresosBanco,
                    ISNULL(agg.totalEgreso, 0)  + ISNULL(cb.egreso, 0)  AS totalEgresosBanco
                FROM bancos b
                LEFT JOIN banco_saldo_global bsg
                    ON bsg.idBanco = b.id
                   AND bsg.fecha = @fecha
                LEFT JOIN agg_mov agg ON agg.bancoId = b.id
                LEFT JOIN capital_banco cb ON cb.bancoId = b.id
                ${whereBancoActivo}
                ORDER BY b.nombre ASC;
            `);

        const rows = (result.recordset || []).map((x) => {
            const saldoInicialBanco = Number(x.saldoInicialBanco || 0);
            const totalIngresosBanco = Number(x.totalIngresosBanco || 0);
            const totalEgresosBanco = Number(x.totalEgresosBanco || 0);
            return {
                idBanco: Number(x.idBanco),
                banco: String(x.banco || ''),
                saldoInicialBanco,
                totalIngresosBanco,
                totalEgresosBanco,
                saldoActualBanco: saldoInicialBanco + totalIngresosBanco - totalEgresosBanco,
            };
        });

        return res.json(rows);
    } catch (error) {
        return res.status(500).json({
            message: "Error al obtener saldos actuales por banco.",
            error: error.message,
        });
    }
};

exports.ResumenOperativoCaja = async (req, res) => {
    try {
        const idUsuario = Number(req.params.idUsuario);
        if (Number.isNaN(idUsuario) || idUsuario <= 0) {
            return res.status(400).json({ message: "ID de usuario invalido." });
        }

        const fecha = String(req.query?.fecha || "").trim() || hondurasFechaHoy();
        // Filtrar movimientos_caja por sesion de caja (idCaja) para que cada apertura arranque en 0
        const idCajaParam = req.query?.idCaja ? Number(req.query.idCaja) : null;
        // fechaApertura como fallback para transacciones (no tienen idCaja)
        const fechaApertura = String(req.query?.fechaApertura || "").trim() || null;
        const pool = await getpool();
        await ensureConfigAperturaTables(pool);

        const usarFechaApertura = !!fechaApertura;
        // Transacciones: filtrar por fechaApertura (sesion) o por fecha (dia)
        const filtroFechaTrans = usarFechaApertura
            ? "t.fechaTransaccion >= @fechaApertura"
            : "CONVERT(date, t.fechaTransaccion) = @fecha";
        // movimientos_caja: filtrar por idCaja si esta disponible; fallback a fecha
        let filtroFechaMovCaja;
        if (idCajaParam && !Number.isNaN(idCajaParam)) {
            filtroFechaMovCaja = "mc.idCaja = @idCajaParam";
        } else if (usarFechaApertura) {
            filtroFechaMovCaja = "mc.fechaRegistro >= @fechaApertura";
        } else {
            filtroFechaMovCaja = "mc.fecha = @fecha";
        }

        const efectivoBaseRequest = pool
            .request()
            .input("idUsuario", sql.Int, idUsuario)
            .input("fecha", sql.Date, fecha);
        if (usarFechaApertura) {
            efectivoBaseRequest.input("fechaApertura", sql.DateTime, new Date(fechaApertura));
        }
        if (idCajaParam && !Number.isNaN(idCajaParam)) {
            efectivoBaseRequest.input("idCajaParam", sql.Int, idCajaParam);
        }

        const efectivoResult = await efectivoBaseRequest
            .query(`
                WITH cfg AS (
                    SELECT TOP 1
                        id,
                        efectivoInicial
                    FROM caja_config_apertura
                    WHERE idUsuario = @idUsuario
                      AND fecha = @fecha
                )
                SELECT
                    ISNULL((SELECT TOP 1 efectivoInicial FROM cfg), 0) AS efectivoInicial,
                    ISNULL(SUM(CASE
                        WHEN (LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%deposit%'
                             OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%servicio%'
                             OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%tarjeta%')
                             AND LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI NOT LIKE '%transferencia%'
                            THEN ISNULL(t.monto, 0)
                        ELSE 0
                    END), 0) AS efectivoEntradas,
                    ISNULL(SUM(CASE
                        WHEN (LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%retiro%'
                             OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%remesa%')
                             AND LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI NOT LIKE '%transferencia%'
                            THEN ISNULL(t.monto, 0)
                        ELSE 0
                    END), 0) AS efectivoSalidas
                FROM transacciones t
                LEFT JOIN tipo_transaccion tt ON tt.id = t.idTipoTrans
                WHERE t.idUsuario = @idUsuario
                  AND ${filtroFechaTrans}
                  AND ISNULL(t.anulado, '') = 'completada';
            `);

        const bancosColsResult = await pool.request().query(`
            SELECT LOWER(COLUMN_NAME) AS nombre
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'bancos';
        `);
        const bancosCols = new Set((bancosColsResult.recordset || []).map((x) => x.nombre));
        const whereBancoActivo = bancosCols.has('estado')
            ? "WHERE ISNULL(CAST(b.estado AS INT), 1) = 1"
            : "";

        const bancosReqResumen = pool
            .request()
            .input("idUsuario", sql.Int, idUsuario)
            .input("fecha", sql.Date, fecha);
        if (usarFechaApertura) {
            bancosReqResumen.input("fechaApertura", sql.DateTime, new Date(fechaApertura));
        }
        if (idCajaParam && !Number.isNaN(idCajaParam)) {
            bancosReqResumen.input("idCajaParam2", sql.Int, idCajaParam);
        }
        // Reemplazar el filtro de movimientos_caja en la segunda query de bancos
        const filtroFechaMovCajaBancos = (idCajaParam && !Number.isNaN(idCajaParam))
            ? "mc.idCaja = @idCajaParam2"
            : filtroFechaMovCaja;
        const bancosResult = await bancosReqResumen
            .query(`
                WITH mov_banco AS (
                    SELECT
                        t.idBanco,
                        SUM(CASE
                            WHEN LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%retiro%'
                                 OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%remesa%'
                                THEN ISNULL(t.monto, 0)
                            ELSE 0
                        END) AS ingresosBanco,
                        SUM(CASE
                            WHEN LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%deposit%'
                                 OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%servicio%'
                                 OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre, '')))) COLLATE Latin1_General_CI_AI LIKE '%tarjeta%'
                                THEN ISNULL(t.monto, 0)
                            ELSE 0
                        END) AS egresosBanco
                    FROM transacciones t
                    LEFT JOIN tipo_transaccion tt
                        ON tt.id = t.idTipoTrans
                    WHERE ${filtroFechaTrans}
                      AND ISNULL(t.anulado, '') = 'completada'
                      AND t.idUsuario = @idUsuario
                    GROUP BY t.idBanco
                ),
                capital_banco AS (
                    SELECT idBanco,
                        ISNULL(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS ingresos,
                        ISNULL(SUM(CASE WHEN tipo = 'egreso'  THEN monto ELSE 0 END), 0) AS egresos
                    FROM movimientos_caja mc
                    WHERE ${filtroFechaMovCajaBancos}
                      AND mc.modalidad = 'banco'
                      AND mc.idUsuario = @idUsuario
                      AND mc.idBanco IS NOT NULL
                    GROUP BY mc.idBanco
                )
                SELECT
                    ISNULL(SUM(
                        ISNULL(bsg.saldoInicial, 0)
                        + ISNULL(mb.ingresosBanco, 0)
                        - ISNULL(mb.egresosBanco, 0)
                        + ISNULL(cb.ingresos, 0)
                        - ISNULL(cb.egresos, 0)
                    ), 0) AS montoBancosActual
                FROM bancos b
                LEFT JOIN banco_saldo_global bsg
                    ON bsg.idBanco = b.id
                   AND bsg.fecha = @fecha
                LEFT JOIN mov_banco mb ON mb.idBanco = b.id
                LEFT JOIN capital_banco cb ON cb.idBanco = b.id
                ${whereBancoActivo};
            `);

        const efectivoRow = efectivoResult.recordset?.[0] || {};
        const efectivoInicial = Number(efectivoRow.efectivoInicial || 0);
        const efectivoEntradas = Number(efectivoRow.efectivoEntradas || 0);
        const efectivoSalidas = Number(efectivoRow.efectivoSalidas || 0);

        // Ingresos de Capital y Gastos en efectivo registrados desde Control de Caja
        const capEfectivoReq = pool
            .request()
            .input('fechaCap', sql.Date, fecha)
            .input('idUsuarioCap', sql.Int, idUsuario);
        if (usarFechaApertura) {
            capEfectivoReq.input('fechaAperturaCap', sql.DateTime, new Date(fechaApertura));
        }
        if (idCajaParam && !Number.isNaN(idCajaParam)) {
            capEfectivoReq.input('idCajaParamCap', sql.Int, idCajaParam);
        }
        const filtroFechaMovCajaEfectivo = (idCajaParam && !Number.isNaN(idCajaParam))
            ? "mc.idCaja = @idCajaParamCap"
            : usarFechaApertura
                ? "mc.fechaRegistro >= @fechaAperturaCap"
                : "mc.fecha = @fechaCap";
        const capitalEfectivoResult = await capEfectivoReq
            .query(`
                SELECT
                    ISNULL(SUM(CASE WHEN mc.tipo = 'ingreso' THEN mc.monto ELSE 0 END), 0) AS ingresosCapital,
                    ISNULL(SUM(CASE WHEN mc.tipo = 'egreso'  THEN mc.monto ELSE 0 END), 0) AS gastosCapital
                FROM movimientos_caja mc
                WHERE ${filtroFechaMovCajaEfectivo}
                  AND mc.idUsuario = @idUsuarioCap
                  AND (mc.modalidad = 'efectivo' OR mc.modalidad IS NULL)
            `);
        const capRow = capitalEfectivoResult.recordset?.[0] || {};
        const ingresosCapital = Number(capRow.ingresosCapital || 0);
        const gastosCapital   = Number(capRow.gastosCapital   || 0);

        const efectivoActual = efectivoInicial + efectivoEntradas - efectivoSalidas + ingresosCapital - gastosCapital;
        const montoBancosActual = Number(bancosResult.recordset?.[0]?.montoBancosActual || 0);

        return res.json({
            idUsuario,
            fecha,
            efectivoInicial,
            efectivoEntradas,
            efectivoSalidas,
            ingresosCapital,
            gastosCapital,
            efectivoActual,
            montoBancosActual,
            montoGeneral: efectivoActual + montoBancosActual,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error al obtener resumen operativo de caja.",
            error: error.message,
        });
    }
};

exports.UltimoCortePorUsuario = async (req, res) => {
    try {
        const idUsuario = Number(req.params.idUsuario);
        const idBanco = req.query?.idBanco ? Number(req.query.idBanco) : null;
        if (Number.isNaN(idUsuario)) {
            return res.status(400).json({ message: "ID de usuario invalido." });
        }
        if (idBanco !== null && Number.isNaN(idBanco)) {
            return res.status(400).json({ message: "ID de banco invalido." });
        }

        const pool = await getpool();

        // Si no hay filtro por banco, conservar comportamiento anterior.
        if (idBanco === null) {
            const tableCandidates = ["corte_caja", "corteCaja"];

            for (const tableName of tableCandidates) {
                try {
                    const result = await pool
                        .request()
                        .input("idUsuario", sql.Int, idUsuario)
                        .query(`
                            SELECT TOP 1
                                cc.id,
                                cc.idCaja,
                                cc.idUsuario,
                                cc.totalDepositos,
                                cc.totalRetiros,
                                cc.totalRemesas,
                                cc.totalServicios,
                                cc.totalComisiones,
                                cc.diferencia,
                                cc.observacion,
                                cc.fechaCorte
                            FROM ${tableName} cc
                            WHERE cc.idUsuario = @idUsuario
                            ORDER BY cc.fechaCorte DESC;
                        `);

                    const row = result.recordset?.[0] || null;
                    if (row) {
                        return res.json(row);
                    }
                } catch {
                    // Si la tabla no existe, intenta con el siguiente candidato.
                }
            }

            return res.json(null);
        }

        // Con filtro por banco: usar la ultima caja cerrada del usuario y calcular totales por banco.
        const ultimaCajaResult = await pool
            .request()
            .input("idUsuario", sql.Int, idUsuario)
            .query(`
                SELECT TOP 1
                    c.id,
                    c.fecha,
                    c.fechaCierre
                FROM caja c
                WHERE c.idUsuario = @idUsuario
                  AND c.estado = 'cerrada'
                ORDER BY c.fechaCierre DESC, c.id DESC;
            `);

        const caja = ultimaCajaResult.recordset?.[0] || null;
        if (!caja) {
            return res.json(null);
        }

        const resumenResult = await pool
            .request()
            .input("idUsuario", sql.Int, idUsuario)
            .input("idBanco", sql.Int, idBanco)
            .input("fechaCaja", sql.Date, caja.fecha)
            .query(`
                SELECT
                    SUM(CASE WHEN tt.nombre = 'Deposito' THEN t.monto ELSE 0 END) AS totalDepositos,
                    SUM(CASE WHEN tt.nombre = 'Retiro' THEN t.monto ELSE 0 END) AS totalRetiros,
                    SUM(CASE WHEN tt.nombre = 'Remesa' THEN t.monto ELSE 0 END) AS totalRemesas,
                    SUM(CASE WHEN tt.nombre LIKE '%Servicio%' OR tt.nombre LIKE '%Tarjeta%' THEN t.monto ELSE 0 END) AS totalServicios,
                    SUM(ISNULL(t.comision, 0)) AS totalComisiones
                FROM transacciones t
                INNER JOIN tipo_transaccion tt ON tt.id = t.idTipoTrans
                WHERE t.idUsuario = @idUsuario
                  AND t.idBanco = @idBanco
                  AND CONVERT(date, t.fechaTransaccion) = @fechaCaja
                  AND ISNULL(t.anulado, '') = 'completada';
            `);

        const bancoResult = await pool
            .request()
            .input("idBanco", sql.Int, idBanco)
            .query(`SELECT TOP 1 nombre FROM bancos WHERE id = @idBanco;`);

        const resumen = resumenResult.recordset?.[0] || {};
        const totalDepositos = Number(resumen.totalDepositos || 0);
        const totalRetiros = Number(resumen.totalRetiros || 0);
        const totalRemesas = Number(resumen.totalRemesas || 0);
        const totalServicios = Number(resumen.totalServicios || 0);
        const totalComisiones = Number(resumen.totalComisiones || 0);
        const diferencia = (totalDepositos + totalRemesas + totalServicios + totalComisiones) - totalRetiros;
        const nombreBanco = bancoResult.recordset?.[0]?.nombre || `Banco #${idBanco}`;

        return res.json({
            id: caja.id,
            idCaja: caja.id,
            idUsuario,
            totalDepositos,
            totalRetiros,
            totalRemesas,
            totalServicios,
            totalComisiones,
            diferencia,
            observacion: `Filtrado por banco: ${nombreBanco}`,
            fechaCorte: caja.fechaCierre || caja.fecha,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error al obtener ultimo corte.",
            error: error.message,
        });
    }
};

exports.CerrarCaja = async (req, res) => {
    try {
        const { idCaja, idUsuario, observacion, fechaCierreDispositivo, fechaCierreDispositivoMs } = req.body;

        const caja = Number(idCaja);
        const usuario = Number(idUsuario);

        if (Number.isNaN(caja) || Number.isNaN(usuario)) {
            return res.status(400).json({
                message: "Campos invalidos. idCaja e idUsuario son obligatorios.",
            });
        }

        const pool = await getpool();
        await pool
            .request()
            .input("idCaja", sql.Int, caja)
            .input("idUsuario", sql.Int, usuario)
            .input("observacion", sql.VarChar(300), observacion ? String(observacion).trim() : null)
            .execute("sp_CerrarCaja");

        const fechaCierreTexto = String(fechaCierreDispositivo || "").trim() || (
            fechaCierreDispositivoMs !== undefined && fechaCierreDispositivoMs !== null
                ? fechaLocalSql(new Date(Number(fechaCierreDispositivoMs)))
                : ""
        );

        if (fechaCierreTexto) {
            await pool
                .request()
                .input("idCaja", sql.Int, caja)
                .input("fechaCierre", sql.VarChar(30), fechaCierreTexto)
                .query(`
                    UPDATE caja
                    SET fechaCierre = @fechaCierre
                    WHERE id = @idCaja;
                `);

            const tableCandidates = ["corte_caja", "corteCaja"];
            for (const tableName of tableCandidates) {
                try {
                    await pool
                        .request()
                        .input("idCaja", sql.Int, caja)
                        .input("idUsuario", sql.Int, usuario)
                        .input("fechaCorte", sql.VarChar(30), fechaCierreTexto)
                        .query(`
                            UPDATE ${tableName}
                            SET fechaCorte = @fechaCorte
                            WHERE id = (
                                SELECT TOP 1 id
                                FROM ${tableName}
                                WHERE idCaja = @idCaja AND idUsuario = @idUsuario
                                ORDER BY id DESC
                            );
                        `);
                    break;
                } catch {
                    // Intentar con el siguiente nombre de tabla.
                }
            }
        }

        res.json({
            message: "Caja cerrada y corte generado correctamente",
        });
    } catch (error) {
        res.status(500).json({
            message: "Error al cerrar caja",
            error: error.message,
        });
    }
};

/**
 * GET /api/caja/actividad-reciente
 * Retorna historial reciente de: usuarios creados, bancos creados, servicios creados,
 * contrasenas actualizadas y transacciones anuladas.
 * Limite: ultimas 10 entradas por categoria.
 */
exports.ActividadReciente = async (req, res) => {
    try {
        const pool = await getpool();

        // Detectar columnas disponibles dinamicamente
        const colsRs = await pool.request().query(`
            SELECT TABLE_NAME, LOWER(COLUMN_NAME) AS col
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME IN ('usuarios','bancos','servicios','transacciones','usuarios_seguridad')
        `);
        const colMap = {};
        for (const row of (colsRs.recordset || [])) {
            if (!colMap[row.TABLE_NAME]) colMap[row.TABLE_NAME] = new Set();
            colMap[row.TABLE_NAME].add(row.col);
        }

        const hasCols = (tabla, ...cols) => cols.every(c => colMap[tabla]?.has(c));

        const resultados = { usuariosCreados: [], bancosCreados: [], serviciosCreados: [], passwordsActualizadas: [], transaccionesAnuladas: [] };

        // --- Usuarios creados ---
        try {
            const campoFecha = hasCols('usuarios', 'created_at') ? 'created_at'
                : hasCols('usuarios', 'fechacreacion') ? 'fechacreacion'
                : hasCols('usuarios', 'fecha') ? 'fecha' : null;
            const campoNombre = hasCols('usuarios', 'nombre') ? 'nombre'
                : hasCols('usuarios', 'usuario') ? 'usuario' : 'correo';
            const campoRol = hasCols('usuarios', 'rol') ? 'rol'
                : hasCols('usuarios', 'tipousuario') ? 'tipousuario' : null;

            if (campoFecha) {
                const rs = await pool.request().query(`
                    SELECT TOP 10 id, ${campoNombre} AS nombre,
                        ${campoRol ? campoRol + ' AS rol,' : "'cajero' AS rol,"}
                        ${campoFecha} AS fecha
                    FROM usuarios ORDER BY ${campoFecha} DESC;
                `);
                resultados.usuariosCreados = (rs.recordset || []).map(r => ({
                    id: Number(r.id), nombre: String(r.nombre || ''), rol: String(r.rol || 'cajero'),
                    fecha: r.fecha ? new Date(r.fecha).toISOString() : null,
                }));
            } else {
                const rs = await pool.request().query(`
                    SELECT TOP 10 id, ${campoNombre} AS nombre,
                        ${campoRol ? campoRol + ' AS rol' : "'cajero' AS rol"}
                    FROM usuarios ORDER BY id DESC;
                `);
                resultados.usuariosCreados = (rs.recordset || []).map(r => ({
                    id: Number(r.id), nombre: String(r.nombre || ''), rol: String(r.rol || 'cajero'), fecha: null,
                }));
            }
        } catch {}

        // --- Bancos creados ---
        try {
            const campoFecha = hasCols('bancos', 'created_at') ? 'created_at'
                : hasCols('bancos', 'fechacreacion') ? 'fechacreacion'
                : hasCols('bancos', 'fecha') ? 'fecha' : null;

            if (campoFecha) {
                const rs = await pool.request().query(`
                    SELECT TOP 10 id, nombre, ${campoFecha} AS fecha 
                    FROM bancos 
                    WHERE ISNULL(nombre, '') != '' 
                    ORDER BY ${campoFecha} DESC;
                `);
                resultados.bancosCreados = (rs.recordset || []).map(r => ({
                    id: Number(r.id), 
                    nombre: String(r.nombre || ''),
                    fecha: r.fecha ? new Date(r.fecha).toISOString() : null,
                }));
            } else {
                const rs = await pool.request().query(`
                    SELECT TOP 10 id, nombre 
                    FROM bancos 
                    WHERE ISNULL(nombre, '') != '' 
                    ORDER BY id DESC;
                `);
                resultados.bancosCreados = (rs.recordset || []).map(r => ({
                    id: Number(r.id), 
                    nombre: String(r.nombre || ''), 
                    fecha: null,
                }));
            }
        } catch {}

        // --- Servicios creados ---
        try {
            const campoFecha = hasCols('servicios', 'created_at') ? 'created_at'
                : hasCols('servicios', 'fechacreacion') ? 'fechacreacion'
                : hasCols('servicios', 'fecha') ? 'fecha' : null;
            const campoTipo = hasCols('servicios', 'tipo') ? 'tipo' : null;

            if (campoFecha) {
                const rs = await pool.request().query(`
                    SELECT TOP 10 id, nombre, ${campoTipo ? campoTipo + ' AS tipo,' : "'publico' AS tipo,"}
                        ${campoFecha} AS fecha FROM servicios ORDER BY ${campoFecha} DESC;
                `);
                resultados.serviciosCreados = (rs.recordset || []).map(r => ({
                    id: Number(r.id), nombre: String(r.nombre || ''), tipo: String(r.tipo || 'publico'),
                    fecha: r.fecha ? new Date(r.fecha).toISOString() : null,
                }));
            } else {
                const rs = await pool.request().query(`
                    SELECT TOP 10 id, nombre, ${campoTipo ? campoTipo + ' AS tipo' : "'publico' AS tipo"} FROM servicios ORDER BY id DESC;
                `);
                resultados.serviciosCreados = (rs.recordset || []).map(r => ({
                    id: Number(r.id), nombre: String(r.nombre || ''), tipo: String(r.tipo || 'publico'), fecha: null,
                }));
            }
        } catch {}

        // --- Contrasenas actualizadas (desde usuarios_seguridad) ---
        try {
            if (hasCols('usuarios_seguridad', 'last_password_change') && hasCols('usuarios_seguridad', 'user_id')) {
                const rs = await pool.request().query(`
                    SELECT TOP 10
                        us.user_id AS id,
                        COALESCE(u.nombre, CAST(us.user_id AS VARCHAR(20))) AS nombre,
                        us.last_password_change AS fecha
                    FROM usuarios_seguridad us
                    LEFT JOIN usuarios u ON u.id = us.user_id
                    WHERE us.last_password_change IS NOT NULL
                    ORDER BY us.last_password_change DESC;
                `);
                resultados.passwordsActualizadas = (rs.recordset || []).map(r => ({
                    id: Number(r.id), nombre: String(r.nombre || ''),
                    fecha: r.fecha ? new Date(r.fecha).toISOString() : null,
                }));
            }
        } catch {}

        // --- Transacciones anuladas ---
        try {
            const campoBanco = hasCols('transacciones', 'idbanco') ? 'b.nombre AS banco,' : '';
            const joinBanco = hasCols('transacciones', 'idbanco') ? 'LEFT JOIN bancos b ON b.id = t.idBanco' : '';
            const campoTipo = hasCols('transacciones', 'idtipotrans') ? "COALESCE(tt.nombre,'') AS tipo," : '';
            const joinTipo = hasCols('transacciones', 'idtipotrans') ? 'LEFT JOIN tipo_transaccion tt ON tt.id = t.idTipoTrans' : '';
            const campoNombreU = hasCols('usuarios', 'nombre') ? 'u.nombre' : "CAST(t.idUsuario AS VARCHAR(20))";
            const rs = await pool.request().query(`
                SELECT TOP 10
                    t.id, t.monto, t.fechaTransaccion AS fecha,
                    ${campoTipo}
                    ${campoBanco}
                    COALESCE(${campoNombreU}, CAST(t.idUsuario AS VARCHAR(20))) AS cajero
                FROM transacciones t
                LEFT JOIN usuarios u ON u.id = t.idUsuario
                ${joinTipo}
                ${joinBanco}
                WHERE LOWER(ISNULL(t.anulado,'')) = 'anulada'
                ORDER BY t.fechaTransaccion DESC;
            `);
            resultados.transaccionesAnuladas = (rs.recordset || []).map(r => ({
                id: Number(r.id), monto: Number(r.monto || 0),
                tipo: String(r.tipo || ''), banco: String(r.banco || ''),
                cajero: String(r.cajero || ''),
                fecha: r.fecha ? new Date(r.fecha).toISOString() : null,
            }));
        } catch {}

        return res.json(resultados);
    } catch (error) {
        return res.status(500).json({ message: 'Error al obtener actividad reciente.', error: error.message });
    }
};

exports.HistorialCajasCerradas = async (req, res) => {
    try {
        const pool = await getpool();
        try {
            const result = await pool.request().query(`
                SELECT
                    c.id,
                    c.idUsuario,
                    COALESCE(u.nombre, CAST(c.idUsuario AS VARCHAR(20))) AS nombreCajero,
                    c.saldoInicial,
                    c.totalIngresos,
                    c.totalEgresos,
                    c.saldoFinal,
                    c.fecha,
                    c.fechaCierre,
                    c.estado
                FROM caja c
                LEFT JOIN usuarios u ON u.id = c.idUsuario
                WHERE LOWER(LTRIM(RTRIM(ISNULL(c.estado, '')))) IN ('cerrada', 'cerrado', 'closed')
                ORDER BY
                    COALESCE(
                        TRY_CONVERT(datetime2, c.fechaCierre, 121),
                        TRY_CONVERT(datetime2, c.fechaCierre),
                        TRY_CONVERT(datetime2, c.fecha, 121),
                        TRY_CONVERT(datetime2, c.fecha)
                    ) DESC,
                    c.id DESC;
            `);

            return res.json(result.recordset || []);
        } catch {
            // Fallback para esquemas donde la tabla usuarios no usa columna "id".
            const fallback = await pool.request().query(`
                SELECT
                    c.id,
                    c.idUsuario,
                    CAST(c.idUsuario AS VARCHAR(20)) AS nombreCajero,
                    c.saldoInicial,
                    c.totalIngresos,
                    c.totalEgresos,
                    c.saldoFinal,
                    c.fecha,
                    c.fechaCierre,
                    c.estado
                FROM caja c
                WHERE LOWER(LTRIM(RTRIM(ISNULL(c.estado, '')))) IN ('cerrada', 'cerrado', 'closed')
                ORDER BY
                    COALESCE(
                        TRY_CONVERT(datetime2, c.fechaCierre, 121),
                        TRY_CONVERT(datetime2, c.fechaCierre),
                        TRY_CONVERT(datetime2, c.fecha, 121),
                        TRY_CONVERT(datetime2, c.fecha)
                    ) DESC,
                    c.id DESC;
            `);

            return res.json(fallback.recordset || []);
        }
    } catch (error) {
        res.status(500).json({
            message: "Error al obtener historial de cajas cerradas",
            error: error.message,
        });
    }
};

exports.DetalleCajaCerrada = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ message: "ID de caja invalido." });
        }

        const pool = await getpool();
        const result = await pool
            .request()
            .input("id", sql.Int, id)
            .query(`
                SELECT
                    c.id,
                    c.idUsuario,
                    COALESCE(u.nombre, CAST(c.idUsuario AS VARCHAR(20))) AS nombreCajero,
                    c.saldoInicial,
                    c.totalIngresos,
                    c.totalEgresos,
                    c.saldoFinal,
                    c.fecha,
                    c.fechaCierre,
                    c.estado
                FROM caja c
                LEFT JOIN usuarios u ON u.id = c.idUsuario
                WHERE c.id = @id
                  AND c.estado = 'cerrada';
            `);

        const row = result.recordset?.[0];
        if (!row) {
            return res.status(404).json({ message: "Caja cerrada no encontrada." });
        }

        res.json(row);
    } catch (error) {
        res.status(500).json({
            message: "Error al obtener detalle de caja cerrada",
            error: error.message,
        });
    }
};

exports.ResumenOperativoGlobal = async (req, res) => {
    try {
        const fecha = String(req.query?.fecha || "").trim() || hondurasFechaHoy();
        const pool = await getpool();
        await ensureConfigAperturaTables(pool);

        // ---- 1. Obtener cajas abiertas hoy para filtrar solo la sesion activa ----
        // Esto evita contar las transacciones de sesiones anteriores que ya estan
        // "consolidadas" en banco_saldo_global.saldoInicial al momento del cierre.
        const openCajasRs = await pool.request()
            .input("fechaHoy", sql.Date, fecha)
            .query(`
                SELECT id AS idCaja, idUsuario, fechaApertura
                FROM caja
                WHERE CONVERT(date, fecha) = @fechaHoy
                  AND LOWER(LTRIM(RTRIM(ISNULL(estado,'')))) IN ('abierta','abierto','open');
            `);
        const openCajas = openCajasRs.recordset || [];
        const openCajaIds = openCajas.map(c => Number(c.idCaja)).filter(n => n > 0);
        // Lista de IDs para filtrar movimientos_caja (si es vacia usar 0 = sin resultados)
        const inCajaIds = openCajaIds.length > 0 ? openCajaIds.join(',') : '0';

        // Condicion para transacciones: solo de sesiones activas (usuario + fechaApertura)
        // Si no hay cajas abiertas: 1=0 devuelve 0 filas (saldos base del cierre aplican)
        const filtroTransStr = openCajas.length === 0
            ? '1=0'
            : openCajas.map(oc => {
                const idU = Number(oc.idUsuario);
                if (oc.fechaApertura) {
                    const fa = new Date(oc.fechaApertura).toISOString().replace('T', ' ').slice(0, 23);
                    return `(t.idUsuario = ${idU} AND t.fechaTransaccion >= '${fa}')`;
                }
                return `(t.idUsuario = ${idU} AND CONVERT(date, t.fechaTransaccion) = '${fecha}')`;
            }).join(' OR ');

        // ---- 2. Efectivo ----
        const efectivoRs = await pool.request()
            .input("fecha", sql.Date, fecha)
            .query(`
                SELECT
                    -- Base: suma de efectivoInicial de todos los cajeros del dia
                    -- (se actualiza al cerrar, por lo que siempre refleja el cierre mas reciente)
                    ISNULL((SELECT SUM(efectivoInicial) FROM caja_config_apertura WHERE fecha = @fecha), 0) AS efectivoInicial,
                    -- Entradas y salidas de efectivo SOLO de la sesion activa
                    ISNULL((
                        SELECT SUM(CASE
                            WHEN (LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%deposit%'
                                 OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%servicio%'
                                 OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%tarjeta%')
                                AND LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI NOT LIKE '%transferencia%'
                            THEN ISNULL(t.monto,0) ELSE 0 END)
                        FROM transacciones t
                        LEFT JOIN tipo_transaccion tt ON tt.id = t.idTipoTrans
                        WHERE (${filtroTransStr}) AND ISNULL(t.anulado,'') = 'completada'
                    ), 0) AS efectivoEntradas,
                    ISNULL((
                        SELECT SUM(CASE
                            WHEN (LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%retiro%'
                                 OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%remesa%')
                                AND LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI NOT LIKE '%transferencia%'
                            THEN ISNULL(t.monto,0) ELSE 0 END)
                        FROM transacciones t
                        LEFT JOIN tipo_transaccion tt ON tt.id = t.idTipoTrans
                        WHERE (${filtroTransStr}) AND ISNULL(t.anulado,'') = 'completada'
                    ), 0) AS efectivoSalidas,
                    -- Movimientos manuales de efectivo SOLO de sesiones activas
                    ISNULL((SELECT SUM(monto) FROM movimientos_caja
                            WHERE idCaja IN (${inCajaIds}) AND tipo = 'ingreso'
                              AND (modalidad = 'efectivo' OR modalidad IS NULL)), 0) AS movEfectivoIngreso,
                    ISNULL((SELECT SUM(monto) FROM movimientos_caja
                            WHERE idCaja IN (${inCajaIds}) AND tipo = 'egreso'
                              AND (modalidad = 'efectivo' OR modalidad IS NULL)), 0) AS movEfectivoEgreso,
                    -- Totales informativos del dia completo
                    ISNULL((SELECT SUM(monto) FROM movimientos_caja WHERE fecha = @fecha AND tipo = 'ingreso'), 0) AS totalIngresos,
                    ISNULL((SELECT SUM(monto) FROM movimientos_caja WHERE fecha = @fecha AND tipo = 'egreso'), 0) AS totalEgresos;
            `);

        // ---- 3. Saldos por banco ----
        const bancosColsResult = await pool.request().query(`
            SELECT LOWER(COLUMN_NAME) AS nombre
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'bancos';
        `);
        const bancosCols = new Set((bancosColsResult.recordset || []).map((x) => x.nombre));
        const whereBancoActivo = bancosCols.has('estado')
            ? "WHERE ISNULL(CAST(b.estado AS INT), 1) = 1"
            : "";

        const bancosRs = await pool.request()
            .input("fecha", sql.Date, fecha)
            .query(`
                WITH
                -- Transacciones regulares (no transferencia) de la sesion activa
                trans_regular AS (
                    SELECT t.idBanco,
                        SUM(CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%retiro%'
                                      OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%remesa%'
                                 THEN ISNULL(t.monto,0) ELSE 0 END) AS ingreso,
                        SUM(CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%deposit%'
                                      OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%servicio%'
                                      OR LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%tarjeta%'
                                 THEN ISNULL(t.monto,0) ELSE 0 END) AS egreso
                    FROM transacciones t
                    LEFT JOIN tipo_transaccion tt ON tt.id = t.idTipoTrans
                    WHERE (${filtroTransStr})
                      AND ISNULL(t.anulado,'') = 'completada'
                      AND LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI NOT LIKE '%transferencia%'
                    GROUP BY t.idBanco
                ),
                -- Transferencias: banco principal (idBanco) disminuye (egreso)
                trans_transf_salida AS (
                    SELECT t.idBanco, SUM(ISNULL(t.monto,0)) AS egreso
                    FROM transacciones t
                    LEFT JOIN tipo_transaccion tt ON tt.id = t.idTipoTrans
                    WHERE (${filtroTransStr})
                      AND ISNULL(t.anulado,'') = 'completada'
                      AND LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%transferencia%'
                      AND t.idBanco IS NOT NULL
                    GROUP BY t.idBanco
                ),
                -- Transferencias: banco destino (idBancoOrigen) aumenta (ingreso)
                trans_transf_entrada AS (
                    SELECT t.idBancoOrigen AS idBanco, SUM(ISNULL(t.monto,0)) AS ingreso
                    FROM transacciones t
                    LEFT JOIN tipo_transaccion tt ON tt.id = t.idTipoTrans
                    WHERE (${filtroTransStr})
                      AND ISNULL(t.anulado,'') = 'completada'
                      AND LOWER(LTRIM(RTRIM(ISNULL(tt.nombre,'')))) COLLATE Latin1_General_CI_AI LIKE '%transferencia%'
                      AND t.idBancoOrigen IS NOT NULL
                    GROUP BY t.idBancoOrigen
                ),
                -- Movimientos manuales de banco de la sesion activa
                mov_banco AS (
                    SELECT mc.idBanco,
                        SUM(CASE WHEN mc.tipo = 'ingreso' THEN mc.monto ELSE 0 END) AS ingreso,
                        SUM(CASE WHEN mc.tipo = 'egreso'  THEN mc.monto ELSE 0 END) AS egreso
                    FROM movimientos_caja mc
                    WHERE mc.idCaja IN (${inCajaIds})
                      AND mc.modalidad = 'banco'
                      AND mc.idBanco IS NOT NULL
                    GROUP BY mc.idBanco
                )
                SELECT
                    b.id AS idBanco,
                    b.nombre AS banco,
                    -- saldoInicial ya refleja el cierre de la ultima sesion (se actualiza al cerrar)
                    ISNULL(bsg.saldoInicial, 0) AS saldoInicial,
                    ISNULL(tr.ingreso, 0) + ISNULL(tte.ingreso, 0) + ISNULL(mb.ingreso, 0) AS ingresosBanco,
                    ISNULL(tr.egreso, 0)  + ISNULL(tts.egreso, 0)  + ISNULL(mb.egreso, 0)  AS egresosBanco,
                    ISNULL(mb.ingreso, 0) AS ingresosManualBanco,
                    ISNULL(mb.egreso,  0) AS egresosManualBanco,
                    ISNULL(bsg.saldoInicial, 0)
                        + ISNULL(tr.ingreso, 0)  + ISNULL(tte.ingreso, 0) + ISNULL(mb.ingreso, 0)
                        - ISNULL(tr.egreso, 0)   - ISNULL(tts.egreso, 0)  - ISNULL(mb.egreso, 0)
                    AS saldoActual
                FROM bancos b
                LEFT JOIN banco_saldo_global bsg ON bsg.idBanco = b.id AND bsg.fecha = @fecha
                LEFT JOIN trans_regular tr ON tr.idBanco = b.id
                LEFT JOIN trans_transf_salida tts ON tts.idBanco = b.id
                LEFT JOIN trans_transf_entrada tte ON tte.idBanco = b.id
                LEFT JOIN mov_banco mb ON mb.idBanco = b.id
                ${whereBancoActivo}
                ORDER BY b.nombre ASC;
            `);

        const ef = efectivoRs.recordset?.[0] || {};
        const efectivoInicial    = Number(ef.efectivoInicial    || 0);
        const efectivoEntradas   = Number(ef.efectivoEntradas   || 0);
        const efectivoSalidas    = Number(ef.efectivoSalidas    || 0);
        const movEfectivoIngreso = Number(ef.movEfectivoIngreso || 0);
        const movEfectivoEgreso  = Number(ef.movEfectivoEgreso  || 0);
        const totalIngresos      = Number(ef.totalIngresos      || 0);
        const totalEgresos       = Number(ef.totalEgresos       || 0);

        const efectivoActual = efectivoInicial + efectivoEntradas - efectivoSalidas
                             + movEfectivoIngreso - movEfectivoEgreso;

        const detallesBancos = (bancosRs.recordset || []).map((row) => ({
            idBanco: Number(row.idBanco),
            banco: String(row.banco || ''),
            saldoInicial: Number(row.saldoInicial || 0),
            ingresosBanco: Number(row.ingresosBanco || 0),
            egresosBanco: Number(row.egresosBanco || 0),
            ingresosManualBanco: Number(row.ingresosManualBanco || 0),
            egresosManualBanco: Number(row.egresosManualBanco || 0),
            saldoActual: Number(row.saldoActual || 0),
        }));

        const montoBancosActual = detallesBancos.reduce((acc, b) => acc + b.saldoActual, 0);

        return res.json({
            fecha,
            efectivoInicial,
            efectivoEntradas,
            efectivoSalidas,
            totalIngresos,
            totalEgresos,
            efectivoActual,
            montoBancosActual,
            montoGeneral: efectivoActual + montoBancosActual,
            detallesBancos,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error al obtener resumen operativo global.",
            error: error.message,
        });
    }
};

exports.RegistrarMovimiento = async (req, res) => {
    try {
        const { idUsuario, tipo, monto, concepto, subtipoIngreso, fecha, modalidad, idBanco, idCaja } = req.body;

        const idUs = Number(idUsuario);
        if (Number.isNaN(idUs) || idUs <= 0) {
            return res.status(400).json({ message: 'ID de usuario invalido.' });
        }
        if (!['ingreso', 'egreso'].includes(String(tipo))) {
            return res.status(400).json({ message: 'Tipo debe ser ingreso o egreso.' });
        }
        const montoNum = Number(monto);
        if (Number.isNaN(montoNum) || montoNum <= 0) {
            return res.status(400).json({ message: 'Monto invalido.' });
        }

        // modalidad aplica tanto a ingresos como a egresos
        const modalidadStr = ['efectivo', 'banco'].includes(String(modalidad)) ? String(modalidad) : 'efectivo';

        const idBancoNum = idBanco ? Number(idBanco) : null;
        if (modalidadStr === 'banco' && (!idBancoNum || Number.isNaN(idBancoNum) || idBancoNum <= 0)) {
            return res.status(400).json({ message: 'Debe seleccionar un banco cuando la modalidad es banco.' });
        }

        const fechaStr = String(fecha || '').trim() || hondurasFechaHoy();
        const conceptoStr = concepto ? String(concepto).trim().slice(0, 200) : null;
        const subtipoStr = subtipoIngreso ? String(subtipoIngreso).trim().slice(0, 30) : null;

        const pool = await getpool();
        await ensureConfigAperturaTables(pool);

        const idCajaNum = idCaja ? Number(idCaja) : null;

        // Validar que el egreso no deje ningun saldo en negativo
        // Filtrar movimientos_caja por idCaja (sesion actual) cuando este disponible
        const filtroMcBanco    = idCajaNum ? `mc.idCaja = ${idCajaNum} AND mc.idBanco = @idBancoVal` : `mc.fecha = @fechaVal AND mc.idBanco = @idBancoVal`;
        const filtroMcEfectivo = idCajaNum ? `mc.idCaja = ${idCajaNum}` : `mc.fecha = @fechaEf`;

        if (tipo === 'egreso') {
            if (modalidadStr === 'banco') {
                const saldoBancoCheck = await pool.request()
                    .input('idBancoVal', sql.Int, idBancoNum)
                    .input('fechaVal', sql.Date, fechaStr)
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
                                  AND CONVERT(date, t.fechaTransaccion) = @fechaVal
                                  AND ISNULL(t.anulado,'') = 'completada'
                            ), 0)
                            + ISNULL((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE ${filtroMcBanco} AND mc.tipo = 'ingreso' AND mc.modalidad = 'banco'), 0)
                            - ISNULL((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE ${filtroMcBanco} AND mc.tipo = 'egreso'  AND mc.modalidad = 'banco'), 0)
                            AS saldoActual
                        FROM banco_saldo_global bsg
                        WHERE bsg.idBanco = @idBancoVal AND bsg.fecha = @fechaVal;
                    `);
                const saldoActualBanco = Number(saldoBancoCheck.recordset?.[0]?.saldoActual ?? 0);
                if (saldoActualBanco - montoNum < 0) {
                    return res.status(400).json({
                        message: `Saldo insuficiente en el banco. Saldo actual: ${new Intl.NumberFormat('es-HN', { style:'currency', currency:'HNL' }).format(saldoActualBanco)}.`,
                    });
                }
            } else {
                // Efectivo
                const efectivoCheck = await pool.request()
                    .input('idUsEf', sql.Int, idUs)
                    .input('fechaEf', sql.Date, fechaStr)
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
                                  AND CONVERT(date, t.fechaTransaccion) = @fechaEf
                                  AND ISNULL(t.anulado,'') = 'completada'
                            ), 0)
                            + ISNULL((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE ${filtroMcEfectivo} AND mc.tipo = 'ingreso' AND (mc.modalidad = 'efectivo' OR mc.modalidad IS NULL)), 0)
                            - ISNULL((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE ${filtroMcEfectivo} AND mc.tipo = 'egreso'  AND (mc.modalidad = 'efectivo' OR mc.modalidad IS NULL)), 0)
                            AS efectivoActual
                    `);
                const efectivoActualNum = Number(efectivoCheck.recordset?.[0]?.efectivoActual ?? 0);
                if (efectivoActualNum - montoNum < 0) {
                    return res.status(400).json({
                        message: `Efectivo insuficiente. Saldo actual en efectivo: ${new Intl.NumberFormat('es-HN', { style:'currency', currency:'HNL' }).format(efectivoActualNum)}.`,
                    });
                }
            }
        }

        await pool.request()
            .input('idUsuario', sql.Int, idUs)
            .input('tipo', sql.VarChar(10), tipo)
            .input('monto', sql.Decimal(12, 2), montoNum)
            .input('concepto', sql.VarChar(200), conceptoStr)
            .input('subtipoIngreso', sql.VarChar(30), subtipoStr)
            .input('modalidad', sql.VarChar(10), modalidadStr)
            .input('idBanco', sql.Int, modalidadStr === 'banco' ? idBancoNum : null)
            .input('fecha', sql.Date, fechaStr)
            .input('idCaja', sql.Int, idCajaNum)
            .query(`
                INSERT INTO movimientos_caja (idUsuario, tipo, monto, concepto, subtipoIngreso, modalidad, idBanco, fecha, idCaja)
                VALUES (@idUsuario, @tipo, @monto, @concepto, @subtipoIngreso, @modalidad, @idBanco, @fecha, @idCaja)
            `);

        return res.json({ message: 'Movimiento registrado correctamente.' });
    } catch (error) {
        return res.status(500).json({ message: 'Error al registrar movimiento.', error: error.message });
    }
};

exports.ObtenerMovimientos = async (req, res) => {
    try {
        const fecha    = String(req.query?.fecha    || '').trim() || hondurasFechaHoy();
        const tipo     = String(req.query?.tipo     || '').trim().toLowerCase(); // 'ingreso' | 'egreso' | ''
        const idCajaRaw = req.query?.idCaja;
        const idCajaFiltro = idCajaRaw ? Number(idCajaRaw) : null;

        const pool = await getpool();
        await ensureConfigAperturaTables(pool);

        const request = pool.request().input('fecha', sql.Date, fecha);
        const whereExtra = ['ingreso', 'egreso'].includes(tipo)
            ? `AND mc.tipo = '${tipo}'`
            : '';

        // Si se pasa idCaja, filtrar por sesion de caja; sino filtrar por fecha (retrocompatibilidad)
        let whereFechaMov;
        if (idCajaFiltro && !Number.isNaN(idCajaFiltro)) {
            request.input('idCajaFiltro', sql.Int, idCajaFiltro);
            whereFechaMov = 'mc.idCaja = @idCajaFiltro';
        } else {
            whereFechaMov = 'mc.fecha = @fecha';
        }

        const result = await request.query(`
            SELECT
                mc.id,
                mc.idUsuario,
                ISNULL(u.nombre, CAST(mc.idUsuario AS VARCHAR)) AS nombreUsuario,
                mc.tipo,
                mc.monto,
                mc.concepto,
                mc.subtipoIngreso,
                mc.modalidad,
                mc.idBanco,
                ISNULL(b.nombre, NULL) AS nombreBanco,
                mc.fecha,
                mc.fechaRegistro
            FROM movimientos_caja mc
            LEFT JOIN usuarios u  ON u.id  = mc.idUsuario
            LEFT JOIN bancos   b  ON b.id  = mc.idBanco
            WHERE ${whereFechaMov}
            ${whereExtra}
            ORDER BY mc.fechaRegistro DESC;
        `);

        return res.json(result.recordset || []);
    } catch (error) {
        return res.status(500).json({ message: 'Error al obtener movimientos.', error: error.message });
    }
};

exports.EliminarMovimiento = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id) || id <= 0) {
            return res.status(400).json({ message: 'ID de movimiento invalido.' });
        }
        const pool = await getpool();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM movimientos_caja WHERE id = @id');
        if ((result.rowsAffected?.[0] ?? 0) === 0) {
            return res.status(404).json({ message: 'Movimiento no encontrado.' });
        }
        return res.json({ message: 'Movimiento eliminado correctamente.' });
    } catch (error) {
        return res.status(500).json({ message: 'Error al eliminar movimiento.', error: error.message });
    }
};

exports.AbrirTodasCajas = async (req, res) => {
    try {
        const { saldoInicial } = req.body;
        const saldo = Number(saldoInicial ?? 0);

        if (Number.isNaN(saldo) || saldo < 0) {
            return res.status(400).json({ message: "saldoInicial invalido." });
        }

        const pool = await getpool();

        const usuariosResult = await pool.request().query(`
            SELECT id FROM usuarios WHERE ISNULL(estado, 1) = 1;
        `);

        const usuarios = usuariosResult.recordset || [];
        if (usuarios.length === 0) {
            return res.json({ message: "No hay usuarios activos.", abiertos: 0, errores: [] });
        }

        const fechaHoy = hondurasFechaHoy();
        let abiertos = 0;
        const errores = [];

        for (const u of usuarios) {
            try {
                const existente = await pool.request()
                    .input("idUsuario", sql.Int, u.id)
                    .input("fecha", sql.Date, fechaHoy)
                    .query(`
                        SELECT TOP 1 id FROM caja
                        WHERE idUsuario = @idUsuario
                          AND CONVERT(date, fecha) = @fecha
                          AND estado = 'abierta';
                    `);

                if (existente.recordset?.length > 0) {
                    continue;
                }

                const abrirResult = await pool.request()
                    .input("idUsuario", sql.Int, u.id)
                    .input("saldoInicial", sql.Decimal(12, 2), saldo)
                    .execute("sp_AbrirCaja");

                // Guardar fechaApertura para aislar transacciones por sesion de caja
                const nuevaCajaId = Number(abrirResult.recordset?.[0]?.cajaId || 0);
                if (nuevaCajaId > 0) {
                    const fechaAperturaAhora = fechaLocalSql(new Date());
                    await pool.request()
                        .input("idCaja", sql.Int, nuevaCajaId)
                        .input("fechaApertura", sql.VarChar(30), fechaAperturaAhora)
                        .query(`
                            UPDATE caja
                            SET fechaApertura = TRY_CONVERT(datetime, @fechaApertura, 121)
                            WHERE id = @idCaja;
                        `);
                }

                abiertos++;
            } catch (err) {
                const msg = err?.originalError?.info?.message || err.message;
                if (!msg.includes("Ya existe una caja abierta")) {
                    errores.push({ idUsuario: u.id, error: msg });
                }
            }
        }

        return res.status(201).json({
            message: `Cajas abiertas: ${abiertos}`,
            abiertos,
            errores,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error al abrir todas las cajas",
            error: error.message,
        });
    }
};

exports.CerrarTodasCajas = async (req, res) => {
    try {
        const { observacion } = req.body;
        const obs = observacion ? String(observacion).trim() : null;

        const pool = await getpool();

        const cajasResult = await pool.request().query(`
            SELECT id, idUsuario FROM caja
            WHERE estado = 'abierta'
              AND CONVERT(date, fecha) = CONVERT(date, GETDATE());
        `);

        const cajas = cajasResult.recordset || [];
        if (cajas.length === 0) {
            return res.json({ message: "No hay cajas abiertas.", cerrados: 0, errores: [] });
        }

        const fechaCierreTexto = fechaLocalSql(new Date());
        let cerrados = 0;
        const errores = [];

        for (const c of cajas) {
            try {
                await pool.request()
                    .input("idCaja", sql.Int, c.id)
                    .input("idUsuario", sql.Int, c.idUsuario)
                    .input("observacion", sql.VarChar(300), obs)
                    .execute("sp_CerrarCaja");

                await pool.request()
                    .input("idCaja", sql.Int, c.id)
                    .input("fechaCierre", sql.VarChar(30), fechaCierreTexto)
                    .query(`UPDATE caja SET fechaCierre = @fechaCierre WHERE id = @idCaja;`);

                cerrados++;
            } catch (err) {
                errores.push({ idCaja: c.id, idUsuario: c.idUsuario, error: err?.originalError?.info?.message || err.message });
            }
        }

        return res.json({
            message: `Cajas cerradas: ${cerrados}`,
            cerrados,
            errores,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error al cerrar todas las cajas",
            error: error.message,
        });
    }
};
