import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Transaccion } from '../models/transaccion.model';
import { FechasLocales } from '../services/fechas-locales';
import { TransaccionBorradorService } from '../services/transaccion-borrador';
import { Transacciones } from '../services/transacciones';

@Component({
  selector: 'app-transaccion-detalle',
  templateUrl: './transaccion-detalle.page.html',
  styleUrls: ['./transaccion-detalle.page.scss'],
  standalone: false,
})
export class TransaccionDetallePage implements OnInit {
  transaccion: Transaccion | null = null;
  id = 0;
  esBorrador = false;
  loading = false;
  mostrarFotoAmpliada = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private transaccionesService: Transacciones,
    public fechasLocal: FechasLocales,
    private borradorService: TransaccionBorradorService,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  async ngOnInit(): Promise<void> {
    this.id = Number(this.route.snapshot.paramMap.get('id') || 0);
    if (!this.id) {
      const borrador = this.borradorService.obtener();
      if (!borrador) {
        await this.router.navigateByUrl('/transacciones');
        return;
      }

      this.esBorrador = true;
      this.transaccion = {
        id: 0,
        idBanco: borrador.payload.idBanco,
        idTipoTrans: borrador.payload.idTipoTrans,
        idServicio: borrador.payload.idServicio ?? null,
        idUsuario: borrador.payload.idUsuario,
        numeroReferencia: borrador.payload.numeroReferencia ?? null,
        nombreCliente: borrador.payload.nombreCliente,
        monto: Number(borrador.payload.monto || 0),
        comision: Number(borrador.payload.comision || 0),
        anulado: null,
        observacion: borrador.payload.observacion ?? null,
        fechaTransaccion: borrador.fechaTransaccion,
        latitud: borrador.payload.latitud ?? null,
        longitud: borrador.payload.longitud ?? null,
        fotoComprobante: borrador.payload.fotoComprobante ?? null,
      };
      return;
    }
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.loading = true;
    try {
      this.transaccion = await this.transaccionesService.getTransaccionById(this.id);
      if (!this.transaccion) {
        await this.showToast('Transaccion no encontrada.', 'warning');
      }
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo obtener el detalle.', 'danger');
    } finally {
      this.loading = false;
    }
  }

  abrirFoto(): void {
    if (this.transaccion?.fotoComprobante) {
      this.mostrarFotoAmpliada = true;
    }
  }

  cerrarFoto(): void {
    this.mostrarFotoAmpliada = false;
  }

  async guardarCambios(): Promise<void> {
    if (!this.transaccion) {
      return;
    }

    if (this.esBorrador) {
      const borrador = this.borradorService.obtener();
      if (!borrador) {
        await this.showToast('No se encontro el borrador.', 'warning');
        return;
      }

      this.borradorService.guardar({
        ...borrador.payload,
        observacion: this.transaccion.observacion || null,
      });
      await this.showToast('Borrador actualizado.', 'success');
      return;
    }

    try {
      await this.transaccionesService.actualizar(this.id, {
        observacion: this.transaccion.observacion || null,
      });
      await this.showToast('Transaccion actualizada.', 'success');
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo actualizar.', 'danger');
    }
  }

  async anular(): Promise<void> {
    if (!this.esBorrador && this.esAnulada()) {
      await this.showToast('La transaccion ya esta anulada.', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirmar anulacion',
      message: 'Desea anular esta transaccion?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Anular',
          role: 'destructive',
          handler: async () => {
            try {
              if (this.esBorrador) {
                const borrador = this.borradorService.obtener();
                if (!borrador) {
                  await this.showToast('No se encontro el borrador.', 'warning');
                  return;
                }

                await this.transaccionesService.crear({
                  ...borrador.payload,
                  anulado: 'anulada',
                });
                this.borradorService.limpiar();
                await this.showToast('Transaccion anulada y respaldada en base.', 'success');
                await this.router.navigateByUrl('/transaccion-form');
              } else {
                await this.transaccionesService.anular(this.id);
                await this.showToast('Transaccion anulada.', 'success');
                await this.router.navigateByUrl('/transaccion-form');
              }
            } catch (error: any) {
              await this.showToast(error?.message || 'No se pudo anular.', 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async aprobar(): Promise<void> {
    if (!this.esBorrador && !this.esPendiente()) {
      await this.showToast('Solo una transaccion pendiente puede aprobarse.', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirmar aprobacion',
      message: 'Desea aprobar esta transaccion?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Aprobar',
          handler: async () => {
            try {
              if (this.esBorrador) {
                const borrador = this.borradorService.obtener();
                if (!borrador) {
                  await this.showToast('No se encontro el borrador.', 'warning');
                  return;
                }

                await this.transaccionesService.crear({
                  ...borrador.payload,
                  anulado: 'completada',
                });
                this.borradorService.limpiar();
                await this.showToast('Transaccion aprobada y registrada.', 'success');
                await this.router.navigateByUrl('/transacciones');
              } else {
                await this.transaccionesService.aprobar(this.id);
                await this.showToast('Transaccion aprobada.', 'success');
                await this.cargar();
              }
            } catch (error: any) {
              await this.showToast(error?.message || 'No se pudo aprobar.', 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  estadoVisual(): 'Pendiente' | 'Completada' | 'Anulada' {
    if (this.esBorrador) return 'Pendiente';
    const valor = String(this.transaccion?.anulado || '').toLowerCase();
    if (valor === 'completada' || valor === 'completado') return 'Completada';
    if (valor === 'anulado' || valor === 'anulada') return 'Anulada';
    return 'Pendiente';
  }

  colorEstadoVisual(): 'warning' | 'success' | 'danger' {
    if (this.esBorrador) return 'warning';
    const valor = String(this.transaccion?.anulado || '').toLowerCase();
    if (valor === 'completada' || valor === 'completado') return 'success';
    if (valor === 'anulado' || valor === 'anulada') return 'danger';
    return 'warning';
  }

  estaCompletada(): boolean {
    if (this.esBorrador) return false;
    const valor = String(this.transaccion?.anulado || '').toLowerCase();
    return valor === 'completada' || valor === 'completado';
  }

  esPendiente(): boolean {
    if (this.esBorrador) return true;
    const valor = String(this.transaccion?.anulado || '').trim().toLowerCase();
    return valor === '';
  }

  esAnulada(): boolean {
    if (this.esBorrador) return false;
    const valor = String(this.transaccion?.anulado || '').trim().toLowerCase();
    return valor === 'anulada' || valor === 'anulado';
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: 'HNL',
      minimumFractionDigits: 2,
    }).format(value || 0);
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
