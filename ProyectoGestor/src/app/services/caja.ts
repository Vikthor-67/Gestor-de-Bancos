import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { environment } from '../../environments/environment';
import {
  Caja,
  CajaCerrada,
  CajaConfigApertura,
  CajaResumenOperativo,
  CajaSaldoBancoActual,
  CorteCaja,
  MovimientoCaja,
  MovimientoCajaPayload,
  ResumenOperativoGlobal,
  ActividadReciente,
} from '../models/caja.model';

@Injectable({
  providedIn: 'root',
})
export class CajaService {
  private baseUrl = `${environment.apiUrl}/api/caja`;

  private fechaHoyISO(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tegucigalpa' }).format(new Date());
  }

  private toNumber(value: any, fallback = 0): number {
    const num = Number(value);
    return Number.isNaN(num) ? fallback : num;
  }

  private normalizeCorte(raw: any): CorteCaja | null {
    if (!raw) return null;

    return {
      id: this.toNumber(raw?.id ?? raw?.Id, 0),
      idCaja: this.toNumber(raw?.idCaja ?? raw?.IdCaja, 0),
      idUsuario: this.toNumber(raw?.idUsuario ?? raw?.IdUsuario, 0),
      totalDepositos: this.toNumber(raw?.totalDepositos ?? raw?.TotalDepositos, 0),
      totalRetiros: this.toNumber(raw?.totalRetiros ?? raw?.TotalRetiros, 0),
      totalRemesas: this.toNumber(raw?.totalRemesas ?? raw?.TotalRemesas, 0),
      totalServicios: this.toNumber(raw?.totalServicios ?? raw?.TotalServicios, 0),
      totalComisiones: this.toNumber(raw?.totalComisiones ?? raw?.TotalComisiones, 0),
      diferencia: this.toNumber(raw?.diferencia ?? raw?.Diferencia, 0),
      observacion: raw?.observacion ?? raw?.Observacion ?? null,
      fechaCorte: String(raw?.fechaCorte ?? raw?.FechaCorte ?? ''),
    };
  }

  private normalizeCajaCerrada(raw: any): CajaCerrada {
    return {
      id: this.toNumber(raw?.id ?? raw?.Id, 0),
      idUsuario: this.toNumber(raw?.idUsuario ?? raw?.IdUsuario, 0),
      nombreCajero: raw?.nombreCajero ?? raw?.NombreCajero ?? null,
      saldoInicial: this.toNumber(raw?.saldoInicial ?? raw?.SaldoInicial, 0),
      totalIngresos: this.toNumber(raw?.totalIngresos ?? raw?.TotalIngresos, 0),
      totalEgresos: this.toNumber(raw?.totalEgresos ?? raw?.TotalEgresos, 0),
      saldoFinal: this.toNumber(raw?.saldoFinal ?? raw?.SaldoFinal, 0),
      fecha: String(raw?.fecha ?? raw?.Fecha ?? ''),
      fechaCierre: raw?.fechaCierre ?? raw?.FechaCierre ?? null,
      estado: String(raw?.estado ?? raw?.Estado ?? ''),
    };
  }

  async abrir(idUsuario: number, saldoInicial: number, fechaAperturaDispositivo?: string): Promise<any> {
    const response = await CapacitorHttp.post({
      url: `${this.baseUrl}/abrir`,
      data: { idUsuario, saldoInicial, fechaAperturaDispositivo },
      headers: { 'Content-Type': 'application/json' },
    });

    return response.data;
  }

  async cerrar(idCaja: number, idUsuario: number, observacion?: string, fechaCierreDispositivo?: string): Promise<any> {
    const response = await CapacitorHttp.post({
      url: `${this.baseUrl}/cerrar`,
      data: { idCaja, idUsuario, observacion, fechaCierreDispositivo },
      headers: { 'Content-Type': 'application/json' },
    });

    return response.data;
  }

  async getCajaHoy(idUsuario: number, fecha?: string): Promise<Caja | null> {
    try {
      const fechaParam = fecha || this.fechaHoyISO();
      const response = await CapacitorHttp.get({
        url: `${this.baseUrl}/hoy/${idUsuario}?fecha=${encodeURIComponent(fechaParam)}`,
        headers: { Accept: 'application/json' },
      });
      return (response.data || null) as Caja | null;
    } catch {
      return null;
    }
  }

  async getUltimoCorte(idUsuario: number, idBanco?: number): Promise<CorteCaja | null> {
    try {
      const query = typeof idBanco === 'number' ? `?idBanco=${idBanco}` : '';
      const response = await CapacitorHttp.get({
        url: `${this.baseUrl}/corte/ultimo/${idUsuario}${query}`,
        headers: { Accept: 'application/json' },
      });
      return this.normalizeCorte(response.data);
    } catch {
      return null;
    }
  }

  async getHistorialCajasCerradas(): Promise<CajaCerrada[]> {
    try {
      const response = await CapacitorHttp.get({
        url: `${this.baseUrl}/historial-cerradas`,
        headers: { Accept: 'application/json' },
      });

      const listado = Array.isArray(response.data)
        ? response.data
        : Array.isArray((response.data as any)?.value)
        ? (response.data as any).value
        : Array.isArray((response.data as any)?.recordset)
        ? (response.data as any).recordset
        : Array.isArray((response.data as any)?.rows)
        ? (response.data as any).rows
        : [];

      return listado.map((item: any) => this.normalizeCajaCerrada(item));
    } catch (error: any) {
      throw new Error(error?.message || 'No se pudo obtener historial de cajas cerradas.');
    }
  }

  async getConfigApertura(idUsuario: number, fecha?: string): Promise<CajaConfigApertura> {
    const fechaParam = fecha || this.fechaHoyISO();
    const response = await CapacitorHttp.get({
      url: `${this.baseUrl}/config-apertura/${idUsuario}?fecha=${encodeURIComponent(fechaParam)}`,
      headers: { Accept: 'application/json' },
    });

    const data = (response.data || {}) as Partial<CajaConfigApertura>;
    return {
      idUsuario,
      fecha: String(data.fecha || fechaParam),
      efectivoInicial: this.toNumber((data as any).efectivoInicial, 0),
      saldosBancos: Array.isArray((data as any).saldosBancos)
        ? (data as any).saldosBancos.map((item: any) => ({
            idBanco: this.toNumber(item?.idBanco, 0),
            saldoInicialBanco: this.toNumber(item?.saldoInicialBanco, 0),
          }))
        : [],
    };
  }

  async guardarConfigApertura(config: CajaConfigApertura): Promise<any> {
    const response = await CapacitorHttp.post({
      url: `${this.baseUrl}/config-apertura`,
      data: {
        idUsuario: config.idUsuario,
        fecha: config.fecha,
        efectivoInicial: this.toNumber(config.efectivoInicial, 0),
        saldosBancos: (config.saldosBancos || []).map((x) => ({
          idBanco: this.toNumber(x?.idBanco, 0),
          saldoInicialBanco: this.toNumber(x?.saldoInicialBanco, 0),
        })),
      },
      headers: { 'Content-Type': 'application/json' },
    });

    return response.data;
  }

  async getSaldosActualesPorBanco(idUsuario: number, fecha?: string, fechaApertura?: string | null, idCaja?: number | null): Promise<CajaSaldoBancoActual[]> {
    const fechaParam = fecha || this.fechaHoyISO();
    const aperturaParam = fechaApertura ? `&fechaApertura=${encodeURIComponent(fechaApertura)}` : '';
    const cajaParam = idCaja ? `&idCaja=${idCaja}` : '';
    const response = await CapacitorHttp.get({
      url: `${this.baseUrl}/saldos-por-banco/${idUsuario}?fecha=${encodeURIComponent(fechaParam)}${cajaParam}${aperturaParam}&_t=${Date.now()}`,
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });

    const listado = Array.isArray(response.data) ? response.data : [];
    return listado.map((x: any) => ({
      idBanco: this.toNumber(x?.idBanco, 0),
      banco: String(x?.banco || ''),
      saldoInicialBanco: this.toNumber(x?.saldoInicialBanco, 0),
      totalIngresosBanco: this.toNumber(x?.totalIngresosBanco, 0),
      totalEgresosBanco: this.toNumber(x?.totalEgresosBanco, 0),
      saldoActualBanco: this.toNumber(x?.saldoActualBanco, 0),
    }));
  }

  async getResumenOperativo(idUsuario: number, fecha?: string, fechaApertura?: string | null, idCaja?: number | null): Promise<CajaResumenOperativo> {
    const fechaParam = fecha || this.fechaHoyISO();
    const aperturaParam = fechaApertura ? `&fechaApertura=${encodeURIComponent(fechaApertura)}` : '';
    const cajaParam = idCaja ? `&idCaja=${idCaja}` : '';
    const response = await CapacitorHttp.get({
      url: `${this.baseUrl}/resumen-operativo/${idUsuario}?fecha=${encodeURIComponent(fechaParam)}${cajaParam}${aperturaParam}&_t=${Date.now()}`,
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });

    const data = (response.data || {}) as any;
    return {
      idUsuario,
      fecha: String(data?.fecha || fechaParam),
      efectivoInicial: this.toNumber(data?.efectivoInicial, 0),
      efectivoEntradas: this.toNumber(data?.efectivoEntradas, 0),
      efectivoSalidas: this.toNumber(data?.efectivoSalidas, 0),
      efectivoActual: this.toNumber(data?.efectivoActual, 0),
      montoBancosActual: this.toNumber(data?.montoBancosActual, 0),
      montoGeneral: this.toNumber(data?.montoGeneral, 0),
    };
  }

  async getResumenOperativoGlobal(fecha?: string): Promise<ResumenOperativoGlobal> {
    const fechaParam = fecha || this.fechaHoyISO();
    const response = await CapacitorHttp.get({
      url: `${this.baseUrl}/resumen-global?fecha=${encodeURIComponent(fechaParam)}&_t=${Date.now()}`,
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    const data = (response.data || {}) as any;
    return {
      fecha: String(data?.fecha || fechaParam),
      efectivoInicial: this.toNumber(data?.efectivoInicial, 0),
      efectivoEntradas: this.toNumber(data?.efectivoEntradas, 0),
      efectivoSalidas: this.toNumber(data?.efectivoSalidas, 0),
      totalIngresos: this.toNumber(data?.totalIngresos, 0),
      totalEgresos: this.toNumber(data?.totalEgresos, 0),
      efectivoActual: this.toNumber(data?.efectivoActual, 0),
      montoBancosActual: this.toNumber(data?.montoBancosActual, 0),
      montoGeneral: this.toNumber(data?.montoGeneral, 0),
      detallesBancos: (Array.isArray(data?.detallesBancos) ? data.detallesBancos : []).map((b: any) => ({
        idBanco: this.toNumber(b?.idBanco, 0),
        banco: String(b?.banco || ''),
        saldoInicial: this.toNumber(b?.saldoInicial, 0),
        ingresosBanco: this.toNumber(b?.ingresosBanco, 0),
        egresosBanco: this.toNumber(b?.egresosBanco, 0),
        ingresosManualBanco: this.toNumber(b?.ingresosManualBanco, 0),
        egresosManualBanco: this.toNumber(b?.egresosManualBanco, 0),
        saldoActual: this.toNumber(b?.saldoActual, 0),
      })),
    };
  }

  async registrarMovimiento(payload: MovimientoCajaPayload): Promise<void> {
    await CapacitorHttp.post({
      url: `${this.baseUrl}/movimiento`,
      data: payload,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getMovimientos(fecha?: string, tipo?: 'ingreso' | 'egreso' | '', idCaja?: number | null): Promise<MovimientoCaja[]> {
    const fechaParam = fecha || this.fechaHoyISO();
    const tipoParam  = tipo  || '';
    const cajaParam  = idCaja ? `&idCaja=${idCaja}` : '';
    const response = await CapacitorHttp.get({
      url: `${this.baseUrl}/movimientos?fecha=${encodeURIComponent(fechaParam)}&tipo=${encodeURIComponent(tipoParam)}${cajaParam}&_t=${Date.now()}`,
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    const raw = Array.isArray(response.data) ? response.data : [];
    return raw.map((r: any): MovimientoCaja => ({
      id:             this.toNumber(r?.id, 0),
      idUsuario:      this.toNumber(r?.idUsuario, 0),
      nombreUsuario:  String(r?.nombreUsuario || ''),
      tipo:           String(r?.tipo || '') as 'ingreso' | 'egreso',
      monto:          this.toNumber(r?.monto, 0),
      concepto:       r?.concepto ?? null,
      subtipoIngreso: r?.subtipoIngreso ?? null,
      modalidad:      r?.modalidad ?? null,
      idBanco:        r?.idBanco != null ? this.toNumber(r.idBanco, 0) : null,
      nombreBanco:    r?.nombreBanco ?? null,
      fecha:          String(r?.fecha || ''),
      fechaRegistro:  String(r?.fechaRegistro || ''),
    }));
  }

  async eliminarMovimiento(id: number): Promise<void> {
    await CapacitorHttp.delete({
      url: `${this.baseUrl}/movimiento/${id}`,
      headers: { Accept: 'application/json' },
    });
  }

  async getActividadReciente(): Promise<ActividadReciente> {
    try {
      const response = await CapacitorHttp.get({
        url: `${this.baseUrl}/actividad-reciente&_t=${Date.now()}`,
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      });
      const d = (response.data || {}) as any;
      return {
        usuariosCreados:       Array.isArray(d.usuariosCreados)       ? d.usuariosCreados       : [],
        bancosCreados:         Array.isArray(d.bancosCreados)         ? d.bancosCreados         : [],
        serviciosCreados:      Array.isArray(d.serviciosCreados)      ? d.serviciosCreados      : [],
        passwordsActualizadas: Array.isArray(d.passwordsActualizadas) ? d.passwordsActualizadas : [],
        transaccionesAnuladas: Array.isArray(d.transaccionesAnuladas) ? d.transaccionesAnuladas : [],
      };
    } catch {
      return { usuariosCreados: [], bancosCreados: [], serviciosCreados: [], passwordsActualizadas: [], transaccionesAnuladas: [] };
    }
  }

  async abrirTodasCajas(saldoInicial: number): Promise<{ message: string; abiertos: number; errores: any[] }> {
    const response = await CapacitorHttp.post({
      url: `${this.baseUrl}/abrir-todas`,
      data: { saldoInicial },
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  }

  async cerrarTodasCajas(observacion?: string): Promise<{ message: string; cerrados: number; errores: any[] }> {
    const response = await CapacitorHttp.post({
      url: `${this.baseUrl}/cerrar-todas`,
      data: { observacion: observacion || null },
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  }
}
