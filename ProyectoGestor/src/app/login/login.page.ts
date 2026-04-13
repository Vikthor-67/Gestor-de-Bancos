import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Auth } from '../services/auth';
import { BiometriaLoginService } from '../services/biometria-login';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  credenciales = {
    correo: '',
    password: '',
  };

  loading = false;
  puedeUsarHuella = false;
  correoVinculadoHuella = '';

  get huellaActiva(): boolean {
    return !!this.correoVinculadoHuella;
  }

  constructor(
    private auth: Auth,
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController,
    private biometriaLogin: BiometriaLoginService
  ) {}

  async ngOnInit() {
    const sesion = this.auth.getUsuarioSesion();
    if (sesion) {
      await this.router.navigateByUrl(sesion.mustChangePassword ? '/cambiar-password' : this.auth.getRutaInicioPorRol(sesion.rol));
      return;
    }

    await this.actualizarEstadoHuella();
  }

  async ionViewWillEnter(): Promise<void> {
    this.credenciales = {
      correo: '',
      password: '',
    };
    this.loading = false;
    await this.actualizarEstadoHuella();
  }

  async ingresar(): Promise<void> {
    if (!this.credenciales.correo || !this.credenciales.password) {
      await this.showToast('Correo y contrasena son obligatorios.', 'warning');
      return;
    }

    this.loading = true;
    try {
      const usuario = await this.auth.login(this.credenciales);
      await this.showToast('Sesion iniciada correctamente.', 'success');
      await this.router.navigateByUrl(usuario.mustChangePassword ? '/cambiar-password' : this.auth.getRutaInicioPorRol(usuario.rol));
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo iniciar sesion.', 'danger');
    } finally {
      this.loading = false;
    }
  }

  async ingresarConHuella(): Promise<void> {
    if (!this.puedeUsarHuella) {
      await this.showToast('No hay huella vinculada para iniciar sesion.', 'warning');
      return;
    }

    this.loading = true;
    try {
      const credenciales = await this.biometriaLogin.obtenerCredencialesConHuella(this.credenciales.correo);
      if (!credenciales) {
        await this.showToast('No se pudo obtener las credenciales biometrica.', 'danger');
        return;
      }

      this.credenciales.correo = credenciales.correo;
      const usuario = await this.auth.login(credenciales);
      await this.showToast('Sesion iniciada con huella.', 'success');
      await this.router.navigateByUrl(usuario.mustChangePassword ? '/cambiar-password' : this.auth.getRutaInicioPorRol(usuario.rol));
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo iniciar con huella.', 'danger');
    } finally {
      this.loading = false;
    }
  }

  private async actualizarEstadoHuella(): Promise<void> {
    this.correoVinculadoHuella = this.biometriaLogin.obtenerCorreoVinculado();
    this.puedeUsarHuella = !!this.correoVinculadoHuella && await this.biometriaLogin.estaDisponible();
  }

  async recuperarPassword(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Recuperar contrasena',
      message: 'Si la recuperacion por correo no esta configurada, un administrador debera generar una nueva contrasena temporal.',
      inputs: [
        {
          name: 'correo',
          type: 'email',
          placeholder: 'usuario@gestor.hn',
          value: this.credenciales.correo,
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Enviar',
          handler: async (data) => {
            const correo = String(data?.correo || '').trim();
            if (!correo) {
              await this.showToast('Debes indicar un correo.', 'warning');
              return;
            }

            try {
              await this.auth.solicitarResetPassword(correo);
              await this.showToast('Se envio una contrasena temporal al correo indicado.', 'success');
            } catch (error: any) {
              await this.showToast(error?.message || 'No se pudo procesar la recuperacion.', 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2200,
      color,
      position: 'top',
    });
    await toast.present();
  }

}
