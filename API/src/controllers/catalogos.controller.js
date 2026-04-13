const { getpool } = require("../config/db");

exports.ListarBancos = async (req, res) => {
    try {
        const pool = await getpool();
        const result = await pool.request().query(`
            SELECT id, nombre
            FROM bancos
            ORDER BY nombre;
        `);

        res.json(result.recordset || []);
    } catch (error) {
        res.status(500).json({
            message: "Error listando bancos",
            error: error.message,
        });
    }
};

exports.ListarTiposTransaccion = async (req, res) => {
    try {
        const pool = await getpool();
        const result = await pool.request().query(`
            SELECT id, nombre
            FROM tipo_transaccion
            ORDER BY nombre;
        `);

        res.json(result.recordset || []);
    } catch (error) {
        res.status(500).json({
            message: "Error listando tipos de transaccion",
            error: error.message,
        });
    }
};

exports.ListarServicios = async (req, res) => {
    try {
        const pool = await getpool();
        const result = await pool.request().query(`
            SELECT id, nombre
            FROM servicios
            WHERE COALESCE(estado, 1) = 1
            ORDER BY nombre;
        `);

        res.json(result.recordset || []);
    } catch (error) {
        res.status(500).json({
            message: "Error listando servicios",
            error: error.message,
        });
    }
};

exports.ListarUsuarios = async (req, res) => {
    try {
        const pool = await getpool();
        const result = await pool.request().query(`
            SELECT id,
                   COALESCE(nombre, CAST(id AS VARCHAR(20))) AS nombre
            FROM usuarios
            ORDER BY nombre;
        `);

        res.json(result.recordset || []);
    } catch (error) {
        res.status(500).json({
            message: "Error listando usuarios",
            error: error.message,
        });
    }
};
