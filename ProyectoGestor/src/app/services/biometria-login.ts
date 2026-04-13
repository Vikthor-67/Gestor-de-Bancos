import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from 'capacitor-native-biometric';
import { LoginPayload } from '../models/usuario.model';

@Injectable({
  providedIn: 'root',
})
export class BiometriaLoginService {
  private readonly credentialServer = 'gestor-bancario-login';
  private readonly emailVinculadoKey = 'biometria_login_correo_vinculado';

  private normalizarCorreo(correo: string): string {
    return String(correo || '').trim().toLowerCase();
  }

  private enDispositivoNativo(): boolean {
    return Capacitor.getPlatform() !== 'web';
  }

  async estaDisponible(): Promise<boolean> {
    if (!this.enDispositivoNativo()) {
      return false;
    }

    try {
      const disponible = await NativeBiometric.isAvailable({ useFallback: true });
      return !!disponible?.isAvailable;
    } catch {
      return false;
    }
  }

  obtenerCorreoVinculado(): string {
    return this.normalizarCorreo(localStorage.getItem(this.emailVinculadoKey) || '');
  }

  async activarParaCuenta(correo: string, password: string): Promise<void> {
    const correoNormalizado = this.normalizarCorreo(correo);
    if (!correoNormalizado || !password) {
      throw new Error('Credenciales incompletas para activar huella.');
    }

    if (!(await this.estaDisponible())) {
      throw new Error('La biometria no esta disponible en este dispositivo.');
    }

    await NativeBiometric.setCredentials({
      username: correoNormalizado,
      password,
      server: this.credentialServer,
    });

    localStorage.setItem(this.emailVinculadoKey, correoNormalizado);
  }

  async desactivar(): Promise<void> {
    try {
      await NativeBiometric.deleteCredentials({ server: this.credentialServer });
    } catch {
      // Si no existian credenciales nativas, no es un error funcional.
    }
    localStorage.removeItem(this.emailVinculadoKey);
  }

  async obtenerCredencialesConHuella(correoEsperado?: string): Promise<LoginPayload | null> {
    const correoVinculado = this.obtenerCorreoVinculado();
    if (!correoVinculado) {
      return null;
    }

    if (!(await this.estaDisponible())) {
      return null;
    }

    const correoObjetivo = this.normalizarCorreo(correoEsperado || correoVinculado);
    if (correoObjetivo && correoObjetivo !== correoVinculado) {
      throw new Error('La huella esta vinculada a otro correo.');
    }

    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Usa tu huella para iniciar sesion',
        title: 'Iniciar sesion con huella',
        subtitle: 'Verificacion de identidad',
        description: 'Confirma tu identidad para continuar',
        negativeButtonText: 'Cancelar',
        useFallback: true,
        maxAttempts: 3,
      });

      const credenciales = await NativeBiometric.getCredentials({
        server: this.credentialServer,
      });

      const correoCredencial = this.normalizarCorreo(credenciales?.username || '');
      if (!correoCredencial || correoCredencial !== correoVinculado || !credenciales?.password) {
        return null;
      }

      return {
        correo: correoCredencial,
        password: credenciales.password,
      };
    } catch {
      return null;
    }
  }
}
