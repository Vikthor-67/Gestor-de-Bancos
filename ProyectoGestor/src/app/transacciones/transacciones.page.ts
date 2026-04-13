import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Banco } from '../models/banco.model';
import { TipoTransaccion } from '../models/tipo-transaccion.model';
import { Bancos } from '../services/bancos';
import { Catalogos } from '../services/catalogos';
import { Transaccion } from '../models/transaccion.model';
import { FechasLocales } from '../services/fechas-locales';
import { Transacciones } from '../services/transacciones';

@Component({
  selector: 'app-transacciones',
  templateUrl: './transacciones.page.html',
  styleUrls: ['./transacciones.page.scss'],
  standalone: false,
})
export class TransaccionesPage implements OnInit {
  transacciones: Transaccion[] = [];
  transaccionesFiltradas: Transaccion[] = [];
  bancos: Banco[] = [];
  tiposTransaccion: TipoTransaccion[] = [];

  filtros = {
    idBanco: null as number | null,
    idTipo: null as number | null,
    busqueda: '',
    cuentaDestino: '',
  };

  loading = false;

  constructor(
    private transaccionesService: Transacciones,
    private bancosService: Bancos,
    private catalogosService: Catalogos,
    public fechasLocal: FechasLocales,
    private toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.cargarCatalogos();
    await this.cargarTransacciones();
  }

  private async cargarCatalogos(): Promise<void> {
    try {
      this.bancos = await this.bancosService.getBancos(true);
    } catch {
      this.bancos = [];
    }

    try {
      this.tiposTransaccion = await this.catalogosService.getTiposTransaccion();
    } catch {
      this.tiposTransaccion = [];
    }
  }

  async cargarTransacciones(): Promise<void> {
    this.loading = true;
    try {
      this.transacciones = await this.transaccionesService.getTransacciones({
        idBanco: this.filtros.idBanco || undefined,
        idTipo: this.filtros.idTipo || undefined,
      });
      this.aplicarBusquedaLocal();
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo cargar transacciones.', 'danger');
    } finally {
      this.loading = false;
    }
  }

  aplicarBusquedaLocal(): void {
    const q = this.filtros.busqueda.trim().toLowerCase();
    const cuenta = this.filtros.cuentaDestino.trim().toLowerCase();

    this.transaccionesFiltradas = this.transacciones.filter((item) => {
      const cliente = String(item.nombreCliente || '').toLowerCase();
      const ref = String(item.numeroReferencia || '').toLowerCase();
      const cuentaDest = String(item.cuentaDestino || '').toLowerCase();

      const coincideBusqueda = !q || cliente.includes(q) || ref.includes(q);
      const coincideCuenta = !cuenta || cuentaDest.includes(cuenta);

      return coincideBusqueda && coincideCuenta;
    });
  }

  async anular(id: number): Promise<void> {
    try {
      await this.transaccionesService.anular(id);
      await this.showToast('Transaccion anulada correctamente.', 'success');
      await this.cargarTransacciones();
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo anular la transaccion.', 'danger');
    }
  }

  estadoVisual(item: Transaccion): 'Pendiente' | 'Completada' | 'Anulada' {
    const valor = String(item.anulado || '').toLowerCase();
    if (valor === 'completada' || valor === 'completado') return 'Completada';
    if (valor === 'anulado' || valor === 'anulada') return 'Anulada';
    return 'Pendiente';
  }

  colorEstadoVisual(item: Transaccion): 'warning' | 'success' | 'danger' {
    const valor = String(item.anulado || '').toLowerCase();
    if (valor === 'completada' || valor === 'completado') return 'success';
    if (valor === 'anulado' || valor === 'anulada') return 'danger';
    return 'warning';
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
