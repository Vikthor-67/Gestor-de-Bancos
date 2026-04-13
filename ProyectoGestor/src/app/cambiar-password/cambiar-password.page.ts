import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Auth } from '../services/auth';
import { UsuarioSesion } from '../models/usuario.model';

@Component({
  selector: 'app-cambiar-password',
  templateUrl: './cambiar-password.page.html',
  styleUrls: ['./cambiar-password.page.scss'],
  standalone: false,
})
export class CambiarPasswordPage implements OnInit {
  sesion: UsuarioSesion | null = null;

  form = {
    actual: '',
    nueva: '',
    confirmar: '',
  };

  loading = false;

  constructor(
    private auth: Auth,
    private router: Router,
    private toastController: ToastController
  ) {}

  ngOnInit(): void {
    this.sesion = this.auth.getUsuarioSesion();
    if (!this.sesion) {
      this.router.navigateByUrl('/login');
    }
  }

  async guardar(): Promise<void> {
    const sesion = this.auth.getUsuarioSesion();
    this.sesion = sesion;
    if (!sesion) {
      await this.router.navigateByUrl('/login', { replaceUrl: true });
      return;
    }

    if (!this.form.actual || !this.form.nueva || !this.form.confirmar) {
      await this.showToast('Complete todos los campos.', 'warning');
      return;
    }

    if (this.form.nueva !== this.form.confirmar) {
      await this.showToast('La confirmacion de contrasena no coincide.', 'warning');
      return;
    }

    this.loading = true;
    try {
      await this.auth.cambiarPasswordInicial({
        userId: sesion.id,
        correo: sesion.correo,
        currentPassword: this.form.actual,
        newPassword: this.form.nueva,
      });

      await this.showToast('Contrasena actualizada correctamente.', 'success');
      await this.router.navigateByUrl(this.auth.getRutaInicioPorRol(sesion.rol), { replaceUrl: true });
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo actualizar la contrasena.', 'danger');
    } finally {
      this.loading = false;
    }
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
