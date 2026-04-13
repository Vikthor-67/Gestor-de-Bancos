import { Component, OnInit } from '@angular/core';
import { ViewChild } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { AlertController, ToastController } from '@ionic/angular';
import { Banco, BancoPayload } from '../models/banco.model';
import { Bancos } from '../services/bancos';

@Component({
  selector: 'app-bancos',
  templateUrl: './bancos.page.html',
  styleUrls: ['./bancos.page.scss'],
  standalone: false,
})
export class BancosPage implements OnInit {
  @ViewChild(IonContent, { static: false }) content?: IonContent;

  bancos: Banco[] = [];

  form: BancoPayload = {
    nombre: '',
    codigo: '',
    telefono: '',
    estado: true,
  };

  editId: number | null = null;
  loading = false;

  constructor(
    private bancosService: Bancos,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.loading = true;
    try {
      const data = await this.bancosService.getBancos(true);
      this.bancos = (data || []).sort((a, b) =>
        String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' })
      );
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudieron cargar los bancos.', 'danger');
      this.bancos = [];
    } finally {
      this.loading = false;
    }
  }

  editar(item: Banco): void {
    this.editId = item.id;
    this.form = {
      nombre: item.nombre,
      codigo: item.codigo,
      telefono: item.telefono || '',
      estado: item.estado,
    };

    // Lleva al formulario superior para editar sin tener que desplazarse manualmente.
    void this.content?.scrollToTop(450);
  }

  limpiar(): void {
    this.editId = null;
    this.form = { nombre: '', codigo: '', telefono: '', estado: true };
  }

  async guardar(): Promise<void> {
    if (!this.form.nombre || !this.form.codigo) {
      await this.showToast('Nombre y codigo son obligatorios.', 'warning');
      return;
    }

    try {
      if (this.editId) {
        await this.bancosService.actualizar(this.editId, this.form);
        await this.showToast('Banco actualizado.', 'success');
      } else {
        await this.bancosService.crear(this.form);
        await this.showToast('Banco creado.', 'success');
      }

      this.limpiar();
      await this.cargar();
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo guardar el banco.', 'danger');
    }
  }

  async cambiarEstado(item: Banco): Promise<void> {
    const activar = !item.estado;
    const alert = await this.alertController.create({
      header: activar ? 'Activar banco' : 'Desactivar banco',
      message: activar
        ? 'Desea activar este banco para volver a usarlo?'
        : 'Desea desactivar este banco?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: activar ? 'Activar' : 'Desactivar',
          role: activar ? 'confirm' : 'destructive',
          handler: async () => {
            try {
              if (activar) {
                await this.bancosService.activar(item.id);
                await this.showToast('Banco activado.', 'success');
              } else {
                await this.bancosService.desactivar(item.id);
                await this.showToast('Banco desactivado.', 'success');
              }
              await this.cargar();
            } catch (error: any) {
              await this.showToast(
                error?.message || (activar ? 'No se pudo activar.' : 'No se pudo desactivar.'),
                'danger'
              );
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
