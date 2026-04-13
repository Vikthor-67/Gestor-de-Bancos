const router = require("express").Router();
const controller = require("../controllers/usuarios.controller");

router.post("/login", controller.Login);
router.get("/", controller.ListarUsuarios);
router.post("/", controller.CrearUsuario);
router.post("/cambiar-password", controller.CambiarPasswordInicial);
router.post("/forgot-password", controller.SolicitarResetPassword);
router.post("/reset-password", controller.ResetPasswordAdmin);
router.put("/correo", controller.ActualizarCorreoUsuario);
router.get("/seguridad/parametros", controller.ObtenerParametrosSeguridad);
router.put("/seguridad/parametros", controller.ActualizarParametrosSeguridad);

module.exports = router;
