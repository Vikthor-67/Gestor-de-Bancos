const { sql, getpool } = require("../config/db");

function toBool(value, fallback = true) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return value !== 0;
    }

    const normalized = String(value).trim().toLowerCase();
    if (["true", "1", "si", "yes", "activo"].includes(normalized)) {
        return true;
    }
    if (["false", "0", "no", "inactivo"].includes(normalized)) {
        return false;
    }

    return fallback;
}

function toNullableNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const num = Number(value);
    return Number.isNaN(num) ? null : num;
}

exports.ListarComisiones = async (req, res) => {
    try {
        const pool = await getpool();
        const result = await pool.request().query(`
            SELECT
                cc.id,
                cc.idBanco,
                cc.idTipoTrans,
                COALESCE(b.nombre, 'Todos los bancos') AS banco,
                COALESCE(tt.nombre, 'Todos los tipos') AS tipoTransaccion,
                cc.comisionFija,
                cc.comisionPorcentaje,
                cc.montoMinimo,
                cc.montoMaximo,
                cc.esDefault,
                cc.estado,
                cc.fechaCreacion
            FROM configuracion_comisiones cc
            LEFT JOIN bancos b ON cc.idBanco = b.id
            LEFT JOIN tipo_transaccion tt ON cc.idTipoTrans = tt.id
            ORDER BY cc.esDefault DESC, b.nombre, tt.nombre;
        `);

        return res.json(result.recordset || []);
    } catch (error) {
        return res.status(500).json({
            message: "Error listando comisiones",
            error: error.message,
        });
    }
};

exports.GuardarComision = async (req, res) => {
    try {
        const idBanco = toNullableNumber(req.body?.idBanco);
        const idTipoTrans = toNullableNumber(req.body?.idTipoTrans);
        const comisionFija = Number(req.body?.comisionFija ?? 0);
        const comisionPorcentaje = Number(req.body?.comisionPorcentaje ?? 0);
        const montoMinimo = Number(req.body?.montoMinimo ?? 0);
        const montoMaximo = toNullableNumber(req.body?.montoMaximo);
        const esDefault = toBool(req.body?.esDefault, false);
        const estado = toBool(req.body?.estado, true);

        if (
            Number.isNaN(comisionFija) ||
            Number.isNaN(comisionPorcentaje) ||
            Number.isNaN(montoMinimo) ||
            (montoMaximo !== null && Number.isNaN(montoMaximo))
        ) {
            return res.status(400).json({
                message: "Valores invalidos para comision o montos.",
            });
        }

        if (montoMaximo !== null && montoMaximo < montoMinimo) {
            return res.status(400).json({
                message: "montoMaximo no puede ser menor a montoMinimo.",
            });
        }

        const pool = await getpool();
        const existe = await pool
            .request()
            .input("idBanco", sql.Int, idBanco)
            .input("idTipoTrans", sql.Int, idTipoTrans)
            .query(`
                SELECT TOP 1 id
                FROM configuracion_comisiones
                WHERE (idBanco = @idBanco OR (idBanco IS NULL AND @idBanco IS NULL))
                  AND (idTipoTrans = @idTipoTrans OR (idTipoTrans IS NULL AND @idTipoTrans IS NULL));
            `);

        const request = pool
            .request()
            .input("idBanco", sql.Int, idBanco)
            .input("idTipoTrans", sql.Int, idTipoTrans)
            .input("comisionFija", sql.Decimal(10, 2), comisionFija)
            .input("comisionPorcentaje", sql.Decimal(6, 4), comisionPorcentaje)
            .input("montoMinimo", sql.Decimal(12, 2), montoMinimo)
            .input("montoMaximo", sql.Decimal(12, 2), montoMaximo)
            .input("esDefault", sql.Bit, esDefault)
            .input("estado", sql.Bit, estado);

        if (existe.recordset?.[0]?.id) {
            request.input("id", sql.Int, Number(existe.recordset[0].id));
            await request.query(`
                UPDATE configuracion_comisiones
                SET comisionFija = @comisionFija,
                    comisionPorcentaje = @comisionPorcentaje,
                    montoMinimo = @montoMinimo,
                    montoMaximo = @montoMaximo,
                    esDefault = @esDefault,
                    estado = @estado
                WHERE id = @id;
            `);

            return res.json({
                message: "Comision actualizada correctamente",
                id: Number(existe.recordset[0].id),
            });
        }

        const inserted = await request.query(`
            INSERT INTO configuracion_comisiones
                (idBanco, idTipoTrans, comisionFija, comisionPorcentaje, montoMinimo, montoMaximo, esDefault, estado)
            OUTPUT INSERTED.id AS id
            VALUES
                (@idBanco, @idTipoTrans, @comisionFija, @comisionPorcentaje, @montoMinimo, @montoMaximo, @esDefault, @estado);
        `);

        return res.status(201).json({
            message: "Comision creada correctamente",
            id: Number(inserted.recordset?.[0]?.id || 0),
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error guardando comision",
            error: error.message,
        });
    }
};

exports.ActualizarComisionPorId = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id) || id <= 0) {
            return res.status(400).json({ message: "ID invalido." });
        }

        const idBanco = toNullableNumber(req.body?.idBanco);
        const idTipoTrans = toNullableNumber(req.body?.idTipoTrans);
        const comisionFija = Number(req.body?.comisionFija ?? 0);
        const comisionPorcentaje = Number(req.body?.comisionPorcentaje ?? 0);
        const montoMinimo = Number(req.body?.montoMinimo ?? 0);
        const montoMaximo = toNullableNumber(req.body?.montoMaximo);
        const esDefault = toBool(req.body?.esDefault, false);
        const estado = toBool(req.body?.estado, true);

        if (
            Number.isNaN(comisionFija) ||
            Number.isNaN(comisionPorcentaje) ||
            Number.isNaN(montoMinimo) ||
            (montoMaximo !== null && Number.isNaN(montoMaximo))
        ) {
            return res.status(400).json({
                message: "Valores invalidos para comision o montos.",
            });
        }

        if (montoMaximo !== null && montoMaximo < montoMinimo) {
            return res.status(400).json({
                message: "montoMaximo no puede ser menor a montoMinimo.",
            });
        }

        const pool = await getpool();
        const existe = await pool
            .request()
            .input("id", sql.Int, id)
            .query(`
                SELECT TOP 1 id
                FROM configuracion_comisiones
                WHERE id = @id;
            `);

        if (!existe.recordset?.[0]?.id) {
            return res.status(404).json({ message: "Configuracion no encontrada." });
        }

        await pool
            .request()
            .input("id", sql.Int, id)
            .input("idBanco", sql.Int, idBanco)
            .input("idTipoTrans", sql.Int, idTipoTrans)
            .input("comisionFija", sql.Decimal(10, 2), comisionFija)
            .input("comisionPorcentaje", sql.Decimal(6, 4), comisionPorcentaje)
            .input("montoMinimo", sql.Decimal(12, 2), montoMinimo)
            .input("montoMaximo", sql.Decimal(12, 2), montoMaximo)
            .input("esDefault", sql.Bit, esDefault)
            .input("estado", sql.Bit, estado)
            .query(`
                UPDATE configuracion_comisiones
                SET idBanco = @idBanco,
                    idTipoTrans = @idTipoTrans,
                    comisionFija = @comisionFija,
                    comisionPorcentaje = @comisionPorcentaje,
                    montoMinimo = @montoMinimo,
                    montoMaximo = @montoMaximo,
                    esDefault = @esDefault,
                    estado = @estado
                WHERE id = @id;
            `);

        return res.json({
            message: "Comision actualizada correctamente",
            id,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error actualizando comision",
            error: error.message,
        });
    }
};

exports.CambiarEstadoComision = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const estado = toBool(req.body?.estado, true);

        if (Number.isNaN(id) || id <= 0) {
            return res.status(400).json({ message: "ID invalido." });
        }

        const result = await (await getpool())
            .request()
            .input("id", sql.Int, id)
            .input("estado", sql.Bit, estado)
            .query(`
                UPDATE configuracion_comisiones
                SET estado = @estado
                WHERE id = @id;

                SELECT @@ROWCOUNT AS affected;
            `);

        if (!Number(result.recordset?.[0]?.affected || 0)) {
            return res.status(404).json({ message: "Configuracion no encontrada." });
        }

        return res.json({ message: "Estado actualizado correctamente" });
    } catch (error) {
        return res.status(500).json({
            message: "Error actualizando estado de comision",
            error: error.message,
        });
    }
};

exports.ReporteComisiones = async (req, res) => {
    try {
        // mes: YYYY-MM (default: mes actual en Honduras)
        const tz = 'America/Tegucigalpa';
        const ahora = new Date();
        const partsHoy = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(ahora);
        const g = (t) => partsHoy.find(x => x.type === t)?.value ?? '00';
        const mesDefault = `${g('year')}-${g('month')}`;
        const mes = String(req.query?.mes || mesDefault).trim().slice(0, 7);

        if (!/^\d{4}-\d{2}$/.test(mes)) {
            return res.status(400).json({ message: "Parametro mes invalido. Use formato YYYY-MM." });
        }

        const [anio, numMes] = mes.split('-').map(Number);
        const primerDia = `${mes}-01`;
        const ultimoDia = new Date(anio, numMes, 0).getDate();
        const ultimoDiaStr = `${mes}-${String(ultimoDia).padStart(2, '0')}`;

        const pool = await getpool();

        // Detectar columna de fecha en transacciones
        const colsResult = await pool.request().query(`
            SELECT LOWER(COLUMN_NAME) AS nombre FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'transacciones';
        `);
        const hasFechaTransaccion = (colsResult.recordset || []).some(x => x.nombre === 'fechatransaccion');
        const colFecha = hasFechaTransaccion ? 'fechaTransaccion' : 'fechaTransaccion';

        // Reporte por dia
        const porDia = await pool.request()
            .input('desde', sql.Date, primerDia)
            .input('hasta', sql.Date, ultimoDiaStr)
            .query(`
                SELECT
                    CONVERT(VARCHAR(10), CONVERT(DATE, t.${colFecha}), 23) AS fecha,
                    COUNT(*) AS numTransacciones,
                    SUM(ISNULL(t.comision, 0)) AS totalComisiones
                FROM transacciones t
                WHERE CONVERT(DATE, t.${colFecha}) BETWEEN @desde AND @hasta
                  AND ISNULL(t.anulado, '') NOT IN ('anulada', 'anulado')
                GROUP BY CONVERT(DATE, t.${colFecha})
                ORDER BY fecha ASC;
            `);

        // Acumulado hasta cada dia del mes
        const dias = (porDia.recordset || []);
        let acumulado = 0;
        const detalleDias = dias.map(row => {
            acumulado += Number(row.totalComisiones || 0);
            return {
                fecha: String(row.fecha || ''),
                numTransacciones: Number(row.numTransacciones || 0),
                totalComisiones: Number(row.totalComisiones || 0),
                acumuladoMes: Number(acumulado.toFixed(2)),
            };
        });

        const totalMes = Number(acumulado.toFixed(2));

        return res.json({ mes, totalMes, dias: detalleDias });
    } catch (error) {
        return res.status(500).json({
            message: "Error generando reporte de comisiones",
            error: error.message,
        });
    }
};

exports.CalcularComision = async (req, res) => {
    try {
        const idBanco = Number(req.query?.idBanco);
        const idTipoTrans = Number(req.query?.idTipoTrans);
        const monto = Number(req.query?.monto);

        if (Number.isNaN(idBanco) || Number.isNaN(idTipoTrans) || Number.isNaN(monto)) {
            return res.status(400).json({
                message: "Parametros invalidos. Envie idBanco, idTipoTrans y monto.",
            });
        }

        const result = await (await getpool())
            .request()
            .input("idBanco", sql.Int, idBanco)
            .input("idTipoTrans", sql.Int, idTipoTrans)
            .input("monto", sql.Decimal(12, 2), monto)
            .query(`
                SELECT CAST(dbo.fn_ObtenerComision(@idBanco, @idTipoTrans, @monto) AS DECIMAL(10,2)) AS comision;
            `);

        const comision = Number(result.recordset?.[0]?.comision || 0);
        return res.json({ comision });
    } catch (error) {
        return res.status(500).json({
            message: "Error calculando comision",
            error: error.message,
        });
    }
};
