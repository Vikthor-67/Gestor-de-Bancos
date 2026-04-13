import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { LoginPayload, UsuarioSesion } from '../models/usuario.model';

interface CambiarPasswordPayload {
  userId: number;
  correo: string;
  currentPassword: string;
  newPassword: string;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly sessionKey = 'gestor_bancario_session';

  constructor() {
    // Limpia sesiones legacy guardadas en localStorage para evitar bypass al actualizar la app.
    localStorage.removeItem(this.sessionKey);
  }

  async login(payload: LoginPayload): Promise<UsuarioSesion> {
    try {
      const response = await CapacitorHttp.post({
        url: `${environment.apiUrl}/api/usuarios/login`,
        data: payload,
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status >= 200 && response.status < 300 && response.data) {
        const usuario: UsuarioSesion = response.data.usuario || response.data;
        usuario.mustChangePassword = !!usuario.mustChangePassword;
        sessionStorage.setItem(this.sessionKey, JSON.stringify(usuario));
        return usuario;
      }

      throw new Error(response.data?.message || 'Credenciales invalidas.');
    } catch (error: any) {
      throw new Error(this.getLoginErrorMessage(error));
    }
  }

  logout(): void {
    sessionStorage.removeItem(this.sessionKey);
    localStorage.removeItem(this.sessionKey);
  }

  getUsuarioSesion(): UsuarioSesion | null {
    const raw = sessionStorage.getItem(this.sessionKey);
    if (!raw) {
      return null;
    }

    try {
      const usuario = JSON.parse(raw) as Partial<UsuarioSesion>;
      const rol = String(usuario.rol || '').toLowerCase();
      if (!usuario.id || !usuario.correo || (rol !== 'admin' && rol !== 'cajero')) {
        this.logout();
        return null;
      }

      return {
        id: Number(usuario.id),
        nombre: String(usuario.nombre || 'Usuario'),
        correo: String(usuario.correo),
        rol: rol as 'admin' | 'cajero',
        mustChangePassword: !!usuario.mustChangePassword,
      };
    } catch {
      this.logout();
      return null;
    }
  }

  estaAutenticado(): boolean {
    return !!this.getUsuarioSesion();
  }

  getRolActual(): UsuarioSesion['rol'] | null {
    return this.getUsuarioSesion()?.rol || null;
  }

  getRutaInicioPorRol(rol: UsuarioSesion['rol']): string {
    return rol === 'cajero' ? '/transacciones' : '/caja';
  }

  async cambiarPasswordInicial(payload: CambiarPasswordPayload): Promise<void> {
    try {
      const response = await CapacitorHttp.post({
        url: `${environment.apiUrl}/api/usuarios/cambiar-password`,
        data: payload,
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status >= 200 && response.status < 300) {
        this.actualizarSesion({ mustChangePassword: false });
        return;
      }

      throw new Error(response.data?.message || 'No se pudo cambiar la contrasena.');
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'No se pudo cambiar la contrasena.');
    }
  }

  async solicitarResetPassword(correo: string): Promise<void> {
    try {
      const response = await CapacitorHttp.post({
        url: `${environment.apiUrl}/api/usuarios/forgot-password`,
        data: { correo },
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status >= 200 && response.status < 300) {
        return;
      }

      throw new Error(response.data?.message || 'No se pudo procesar la solicitud.');
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'No se pudo procesar la solicitud.');
    }
  }

  actualizarSesion(changes: Partial<UsuarioSesion>): void {
    const actual = this.getUsuarioSesion();
    if (!actual) {
      return;
    }

    const merged: UsuarioSesion = {
      ...actual,
      ...changes,
      mustChangePassword: !!(changes.mustChangePassword ?? actual.mustChangePassword),
    };
    sessionStorage.setItem(this.sessionKey, JSON.stringify(merged));
  }

  private getLoginErrorMessage(error: any): string {
    const backendMessage = error?.response?.data?.message || error?.data?.message;
    if (backendMessage) {
      return backendMessage;
    }

    const rawMessage = String(error?.message || '').toLowerCase();
    if (rawMessage.includes('failed to fetch') || rawMessage.includes('network') || rawMessage.includes('cleartext')) {
      return 'No se pudo conectar con la API. Verifique que el servidor este encendido y que la IP configurada sea accesible desde el dispositivo.';
    }

    return 'No se pudo iniciar sesion.';
  }
}
