import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { Servicio, ServicioPayload, TipoServicio } from '../models/servicio.model';

@Injectable({
  providedIn: 'root',
})
export class Servicios {
  private baseUrl = `${environment.apiUrl}/api/servicios`;
  private catalogosUrl = `${environment.apiUrl}/api/catalogos/servicios`;

  async getServicios(tipo?: TipoServicio, includeInactivos = false): Promise<Servicio[]> {
    const params: string[] = [];
    if (tipo) {
      params.push(`tipo=${encodeURIComponent(tipo)}`);
    }
    if (includeInactivos) {
      params.push('includeInactivos=1');
    }
    const query = params.length ? `?${params.join('&')}` : '';
    try {
      const response = await CapacitorHttp.get({
        url: `${this.baseUrl}${query}`,
        headers: { Accept: 'application/json' },
      });
      return (response.data || []) as Servicio[];
    } catch {
      const response = await CapacitorHttp.get({
        url: `${this.catalogosUrl}${query}`,
        headers: { Accept: 'application/json' },
      });
      return (response.data || []) as Servicio[];
    }
  }

  async crear(data: ServicioPayload): Promise<any> {
    try {
      const response = await CapacitorHttp.post({
        url: this.baseUrl,
        data,
        headers: { 'Content-Type': 'application/json' },
      });
      this.ensureSuccess(response, 'No se pudo crear el servicio.');
      return response.data;
    } catch (error: any) {
      throw new Error(this.getBackendMessage(error, 'No se pudo crear el servicio.'));
    }
  }

  async actualizar(id: number, data: Partial<ServicioPayload>): Promise<any> {
    try {
      const response = await CapacitorHttp.put({
        url: `${this.baseUrl}/${id}`,
        data,
        headers: { 'Content-Type': 'application/json' },
      });
      this.ensureSuccess(response, 'No se pudo actualizar el servicio.');
      return response.data;
    } catch (error: any) {
      throw new Error(this.getBackendMessage(error, 'No se pudo actualizar el servicio.'));
    }
  }

  async eliminar(id: number): Promise<any> {
    try {
      const response = await CapacitorHttp.delete({
        url: `${this.baseUrl}/${id}`,
        headers: { Accept: 'application/json' },
      });
      this.ensureSuccess(response, 'No se pudo eliminar el servicio.');
      return response.data;
    } catch (error: any) {
      throw new Error(this.getBackendMessage(error, 'No se pudo eliminar el servicio.'));
    }
  }

  async cambiarEstado(id: number, estado: boolean): Promise<any> {
    try {
      const response = await CapacitorHttp.patch({
        url: `${this.baseUrl}/${id}/estado`,
        data: { estado },
        headers: { 'Content-Type': 'application/json' },
      });
      this.ensureSuccess(response, 'No se pudo actualizar el estado del servicio.');
      return response.data;
    } catch (error: any) {
      throw new Error(this.getBackendMessage(error, 'No se pudo actualizar el estado del servicio.'));
    }
  }

  private ensureSuccess(response: any, defaultMessage: string): void {
    const status = Number(response?.status || 0);
    if (status >= 200 && status < 300) {
      return;
    }

    const backendMessage = response?.data?.message || response?.data?.error;
    throw new Error(String(backendMessage || defaultMessage));
  }

  private getBackendMessage(error: any, fallback: string): string {
    return (
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.data?.message ||
      error?.data?.error ||
      error?.message ||
      fallback
    );
  }
}
