import { Component, OnInit } from '@angular/core';
import { Share } from '@capacitor/share';
import { AlertController, ToastController } from '@ionic/angular';
import { Auth } from '../services/auth';
import { BiometriaLoginService } from '../services/biometria-login';
import { UsuariosAdmin } from '../services/usuarios-admin';
import { FechasLocales } from '../services/fechas-locales';
import { CredencialTemporalResponse, ParametrosSeguridad, UsuarioAdminItem } from '../models/usuarios-admin.model';

@Component({
  selector: 'app-usuarios',
  templateUrl: './usuarios.page.html',
  styleUrls: ['./usuarios.page.scss'],
  standalone: false,
})
export class UsuariosPage implements OnInit {
  loading = false;
  usuarios: UsuarioAdminItem[] = [];
  biometriaDisponible = false;
  biometriaActiva = false;
  correoHuellaVinculado = '';

  formUsuario = {
    nombre: '',
    correo: '',
    rol: 'cajero' as 'admin' | 'cajero',
  };

  parametros: ParametrosSeguridad = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
    maxFailedAttempts: 5,
    lockMinutes: 15,
    defaultPasswordLength: 12,
  };

  constructor(
    private auth: Auth,
    private biometriaLogin: BiometriaLoginService,
    private usuariosAdmin: UsuariosAdmin,
    private alertController: AlertController,
    private toastController: ToastController,
    public fechasLocal: FechasLocales
  ) {}

  async ngOnInit(): Promise<void> {
    await this.cargarTodo();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.cargarTodo();
  }

  get esAdmin(): boolean {
    return this.auth.getRolActual() === 'admin';
  }

  get esCajero(): boolean {
    return this.auth.getRolActual() === 'cajero';
  }

  get adminId(): number {
    return this.auth.getUsuarioSesion()?.id || 0;
  }

  async cargarTodo(): Promise<void> {
    if (!this.adminId) {
      return;
    }

    if (this.esCajero) {
      this.usuarios = [];
      await this.actualizarEstadoBiometria();
      return;
    }

    this.loading = true;
    try {
      this.usuarios = await this.usuariosAdmin.listar(this.adminId);
      this.parametros = await this.usuariosAdmin.obtenerParametros(this.adminId);
    } catch (error: any) {
      this.usuarios = [];
      await this.showToast(error?.message || 'No se pudo cargar la administracion de usuarios.', 'danger');
    } finally {
      this.loading = false;
      await this.actualizarEstadoBiometria();
    }
  }

  get correoUsuarioActual(): string {
    return String(this.auth.getUsuarioSesion()?.correo || '').trim().toLowerCase();
  }

  get huellaLigadaAlUsuarioActual(): boolean {
    return !!this.correoUsuarioActual && this.correoUsuarioActual === this.correoHuellaVinculado;
  }

  async alternarHuella(): Promise<void> {
    if (!this.biometriaDisponible) {
      await this.showToast('La biometria no esta disponible en este dispositivo.', 'warning');
      return;
    }

    if (!this.correoUsuarioActual) {
      await this.showToast('No hay sesion valida para configurar la huella.', 'warning');
      return;
    }

    if (this.huellaLigadaAlUsuarioActual) {
      await this.biometriaLogin.desactivar();
      await this.actualizarEstadoBiometria();
      await this.showToast('Huella desactivada para este usuario.', 'success');
      return;
    }

    await this.activarHuellaConPassword();
  }

  private async activarHuellaConPassword(): Promise<void> {
    const correo = this.correoUsuarioActual;
    const alert = await this.alertController.create({
      header: 'Activar huella',
      message: `Confirma tu contrasena para vincular la huella a ${correo}`,
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: 'Contrasena actual',
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Activar',
          handler: async (data) => {
            const password = String(data?.password || '');
            if (!password) {
              await this.showToast('Debes ingresar tu contrasena para activar la huella.', 'warning');
              return false;
            }

            try {
              await this.auth.login({ correo, password });
              await this.biometriaLogin.activarParaCuenta(correo, password);
              await this.actualizarEstadoBiometria();
              await this.showToast('Huella activada y vinculada a tu correo.', 'success');
              return true;
            } catch (error: any) {
              await this.showToast(error?.message || 'No se pudo activar la huella.', 'danger');
              return false;
            }
          },
        },
      ],
    });

    await alert.present();
  }

  private async actualizarEstadoBiometria(): Promise<void> {
    this.biometriaDisponible = await this.biometriaLogin.estaDisponible();
    this.correoHuellaVinculado = this.biometriaLogin.obtenerCorreoVinculado();
    this.biometriaActiva = !!this.correoHuellaVinculado;
  }

  async crearUsuario(): Promise<void> {
    if (!this.formUsuario.nombre || !this.formUsuario.correo) {
      await this.showToast('Nombre y correo son obligatorios.', 'warning');
      return;
    }

    try {
      const result = await this.usuariosAdmin.crear(this.adminId, this.formUsuario);
      await this.showToast(result?.message || 'Usuario creado correctamente.', 'success');
      await this.mostrarCredencialTemporal('Credenciales temporales del nuevo usuario', result);
      this.formUsuario = { nombre: '', correo: '', rol: 'cajero' };
      await this.cargarTodo();
    } catch (error: any) {
      await this.showToast(error?.response?.data?.message || error?.message || 'No se pudo crear el usuario.', 'danger');
    }
  }

  async resetearPassword(usuario: UsuarioAdminItem): Promise<void> {
    try {
      const result = await this.usuariosAdmin.resetPassword(this.adminId, usuario.id);
      await this.showToast(result?.message || `Contrasena temporal generada para ${usuario.correo}.`, 'success');
      await this.mostrarCredencialTemporal(`Nueva contrasena temporal para ${usuario.nombre}`, result);
      await this.cargarTodo();
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo resetear la contrasena.', 'danger');
    }
  }

  async actualizarCorreo(usuario: UsuarioAdminItem): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Actualizar correo',
      message: `Nuevo correo para ${usuario.nombre}`,
      inputs: [
        {
          name: 'correo',
          type: 'email',
          placeholder: 'usuario@gestor.hn',
          value: usuario.correo,
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Actualizar',
          handler: async (data) => {
            const correo = String(data?.correo || '').trim().toLowerCase();
            if (!correo) {
              await this.showToast('El correo es obligatorio.', 'warning');
              return false;
            }
            void this.procesarActualizacionCorreo(usuario, correo);
            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  private async procesarActualizacionCorreo(usuario: UsuarioAdminItem, correo: string): Promise<void> {
    try {
      const result = await this.usuariosAdmin.actualizarCorreo(this.adminId, usuario.id, correo);
      await this.showToast(result?.message || 'Correo actualizado correctamente.', 'success');
      await this.cargarTodo();
    } catch (error: any) {
      await this.showToast(error?.response?.data?.message || error?.message || 'No se pudo actualizar el correo.', 'danger');
    }
  }

  async guardarParametros(): Promise<void> {
    try {
      const result = await this.usuariosAdmin.actualizarParametros(this.adminId, this.parametros);
      await this.showToast(result?.message || 'Parametros actualizados.', 'success');
      await this.cargarTodo();
    } catch (error: any) {
      await this.showToast(error?.response?.data?.message || error?.message || 'No se pudieron guardar los parametros.', 'danger');
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2400,
      color,
      position: 'top',
    });
    await toast.present();
  }

  private async mostrarCredencialTemporal(header: string, result: CredencialTemporalResponse): Promise<void> {
    const correo = result.usuario?.correo || 'No disponible';
    const shareText = `Credenciales temporales\nUsuario: ${correo}\nContrasena temporal: ${result.tempPassword}\nDebes cambiarla en el primer ingreso.`;
    const mensajePlano = [
      `Usuario: ${correo}`,
      `Contrasena temporal: ${result.tempPassword}`,
      'NOTA: Comparte esta contrasena por un canal seguro. En el primer ingreso sera obligatorio cambiarla.',
    ].join('\n');

    const alert = await this.alertController.create({
      header,
      cssClass: 'credencial-temporal-alert',
      message: mensajePlano,
      buttons: [
        {
          text: 'Copiar clave',
          handler: async () => {
            const copied = await this.copyToClipboard(result.tempPassword);
            await this.showToast(
              copied ? 'Contrasena temporal copiada al portapapeles.' : 'No se pudo copiar automaticamente la contrasena.',
              copied ? 'success' : 'warning'
            );
          },
        },
        {
          text: 'Compartir',
          handler: async () => {
            const shared = await this.shareCredential(header, shareText);
            if (!shared) {
              const copied = await this.copyToClipboard(shareText);
              await this.showToast(
                copied
                  ? 'No se pudo abrir compartir; texto copiado al portapapeles.'
                  : 'No se pudo compartir ni copiar automaticamente.',
                copied ? 'warning' : 'danger'
              );
            }
          },
        },
        'Entendido',
      ],
    });

    await alert.present();
  }

  private async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Se usa el fallback DOM si la API nativa no esta disponible.
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }

  private async shareCredential(title: string, text: string): Promise<boolean> {
    try {
      const canShare = await Share.canShare();
      if (canShare?.value) {
        await Share.share({ title, text, dialogTitle: 'Compartir credenciales temporales' });
        return true;
      }

      if (navigator?.share) {
        await navigator.share({ title, text });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
