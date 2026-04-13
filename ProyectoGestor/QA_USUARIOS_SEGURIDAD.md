# Hoja de Resultados QA - Usuarios y Seguridad

Fecha de prueba: ____________________

Probador: ____________________

Ambiente: ____________________

Version app/API: ____________________

## Datos de prueba

- Admin existente: admin@gestor.hn
- Usuario nuevo: cajero.prueba.01@dominio.com
- Rol nuevo usuario: cajero
- Password final esperada: PruebaSegura#2026

## Configuracion previa

- SMTP configurado en API: [ ] Si  [ ] No
- API encendida: [ ] Si  [ ] No
- App encendida: [ ] Si  [ ] No
- Admin funcional: [ ] Si  [ ] No

## Matriz de resultados

| Paso | Accion | Resultado esperado | Obtenido | Estado | Evidencia |
| --- | --- | --- | --- | --- | --- |
| 1 | Iniciar sesion como admin | Acceso correcto con usuario administrador |  | [ ] OK [ ] FAIL |  |
| 2 | Entrar a pantalla de usuarios | Solo admin puede verla |  | [ ] OK [ ] FAIL |  |
| 3 | Crear usuario Cajero Prueba 01 | Usuario creado correctamente |  | [ ] OK [ ] FAIL |  |
| 4 | Verificar envio de correo | Llega correo con password temporal |  | [ ] OK [ ] FAIL |  |
| 5 | Cerrar sesion admin | Sale de la sesion correctamente |  | [ ] OK [ ] FAIL |  |
| 6 | Iniciar sesion con usuario nuevo | Login exitoso con password temporal |  | [ ] OK [ ] FAIL |  |
| 7 | Validar primer ingreso | Redireccion obligatoria a cambiar password |  | [ ] OK [ ] FAIL |  |
| 8 | Cambiar password temporal | Password actualizada correctamente |  | [ ] OK [ ] FAIL |  |
| 9 | Validar acceso normal | Entra a ruta normal de cajero |  | [ ] OK [ ] FAIL |  |
| 10 | Cerrar sesion del nuevo usuario | Sale correctamente |  | [ ] OK [ ] FAIL |  |
| 11 | Usar olvide mi password | El sistema acepta la solicitud |  | [ ] OK [ ] FAIL |  |
| 12 | Verificar nuevo correo | Llega nuevo correo con password temporal |  | [ ] OK [ ] FAIL |  |
| 13 | Iniciar sesion con password reseteada | Login exitoso |  | [ ] OK [ ] FAIL |  |
| 14 | Validar cambio obligatorio tras reset | Vuelve a pedir cambio de password |  | [ ] OK [ ] FAIL |  |
| 15 | Entrar como admin y editar politica | Guarda parametros de seguridad |  | [ ] OK [ ] FAIL |  |
| 16 | Probar password invalida | Backend rechaza por politica |  | [ ] OK [ ] FAIL |  |
| 17 | Probar intentos fallidos | Bloquea al usuario segun politica |  | [ ] OK [ ] FAIL |  |
| 18 | Validar restriccion de creacion | Usuario no admin no puede crear usuarios |  | [ ] OK [ ] FAIL |  |

## Politica probada

- Longitud minima: __________
- Requiere mayuscula: [ ] Si  [ ] No
- Requiere minuscula: [ ] Si  [ ] No
- Requiere numero: [ ] Si  [ ] No
- Requiere caracter especial: [ ] Si  [ ] No
- Intentos maximos: __________
- Minutos de bloqueo: __________
- Longitud password temporal: __________

## Incidencias encontradas

| ID | Descripcion | Severidad | Paso relacionado | Estado |
| --- | --- | --- | --- | --- |
| 1 |  |  |  |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |

## Observaciones finales

- Flujo de creacion de usuarios: __________________________________________
- Flujo de correo: __________________________________________
- Flujo de cambio de password: __________________________________________
- Flujo de reset: __________________________________________
- Flujo de politicas de seguridad: __________________________________________

## Aprobacion

- Resultado general: [ ] Aprobado  [ ] Rechazado
- Nombre responsable: ____________________
- Firma o validacion: ____________________