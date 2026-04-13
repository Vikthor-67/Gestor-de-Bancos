const router = require("express").Router();
const controller = require("../controllers/catalogos.controller");

router.get("/bancos", controller.ListarBancos);
router.get("/tipos-transaccion", controller.ListarTiposTransaccion);
router.get("/servicios", controller.ListarServicios);
router.get("/usuarios", controller.ListarUsuarios);

module.exports = router;
