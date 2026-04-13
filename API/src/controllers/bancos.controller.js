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

async function getBancosColumns(pool) {
  const colsResult = await pool.request().query(`
    SELECT LOWER(COLUMN_NAME) AS nombre
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'bancos';
  `);

  return new Set((colsResult.recordset || []).map((x) => x.nombre));
}

function normalizeBanco(row) {
  return {
    id: Number(row?.id || 0),
    nombre: String(row?.nombre || ""),
    codigo: String(row?.codigo || ""),
    telefono: row?.telefono ?? null,
    logo: row?.logo ?? null,
    estado: toBool(row?.estado, true),
  };
}

exports.ListarBancos = async (req, res) => {
  try {
    const pool = await getpool();
    const cols = await getBancosColumns(pool);
    const includeInactivosRaw = String(req.query?.includeInactivos || "").trim().toLowerCase();
    const includeInactivos = ["1", "true", "si", "yes"].includes(includeInactivosRaw);

    const selectFields = ["id", "nombre"];
    if (cols.has("codigo")) {
      selectFields.push("codigo");
    } else {
      selectFields.push("'' AS codigo");
    }

    if (cols.has("telefono")) {
      selectFields.push("telefono");
    } else {
      selectFields.push("NULL AS telefono");
    }

    if (cols.has("logo")) {
      selectFields.push("logo");
    } else {
      selectFields.push("NULL AS logo");
    }

    if (cols.has("estado")) {
      selectFields.push("COALESCE(estado, 1) AS estado");
    } else {
      selectFields.push("CAST(1 AS BIT) AS estado");
    }

    const where = cols.has("estado") && !includeInactivos ? "WHERE COALESCE(estado, 1) = 1" : "";

    const result = await pool.request().query(`
      SELECT ${selectFields.join(",\n             ")}
      FROM bancos
      ${where}
      ORDER BY nombre;
    `);

    return res.json((result.recordset || []).map(normalizeBanco));
  } catch (error) {
    return res.status(500).json({
      message: "Error listando bancos",
      error: error.message,
    });
  }
};

exports.CrearBanco = async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    const codigo = String(req.body?.codigo || "").trim();
    const telefono = req.body?.telefono ? String(req.body.telefono).trim() : null;
    const logo = req.body?.logo ? String(req.body.logo).trim() : null;
    const estado = toBool(req.body?.estado, true);

    if (!nombre) {
      return res.status(400).json({ message: "Nombre es obligatorio." });
    }

    const pool = await getpool();
    const cols = await getBancosColumns(pool);

    const fields = ["nombre"];
    const values = ["@nombre"];
    const request = pool.request().input("nombre", sql.VarChar(150), nombre);

    if (cols.has("codigo") && !codigo) {
      return res.status(400).json({ message: "Codigo es obligatorio." });
    }

    if (cols.has("codigo")) {
      fields.push("codigo");
      values.push("@codigo");
      request.input("codigo", sql.VarChar(50), codigo || "");
    }
    if (cols.has("telefono")) {
      fields.push("telefono");
      values.push("@telefono");
      request.input("telefono", sql.VarChar(50), telefono);
    }
    if (cols.has("logo")) {
      fields.push("logo");
      values.push("@logo");
      request.input("logo", sql.VarChar(300), logo);
    }
    if (cols.has("estado")) {
      fields.push("estado");
      values.push("@estado");
      request.input("estado", sql.Bit, estado);
    }

    // Agregar fecha de creación
    const fechaCreacionCols = ['fechacreacion', 'created_at', 'fecha'];
    const campoFecha = fechaCreacionCols.find(col => cols.has(col));
    
    if (campoFecha) {
      fields.push(campoFecha);
      values.push("@fechaCreacion");
      request.input("fechaCreacion", sql.DateTime, new Date());
    }

    const result = await request.query(`
      INSERT INTO bancos (${fields.join(", ")})
      OUTPUT INSERTED.id AS id
      VALUES (${values.join(", ")});
    `);

    return res.status(201).json({
      message: "Banco creado correctamente",
      id: Number(result.recordset?.[0]?.id || 0),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creando banco",
      error: error.message,
    });
  }
};

exports.ActualizarBanco = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "ID de banco invalido." });
    }

    const nombre = String(req.body?.nombre || "").trim();
    const codigo = String(req.body?.codigo || "").trim();
    const telefono = req.body?.telefono ? String(req.body.telefono).trim() : null;
    const logo = req.body?.logo ? String(req.body.logo).trim() : null;
    const estado = toBool(req.body?.estado, true);

    if (!nombre) {
      return res.status(400).json({ message: "Nombre es obligatorio." });
    }

    const pool = await getpool();
    const cols = await getBancosColumns(pool);
    const setClauses = ["nombre = @nombre"];
    const request = pool.request().input("id", sql.Int, id).input("nombre", sql.VarChar(150), nombre);

    if (cols.has("codigo") && !codigo) {
      return res.status(400).json({ message: "Codigo es obligatorio." });
    }

    if (cols.has("codigo")) {
      setClauses.push("codigo = @codigo");
      request.input("codigo", sql.VarChar(50), codigo || "");
    }
    if (cols.has("telefono")) {
      setClauses.push("telefono = @telefono");
      request.input("telefono", sql.VarChar(50), telefono);
    }
    if (cols.has("logo")) {
      setClauses.push("logo = @logo");
      request.input("logo", sql.VarChar(300), logo);
    }
    if (cols.has("estado")) {
      setClauses.push("estado = @estado");
      request.input("estado", sql.Bit, estado);
    }

    const result = await request.query(`
      UPDATE bancos
      SET ${setClauses.join(",\n          ")}
      WHERE id = @id;

      SELECT @@ROWCOUNT AS affected;
    `);

    const affected = Number(result.recordset?.[0]?.affected || 0);
    if (affected === 0) {
      return res.status(404).json({ message: "Banco no encontrado." });
    }

    return res.json({ message: "Banco actualizado correctamente" });
  } catch (error) {
    return res.status(500).json({
      message: "Error actualizando banco",
      error: error.message,
    });
  }
};

exports.DesactivarBanco = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "ID de banco invalido." });
    }

    const pool = await getpool();
    const cols = await getBancosColumns(pool);

    if (!cols.has("estado")) {
      return res.status(400).json({
        message: "La tabla bancos no tiene columna estado para activar/desactivar.",
      });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        UPDATE bancos
        SET estado = 0
        WHERE id = @id;

        SELECT @@ROWCOUNT AS affected;
      `);

    const affected = Number(result.recordset?.[0]?.affected || 0);
    if (affected === 0) {
      return res.status(404).json({ message: "Banco no encontrado." });
    }

    return res.json({ message: "Banco desactivado correctamente" });
  } catch (error) {
    return res.status(500).json({
      message: "Error desactivando banco",
      error: error.message,
    });
  }
};

exports.ActivarBanco = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "ID de banco invalido." });
    }

    const pool = await getpool();
    const cols = await getBancosColumns(pool);

    if (!cols.has("estado")) {
      return res.status(400).json({
        message: "La tabla bancos no tiene columna estado para activar/desactivar.",
      });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        UPDATE bancos
        SET estado = 1
        WHERE id = @id;

        SELECT @@ROWCOUNT AS affected;
      `);

    const affected = Number(result.recordset?.[0]?.affected || 0);
    if (affected === 0) {
      return res.status(404).json({ message: "Banco no encontrado." });
    }

    return res.json({ message: "Banco activado correctamente" });
  } catch (error) {
    return res.status(500).json({
      message: "Error activando banco",
      error: error.message,
    });
  }
};
