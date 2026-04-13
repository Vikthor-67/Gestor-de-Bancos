import { Component, OnInit } from '@angular/core';
import { IonContent, AlertController, ToastController } from '@ionic/angular';
import { ViewChild } from '@angular/core';
import { Servicio, ServicioPayload, TipoServicio } from '../models/servicio.model';
import { Servicios } from '../services/servicios';

@Component({
  selector: 'app-servicios',
  templateUrl: './servicios.page.html',
  styleUrls: ['./servicios.page.scss'],
  standalone: false,
})
export class ServiciosPage implements OnInit {
  @ViewChild(IonContent, { static: false }) content?: IonContent;

  servicios: Servicio[] = [];
  filtroTipo: TipoServicio | '' = '';
  mostrarDeshabilitados = false;

  form: ServicioPayload = {
    nombre: '',
    tipo: 'publico',
    descripcion: '',
    estado: true,
  };

  editId: number | null = null;
  loading = false;

  constructor(
    private serviciosService: Servicios,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.loading = true;
    try {
      this.servicios = await this.serviciosService.getServicios(this.filtroTipo || undefined, this.mostrarDeshabilitados);
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudieron cargar los servicios.', 'danger');
      this.servicios = [];
    } finally {
      this.loading = false;
    }
  }

  editar(item: Servicio): void {
    this.editId = item.id;
    this.form = {
      nombre: item.nombre,
      tipo: item.tipo,
      descripcion: item.descripcion || '',
      estado: item.estado,
    };

    // Lleva al formulario para que el flujo de edicion sea inmediato.
    void this.content?.scrollToTop(450);
  }

  limpiar(): void {
    this.editId = null;
    this.form = { nombre: '', tipo: 'publico', descripcion: '', estado: true };
  }

  async guardar(): Promise<void> {
    if (!this.form.nombre || !this.form.tipo) {
      await this.showToast('Nombre y tipo son obligatorios.', 'warning');
      return;
    }

    try {
      if (this.editId) {
        await this.serviciosService.actualizar(this.editId, this.form);
        await this.showToast('Servicio actualizado.', 'success');
      } else {
        await this.serviciosService.crear(this.form);
        await this.showToast('Servicio creado.', 'success');
      }
      this.limpiar();
      await this.cargar();
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo guardar el servicio.', 'danger');
    }
  }

  async cambiarEstado(item: Servicio): Promise<void> {
    const activar = !item.estado;
    const alert = await this.alertController.create({
      header: activar ? 'Habilitar servicio' : 'Deshabilitar servicio',
      message: activar
        ? `Deseas habilitar ${item.nombre}? Volvera a estar disponible.`
        : `Deseas deshabilitar ${item.nombre}? Dejara de mostrarse en la app.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: activar ? 'Habilitar' : 'Deshabilitar',
          role: activar ? 'confirm' : 'destructive',
          handler: async () => {
            try {
              await this.serviciosService.cambiarEstado(item.id, activar);
              await this.showToast(activar ? 'Servicio habilitado.' : 'Servicio deshabilitado.', 'success');
              if (this.editId === item.id) {
                this.limpiar();
              }
              await this.cargar();
            } catch (error: any) {
              await this.showToast(error?.message || 'No se pudo eliminar el servicio.', 'danger');
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
