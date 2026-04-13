const router = require("express").Router();
const controller = require("../controllers/servicios.controller");

router.get("/", controller.ListarServicios);
router.post("/", controller.CrearServicio);
router.put("/:id", controller.ActualizarServicio);
router.patch("/:id/estado", controller.CambiarEstadoServicio);
router.delete("/:id", controller.EliminarServicio);

module.exports = router;
