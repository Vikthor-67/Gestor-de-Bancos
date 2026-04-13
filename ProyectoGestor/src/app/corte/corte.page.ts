import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { CajaCerrada, CorteCaja } from '../models/caja.model';
import { Banco } from '../models/banco.model';
import { Auth } from '../services/auth';
import { Bancos } from '../services/bancos';
import { CajaService } from '../services/caja';
import { FechasLocales } from '../services/fechas-locales';

@Component({
  selector: 'app-corte',
  templateUrl: './corte.page.html',
  styleUrls: ['./corte.page.scss'],
  standalone: false,
})
export class CortePage implements OnInit {
  corte: CorteCaja | null = null;
  cajasCerradas: CajaCerrada[] = [];
  cajasFiltradas: CajaCerrada[] = [];
  bancos: Banco[] = [];
  filtroBancoId: number | null = null;
  fechaDesde = '';
  fechaHasta = '';
  mostrarDesdePicker = false;
  mostrarHastaPicker = false;
  loading = false;

  constructor(
    private auth: Auth,
    private cajaService: CajaService,
    private bancosService: Bancos,
    private router: Router,
    public fechasLocal: FechasLocales,
    private toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([this.cargarBancos(), this.cargarCorte(), this.cargarHistorialCajas()]);
  }

  async ionViewWillEnter(): Promise<void> {
    await Promise.all([this.cargarBancos(), this.cargarCorte(), this.cargarHistorialCajas()]);
  }

  private isoDateOnly(value: string | null | undefined): string {
    if (!value) return '';
    const d = this.fechasLocal.parseFechaLocal(value);
    if (!d) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private fechaOrdenCierre(caja: CajaCerrada): number {
    return this.fechasLocal.parseFechaLocal(caja.fechaCierre || caja.fecha)?.getTime() || 0;
  }

  async cargarHistorialCajas(): Promise<void> {
    this.cajasCerradas = await this.cajaService.getHistorialCajasCerradas();
    this.cajasCerradas = this.cajasCerradas.sort((a, b) => this.fechaOrdenCierre(b) - this.fechaOrdenCierre(a));

    if (!this.fechaHasta && this.cajasCerradas.length > 0) {
      this.fechaHasta = this.isoDateOnly(this.cajasCerradas[0].fechaCierre || this.cajasCerradas[0].fecha);
    }

    if (!this.fechaDesde && this.fechaHasta) {
      this.fechaDesde = this.fechaHasta;
    }

    this.aplicarFiltroFechas();
  }

  async cargarBancos(): Promise<void> {
    try {
      this.bancos = await this.bancosService.getBancos();
    } catch {
      this.bancos = [];
    }
  }

  async cargarCorte(): Promise<void> {
    const usuario = this.auth.getUsuarioSesion();
    if (!usuario) {
      await this.router.navigateByUrl('/login');
      return;
    }

    this.loading = true;
    try {
      this.corte = await this.cajaService.getUltimoCorte(usuario.id, this.filtroBancoId ?? undefined);
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo obtener el corte.', 'danger');
      this.corte = null;
    } finally {
      this.loading = false;
    }
  }

  async aplicarFiltroBanco(): Promise<void> {
    await this.cargarCorte();
    this.aplicarFiltroFechas();
  }

  async limpiarFiltroBanco(): Promise<void> {
    this.filtroBancoId = null;
    await this.cargarCorte();
    this.aplicarFiltroFechas();
  }

  aplicarFiltroFechas(): void {
    const desde = this.fechaDesde ? new Date(`${this.fechaDesde}T00:00:00`) : null;
    const hasta = this.fechaHasta ? new Date(`${this.fechaHasta}T23:59:59`) : null;

    this.cajasFiltradas = this.cajasCerradas.filter((caja) => {
      const fecha = this.fechasLocal.parseFechaLocal(caja.fechaCierre || caja.fecha);
      if (!fecha) return false;
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
      return true;
    }).sort((a, b) => this.fechaOrdenCierre(b) - this.fechaOrdenCierre(a));
  }

  abrirSelectorDesde(): void {
    this.mostrarDesdePicker = true;
  }

  abrirSelectorHasta(): void {
    this.mostrarHastaPicker = true;
  }

  onFechaDesdeChange(event: any): void {
    const valor = this.extraerFecha(event?.detail?.value);
    if (valor) {
      this.fechaDesde = valor;
      if (this.fechaHasta && this.fechaDesde > this.fechaHasta) {
        this.fechaHasta = this.fechaDesde;
      }
      this.aplicarFiltroFechas();
    }
    this.mostrarDesdePicker = false;
  }

  onFechaHastaChange(event: any): void {
    const valor = this.extraerFecha(event?.detail?.value);
    if (valor) {
      this.fechaHasta = valor;
      if (this.fechaDesde && this.fechaHasta < this.fechaDesde) {
        this.fechaDesde = this.fechaHasta;
      }
      this.aplicarFiltroFechas();
    }
    this.mostrarHastaPicker = false;
  }

  private extraerFecha(valor: unknown): string {
    if (!valor || typeof valor !== 'string') return '';

    // ion-datetime puede devolver ISO con zona horaria; tomamos solo YYYY-MM-DD
    // para evitar que el huso horario mueva la fecha un día.
    const match = valor.match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
  }

  formatFechaVisual(valor: string): string {
    if (!valor) return 'Seleccionar fecha';
    const fecha = this.fechasLocal.parseFechaLocal(`${valor}T00:00:00`);
    if (!fecha) return 'Seleccionar fecha';
    return fecha.toLocaleDateString('es-HN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  async limpiarFiltroFechas(): Promise<void> {
    this.fechaDesde = '';
    if (this.cajasCerradas.length > 0) {
      this.fechaHasta = this.isoDateOnly(this.cajasCerradas[0].fechaCierre || this.cajasCerradas[0].fecha);
      this.fechaDesde = this.fechaHasta;
    } else {
      this.fechaHasta = '';
    }
    this.aplicarFiltroFechas();
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
