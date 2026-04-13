const router = require("express").Router();
const controller = require("../controllers/caja.controller");

router.get("/config-apertura/:idUsuario", controller.ObtenerConfigApertura);
router.get("/saldos-por-banco/:idUsuario", controller.SaldosActualesPorBanco);
router.get("/resumen-operativo/:idUsuario", controller.ResumenOperativoCaja);router.get("/resumen-global",                controller.ResumenOperativoGlobal);router.post("/movimiento",                   controller.RegistrarMovimiento);router.get("/movimientos",                   controller.ObtenerMovimientos);router.delete("/movimiento/:id",             controller.EliminarMovimiento);router.post("/config-apertura", controller.GuardarConfigApertura);
router.get("/hoy/:idUsuario", controller.CajaHoyPorUsuario);
router.get("/corte/ultimo/:idUsuario", controller.UltimoCortePorUsuario);
router.get("/actividad-reciente",            controller.ActividadReciente);
router.get("/historial-cerradas", controller.HistorialCajasCerradas);
router.get("/historial-cerradas/:id", controller.DetalleCajaCerrada);
router.post("/abrir", controller.AbrirCaja);
router.post("/cerrar", controller.CerrarCaja);
router.post("/abrir-todas", controller.AbrirTodasCajas);
router.post("/cerrar-todas", controller.CerrarTodasCajas);

module.exports = router;


//POST /api/caja/abrir
//POST /api/caja/cerrar