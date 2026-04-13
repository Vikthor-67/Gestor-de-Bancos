export type EstadoCaja = 'abierta' | 'cerrada';

export interface Caja {
  id: number;
  idUsuario: number;
  fecha: string;
  saldoInicial: number;
  totalIngresos: number;
  totalEgresos: number;
  saldoFinal: number;
  estado: EstadoCaja;
  fechaCierre?: string | null;
  fechaApertura?: string | null;
}

export interface CorteCaja {
  id: number;
  idCaja: number;
  idUsuario: number;
  totalDepositos: number;
  totalRetiros: number;
  totalRemesas: number;
  totalServicios: number;
  totalComisiones: number;
  diferencia: number;
  observacion?: string | null;
  fechaCorte: string;
}

export interface CajaCerrada {
  id: number;
  idUsuario: number;
  nombreCajero?: string | null;
  saldoInicial: number;
  totalIngresos: number;
  totalEgresos: number;
  saldoFinal: number;
  fecha: string;
  fechaCierre?: string | null;
  estado: string;
}

export interface CajaConfigAperturaBanco {
  idBanco: number;
  saldoInicialBanco: number;
}

export interface CajaConfigApertura {
  idUsuario: number;
  fecha: string;
  efectivoInicial: number;
  saldosBancos: CajaConfigAperturaBanco[];
}

export interface CajaSaldoBancoActual {
  idBanco: number;
  banco: string;
  saldoInicialBanco: number;
  totalIngresosBanco: number;
  totalEgresosBanco: number;
  saldoActualBanco: number;
}

export interface CajaResumenOperativo {
  idUsuario: number;
  fecha: string;
  efectivoInicial: number;
  efectivoEntradas: number;
  efectivoSalidas: number;
  efectivoActual: number;
  montoBancosActual: number;
  montoGeneral: number;
}

export interface ResumenBancoGlobal {
  idBanco: number;
  banco: string;
  saldoInicial: number;
  ingresosBanco: number;
  egresosBanco: number;
  ingresosManualBanco: number;
  egresosManualBanco: number;
  saldoActual: number;
}

export interface ResumenOperativoGlobal {
  fecha: string;
  efectivoInicial: number;
  efectivoEntradas: number;
  efectivoSalidas: number;
  totalIngresos: number;
  totalEgresos: number;
  efectivoActual: number;
  montoBancosActual: number;
  montoGeneral: number;
  detallesBancos: ResumenBancoGlobal[];
}

export interface MovimientoCajaPayload {
  idUsuario: number;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  concepto?: string;
  subtipoIngreso?: string;
  modalidad?: 'efectivo' | 'banco';
  idBanco?: number;
  fecha?: string;
  idCaja?: number;
}

export interface MovimientoCaja {
  id: number;
  idUsuario: number;
  nombreUsuario: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  concepto: string | null;
  subtipoIngreso: string | null;
  modalidad: string | null;
  idBanco: number | null;
  nombreBanco: string | null;
  fecha: string;
  fechaRegistro: string;
}

export interface ActividadReciente {
  usuariosCreados:       Array<{ id: number; nombre: string; rol: string; fecha: string | null }>;
  bancosCreados:         Array<{ id: number; nombre: string; fecha: string | null }>;
  serviciosCreados:      Array<{ id: number; nombre: string; tipo: string; fecha: string | null }>;
  passwordsActualizadas: Array<{ id: number; nombre: string; fecha: string | null }>;
  transaccionesAnuladas: Array<{ id: number; monto: number; tipo: string; banco: string; cajero: string; fecha: string | null }>;
}
