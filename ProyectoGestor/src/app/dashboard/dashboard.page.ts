import { Component, OnDestroy, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Banco } from '../models/banco.model';
import { DashboardComisionesMetricas, DashboardResumen, ResumenBanco } from '../models/dashboard.model';
import { TipoTransaccion } from '../models/tipo-transaccion.model';
import { CajaCerrada, ResumenOperativoGlobal } from '../models/caja.model';
import { Bancos } from '../services/bancos';
import { CajaService } from '../services/caja';
import { Catalogos } from '../services/catalogos';
import { FechasLocales } from '../services/fechas-locales';
import { Auth } from '../services/auth';
import { Dashboard } from '../services/dashboard';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage implements OnInit, OnDestroy {
  resumen: DashboardResumen = { totalTransacciones: 0, totalMonto: 0, totalComisiones: 0, cajaEstado: 'sin-caja' };
  resumenBanco: ResumenBanco[] = [];
  metricasComisiones: DashboardComisionesMetricas = {
    mes: '', fechaInicio: '', fechaFin: '',
    totalComisionDiaria: 0, totalComisionMensual: 0, totalComisionHastaFecha: 0, totalComisionRango: 0,
    totalMontoDiario: 0, totalMontoMensual: 0, totalMontoHastaFecha: 0, totalMontoRango: 0, totalTransaccionesRango: 0,
  };
  bancos: Banco[] = [];
  tiposTransaccion: TipoTransaccion[] = [];
  filtroBancoId: number | null = null;
  filtroTipoTransId: number | null = null;
  filtroMes = '';
  cajasCerradas: CajaCerrada[] = [];
  fechaInicio = '';
  fechaFin = '';
  loading = false;
  resumenOperativo: ResumenOperativoGlobal | null = null;
  ultimaActualizacion = '';

  readonly piePalette = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#6366f1'];

  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private dashboardService: Dashboard,
    private bancosService: Bancos,
    private catalogosService: Catalogos,
    private cajaService: CajaService,
    public fechasLocal: FechasLocales,
    private toastController: ToastController,
    private auth: Auth,
  ) {}

  private inicializarFiltrosFecha(): void {
    if (!this.filtroMes)    this.filtroMes    = this.fechasLocal.mesActualISO();
    if (!this.fechaInicio)  this.fechaInicio  = this.fechasLocal.fechaHoyISO();
    if (!this.fechaFin)     this.fechaFin     = this.fechasLocal.fechaHoyISO();
    this.metricasComisiones = { ...this.metricasComisiones, mes: this.filtroMes, fechaInicio: this.fechaInicio, fechaFin: this.fechaFin };
  }

  async ngOnInit(): Promise<void> {
    this.inicializarFiltrosFecha();
    await this.cargarCatalogos();
    await this.cargarDashboard();
  }

  async ionViewWillEnter(): Promise<void> {
    this.inicializarFiltrosFecha();
    await this.cargarCatalogos();
    await this.cargarDashboard();
    this.iniciarActualizacionAutomatica();
  }

  ionViewWillLeave(): void { this.detenerActualizacionAutomatica(); }
  ngOnDestroy(): void      { this.detenerActualizacionAutomatica(); }

  private iniciarActualizacionAutomatica(): void {
    this.detenerActualizacionAutomatica();
    void this.cargarResumenOperativo();
    this.refreshInterval = setInterval(() => void this.cargarResumenOperativo(), 15000);
  }

  private detenerActualizacionAutomatica(): void {
    if (this.refreshInterval !== null) { clearInterval(this.refreshInterval); this.refreshInterval = null; }
  }

  async cargarResumenOperativo(): Promise<void> {
    try {
      this.resumenOperativo = await this.cajaService.getResumenOperativoGlobal();
      this.ultimaActualizacion = this.fechasLocal.ahoraHMS();
    } catch {}
  }

  private async cargarCatalogos(): Promise<void> {
    try { this.bancos = await this.bancosService.getBancos(true); } catch { this.bancos = []; }
    try { this.tiposTransaccion = await this.catalogosService.getTiposTransaccion(); } catch { this.tiposTransaccion = []; }
  }

  async cargarDashboard(): Promise<void> {
    this.loading = true;
    try {
      try { this.resumen = await this.dashboardService.getResumen(); } catch { /* mantiene valor anterior */ }
      try { this.resumenBanco = await this.dashboardService.getPorBanco(this.fechaInicio, this.fechaFin, this.filtroBancoId, this.filtroTipoTransId); } catch { this.resumenBanco = []; }
      try { this.metricasComisiones = await this.dashboardService.getMetricasComisiones(this.fechaInicio, this.fechaFin, this.filtroMes, this.filtroBancoId, this.filtroTipoTransId); } catch { /* mantiene valor anterior */ }
      try {
        const cajaList = await this.cajaService.getHistorialCajasCerradas();
        this.cajasCerradas = cajaList.sort((a: CajaCerrada, b: CajaCerrada) => {
          const fa = this.fechasLocal.parseFechaLocal(a.fechaCierre || a.fecha)?.getTime() || 0;
          const fb = this.fechasLocal.parseFechaLocal(b.fechaCierre || b.fecha)?.getTime() || 0;
          return fb - fa;
        });
      } catch { this.cajasCerradas = []; }

      await this.cargarResumenOperativo();
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo cargar el dashboard.', 'danger');
    } finally {
      this.loading = false;
    }
  }

  // ---- Grafica circular: transacciones por tipo ----
  get datosPastelTipos(): Array<{ tipo: string; total: number; transacciones: number }> {
    const map = new Map<string, { total: number; transacciones: number }>();
    for (const item of this.resumenBanco) {
      const tipo = item.tipoTransaccion || 'Otros';
      const prev = map.get(tipo) || { total: 0, transacciones: 0 };
      map.set(tipo, { total: prev.total + Number(item.totalMonto || 0), transacciones: prev.transacciones + Number(item.totalTransacciones || 0) });
    }
    return Array.from(map.entries()).map(([tipo, data]) => ({ tipo, ...data })).sort((a, b) => b.total - a.total);
  }

  get totalPastelTipos(): number { return this.datosPastelTipos.reduce((acc, i) => acc + i.total, 0); }

  get pastelBackgroundTipos(): string {
    const datos = this.datosPastelTipos;
    if (datos.length === 0 || this.totalPastelTipos <= 0) return 'conic-gradient(#e5e7eb 0 100%)';
    let acum = 0;
    return `conic-gradient(${datos.map((item, i) => {
      const pct = (item.total / this.totalPastelTipos) * 100;
      const from = acum; acum += pct;
      return `${this.piePalette[i % this.piePalette.length]} ${from}% ${acum}%`;
    }).join(', ')})`;
  }

  porcentajeTipo(item: { total: number }): number {
    return this.totalPastelTipos <= 0 ? 0 : (item.total / this.totalPastelTipos) * 100;
  }

  colorItem(index: number): string { return this.piePalette[index % this.piePalette.length]; }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL', minimumFractionDigits: 2 }).format(value || 0);
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2200, color, position: 'top' });
    await toast.present();
  }
}

