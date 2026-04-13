const router = require("express").Router();
const controller = require("../controllers/transacciones.controller");

router.get("/", controller.ListarTransacciones);
router.get("/resumen", controller.ResumenPorBanco);
router.get("/resumen-comisiones", controller.ResumenComisionesMetricas);
router.get("/:id", controller.ObtenerTransaccionPorId);
router.post("/", controller.InsertarTransaccion);
router.put("/:id", controller.ActualizarTransaccion);

module.exports = router;
