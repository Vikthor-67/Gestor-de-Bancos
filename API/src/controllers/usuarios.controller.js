const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { sql, getpool } = require("../config/db");

const ID_CANDIDATES = ["id", "idusuario"];
const LOGIN_CANDIDATES = ["correo", "email", "usuario", "username", "nombre"];
const PASS_CANDIDATES = ["password", "clave", "contrasena", "contrasenia", "passwordhash"];
const ROLE_CANDIDATES = ["rol", "tipousuario", "perfil", "cargo", "tipo"];
const NAME_CANDIDATES = ["nombre", "usuario", "username"];
const EMAIL_CANDIDATES = ["correo", "email"];

const TABLE_SECURITY_PARAMS = "seguridad_parametros";
const TABLE_USER_SECURITY = "usuarios_seguridad";

function sanitizeRole(rawRole) {
  const rol = String(rawRole || "").toLowerCase();
  return rol.includes("admin") ? "admin" : "cajero";
}

function buildStringSelectExpression(alias, columns, fallback = null) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return fallback || "''";
  }

  const expressions = columns.map((column) => `CAST(${alias}.${column} AS VARCHAR(150))`);
  if (expressions.length === 1) {
    return expressions[0];
  }

  return `COALESCE(${expressions.join(", ")})`;
}

function normalizeBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "si", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function buildRandomPassword(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%!";
  const bytes = crypto.randomBytes(length * 2);
  let generated = "";
  for (let i = 0; i < bytes.length && generated.length < length; i += 1) {
    generated += alphabet[bytes[i] % alphabet.length];
  }
  return generated;
}

function generateTemporaryPassword(params) {
  const tempLength = Math.max(params.defaultPasswordLength, params.minLength);
  let tempPassword = buildRandomPassword(tempLength);
  let policyError = validatePasswordPolicy(tempPassword, params);
  let attempts = 0;

  while (policyError && attempts < 5) {
    tempPassword = buildRandomPassword(tempLength + attempts);
    policyError = validatePasswordPolicy(tempPassword, params);
    attempts += 1;
  }

  if (policyError) {
    throw new Error("No se pudo generar una contrasena temporal valida.");
  }

  return tempPassword;
}

function validatePasswordPolicy(password, params) {
  const pass = String(password || "");
  if (pass.length < params.minLength) {
    return `La contrasena debe tener al menos ${params.minLength} caracteres.`;
  }

  if (params.requireUppercase && !/[A-Z]/.test(pass)) {
    return "La contrasena debe incluir al menos una letra mayuscula.";
  }

  if (params.requireLowercase && !/[a-z]/.test(pass)) {
    return "La contrasena debe incluir al menos una letra minuscula.";
  }

  if (params.requireNumber && !/[0-9]/.test(pass)) {
    return "La contrasena debe incluir al menos un numero.";
  }

  if (params.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(pass)) {
    return "La contrasena debe incluir al menos un caracter especial.";
  }

  return null;
}

async function ensureSecurityTables(pool) {
  await pool.request().query(`
    IF OBJECT_ID('${TABLE_SECURITY_PARAMS}', 'U') IS NULL
    BEGIN
      CREATE TABLE ${TABLE_SECURITY_PARAMS} (
        id INT NOT NULL PRIMARY KEY,
        min_length INT NOT NULL DEFAULT 8,
        require_uppercase BIT NOT NULL DEFAULT 1,
        require_lowercase BIT NOT NULL DEFAULT 1,
        require_number BIT NOT NULL DEFAULT 1,
        require_special BIT NOT NULL DEFAULT 1,
        max_failed_attempts INT NOT NULL DEFAULT 5,
        lock_minutes INT NOT NULL DEFAULT 15,
        default_password_length INT NOT NULL DEFAULT 12,
        updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    END;

    IF NOT EXISTS (SELECT 1 FROM ${TABLE_SECURITY_PARAMS} WHERE id = 1)
    BEGIN
      INSERT INTO ${TABLE_SECURITY_PARAMS} (
        id,
        min_length,
        require_uppercase,
        require_lowercase,
        require_number,
        require_special,
        max_failed_attempts,
        lock_minutes,
        default_password_length
      ) VALUES (1, 8, 1, 1, 1, 1, 5, 15, 12);
    END;

    IF OBJECT_ID('${TABLE_USER_SECURITY}', 'U') IS NULL
    BEGIN
      CREATE TABLE ${TABLE_USER_SECURITY} (
        user_id INT NOT NULL PRIMARY KEY,
        must_change_password BIT NOT NULL DEFAULT 0,
        failed_attempts INT NOT NULL DEFAULT 0,
        lock_until DATETIME2 NULL,
        last_password_change DATETIME2 NULL,
        updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    END;
  `);
}

async function getSecurityParams(pool) {
  await ensureSecurityTables(pool);
  const result = await pool.request().query(`
    SELECT TOP 1
      min_length,
      require_uppercase,
      require_lowercase,
      require_number,
      require_special,
      max_failed_attempts,
      lock_minutes,
      default_password_length
    FROM ${TABLE_SECURITY_PARAMS}
    WHERE id = 1;
  `);

  const row = result.recordset?.[0] || {};
  return {
    minLength: toPositiveInt(row.min_length, 8),
    requireUppercase: normalizeBool(row.require_uppercase, true),
    requireLowercase: normalizeBool(row.require_lowercase, true),
    requireNumber: normalizeBool(row.require_number, true),
    requireSpecial: normalizeBool(row.require_special, true),
    maxFailedAttempts: toPositiveInt(row.max_failed_attempts, 5),
    lockMinutes: toPositiveInt(row.lock_minutes, 15),
    defaultPasswordLength: toPositiveInt(row.default_password_length, 12),
  };
}

async function getUserColumns(pool) {
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
  const nameCols = NAME_CANDIDATES.filter((c) => available.has(c));
  const emailCols = EMAIL_CANDIDATES.filter((c) => available.has(c));

  if (!idCol || loginCols.length === 0 || passCols.length === 0) {
    throw new Error("La tabla usuarios no tiene columnas minimas para autenticacion.");
  }

  return {
    available,
    idCol,
    loginCols,
    passCols,
    roleCols,
    nameCols,
    emailCols,
    primaryPassCol: passCols[0],
    primaryRoleCol: roleCols[0] || null,
    primaryNameCol: nameCols[0] || null,
    primaryEmailCol: emailCols[0] || loginCols[0],
  };
}

function buildUserSelectExpressions(columns) {
  const correoExpr = buildStringSelectExpression("u", columns.emailCols, `CAST(u.${columns.loginCols[0]} AS VARCHAR(150))`);

  const nombreExpr = buildStringSelectExpression("u", columns.nameCols, correoExpr);

  const roleExpr = columns.roleCols.length > 0
    ? `COALESCE(${columns.roleCols.map((c) => `CAST(u.${c} AS VARCHAR(100))`).join(", ")}, '')`
    : "''";

  const passExpr = `COALESCE(${columns.passCols.map((c) => `CAST(u.${c} AS VARCHAR(255))`).join(", ")}, '')`;

  return {
    correoExpr,
    nombreExpr,
    roleExpr,
    passExpr,
  };
}

async function findUserByLogin(pool, columns, loginValue) {
  const { correoExpr, nombreExpr, roleExpr, passExpr } = buildUserSelectExpressions(columns);
  const result = await pool
    .request()
    .input("login", sql.VarChar(150), String(loginValue || "").trim())
    .query(`
      SELECT TOP 1
        u.${columns.idCol} AS id,
        ${nombreExpr} AS nombre,
        ${correoExpr} AS correo,
        ${roleExpr} AS rol,
        ${passExpr} AS password
      FROM usuarios u
      WHERE (${columns.loginCols.map((c) => `u.${c} = @login`).join(" OR ")});
    `);

  return result.recordset?.[0] || null;
}

async function findUserById(pool, columns, userId) {
  const { correoExpr, nombreExpr, roleExpr } = buildUserSelectExpressions(columns);
  const result = await pool
    .request()
    .input("id", sql.Int, userId)
    .query(`
      SELECT TOP 1
        u.${columns.idCol} AS id,
        ${nombreExpr} AS nombre,
        ${correoExpr} AS correo,
        ${roleExpr} AS rol
      FROM usuarios u
      WHERE u.${columns.idCol} = @id;
    `);

  return result.recordset?.[0] || null;
}

async function getUserSecurityState(pool, userId) {
  await ensureSecurityTables(pool);
  await pool
    .request()
    .input("userId", sql.Int, userId)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM ${TABLE_USER_SECURITY} WHERE user_id = @userId)
      BEGIN
        INSERT INTO ${TABLE_USER_SECURITY} (user_id, must_change_password, failed_attempts, lock_until)
        VALUES (@userId, 0, 0, NULL);
      END;

      SELECT TOP 1
        must_change_password,
        failed_attempts,
        lock_until,
        last_password_change
      FROM ${TABLE_USER_SECURITY}
      WHERE user_id = @userId;
    `);

  const result = await pool
    .request()
    .input("userId", sql.Int, userId)
    .query(`
      SELECT TOP 1
        must_change_password,
        failed_attempts,
        lock_until,
        last_password_change
      FROM ${TABLE_USER_SECURITY}
      WHERE user_id = @userId;
    `);

  const row = result.recordset?.[0] || {};
  return {
    mustChangePassword: normalizeBool(row.must_change_password, false),
    failedAttempts: Number(row.failed_attempts || 0),
    lockUntil: row.lock_until ? new Date(row.lock_until) : null,
    lastPasswordChange: row.last_password_change ? new Date(row.last_password_change) : null,
  };
}

async function registerFailedAttempt(pool, userId, params) {
  await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("maxFailed", sql.Int, params.maxFailedAttempts)
    .input("lockMinutes", sql.Int, params.lockMinutes)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM ${TABLE_USER_SECURITY} WHERE user_id = @userId)
      BEGIN
        INSERT INTO ${TABLE_USER_SECURITY} (user_id, must_change_password, failed_attempts)
        VALUES (@userId, 0, 0);
      END;

      UPDATE ${TABLE_USER_SECURITY}
      SET
        failed_attempts = failed_attempts + 1,
        lock_until = CASE
          WHEN failed_attempts + 1 >= @maxFailed
            THEN DATEADD(MINUTE, @lockMinutes, SYSDATETIME())
          ELSE lock_until
        END,
        updated_at = SYSDATETIME()
      WHERE user_id = @userId;
    `);
}

async function updateUserCorreo(pool, columns, userId, correo) {
  const emailColumns = columns.emailCols.length > 0 ? columns.emailCols : columns.loginCols;
  if (!emailColumns.length) {
    throw new Error("La tabla usuarios no tiene una columna disponible para correo/login.");
  }

  const assignments = emailColumns.map((column) => `${column} = @correo`).join(", ");

  await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("correo", sql.VarChar(150), String(correo).trim().toLowerCase())
    .query(`
      UPDATE usuarios
      SET ${assignments}
      WHERE ${columns.idCol} = @userId;
    `);
}

async function clearFailedAttempts(pool, userId) {
  await pool
    .request()
    .input("userId", sql.Int, userId)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM ${TABLE_USER_SECURITY} WHERE user_id = @userId)
      BEGIN
        INSERT INTO ${TABLE_USER_SECURITY} (user_id, must_change_password, failed_attempts)
        VALUES (@userId, 0, 0);
      END;

      UPDATE ${TABLE_USER_SECURITY}
      SET failed_attempts = 0,
          lock_until = NULL,
          updated_at = SYSDATETIME()
      WHERE user_id = @userId;
    `);
}

async function updateUserPassword(pool, columns, userId, newPassword, mustChangePassword) {
  await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("password", sql.VarChar(255), String(newPassword))
    .query(`
      UPDATE usuarios
      SET ${columns.primaryPassCol} = @password
      WHERE ${columns.idCol} = @userId;
    `);

  await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("mustChange", sql.Bit, mustChangePassword)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM ${TABLE_USER_SECURITY} WHERE user_id = @userId)
      BEGIN
        INSERT INTO ${TABLE_USER_SECURITY} (user_id, must_change_password, failed_attempts, lock_until)
        VALUES (@userId, @mustChange, 0, NULL);
      END
      ELSE
      BEGIN
        UPDATE ${TABLE_USER_SECURITY}
        SET must_change_password = @mustChange,
            failed_attempts = 0,
            lock_until = NULL,
            last_password_change = CASE WHEN @mustChange = 0 THEN SYSDATETIME() ELSE last_password_change END,
            updated_at = SYSDATETIME()
        WHERE user_id = @userId;
      END;
    `);
}

function getRequesterUserId(req) {
  const raw = req.body?.adminId || req.query?.adminId || req.headers["x-user-id"];
  const userId = Number(raw);
  if (!Number.isFinite(userId) || userId <= 0) {
    return null;
  }
  return Math.floor(userId);
}

async function requireAdmin(req, res, pool, columns) {
  const requesterId = getRequesterUserId(req);
  if (!requesterId) {
    res.status(401).json({ message: "No se pudo validar el usuario administrador." });
    return null;
  }

  const requester = await findUserById(pool, columns, requesterId);
  if (!requester || sanitizeRole(requester.rol) !== "admin") {
    res.status(403).json({ message: "Solo un administrador puede realizar esta accion." });
    return null;
  }

  return requester;
}

function getMailTransporter() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();

  if (!host || !user || !pass || !Number.isFinite(port)) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: normalizeBool(process.env.SMTP_SECURE, false),
    auth: { user, pass },
  });
}

async function sendSecurityEmail({ to, subject, html }) {
  const fromAddress = String(process.env.SMTP_FROM || "").trim();
  if (!fromAddress) {
    console.warn("SMTP_FROM no configurado. Correo omitido para:", to);
    return false;
  }

  const transporter = getMailTransporter();
  if (!transporter) {
    console.warn("SMTP no configurado completamente. Correo omitido para:", to);
    return false;
  }

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
  });

  return true;
}

exports.Login = async (req, res) => {
  try {
    const { correo, password } = req.body || {};

    if (!correo || !password) {
      return res.status(400).json({ message: "Correo y password son obligatorios." });
    }

    const pool = await getpool();
    const columns = await getUserColumns(pool);
    const params = await getSecurityParams(pool);
    const user = await findUserByLogin(pool, columns, correo);

    if (!user) {
      return res.status(401).json({ message: "Credenciales invalidas." });
    }

    const securityState = await getUserSecurityState(pool, Number(user.id));
    if (securityState.lockUntil && securityState.lockUntil.getTime() > Date.now()) {
      return res.status(423).json({
        message: "Usuario temporalmente bloqueado por multiples intentos fallidos.",
      });
    }

    const incomingPassword = String(password);
    const storedPassword = String(user.password || "");
    if (incomingPassword !== storedPassword) {
      await registerFailedAttempt(pool, Number(user.id), params);
      return res.status(401).json({ message: "Credenciales invalidas." });
    }

    await clearFailedAttempts(pool, Number(user.id));
    const refreshedSecurity = await getUserSecurityState(pool, Number(user.id));
    const rol = sanitizeRole(user.rol);

    return res.status(200).json({
      message: "Login correcto",
      usuario: {
        id: Number(user.id),
        nombre: String(user.nombre || "Usuario"),
        correo: String(user.correo || correo),
        rol,
        mustChangePassword: refreshedSecurity.mustChangePassword,
      },
    });
  } catch (error) {
    console.error("Error en login de usuarios:", error);
    return res.status(500).json({ message: "Error interno al iniciar sesion." });
  }
};

exports.ListarUsuarios = async (req, res) => {
  try {
    const pool = await getpool();
    const columns = await getUserColumns(pool);
    const admin = await requireAdmin(req, res, pool, columns);
    if (!admin) {
      return;
    }

    await ensureSecurityTables(pool);
    const { correoExpr, nombreExpr, roleExpr } = buildUserSelectExpressions(columns);
    const result = await pool.request().query(`
      SELECT
        u.${columns.idCol} AS id,
        ${nombreExpr} AS nombre,
        ${correoExpr} AS correo,
        ${roleExpr} AS rol,
        COALESCE(s.must_change_password, 0) AS must_change_password,
        COALESCE(s.failed_attempts, 0) AS failed_attempts,
        s.lock_until AS lock_until
      FROM usuarios u
      LEFT JOIN ${TABLE_USER_SECURITY} s ON s.user_id = u.${columns.idCol}
      ORDER BY ${nombreExpr} ASC;
    `);

    const usuarios = (result.recordset || []).map((row) => ({
      id: Number(row.id),
      nombre: String(row.nombre || "Usuario"),
      correo: String(row.correo || ""),
      rol: sanitizeRole(row.rol),
      mustChangePassword: normalizeBool(row.must_change_password, false),
      failedAttempts: Number(row.failed_attempts || 0),
      lockUntil: row.lock_until || null,
    }));

    return res.json(usuarios);
  } catch (error) {
    return res.status(500).json({ message: "Error listando usuarios.", error: error.message });
  }
};

exports.CrearUsuario = async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    const correo = String(req.body?.correo || "").trim().toLowerCase();
    const rol = sanitizeRole(req.body?.rol || "cajero");

    if (!nombre || !correo) {
      return res.status(400).json({ message: "Nombre y correo son obligatorios." });
    }

    const pool = await getpool();
    const columns = await getUserColumns(pool);
    const admin = await requireAdmin(req, res, pool, columns);
    if (!admin) {
      return;
    }

    const existing = await findUserByLogin(pool, columns, correo);
    if (existing) {
      return res.status(409).json({ message: "Ya existe un usuario con ese correo/login." });
    }

    const params = await getSecurityParams(pool);
    const defaultPassword = generateTemporaryPassword(params);

    const fields = [];
    const values = [];
    const request = pool.request();

    if (columns.primaryNameCol) {
      fields.push(columns.primaryNameCol);
      values.push("@nombre");
      request.input("nombre", sql.VarChar(150), nombre);
    }

    if (columns.primaryEmailCol) {
      fields.push(columns.primaryEmailCol);
      values.push("@correo");
      request.input("correo", sql.VarChar(150), correo);
    }

    if (!fields.some((f) => columns.loginCols.includes(f))) {
      fields.push(columns.loginCols[0]);
      values.push("@login");
      request.input("login", sql.VarChar(150), correo);
    }

    fields.push(columns.primaryPassCol);
    values.push("@password");
    request.input("password", sql.VarChar(255), defaultPassword);

    if (columns.primaryRoleCol) {
      fields.push(columns.primaryRoleCol);
      values.push("@rol");
      request.input("rol", sql.VarChar(50), rol);
    }

    // Agregar fecha de creación
    const fechaCreacionCols = ['fechacreacion', 'created_at', 'fecha'];
    const campoFecha = fechaCreacionCols.find(col => columns.nameToLowerCaseColumnMap?.has(col.toLowerCase()));
    
    if (campoFecha) {
      const actualCol = Array.from(columns.nameToLowerCaseColumnMap.entries())
        .find(([key]) => key === campoFecha.toLowerCase())?.[1];
      
      if (actualCol) {
        fields.push(actualCol);
        values.push("@fechaCreacion");
        request.input("fechaCreacion", sql.DateTime, new Date());
      }
    }

    const result = await request.query(`
      INSERT INTO usuarios (${fields.join(", ")})
      OUTPUT INSERTED.${columns.idCol} AS id
      VALUES (${values.join(", ")});
    `);

    const newUserId = Number(result.recordset?.[0]?.id || 0);
    if (!newUserId) {
      return res.status(500).json({ message: "No se pudo crear el usuario." });
    }

    await updateUserPassword(pool, columns, newUserId, defaultPassword, true);

    const html = `
      <h2>Bienvenido al Gestor Bancario</h2>
      <p>Hola ${nombre}, tu cuenta fue creada por un administrador.</p>
      <p><strong>Usuario:</strong> ${correo}</p>
      <p><strong>Contrasena temporal:</strong> ${defaultPassword}</p>
      <p>Por seguridad deberas cambiar esta contrasena en tu primer ingreso.</p>
    `;

    let mailSent = false;
    try {
      mailSent = await sendSecurityEmail({
        to: correo,
        subject: "Credenciales temporales - Gestor Bancario",
        html,
      });
    } catch (mailError) {
      console.error("No se pudo enviar correo de alta de usuario:", mailError);
      mailSent = false;
    }

    return res.status(201).json({
      message: mailSent
        ? "Usuario creado. La contrasena temporal tambien fue enviada por correo."
        : "Usuario creado. Entrega la contrasena temporal al usuario desde administracion.",
      usuario: {
        id: newUserId,
        nombre,
        correo,
        rol,
        mustChangePassword: true,
      },
      tempPassword: defaultPassword,
      mailSent,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error creando usuario.", error: error.message });
  }
};

exports.CambiarPasswordInicial = async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    const correo = String(req.body?.correo || "").trim();
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Contrasena actual y nueva contrasena son obligatorias." });
    }

    const pool = await getpool();
    const columns = await getUserColumns(pool);
    const params = await getSecurityParams(pool);
    const policyError = validatePasswordPolicy(newPassword, params);
    if (policyError) {
      return res.status(400).json({ message: policyError });
    }

    let user = null;
    if (userId && Number.isFinite(userId)) {
      const userById = await findUserById(pool, columns, userId);
      if (userById?.correo) {
        // findUserById no incluye password; se consulta de nuevo por login para validarla.
        user = await findUserByLogin(pool, columns, userById.correo);
      }
    }

    if (!user && correo) {
      user = await findUserByLogin(pool, columns, correo);
    }

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    if (String(user.password || "") !== currentPassword) {
      return res.status(401).json({ message: "La contrasena actual no es correcta." });
    }

    await updateUserPassword(pool, columns, Number(user.id), newPassword, false);

    return res.json({ message: "Contrasena actualizada correctamente." });
  } catch (error) {
    return res.status(500).json({ message: "Error al cambiar contrasena.", error: error.message });
  }
};

exports.SolicitarResetPassword = async (req, res) => {
  try {
    const correo = String(req.body?.correo || "").trim().toLowerCase();
    if (!correo) {
      return res.status(400).json({ message: "El correo es obligatorio." });
    }

    const pool = await getpool();
    const columns = await getUserColumns(pool);
    const params = await getSecurityParams(pool);
    const user = await findUserByLogin(pool, columns, correo);

    if (!user) {
      return res.json({ message: "Si el correo existe, recibira instrucciones para restablecer su contrasena." });
    }

    const tempPassword = generateTemporaryPassword(params);

    await updateUserPassword(pool, columns, Number(user.id), tempPassword, true);

    const html = `
      <h2>Restablecimiento de contrasena</h2>
      <p>Recibimos una solicitud para restablecer tu acceso.</p>
      <p><strong>Usuario:</strong> ${correo}</p>
      <p><strong>Nueva contrasena temporal:</strong> ${tempPassword}</p>
      <p>En tu siguiente ingreso se te pedira cambiarla obligatoriamente.</p>
    `;

    const mailSent = await sendSecurityEmail({
        to: correo,
        subject: "Restablecimiento de contrasena - Gestor Bancario",
        html,
      }).catch((mailError) => {
        console.error("No se pudo enviar correo de restablecimiento:", mailError);
        return false;
      });

    if (!mailSent) {
      return res.status(503).json({
        message: "La recuperacion automatica por correo no esta disponible. Solicita al administrador un reset de contrasena.",
      });
    }

    return res.json({ message: "Se envio una contrasena temporal al correo del usuario." });
  } catch (error) {
    return res.status(500).json({ message: "Error solicitando reset de contrasena.", error: error.message });
  }
};

exports.ResetPasswordAdmin = async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    if (!userId || !Number.isFinite(userId)) {
      return res.status(400).json({ message: "El usuario a resetear es obligatorio." });
    }

    const pool = await getpool();
    const columns = await getUserColumns(pool);
    const admin = await requireAdmin(req, res, pool, columns);
    if (!admin) {
      return;
    }

    const user = await findUserById(pool, columns, userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    const params = await getSecurityParams(pool);
    const tempPassword = generateTemporaryPassword(params);
    const destination = String(user.correo || "").trim();

    await updateUserPassword(pool, columns, Number(user.id), tempPassword, true);

    let mailSent = false;
    if (destination) {
      const html = `
        <h2>Restablecimiento de contrasena</h2>
        <p>Tu acceso fue restablecido por un administrador.</p>
        <p><strong>Usuario:</strong> ${destination}</p>
        <p><strong>Nueva contrasena temporal:</strong> ${tempPassword}</p>
        <p>En tu siguiente ingreso se te pedira cambiarla obligatoriamente.</p>
      `;

      mailSent = await sendSecurityEmail({
        to: destination,
        subject: "Restablecimiento de contrasena - Gestor Bancario",
        html,
      }).catch((mailError) => {
        console.error("No se pudo enviar correo administrativo de restablecimiento:", mailError);
        return false;
      });
    }

    return res.json({
      message: mailSent
        ? "Contrasena temporal generada y enviada por correo."
        : "Contrasena temporal generada. Entregala directamente al usuario.",
      tempPassword,
      mailSent,
      usuario: {
        id: Number(user.id),
        nombre: String(user.nombre || "Usuario"),
        correo: destination,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Error reseteando contrasena.", error: error.message });
  }
};

exports.ActualizarCorreoUsuario = async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    const correo = String(req.body?.correo || "").trim().toLowerCase();

    if (!userId || !Number.isFinite(userId)) {
      return res.status(400).json({ message: "El usuario a actualizar es obligatorio." });
    }

    if (!correo) {
      return res.status(400).json({ message: "El correo es obligatorio." });
    }

    const pool = await getpool();
    const columns = await getUserColumns(pool);
    const admin = await requireAdmin(req, res, pool, columns);
    if (!admin) {
      return;
    }

    const user = await findUserById(pool, columns, userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    const existing = await findUserByLogin(pool, columns, correo);
    if (existing && Number(existing.id) !== userId) {
      return res.status(409).json({ message: "Ya existe otro usuario con ese correo/login." });
    }

    await updateUserCorreo(pool, columns, userId, correo);

    return res.json({
      message: "Correo actualizado correctamente.",
      usuario: {
        id: userId,
        nombre: String(user.nombre || "Usuario"),
        correo,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Error actualizando correo.", error: error.message });
  }
};

exports.ObtenerParametrosSeguridad = async (req, res) => {
  try {
    const pool = await getpool();
    const columns = await getUserColumns(pool);
    const admin = await requireAdmin(req, res, pool, columns);
    if (!admin) {
      return;
    }

    const params = await getSecurityParams(pool);
    return res.json(params);
  } catch (error) {
    return res.status(500).json({ message: "Error obteniendo parametros de seguridad.", error: error.message });
  }
};

exports.ActualizarParametrosSeguridad = async (req, res) => {
  try {
    const pool = await getpool();
    const columns = await getUserColumns(pool);
    const admin = await requireAdmin(req, res, pool, columns);
    if (!admin) {
      return;
    }

    const minLength = toPositiveInt(req.body?.minLength, 8);
    const maxFailedAttempts = toPositiveInt(req.body?.maxFailedAttempts, 5);
    const lockMinutes = toPositiveInt(req.body?.lockMinutes, 15);
    const defaultPasswordLength = toPositiveInt(req.body?.defaultPasswordLength, 12);
    const requireUppercase = normalizeBool(req.body?.requireUppercase, true);
    const requireLowercase = normalizeBool(req.body?.requireLowercase, true);
    const requireNumber = normalizeBool(req.body?.requireNumber, true);
    const requireSpecial = normalizeBool(req.body?.requireSpecial, true);

    if (minLength < 6 || minLength > 64) {
      return res.status(400).json({ message: "La longitud minima debe estar entre 6 y 64." });
    }

    if (maxFailedAttempts < 3 || maxFailedAttempts > 20) {
      return res.status(400).json({ message: "Los intentos maximos deben estar entre 3 y 20." });
    }

    if (lockMinutes < 1 || lockMinutes > 240) {
      return res.status(400).json({ message: "Los minutos de bloqueo deben estar entre 1 y 240." });
    }

    if (defaultPasswordLength < minLength || defaultPasswordLength > 64) {
      return res.status(400).json({ message: "La longitud de contrasena temporal debe ser >= minima y <= 64." });
    }

    await ensureSecurityTables(pool);
    await pool
      .request()
      .input("minLength", sql.Int, minLength)
      .input("requireUppercase", sql.Bit, requireUppercase)
      .input("requireLowercase", sql.Bit, requireLowercase)
      .input("requireNumber", sql.Bit, requireNumber)
      .input("requireSpecial", sql.Bit, requireSpecial)
      .input("maxFailedAttempts", sql.Int, maxFailedAttempts)
      .input("lockMinutes", sql.Int, lockMinutes)
      .input("defaultPasswordLength", sql.Int, defaultPasswordLength)
      .query(`
        UPDATE ${TABLE_SECURITY_PARAMS}
        SET
          min_length = @minLength,
          require_uppercase = @requireUppercase,
          require_lowercase = @requireLowercase,
          require_number = @requireNumber,
          require_special = @requireSpecial,
          max_failed_attempts = @maxFailedAttempts,
          lock_minutes = @lockMinutes,
          default_password_length = @defaultPasswordLength,
          updated_at = SYSDATETIME()
        WHERE id = 1;
      `);

    return res.json({ message: "Parametros de seguridad actualizados correctamente." });
  } catch (error) {
    return res.status(500).json({ message: "Error actualizando parametros de seguridad.", error: error.message });
  }
};
