require("dotenv").config();
const nodemailer = require("nodemailer");

function missingEnvKeys(keys) {
  return keys.filter((key) => !String(process.env[key] || "").trim());
}

async function main() {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];
  const missing = missingEnvKeys(required);

  if (missing.length > 0) {
    console.error(`Faltan variables SMTP: ${missing.join(", ")}`);
    process.exit(1);
  }

  const port = Number(process.env.SMTP_PORT);
  if (!Number.isFinite(port)) {
    console.error("SMTP_PORT no es un numero valido.");
    process.exit(1);
  }

  const secure = String(process.env.SMTP_SECURE || "false").trim().toLowerCase();
  const transporter = nodemailer.createTransport({
    host: String(process.env.SMTP_HOST).trim(),
    port,
    secure: ["1", "true", "yes", "si", "on"].includes(secure),
    auth: {
      user: String(process.env.SMTP_USER).trim(),
      pass: String(process.env.SMTP_PASS).trim(),
    },
  });

  const testRecipient = String(process.env.SMTP_TEST_TO || process.env.SMTP_USER).trim();

  await transporter.verify();

  const info = await transporter.sendMail({
    from: String(process.env.SMTP_FROM).trim(),
    to: testRecipient,
    subject: "Prueba SMTP Gestor Bancario",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2>Prueba de correo</h2>
        <p>La configuracion SMTP del sistema esta funcionando correctamente.</p>
        <p>Fecha: ${new Date().toISOString()}</p>
      </div>
    `,
  });

  console.log("Conexion SMTP verificada.");
  console.log(`Correo de prueba enviado a: ${testRecipient}`);
  console.log(`Message ID: ${info.messageId}`);
}

main().catch((error) => {
  console.error("Error probando SMTP:");
  console.error(error.message || error);
  process.exit(1);
});