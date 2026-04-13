import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { ComisionConfig, ComisionPayload, ReporteComisiones } from '../models/comision.model';

@Injectable({
  providedIn: 'root',
})
export class Comisiones {
  private baseUrl = `${environment.apiUrl}/api/comisiones`;

  async getComisiones(): Promise<ComisionConfig[]> {
    const response = await CapacitorHttp.get({
      url: this.baseUrl,
      headers: { Accept: 'application/json' },
    });

    return (response.data || []) as ComisionConfig[];
  }

  async guardar(data: ComisionPayload): Promise<any> {
    const response = await CapacitorHttp.post({
      url: this.baseUrl,
      data,
      headers: { 'Content-Type': 'application/json' },
    });

    return response.data;
  }

  async actualizar(id: number, data: ComisionPayload): Promise<any> {
    const response = await CapacitorHttp.put({
      url: `${this.baseUrl}/${id}`,
      data,
      headers: { 'Content-Type': 'application/json' },
    });

    return response.data;
  }

  async cambiarEstado(id: number, estado: boolean): Promise<any> {
    const response = await CapacitorHttp.patch({
      url: `${this.baseUrl}/${id}/estado`,
      data: { estado },
      headers: { 'Content-Type': 'application/json' },
    });

    return response.data;
  }

  async calcular(idBanco: number, idTipoTrans: number, monto: number): Promise<number> {
    const query = new URLSearchParams({
      idBanco: String(idBanco),
      idTipoTrans: String(idTipoTrans),
      monto: String(monto),
    }).toString();

    const response = await CapacitorHttp.get({
      url: `${this.baseUrl}/calcular?${query}`,
      headers: { Accept: 'application/json' },
    });

    return Number(response.data?.comision || 0);
  }

  async getReporte(mes?: string): Promise<ReporteComisiones> {
    const params = mes ? `?mes=${mes}` : '';
    const response = await CapacitorHttp.get({
      url: `${this.baseUrl}/reporte${params}`,
      headers: { Accept: 'application/json' },
    });
    return response.data as ReporteComisiones;
  }
}
