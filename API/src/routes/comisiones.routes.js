const router = require("express").Router();
const controller = require("../controllers/comisiones.controller");

router.get("/", controller.ListarComisiones);
router.get("/reporte", controller.ReporteComisiones);
router.get("/calcular", controller.CalcularComision);
router.post("/", controller.GuardarComision);
router.put("/:id", controller.ActualizarComisionPorId);
router.patch("/:id/estado", controller.CambiarEstadoComision);

module.exports = router;
