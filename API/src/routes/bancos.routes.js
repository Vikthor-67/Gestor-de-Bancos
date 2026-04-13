const router = require("express").Router();
const controller = require("../controllers/bancos.controller");

router.get("/", controller.ListarBancos);
router.post("/", controller.CrearBanco);
router.put("/:id", controller.ActualizarBanco);
router.patch("/:id/activar", controller.ActivarBanco);
router.delete("/:id", controller.DesactivarBanco);

module.exports = router;
