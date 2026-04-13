const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, PageBreak, TableOfContents,
  LevelFormat, convertInchesToTwip
} = require('docx');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '..', 'MANUAL_TECNICO.docx');

const headingStyle = (level) => ({
  heading: HeadingLevel[level],
  spacing: { after: 200, before: 300 },
});

const createParagraph = (text, options = {}) => {
  return new Paragraph({
    children: [new TextRun({ text, ...options.runOptions })],
    heading: options.heading,
    alignment: options.alignment || AlignmentType.LEFT,
    spacing: { after: options.afterSpacing || 200, before: options.beforeSpacing || 0 },
    indent: options.indent ? { left: convertInchesToTwip(options.indent) } : undefined,
  });
};

const createBullet = (text, level = 0) => {
  return new Paragraph({
    children: [new TextRun({ text })],
    bullet: { level },
    spacing: { after: 100 },
  });
};

const createTable = (headers, rows, widths = []) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map((h, i) => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
          width: widths[i] ? { size: widths[i], type: WidthType.PERCENTAGE } : undefined,
          shading: { fill: "E0E0E0" },
        })),
      }),
      ...rows.map(row => new TableRow({
        children: row.map(cell => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: String(cell) })] })],
          width: { size: 100 / row.length, type: WidthType.PERCENTAGE },
        })),
      })),
    ],
  });
};

const doc = new Document({
  creator: "Gestor de Bancos - Grupo 3",
  title: "Manual Técnico",
  description: "Manual Técnico del Proyecto Gestor de Bancos",
  styles: {
    paragraphStyles: [
      {
        id: "Normal",
        name: "Normal",
        run: { font: "Calibri", size: 22 },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(1),
          right: convertInchesToTwip(1),
          bottom: convertInchesToTwip(1),
          left: convertInchesToTwip(1),
        },
      },
    },
    children: [
      // PORTADA
      new Paragraph({ spacing: { after: 600 } }),
      new Paragraph({
        children: [new TextRun({ text: "MANUAL TÉCNICO", bold: true, size: 72, color: "1F4E79" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Gestor de Bancos", bold: true, size: 48, color: "2E75B6" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Universidad Tecnológica de Honduras", size: 28 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({ spacing: { after: 200 } }),
      new Paragraph({
        children: [new TextRun({ text: "INTEGRANTES DEL PROYECTO", bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Santiago Johnatan Chavarria Cruz - 202210110208", size: 22 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Victor Manuel Tercero Padilla - 202130110061", size: 22 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Wilmer Mc.Veigh Zalavarria Carvajal - 202210110009", size: 22 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Programación Móvil II", size: 28 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Catedrático: Kevin Josue Manzanarez Auceda", size: 22, italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Versión 1.0.0 - Abril 2026", size: 24, italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
      }),

      // PAGE BREAK
      new Paragraph({ children: [new PageBreak()] }),

      // ÍNDICE
      new Paragraph({
        children: [new TextRun({ text: "TABLA DE CONTENIDOS", bold: true, size: 32, color: "1F4E79" })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 300 },
      }),

      ...[
        "1. Descripción General",
        "2. Arquitectura del Sistema",
        "3. Requisitos del Sistema",
        "4. Estructura del Proyecto",
        "5. Configuración e Instalación",
        "6. API REST - Endpoints",
        "7. Base de Datos",
        "8. Funcionalidades Principales",
        "9. Seguridad",
        "10. Módulos del Frontend",
      ].map(item => createBullet(item)),

      new Paragraph({ children: [new PageBreak()] }),

      // SECCIÓN 1
      new Paragraph({
        children: [new TextRun({ text: "1. DESCRIPCIÓN GENERAL", bold: true, size: 32, color: "1F4E79" })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 300 },
      }),

      new Paragraph({
        children: [new TextRun({ text: "1.1 Resumen del Proyecto", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }),
      createParagraph("Gestor de Bancos es una aplicación móvil híbrida diseñada para gestionar operaciones bancarias de una red de agencias/cajeros. Permite realizar transacciones financieras (depósitos, retiros, remesas, pagos de servicios), gestionar caja diaria, configurar comisiones y administrar usuarios con diferentes roles."),

      new Paragraph({
        children: [new TextRun({ text: "1.2 Tecnologías Utilizadas", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }),
      createTable(
        ["Capa", "Tecnología", "Versión"],
        [
          ["Frontend Móvil", "Ionic Framework", "8.0.0"],
          ["Frontend", "Angular", "20.0.0"],
          ["Backend", "Node.js / Express", "5.2.1"],
          ["Base de Datos", "SQL Server", "-"],
          ["ORM", "mssql", "12.2.1"],
          ["Correo", "Nodemailer", "6.10.1"],
          ["Capacitor", "Capacitor Core", "8.3.0"],
        ],
        [30, 40, 30]
      ),

      new Paragraph({
        children: [new TextRun({ text: "1.3 Roles del Sistema", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createTable(
        ["Rol", "Descripción", "Permisos"],
        [
          ["admin", "Administrador del sistema", "Gestión de usuarios, bancos, servicios, comisiones, reportes globales"],
          ["cajero", "Operador de caja", "Transacciones, apertura/cierre de caja, consulta de saldos"],
        ],
        [20, 40, 40]
      ),

      new Paragraph({ children: [new PageBreak()] }),

      // SECCIÓN 2
      new Paragraph({
        children: [new TextRun({ text: "2. ARQUITECTURA DEL SISTEMA", bold: true, size: 32, color: "1F4E79" })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 300 },
      }),

      new Paragraph({
        children: [new TextRun({ text: "2.1 Diagrama de Arquitectura", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }),
      createParagraph("El sistema sigue una arquitectura cliente-servidor de tres capas:"),
      createBullet("Capa de Presentación: Aplicación móvil Ionic/Angular"),
      createBullet("Capa de Negocio: API REST Express.js"),
      createBullet("Capa de Datos: SQL Server"),

      new Paragraph({
        children: [new TextRun({ text: "2.2 Modelo de Comunicación", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createBullet("Protocolo: HTTP/REST sobre JSON"),
      createBullet("Comunicación móvil: CapacitorHttp"),
      createBullet("Formato de fecha: ISO 8601 con zona horaria Honduras (America/Tegucigalpa)"),

      // SECCIÓN 3
      new Paragraph({
        children: [new TextRun({ text: "3. REQUISITOS DEL SISTEMA", bold: true, size: 32, color: "1F4E79" })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 600, after: 300 },
      }),

      new Paragraph({
        children: [new TextRun({ text: "3.1 Requisitos del Servidor", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }),
      createTable(
        ["Componente", "Requisito Mínimo"],
        [
          ["CPU", "2 cores"],
          ["RAM", "4 GB"],
          ["Almacenamiento", "10 GB"],
          ["Sistema Operativo", "Windows Server 2016+ / Linux"],
          ["Node.js", "v18+"],
          ["SQL Server", "2016+"],
        ],
        [40, 60]
      ),

      new Paragraph({
        children: [new TextRun({ text: "3.2 Requisitos del Cliente Móvil", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createTable(
        ["Componente", "Requisito"],
        [
          ["Sistema Operativo", "Android 6.0+ / iOS 12+"],
          ["RAM", "2 GB mínimo"],
          ["Almacenamiento", "100 MB"],
          ["Permisos", "Cámara, Geolocalización, Internet"],
        ],
        [40, 60]
      ),

      new Paragraph({ children: [new PageBreak()] }),

      // SECCIÓN 4
      new Paragraph({
        children: [new TextRun({ text: "4. ESTRUCTURA DEL PROYECTO", bold: true, size: 32, color: "1F4E79" })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 300 },
      }),

      new Paragraph({
        children: [new TextRun({ text: "4.1 Vista General", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }),
      createParagraph("El proyecto se divide en dos componentes principales:"),
      createBullet("API: Backend Node.js/Express en carpeta /API"),
      createBullet("ProyectoGestor: Frontend Ionic/Angular en carpeta /ProyectoGestor"),

      new Paragraph({
        children: [new TextRun({ text: "4.2 Estructura del Backend (API)", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createBullet("app.js - Configuración principal de Express"),
      createBullet("server.js - Punto de entrada del servidor"),
      createBullet("config/db.js - Configuración de conexión SQL Server"),
      createBullet("controllers/ - Lógica de negocio (6 controladores)"),
      createBullet("routes/ - Definición de rutas API"),

      new Paragraph({
        children: [new TextRun({ text: "4.3 Estructura del Frontend (Ionic)", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createBullet("login/ - Página de autenticación"),
      createBullet("dashboard/ - Panel principal"),
      createBullet("transacciones/ - Gestión de transacciones"),
      createBullet("caja/ - Control de caja"),
      createBullet("usuarios/ - Administración de usuarios"),
      createBullet("models/ - Modelos TypeScript"),
      createBullet("services/ - Servicios Angular"),
      createBullet("guards/ - Guards de autenticación"),

      // SECCIÓN 5
      new Paragraph({
        children: [new TextRun({ text: "5. CONFIGURACIÓN E INSTALACIÓN", bold: true, size: 32, color: "1F4E79" })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 600, after: 300 },
      }),

      new Paragraph({
        children: [new TextRun({ text: "5.1 Configuración del Entorno (.env)", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }),
      createParagraph("Ubicación: API/.env"),
      createParagraph("Variables principales:"),
      createBullet("PORT=3001"),
      createBullet("DB_USER, DB_PASSWORD, DB_SERVER, DB_DATABASE"),
      createBullet("SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS"),

      new Paragraph({
        children: [new TextRun({ text: "5.2 Instalación del Backend", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createParagraph("cd API"),
      createParagraph("npm install"),
      createParagraph("npm run dev (desarrollo) o npm start (producción)"),

      new Paragraph({
        children: [new TextRun({ text: "5.3 Instalación del Frontend", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createParagraph("cd ProyectoGestor"),
      createParagraph("npm install"),
      createParagraph("npm start (desarrollo)"),
      createParagraph("npm run build && npx cap sync android (Android)"),

      new Paragraph({ children: [new PageBreak()] }),

      // SECCIÓN 6
      new Paragraph({
        children: [new TextRun({ text: "6. API REST - ENDPOINTS", bold: true, size: 32, color: "1F4E79" })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 300 },
      }),

      new Paragraph({
        children: [new TextRun({ text: "6.1 Autenticación", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }),
      createTable(
        ["Método", "Endpoint", "Descripción"],
        [
          ["POST", "/api/usuarios/login", "Autentica usuario"],
          ["POST", "/api/usuarios/olvide-password", "Solicita restablecimiento"],
          ["PUT", "/api/usuarios/cambiar-password", "Cambia contraseña"],
        ],
        [20, 40, 40]
      ),

      new Paragraph({
        children: [new TextRun({ text: "6.2 Transacciones", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createTable(
        ["Método", "Endpoint", "Descripción"],
        [
          ["GET", "/api/transacciones", "Lista transacciones"],
          ["GET", "/api/transacciones/:id", "Obtiene transacción"],
          ["POST", "/api/transacciones", "Registra transacción"],
          ["PUT", "/api/transacciones/:id", "Actualiza transacción"],
          ["GET", "/api/transacciones/resumen", "Resumen por banco"],
          ["GET", "/api/transacciones/resumen-comisiones", "Métricas comisiones"],
        ],
        [20, 40, 40]
      ),

      new Paragraph({
        children: [new TextRun({ text: "6.3 Gestión de Caja", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createTable(
        ["Método", "Endpoint", "Descripción"],
        [
          ["POST", "/api/caja/abrir", "Abre caja"],
          ["POST", "/api/caja/cerrar", "Cierra caja"],
          ["GET", "/api/caja/hoy/:idUsuario", "Caja del día"],
          ["GET", "/api/caja/saldos-por-banco/:idUsuario", "Saldos por banco"],
          ["GET", "/api/caja/resumen-operativo/:idUsuario", "Resumen operativo"],
        ],
        [20, 40, 40]
      ),

      new Paragraph({
        children: [new TextRun({ text: "6.4 Bancos", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createTable(
        ["Método", "Endpoint", "Descripción"],
        [
          ["GET", "/api/bancos", "Lista bancos"],
          ["POST", "/api/bancos", "Crea banco"],
          ["PUT", "/api/bancos/:id", "Actualiza banco"],
          ["PUT", "/api/bancos/:id/desactivar", "Desactiva banco"],
          ["PUT", "/api/bancos/:id/activar", "Activa banco"],
        ],
        [20, 40, 40]
      ),

      new Paragraph({
        children: [new TextRun({ text: "6.5 Códigos de Respuesta HTTP", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createTable(
        ["Código", "Significado"],
        [
          ["200", "OK - Solicitud exitosa"],
          ["201", "Created - Recurso creado"],
          ["400", "Bad Request - Datos inválidos"],
          ["401", "Unauthorized - No autenticado"],
          ["403", "Forbidden - Sin permisos"],
          ["404", "Not Found - Recurso no encontrado"],
          ["422", "Unprocessable Entity - Validación fallida"],
          ["423", "Locked - Usuario bloqueado"],
          ["500", "Internal Server Error"],
        ],
        [30, 70]
      ),

      new Paragraph({ children: [new PageBreak()] }),

      // SECCIÓN 7
      new Paragraph({
        children: [new TextRun({ text: "7. BASE DE DATOS", bold: true, size: 32, color: "1F4E79" })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 300 },
      }),

      new Paragraph({
        children: [new TextRun({ text: "7.1 Esquema de Tablas", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }),
      createTable(
        ["Tabla", "Descripción"],
        [
          ["bancos", "Catálogo de bancos disponibles"],
          ["tipo_transaccion", "Tipos de transacciones permitidas"],
          ["servicios", "Servicios públicos y privados"],
          ["usuarios", "Usuarios del sistema"],
          ["caja", "Control de caja por usuario/día"],
          ["transacciones", "Registro de transacciones"],
          ["corte_caja", "Cortes de caja generados"],
          ["configuracion_comisiones", "Configuración de comisiones"],
          ["usuarios_seguridad", "Control de seguridad de usuarios"],
          ["seguridad_parametros", "Parámetros de política de contraseñas"],
        ],
        [30, 70]
      ),

      new Paragraph({
        children: [new TextRun({ text: "7.2 Tipos de Transacción", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createBullet("Deposito"),
      createBullet("Retiro"),
      createBullet("Remesa"),
      createBullet("Servicio Publico"),
      createBullet("Servicio Privado"),
      createBullet("Transferencia"),
      createBullet("Tarjeta de Credito"),

      new Paragraph({
        children: [new TextRun({ text: "7.3 Triggers", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createBullet("trg_ValidarCajaAbierta - Impide transacciones sin caja abierta"),
      createBullet("trg_ActualizarCaja - Actualiza totales de caja automáticamente"),

      new Paragraph({
        children: [new TextRun({ text: "7.4 Procedimientos Almacenados Principales", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createBullet("sp_GetTransacciones - Lista transacciones"),
      createBullet("sp_InsertTransaccion - Inserta transacción con comisión"),
      createBullet("sp_AbrirCaja - Abre caja para usuario"),
      createBullet("sp_CerrarCaja - Cierra caja y genera corte"),
      createBullet("sp_GuardarComision - Crea/actualiza comisión"),
      createBullet("fn_ObtenerComision - Calcula comisión"),

      // SECCIÓN 8
      new Paragraph({
        children: [new TextRun({ text: "8. FUNCIONALIDADES PRINCIPALES", bold: true, size: 32, color: "1F4E79" })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 600, after: 300 },
      }),

      new Paragraph({
        children: [new TextRun({ text: "8.1 Módulo de Autenticación", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }),
      createBullet("Login con correo y contraseña"),
      createBullet("Autenticación biométrica (huella/facial)"),
      createBullet("Cambio obligatorio de contraseña en primer ingreso"),
      createBullet("Bloqueo de cuenta tras 5 intentos fallidos"),
      createBullet("Restablecimiento de contraseña por correo"),

      new Paragraph({
        children: [new TextRun({ text: "8.2 Módulo de Transacciones", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createBullet("Depósitos, retiros, remesas"),
      createBullet("Pago de servicios públicos y privados"),
      createBullet("Transferencias entre cuentas"),
      createBullet("Pago de tarjetas de crédito"),
      createBullet("Validación de caja abierta y saldos"),
      createBullet("Registro de geolocalización y fotografía"),

      new Paragraph({
        children: [new TextRun({ text: "8.3 Módulo de Caja", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createBullet("Apertura con saldo inicial configurable"),
      createBullet("Control de efectivo vs. saldo bancario"),
      createBullet("Registro de movimientos adicionales"),
      createBullet("Cierre con generación de corte automático"),

      new Paragraph({
        children: [new TextRun({ text: "8.4 Módulo de Comisiones", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createBullet("Comisión fija y/o porcentual"),
      createBullet("Configurable por banco y tipo de transacción"),
      createBullet("Montos mínimos y máximos"),
      createBullet("Reportes diarios y mensuales"),

      new Paragraph({ children: [new PageBreak()] }),

      // SECCIÓN 9
      new Paragraph({
        children: [new TextRun({ text: "9. SEGURIDAD", bold: true, size: 32, color: "1F4E79" })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 300 },
      }),

      new Paragraph({
        children: [new TextRun({ text: "9.1 Políticas de Contraseña", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }),
      createTable(
        ["Parámetro", "Valor Default"],
        [
          ["Longitud mínima", "8 caracteres"],
          ["Mayúsculas requeridas", "Sí"],
          ["Minúsculas requeridas", "Sí"],
          ["Números requeridos", "Sí"],
          ["Caracteres especiales", "Sí"],
          ["Intentos máximos fallidos", "5"],
          ["Tiempo de bloqueo", "15 minutos"],
        ],
        [50, 50]
      ),

      new Paragraph({
        children: [new TextRun({ text: "9.2 Control de Acceso Basado en Roles (RBAC)", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createTable(
        ["Recurso", "Admin", "Cajero"],
        [
          ["Login", "✓", "✓"],
          ["Dashboard", "✓", "✓"],
          ["Transacciones", "✓", "✓"],
          ["Apertura/Cierre Caja", "✗", "✓"],
          ["Reportes/Comisiones", "✓", "✗"],
          ["Gestión Usuarios", "✓", "✗"],
        ],
        [40, 30, 30]
      ),

      // SECCIÓN 10
      new Paragraph({
        children: [new TextRun({ text: "10. MÓDULOS DEL FRONTEND", bold: true, size: 32, color: "1F4E79" })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 600, after: 300 },
      }),

      new Paragraph({
        children: [new TextRun({ text: "10.1 Servicios Angular", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }),
      createTable(
        ["Servicio", "Propósito"],
        [
          ["auth.ts", "Autenticación y gestión de sesión"],
          ["transacciones.ts", "CRUD de transacciones"],
          ["caja.ts", "Control de caja"],
          ["bancos.ts", "Gestión de bancos"],
          ["servicios.ts", "Gestión de servicios"],
          ["comisiones.ts", "Configuración de comisiones"],
          ["biometric-login.ts", "Autenticación biométrica"],
        ],
        [30, 70]
      ),

      new Paragraph({
        children: [new TextRun({ text: "10.2 Guards de Seguridad", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createBullet("auth.guard.ts - Verifica si hay sesión activa"),
      createBullet("role.guard.ts - Verifica si el usuario tiene el rol requerido"),

      new Paragraph({
        children: [new TextRun({ text: "10.3 Páginas Principales", bold: true, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      createBullet("login - Página de autenticación"),
      createBullet("dashboard - Panel principal con métricas"),
      createBullet("transacciones - Lista y formulario de transacciones"),
      createBullet("caja - Control de apertura/cierre"),
      createBullet("corte - Generación de corte de caja"),
      createBullet("bancos, servicios, usuarios, comisiones - Módulos de administración"),

      // FOOTER
      new Paragraph({ spacing: { before: 800 } }),
      new Paragraph({
        children: [new TextRun({ text: "— Fin del Manual Técnico —", italics: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Documento generado para el proyecto Gestor de Bancos - Grupo 3", size: 20 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Universidad Tecnológica de Honduras - Programación Móvil II", size: 20 })],
        alignment: AlignmentType.CENTER,
      }),
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`Documento Word generado exitosamente: ${outputPath}`);
}).catch(err => {
  console.error('Error al generar el documento:', err);
  process.exit(1);
});
