export interface DashboardResumen {
  totalTransacciones: number;
  totalMonto: number;
  totalComisiones: number;
  cajaEstado: 'abierta' | 'cerrada' | 'sin-caja';
}

export interface ResumenBanco {
  banco: string;
  tipoTransaccion?: string;
  totalTransacciones: number;
  totalMonto: number;
  totalComisiones: number;
}

export interface DashboardComisionesMetricas {
  mes: string;
  fechaInicio: string;
  fechaFin: string;
  totalComisionDiaria: number;
  totalComisionMensual: number;
  totalComisionHastaFecha: number;
  totalComisionRango: number;
  totalMontoDiario: number;
  totalMontoMensual: number;
  totalMontoHastaFecha: number;
  totalMontoRango: number;
  totalTransaccionesRango: number;
}
