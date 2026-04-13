export interface Transaccion {
  id: number;
  idBanco: number;
  idTipoTrans: number;
  idServicio?: number | null;
  idUsuario: number;
  banco?: string;
  tipo?: string;
  servicio?: string | null;
  numeroReferencia?: string | null;
  nombreCliente: string;
  nombreUsuario?: string | null;
  monto: number;
  comision: number;
  anulado?: string | null;
  observacion?: string | null;
  fechaTransaccion: string;
  latitud?: number | null;
  longitud?: number | null;
  fotoComprobante?: string | null;
  cuentaDestino?: string | null;
  idBancoOrigen?: number | null;
}

export interface TransaccionPayload {
  idBanco: number;
  idTipoTrans: number;
  idServicio?: number | null;
  idUsuario: number;
  anulado?: 'completada' | 'anulada' | null;
  numeroReferencia?: string;
  nombreCliente: string;
  monto: number;
  comision?: number;
  observacion?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  fechaTransaccion?: string | null;
  fotoComprobante?: string | null;
  cuentaDestino?: string | null;
  idBancoOrigen?: number | null;
}
