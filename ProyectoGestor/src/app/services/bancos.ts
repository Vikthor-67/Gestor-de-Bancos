import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { Banco, BancoPayload } from '../models/banco.model';

@Injectable({
  providedIn: 'root',
})
export class Bancos {
  private baseUrl = `${environment.apiUrl}/api/bancos`;
  private catalogosUrl = `${environment.apiUrl}/api/catalogos/bancos`;

  async getBancos(includeInactivos = false): Promise<Banco[]> {
    try {
      const params = includeInactivos ? 'includeInactivos=1' : '';
      const url = params ? `${this.baseUrl}?${params}` : this.baseUrl;
      
      const response = await CapacitorHttp.get({
        url,
        headers: {
          Accept: 'application/json',
        },
      });
      
      const data = response?.data;
      console.log('Respuesta de bancos:', data);
      
      if (Array.isArray(data)) {
        return data.map(b => ({
          id: Number(b.id) || 0,
          nombre: String(b.nombre || ''),
          codigo: String(b.codigo || ''),
          telefono: b.telefono || null,
          logo: b.logo || null,
          estado: b.estado === true || b.estado === 1 || String(b.estado).toLowerCase() === 'true',
        }));
      }
      
      console.warn('Los datos de bancos no son un array:', data);
      return [];
    } catch (error) {
      console.error('Error cargando bancos:', error);
      return [];
    }
  }

  async crear(data: BancoPayload): Promise<any> {
    const response = await CapacitorHttp.post({
      url: this.baseUrl,
      data,
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  }

  async actualizar(id: number, data: Partial<BancoPayload>): Promise<any> {
    const response = await CapacitorHttp.put({
      url: `${this.baseUrl}/${id}`,
      data,
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  }

  async desactivar(id: number): Promise<any> {
    const response = await CapacitorHttp.delete({
      url: `${this.baseUrl}/${id}`,
      headers: { Accept: 'application/json' },
    });
    return response.data;
  }

  async activar(id: number): Promise<any> {
    const response = await CapacitorHttp.patch({
      url: `${this.baseUrl}/${id}/activar`,
      headers: { Accept: 'application/json' },
    });
    return response.data;
  }
}
