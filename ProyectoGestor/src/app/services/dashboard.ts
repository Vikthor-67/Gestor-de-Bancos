import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { DashboardComisionesMetricas, DashboardResumen, ResumenBanco } from '../models/dashboard.model';
import { Transacciones } from './transacciones';

@Injectable({
  providedIn: 'root',
})
export class Dashboard {
  private transaccionesUrl = `${environment.apiUrl}/api/transacciones`;

  constructor(private transacciones: Transacciones) {}

  private isSuccessStatus(status: number | undefined): boolean {
    return Number(status || 0) >= 200 && Number(status || 0) < 300;
  }

  private toArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }

  async getResumen(): Promise<DashboardResumen> {
    try {
      const listado = await this.transacciones.getTransacciones();
      const totalMonto = listado.reduce((acc, item) => acc + Number(item.monto || 0), 0);
      const totalComisiones = listado.reduce((acc, item) => acc + Number(item.comision || 0), 0);
      return {
        totalTransacciones: listado.length,
        totalMonto,
        totalComisiones,
        cajaEstado: 'sin-caja',
      };
    } catch {
      return {
        totalTransacciones: 0,
        totalMonto: 0,
        totalComisiones: 0,
        cajaEstado: 'sin-caja',
      };
    }
  }

  async getPorBanco(
    fechaInicio: string,
    fechaFin: string,
    idBanco?: number | null,
    idTipoTrans?: number | null
  ): Promise<ResumenBanco[]> {
    try {
      const queryParams: Record<string, string> = { fechaInicio, fechaFin };
      if (idBanco) {
        queryParams['idBanco'] = String(idBanco);
      }
      if (idTipoTrans) {
        queryParams['idTipoTrans'] = String(idTipoTrans);
      }

      const query = new URLSearchParams(queryParams).toString();
      const response = await CapacitorHttp.get({
        url: `${this.transaccionesUrl}/resumen?${query}`,
        headers: { Accept: 'application/json' },
      });

      if (!this.isSuccessStatus(response.status)) {
        return [];
      }

      return this.toArray<ResumenBanco>(response.data);
    } catch {
      return [];
    }
  }

  async getMetricasComisiones(
    fechaInicio: string,
    fechaFin: string,
    mes: string,
    idBanco?: number | null,
    idTipoTrans?: number | null
  ): Promise<DashboardComisionesMetricas> {
    const empty: DashboardComisionesMetricas = {
      mes,
      fechaInicio,
      fechaFin,
      totalComisionDiaria: 0,
      totalComisionMensual: 0,
      totalComisionHastaFecha: 0,
      totalComisionRango: 0,
      totalMontoDiario: 0,
      totalMontoMensual: 0,
      totalMontoHastaFecha: 0,
      totalMontoRango: 0,
      totalTransaccionesRango: 0,
    };

    try {
      const queryParams: Record<string, string> = { fechaInicio, fechaFin, mes };
      if (idBanco) {
        queryParams['idBanco'] = String(idBanco);
      }
      if (idTipoTrans) {
        queryParams['idTipoTrans'] = String(idTipoTrans);
      }

      const query = new URLSearchParams(queryParams).toString();
      const response = await CapacitorHttp.get({
        url: `${this.transaccionesUrl}/resumen-comisiones?${query}`,
        headers: { Accept: 'application/json' },
      });

      if (!this.isSuccessStatus(response.status)) {
        return empty;
      }

      return {
        ...empty,
        ...(response.data || {}),
      } as DashboardComisionesMetricas;
    } catch {
      return empty;
    }
  }
}
