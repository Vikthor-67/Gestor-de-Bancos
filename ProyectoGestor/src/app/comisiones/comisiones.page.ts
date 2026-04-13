import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Banco } from '../models/banco.model';
import { ComisionConfig, ComisionPayload, ReporteComisiones } from '../models/comision.model';
import { TipoTransaccion } from '../models/tipo-transaccion.model';
import { Bancos } from '../services/bancos';
import { Catalogos } from '../services/catalogos';
import { Comisiones } from '../services/comisiones';
import { FechasLocales } from '../services/fechas-locales';
import { parseMoneyNumber } from '../services/money-format';

@Component({
  selector: 'app-comisiones',
  templateUrl: './comisiones.page.html',
  styleUrls: ['./comisiones.page.scss'],
  standalone: false,
})
export class ComisionesPage implements OnInit {
  private static readonly DRAFT_KEY = 'comisiones_form_draft_v1';
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  bancos: Banco[] = [];
  tiposTransaccion: TipoTransaccion[] = [];
  comisiones: ComisionConfig[] = [];

  // Tabs
  vistaActiva: 'configuracion' | 'reporte' = 'configuracion';

  // Reporte
  mesFiltro: string = '';
  reporte: ReporteComisiones | null = null;
  loadingReporte = false;

  editId: number | null = null;
  guardandoCambios = false;
  form: ComisionPayload = {
    idBanco: null,
    idTipoTrans: null,
    comisionFija: 0,
    comisionPorcentaje: 0,
    montoMinimo: 0,
    montoMaximo: null,
    esDefault: false,
    estado: true,
  };

  constructor(
    private bancosService: Bancos,
    private catalogosService: Catalogos,
    private comisionesService: Comisiones,
    private toastController: ToastController,
    public fechasLocal: FechasLocales,
  ) {}

  async ngOnInit(): Promise<void> {
    this.cargarBorradorLocal();
    this.mesFiltro = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Tegucigalpa', year: 'numeric', month: '2-digit',
    }).format(new Date()).slice(0, 7);
    await Promise.all([this.cargarBancos(), this.cargarTiposTransaccion(), this.cargarComisiones()]);
  }

  async ionViewWillEnter(): Promise<void> {
    await this.cargarComisiones();
  }

  async cambiarVista(evento: any): Promise<void> {
    this.vistaActiva = evento.detail.value;
    if (this.vistaActiva === 'reporte' && !this.reporte) {
      await this.cargarReporte();
    }
  }

  async cargarReporte(): Promise<void> {
    this.loadingReporte = true;
    this.reporte = null;
    try {
      this.reporte = await this.comisionesService.getReporte(this.mesFiltro);
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo cargar el reporte.', 'danger');
    } finally {
      this.loadingReporte = false;
    }
  }

  async cargarBancos(): Promise<void> {
    try {
      this.bancos = await this.bancosService.getBancos(true);
      console.log('Bancos cargados:', this.bancos);
    } catch (error) {
      console.error('Error cargando bancos:', error);
      this.bancos = [];
    }
  }

  async cargarTiposTransaccion(): Promise<void> {
    try {
      this.tiposTransaccion = await this.catalogosService.getTiposTransaccion();
    } catch {
      this.tiposTransaccion = [];
    }
  }

  async cargarComisiones(): Promise<void> {
    try {
      this.comisiones = await this.comisionesService.getComisiones();
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudieron cargar las comisiones.', 'danger');
      this.comisiones = [];
    }
  }

  editar(item: ComisionConfig): void {
    this.editId = item.id;
    this.form = {
      idBanco: item.idBanco,
      idTipoTrans: item.idTipoTrans,
      comisionFija: Number(item.comisionFija || 0),
      comisionPorcentaje: Number(item.comisionPorcentaje || 0),
      montoMinimo: Number(item.montoMinimo || 0),
      montoMaximo: item.montoMaximo,
      esDefault: !!item.esDefault,
      estado: !!item.estado,
    };
    this.guardarBorradorLocal();

    setTimeout(() => {
      document.getElementById('form-comision')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  limpiar(): void {
    this.editId = null;
    this.form = {
      idBanco: null,
      idTipoTrans: null,
      comisionFija: 0,
      comisionPorcentaje: 0,
      montoMinimo: 0,
      montoMaximo: null,
      esDefault: false,
      estado: true,
    };
    localStorage.removeItem(ComisionesPage.DRAFT_KEY);
  }

  onComisionFijaChange(value: unknown): void {
    this.form.comisionFija = this.parseMoney(value) ?? 0;
    this.guardarBorradorLocal();
    this.programarAutoGuardado();
  }

  onMontoMinimoChange(value: unknown): void {
    this.form.montoMinimo = this.parseMoney(value) ?? 0;
    this.guardarBorradorLocal();
    this.programarAutoGuardado();
  }

  onMontoMaximoChange(value: unknown): void {
    this.form.montoMaximo = this.parseMoney(value);
    this.guardarBorradorLocal();
    this.programarAutoGuardado();
  }

  onComisionPorcentajeChange(value: unknown): void {
    const numero = Number(value);
    this.form.comisionPorcentaje = Number.isNaN(numero) ? 0 : numero;
    this.guardarBorradorLocal();
    this.programarAutoGuardado();
  }

  onCampoClaveChange(): void {
    this.guardarBorradorLocal();
    this.programarAutoGuardado();
  }

  async guardar(): Promise<void> {
    if (Number(this.form.montoMaximo) > 0 && Number(this.form.montoMaximo) < Number(this.form.montoMinimo)) {
      await this.showToast('Monto maximo no puede ser menor al monto minimo.', 'warning');
      return;
    }

    try {
      const payload = {
        ...this.form,
        idBanco: this.form.idBanco || null,
        idTipoTrans: this.form.idTipoTrans || null,
        montoMaximo: this.form.montoMaximo || null,
      };

      if (this.editId) {
        await this.comisionesService.actualizar(this.editId, payload);
      } else {
        await this.comisionesService.guardar(payload);
      }

      await this.showToast(this.editId ? 'Comision actualizada.' : 'Comision creada.', 'success');
      this.limpiar();
      await this.cargarComisiones();
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo guardar la comision.', 'danger');
    }
  }

  async onToggleChange(): Promise<void> {
    this.guardarBorradorLocal();
    this.programarAutoGuardado();
  }

  private programarAutoGuardado(): void {
    if (!this.editId) {
      return;
    }

    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    this.autoSaveTimer = setTimeout(() => {
      void this.guardarCambiosAutomaticamente();
    }, 450);
  }

  private async guardarCambiosAutomaticamente(): Promise<void> {
    if (!this.editId || this.guardandoCambios) {
      return;
    }

    this.guardandoCambios = true;
    try {
      await this.comisionesService.actualizar(this.editId, this.buildPayload());
      await this.cargarComisiones();
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo guardar el cambio.', 'danger');
    } finally {
      this.guardandoCambios = false;
    }
  }

  private buildPayload(): ComisionPayload {
    return {
      ...this.form,
      idBanco: this.form.idBanco || null,
      idTipoTrans: this.form.idTipoTrans || null,
      montoMaximo: this.form.montoMaximo || null,
    };
  }

  private guardarBorradorLocal(): void {
    const draft = {
      editId: this.editId,
      form: this.form,
    };
    localStorage.setItem(ComisionesPage.DRAFT_KEY, JSON.stringify(draft));
  }

  private cargarBorradorLocal(): void {
    try {
      const raw = localStorage.getItem(ComisionesPage.DRAFT_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      this.editId = Number(parsed?.editId) || null;
      this.form = {
        idBanco: parsed?.form?.idBanco ?? null,
        idTipoTrans: parsed?.form?.idTipoTrans ?? null,
        comisionFija: Number(parsed?.form?.comisionFija ?? 0),
        comisionPorcentaje: Number(parsed?.form?.comisionPorcentaje ?? 0),
        montoMinimo: Number(parsed?.form?.montoMinimo ?? 0),
        montoMaximo: parsed?.form?.montoMaximo === null || parsed?.form?.montoMaximo === undefined
          ? null
          : Number(parsed.form.montoMaximo),
        esDefault: !!parsed?.form?.esDefault,
        estado: parsed?.form?.estado === undefined ? true : !!parsed.form.estado,
      };
    } catch {
      localStorage.removeItem(ComisionesPage.DRAFT_KEY);
    }
  }

  async toggleEstado(item: ComisionConfig): Promise<void> {
    try {
      await this.comisionesService.cambiarEstado(item.id, !item.estado);
      await this.showToast(!item.estado ? 'Comision activada.' : 'Comision desactivada.', 'success');
      await this.cargarComisiones();
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo cambiar el estado.', 'danger');
    }
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: 'HNL',
      minimumFractionDigits: 2,
    }).format(value || 0);
  }

  private parseMoney(value: unknown): number | null {
    return parseMoneyNumber(value);
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
