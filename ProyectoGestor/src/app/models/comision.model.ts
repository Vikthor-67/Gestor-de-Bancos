export interface ComisionConfig {
  id: number;
  idBanco: number | null;
  idTipoTrans: number | null;
  banco: string;
  tipoTransaccion: string;
  comisionFija: number;
  comisionPorcentaje: number;
  montoMinimo: number;
  montoMaximo: number | null;
  esDefault: boolean;
  estado: boolean;
  fechaCreacion?: string;
}

export interface ComisionPayload {
  idBanco?: number | null;
  idTipoTrans?: number | null;
  comisionFija: number;
  comisionPorcentaje: number;
  montoMinimo: number;
  montoMaximo?: number | null;
  esDefault?: boolean;
  estado?: boolean;
}

export interface ReporteDiaComision {
  fecha: string;
  numTransacciones: number;
  totalComisiones: number;
  acumuladoMes: number;
}

export interface ReporteComisiones {
  mes: string;
  totalMes: number;
  dias: ReporteDiaComision[];
}
