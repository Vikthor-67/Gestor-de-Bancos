const { sql, getpool } = require("../config/db");

async function getServiciosColumns(pool) {
  const colsResult = await pool.request().query(`
    SELECT LOWER(COLUMN_NAME) AS nombre
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'servicios';
  `);

  return new Set((colsResult.recordset || []).map((x) => x.nombre));
}

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

function getTipoNormalizado(tipo) {
  const value = String(tipo || "").trim().toLowerCase();
  if (value === "publico" || value === "privado") {
    return value;
  }
  return null;
}

function normalizeServicio(row) {
  return {
    id: Number(row?.id || 0),
    nombre: String(row?.nombre || ""),
    tipo: row?.tipo ? String(row.tipo).toLowerCase() : "publico",
    descripcion: row?.descripcion ?? null,
    estado: toBool(row?.estado, true),
  };
}

exports.ListarServicios = async (req, res) => {
  try {
    const pool = await getpool();
    const cols = await getServiciosColumns(pool);
    const request = pool.request();

    const tipo = cols.has("tipo") ? getTipoNormalizado(req.query?.tipo) : null;

    const includeInactivos = toBool(req.query?.includeInactivos, false);
    const whereClauses = [];
    if (tipo && cols.has("tipo")) {
      request.input("tipo", sql.VarChar(20), tipo);
      whereClauses.push("LOWER(ISNULL(tipo, '')) = @tipo");
    }

    if (cols.has("estado") && !includeInactivos) {
      whereClauses.push("COALESCE(estado, 1) = 1");
    }

    const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const selectFields = ["id", "nombre"];
    if (cols.has("tipo")) {
      selectFields.push("COALESCE(tipo, 'publico') AS tipo");
    } else {
      selectFields.push("'publico' AS tipo");
    }
    if (cols.has("descripcion")) {
      selectFields.push("descripcion");
    } else {
      selectFields.push("NULL AS descripcion");
    }
    if (cols.has("estado")) {
      selectFields.push("COALESCE(estado, 1) AS estado");
    } else {
      selectFields.push("CAST(1 AS BIT) AS estado");
    }

    const result = await request.query(`
      SELECT ${selectFields.join(",\n             ")}
      FROM servicios
      ${where}
      ORDER BY nombre;
    `);

    const rows = (result.recordset || []).map(normalizeServicio);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({
      message: "Error listando servicios",
      error: error.message,
    });
  }
};

exports.CambiarEstadoServicio = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "ID de servicio invalido." });
    }

    const estado = toBool(req.body?.estado, true);

    const pool = await getpool();
    const cols = await getServiciosColumns(pool);
    if (!cols.has("estado")) {
      return res.status(400).json({ message: "La tabla servicios no tiene columna estado." });
    }

    const request = pool
      .request()
      .input("id", sql.Int, id)
      .input("estado", sql.Bit, estado);

    const result = await request.query(`
      UPDATE servicios
      SET estado = @estado
      WHERE id = @id;

      SELECT @@ROWCOUNT AS affected;
    `);

    const affected = Number(result.recordset?.[0]?.affected || 0);
    if (affected === 0) {
      return res.status(404).json({ message: "Servicio no encontrado." });
    }

    return res.json({ message: estado ? "Servicio habilitado correctamente" : "Servicio deshabilitado correctamente" });
  } catch (error) {
    return res.status(500).json({
      message: "Error actualizando estado del servicio",
      error: error.message,
    });
  }
};

exports.CrearServicio = async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    const tipo = getTipoNormalizado(req.body?.tipo);
    const descripcion = req.body?.descripcion ? String(req.body.descripcion).trim() : null;
    const estado = toBool(req.body?.estado, true);

    if (!nombre) {
      return res.status(400).json({
        message: "Nombre es obligatorio.",
      });
    }

    const pool = await getpool();
    const cols = await getServiciosColumns(pool);

    if (cols.has("tipo") && !tipo) {
      return res.status(400).json({
        message: "Tipo es obligatorio.",
      });
    }

    const fields = ["nombre"];
    const values = ["@nombre"];
    const request = pool.request().input("nombre", sql.VarChar(120), nombre);

    if (cols.has("tipo")) {
      fields.push("tipo");
      values.push("@tipo");
      request.input("tipo", sql.VarChar(20), tipo || "publico");
    }
    if (cols.has("descripcion")) {
      fields.push("descripcion");
      values.push("@descripcion");
      request.input("descripcion", sql.VarChar(300), descripcion);
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
      INSERT INTO servicios (${fields.join(", ")})
      OUTPUT INSERTED.id AS id
      VALUES (${values.join(", ")});
    `);

    return res.status(201).json({
      message: "Servicio creado correctamente",
      id: Number(result.recordset?.[0]?.id || 0),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creando servicio",
      error: error.message,
    });
  }
};

exports.ActualizarServicio = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "ID de servicio invalido." });
    }

    const nombre = String(req.body?.nombre || "").trim();
    const tipo = getTipoNormalizado(req.body?.tipo);
    const descripcion = req.body?.descripcion ? String(req.body.descripcion).trim() : null;
    const estado = toBool(req.body?.estado, true);

    if (!nombre) {
      return res.status(400).json({
        message: "Nombre es obligatorio.",
      });
    }

    const pool = await getpool();
    const cols = await getServiciosColumns(pool);

    if (cols.has("tipo") && !tipo) {
      return res.status(400).json({
        message: "Tipo es obligatorio.",
      });
    }

    const setClauses = ["nombre = @nombre"];
    const request = pool
      .request()
      .input("id", sql.Int, id)
      .input("nombre", sql.VarChar(120), nombre);

    if (cols.has("tipo")) {
      setClauses.push("tipo = @tipo");
      request.input("tipo", sql.VarChar(20), tipo || "publico");
    }
    if (cols.has("descripcion")) {
      setClauses.push("descripcion = @descripcion");
      request.input("descripcion", sql.VarChar(300), descripcion);
    }
    if (cols.has("estado")) {
      setClauses.push("estado = @estado");
      request.input("estado", sql.Bit, estado);
    }

    const result = await request.query(`
      UPDATE servicios
      SET ${setClauses.join(",\n          ")}
      WHERE id = @id;

      SELECT @@ROWCOUNT AS affected;
    `);

    const affected = Number(result.recordset?.[0]?.affected || 0);
    if (affected === 0) {
      return res.status(404).json({ message: "Servicio no encontrado." });
    }

    return res.json({ message: "Servicio actualizado correctamente" });
  } catch (error) {
    return res.status(500).json({
      message: "Error actualizando servicio",
      error: error.message,
    });
  }
};

exports.EliminarServicio = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "ID de servicio invalido." });
    }

    const pool = await getpool();
    const request = pool.request().input("id", sql.Int, id);

    const result = await request.query(`
      DELETE FROM servicios
      WHERE id = @id;

      SELECT @@ROWCOUNT AS affected;
    `);

    const affected = Number(result.recordset?.[0]?.affected || 0);
    if (affected === 0) {
      return res.status(404).json({ message: "Servicio no encontrado." });
    }

    return res.json({ message: "Servicio eliminado correctamente" });
  } catch (error) {
    // SQL Server FK violation (The DELETE statement conflicted with the REFERENCE constraint)
    if (Number(error?.number) === 547) {
      return res.status(409).json({
        message: "No se puede eliminar el servicio porque tiene registros relacionados.",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Error eliminando servicio",
      error: error.message,
    });
  }
};
