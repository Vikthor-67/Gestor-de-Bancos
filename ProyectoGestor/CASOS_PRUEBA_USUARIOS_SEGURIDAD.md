# Casos de Prueba - Usuarios y Seguridad

Proyecto: Gestor de Bancos

Modulo: Gestion de usuarios, autenticacion y seguridad

Version: ____________________

Fecha: ____________________

Responsable QA: ____________________

## Alcance

Este documento cubre:

- Creacion de usuarios por administrador.
- Envio de password temporal por correo.
- Cambio obligatorio de password en primer ingreso.
- Recuperacion de password por olvido.
- Parametros de seguridad y su aplicacion.
- Bloqueo por intentos fallidos.
- Restricciones por rol.

## Datos base sugeridos

- Admin valido: admin@gestor.hn
- Usuario nuevo: cajero.prueba.01@dominio.com
- Rol usuario nuevo: cajero
- Password nueva valida de ejemplo: PruebaSegura#2026

## Estados

- Ejecutado: Si / No
- Resultado: Aprobado / Rechazado
- Severidad (si falla): Baja / Media / Alta / Critica

## Plantilla de evidencia

- Evidencia: captura, video, log, correo recibido, respuesta API.

## Casos de prueba

### CP-001 - Acceso de admin a pantalla de usuarios

Objetivo:

Validar que solo administrador puede entrar a administracion de usuarios.

Precondiciones:

- Existe usuario admin activo.
- Existe usuario no admin activo.

Pasos:

1. Iniciar sesion como admin.
2. Navegar a pantalla de usuarios.
3. Cerrar sesion.
4. Iniciar sesion como usuario no admin.
5. Intentar navegar a pantalla de usuarios.

Resultado esperado:

- Admin accede correctamente.
- No admin es redirigido o bloqueado.

Prioridad: Alta

Ejecucion:

- Ejecutado: ______
- Resultado: ______
- Evidencia: ____________________
- Observaciones: ____________________

---

### CP-002 - Creacion de usuario por admin

Objetivo:

Validar alta de usuario solo por administrador.

Precondiciones:

- Sesion activa de admin.

Pasos:

1. Ir a pantalla de usuarios.
2. Ingresar nombre, correo y rol.
3. Presionar crear usuario.

Resultado esperado:

- Usuario creado en sistema.
- Se muestra confirmacion de creacion.

Prioridad: Alta

Ejecucion:

- Ejecutado: ______
- Resultado: ______
- Evidencia: ____________________
- Observaciones: ____________________

---

### CP-003 - Envio de password temporal por correo al crear usuario

Objetivo:

Validar envio de credenciales temporales al correo del nuevo usuario.

Precondiciones:

- SMTP configurado.
- Usuario creado desde CP-002.

Pasos:

1. Revisar bandeja de entrada del correo del nuevo usuario.
2. Buscar correo de credenciales temporales.

Resultado esperado:

- Llega correo con password temporal.
- Mensaje indica cambio obligatorio en primer ingreso.

Prioridad: Alta

Ejecucion:

- Ejecutado: ______
- Resultado: ______
- Evidencia: ____________________
- Observaciones: ____________________

---

### CP-004 - Cambio obligatorio de password en primer ingreso

Objetivo:

Validar redireccion obligatoria a cambio de password al usar clave temporal.

Precondiciones:

- Usuario tiene password temporal activa.

Pasos:

1. Iniciar sesion con usuario nuevo y password temporal.
2. Verificar ruta mostrada.
3. Intentar entrar a otras rutas.

Resultado esperado:

- Redireccion a pantalla de cambio de password.
- No permite operar modulos hasta completar el cambio.

Prioridad: Critica

Ejecucion:

- Ejecutado: ______
- Resultado: ______
- Evidencia: ____________________
- Observaciones: ____________________

---

### CP-005 - Cambio de password exitoso tras primer ingreso

Objetivo:

Validar que el usuario puede actualizar su password temporal y continuar.

Precondiciones:

- Usuario en pantalla de cambio obligatorio.

Pasos:

1. Ingresar password temporal actual.
2. Ingresar nueva password valida.
3. Confirmar nueva password.
4. Guardar.

Resultado esperado:

- Password actualizada correctamente.
- Usuario accede a su ruta normal segun rol.

Prioridad: Critica

Ejecucion:

- Ejecutado: ______
- Resultado: ______
- Evidencia: ____________________
- Observaciones: ____________________

---

### CP-006 - Recuperacion de password por olvido

Objetivo:

Validar flujo de olvide mi password.

Precondiciones:

- Usuario existente con correo valido.

Pasos:

1. Ir a login.
2. Seleccionar opcion olvide mi password.
3. Ingresar correo del usuario.
4. Confirmar solicitud.

Resultado esperado:

- Sistema procesa solicitud sin error.
- Mensaje de confirmacion mostrado.

Prioridad: Alta

Ejecucion:

- Ejecutado: ______
- Resultado: ______
- Evidencia: ____________________
- Observaciones: ____________________

---

### CP-007 - Envio de nueva password temporal tras recuperacion

Objetivo:

Validar que recuperacion envia nueva clave temporal.

Precondiciones:

- Solicitud de recuperacion ejecutada en CP-006.

Pasos:

1. Revisar correo del usuario.
2. Confirmar recepcion de nueva password temporal.

Resultado esperado:

- Llega correo con clave temporal nueva.
- Se informa cambio obligatorio en siguiente ingreso.

Prioridad: Alta

Ejecucion:

- Ejecutado: ______
- Resultado: ______
- Evidencia: ____________________
- Observaciones: ____________________

---

### CP-008 - Cambio obligatorio posterior a recuperacion

Objetivo:

Validar que password temporal por recuperacion tambien obliga cambio.

Precondiciones:

- Usuario tiene clave temporal por recuperacion.

Pasos:

1. Iniciar sesion con clave temporal de recuperacion.
2. Verificar comportamiento de navegacion.

Resultado esperado:

- Redireccion forzada a cambio de password.

Prioridad: Critica

Ejecucion:

- Ejecutado: ______
- Resultado: ______
- Evidencia: ____________________
- Observaciones: ____________________

---

### CP-009 - Actualizacion de parametros de seguridad por admin

Objetivo:

Validar que admin puede editar politica de seguridad.

Precondiciones:

- Sesion activa de admin.

Pasos:

1. Ir a pantalla de usuarios.
2. Cambiar parametros de seguridad.
3. Guardar.

Resultado esperado:

- Parametros guardados correctamente.
- Persisten al recargar pantalla.

Prioridad: Alta

Ejecucion:

- Ejecutado: ______
- Resultado: ______
- Evidencia: ____________________
- Observaciones: ____________________

---

### CP-010 - Validacion de politica al cambiar password

Objetivo:

Validar rechazo de password que no cumple politica.

Precondiciones:

- Politica activa con reglas estrictas.

Pasos:

1. Intentar cambiar password con una no valida.
2. Intentar cambiar password con una valida.

Resultado esperado:

- Password invalida se rechaza con mensaje claro.
- Password valida se acepta.

Prioridad: Alta

Ejecucion:

- Ejecutado: ______
- Resultado: ______
- Evidencia: ____________________
- Observaciones: ____________________

---

### CP-011 - Bloqueo por intentos fallidos

Objetivo:

Validar bloqueo temporal al exceder intentos permitidos.

Precondiciones:

- Usuario activo.
- Parametro de intentos maximos definido.

Pasos:

1. Intentar login con password incorrecta hasta superar limite.
2. Intentar login nuevamente.

Resultado esperado:

- Usuario queda bloqueado temporalmente.
- Sistema informa estado de bloqueo.

Prioridad: Critica

Ejecucion:

- Ejecutado: ______
- Resultado: ______
- Evidencia: ____________________
- Observaciones: ____________________

---

### CP-012 - Desbloqueo tras ventana de tiempo

Objetivo:

Validar que el bloqueo expira segun configuracion.

Precondiciones:

- Usuario bloqueado por CP-011.

Pasos:

1. Esperar tiempo de bloqueo configurado.
2. Intentar login con credenciales correctas.

Resultado esperado:

- Usuario recupera acceso despues del tiempo definido.

Prioridad: Media

Ejecucion:

- Ejecutado: ______
- Resultado: ______
- Evidencia: ____________________
- Observaciones: ____________________

---

## Criterio de aceptacion general

- Todos los casos de prioridad critica y alta deben quedar aprobados.
- Ningun caso critico puede quedar rechazado.

## Resumen de ejecucion

- Total casos: 12
- Aprobados: ______
- Rechazados: ______
- No ejecutados: ______
- Resultado final: [ ] Aprobado [ ] Rechazado

## Firmas

QA: ____________________

Lider tecnico: ____________________

Fecha cierre: ____________________
