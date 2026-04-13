const express = require("express");
const cors = require("cors");

const transaccionesRoutes = require("./routes/transacciones.routes");
const cajaRoutes = require("./routes/caja.routes");
const catalogosRoutes = require("./routes/catalogos.routes");
const usuariosRoutes = require("./routes/usuarios.routes");
const serviciosRoutes = require("./routes/servicios.routes");
const bancosRoutes = require("./routes/bancos.routes");
const comisionesRoutes = require("./routes/comisiones.routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.get("/", (req, res) => {
	res.json({ ok: true, message: "API Gestor de Bancos funcionando correctamente" });
});

app.use("/api/transacciones", transaccionesRoutes);
app.use("/api/caja", cajaRoutes);
app.use("/api/catalogos", catalogosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/servicios", serviciosRoutes);
app.use("/api/bancos", bancosRoutes);
app.use("/api/comisiones", comisionesRoutes);

module.exports = app;
