import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { CrearUsuarioPayload, CredencialTemporalResponse, ParametrosSeguridad, UsuarioAdminItem } from '../models/usuarios-admin.model';

@Injectable({
  providedIn: 'root',
})
export class UsuariosAdmin {
  private baseUrl = `${environment.apiUrl}/api/usuarios`;

  private getErrorMessage(response: any, fallback: string): string {
    return response?.data?.message || response?.data?.error || fallback;
  }

  private assertSuccess(response: any, fallback: string): void {
    const status = Number(response?.status || 0);
    if (status < 200 || status >= 300) {
      throw new Error(this.getErrorMessage(response, fallback));
    }
  }

  private buildHeaders(adminId: number): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-user-id': String(adminId),
    };
  }

  async listar(adminId: number): Promise<UsuarioAdminItem[]> {
    const response = await CapacitorHttp.get({
      url: this.baseUrl,
      headers: this.buildHeaders(adminId),
    });
    this.assertSuccess(response, 'No se pudo listar usuarios.');

    if (!Array.isArray(response.data)) {
      throw new Error('La API devolvio un formato invalido para el listado de usuarios.');
    }

    return response.data as UsuarioAdminItem[];
  }

  async crear(adminId: number, data: CrearUsuarioPayload): Promise<CredencialTemporalResponse> {
    const response = await CapacitorHttp.post({
      url: this.baseUrl,
      data: { ...data, adminId },
      headers: this.buildHeaders(adminId),
    });
    this.assertSuccess(response, 'No se pudo crear el usuario.');
    return response.data as CredencialTemporalResponse;
  }

  async resetPassword(adminId: number, userId: number): Promise<CredencialTemporalResponse> {
    const response = await CapacitorHttp.post({
      url: `${this.baseUrl}/reset-password`,
      data: { adminId, userId },
      headers: this.buildHeaders(adminId),
    });
    this.assertSuccess(response, 'No se pudo resetear la contrasena.');
    return response.data as CredencialTemporalResponse;
  }

  async actualizarCorreo(adminId: number, userId: number, correo: string): Promise<any> {
    const response = await CapacitorHttp.put({
      url: `${this.baseUrl}/correo`,
      data: { adminId, userId, correo },
      headers: this.buildHeaders(adminId),
    });
    this.assertSuccess(response, 'No se pudo actualizar el correo.');
    return response.data;
  }

  async obtenerParametros(adminId: number): Promise<ParametrosSeguridad> {
    const response = await CapacitorHttp.get({
      url: `${this.baseUrl}/seguridad/parametros`,
      headers: this.buildHeaders(adminId),
    });
    this.assertSuccess(response, 'No se pudieron obtener los parametros de seguridad.');

    if (!response.data || Array.isArray(response.data)) {
      throw new Error('La API devolvio un formato invalido para los parametros de seguridad.');
    }

    return response.data as ParametrosSeguridad;
  }

  async actualizarParametros(adminId: number, data: ParametrosSeguridad): Promise<any> {
    const response = await CapacitorHttp.put({
      url: `${this.baseUrl}/seguridad/parametros`,
      data: { ...data, adminId },
      headers: this.buildHeaders(adminId),
    });
    this.assertSuccess(response, 'No se pudieron actualizar los parametros de seguridad.');
    return response.data;
  }
}
