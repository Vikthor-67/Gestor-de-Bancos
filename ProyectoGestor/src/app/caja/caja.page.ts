import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Banco } from '../models/banco.model';
import { Caja, CajaConfigAperturaBanco, CajaResumenOperativo, CajaSaldoBancoActual, MovimientoCaja } from '../models/caja.model';
import { Auth } from '../services/auth';
import { Bancos } from '../services/bancos';
import { FechasLocales } from '../services/fechas-locales';
import { CajaService } from '../services/caja';
import { parseMoneyNumber } from '../services/money-format';

@Component({
  selector: 'app-caja',
  templateUrl: './caja.page.html',
  styleUrls: ['./caja.page.scss'],
  standalone: false,
})
export class CajaPage implements OnInit {
  caja: Caja | null = null;
  efectivoInicial: number | null = null;
  bancosActivos: Banco[] = [];
  saldosInicialesBanco: Record<number, number | null> = {};
  saldosActualesPorBanco: CajaSaldoBancoActual[] = [];
  resumenOperativo: CajaResumenOperativo | null = null;
  reglasExpandida = false;
  montoCierre: number | string | null = null;
  observacionCierre = '';
  loading = false;

  // Ingreso de Capital / Gastos
  movCapitalForm = {
    tipo: 'ingreso' as 'ingreso' | 'egreso',
    monto: null as number | null,
    concepto: '',
    modalidad: 'efectivo' as 'efectivo' | 'banco',
    idBanco: null as number | null,
  };
  savingMovCapital = false;
  movimientosCapital: MovimientoCaja[] = [];
  filtroMovCapital: '' | 'ingreso' | 'egreso' = '';
  loadingMovCapital = false;

  constructor(
    private cajaService: CajaService,
    private bancosService: Bancos,
    private auth: Auth,
    private router: Router,
    public fechasLocal: FechasLocales,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.cargarBancosActivos();
    await this.cargarCaja();
    await this.cargarConfiguracionApertura();
    await this.cargarSaldosActualesPorBanco();
    await this.cargarResumenOperativo();
    await this.cargarMovimientosCapital();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.cargarBancosActivos();
    await this.cargarCaja();
    await this.cargarConfiguracionApertura();
    await this.cargarSaldosActualesPorBanco();
    await this.cargarResumenOperativo();
    await this.cargarMovimientosCapital();
  }

  private async cargarResumenOperativo(): Promise<void> {
    const usuarioId = this.usuarioSesionId;
    if (!usuarioId) {
      this.resumenOperativo = null;
      return;
    }

    try {
      // Pasar idCaja para filtrar exactamente por esta sesion de caja
      this.resumenOperativo = await this.cajaService.getResumenOperativo(
        usuarioId,
        this.fechaHoyISO(),
        this.caja?.fechaApertura ?? null,
        this.caja?.id ?? null,
      );
    } catch {
      this.resumenOperativo = null;
    }
  }

  private async cargarSaldosActualesPorBanco(): Promise<void> {
    const usuarioId = this.usuarioSesionId;
    if (!usuarioId) {
      this.saldosActualesPorBanco = [];
      return;
    }

    try {
      // Pasar idCaja para filtrar exactamente por esta sesion de caja
      this.saldosActualesPorBanco = await this.cajaService.getSaldosActualesPorBanco(
        usuarioId,
        this.fechaHoyISO(),
        this.caja?.fechaApertura ?? null,
        this.caja?.id ?? null,
      );
    } catch {
      this.saldosActualesPorBanco = [];
    }
  }

  private get usuarioSesionId(): number | null {
    return this.auth.getUsuarioSesion()?.id || null;
  }

  private get configAperturaKey(): string {
    return `caja_apertura_config_${this.usuarioSesionId || 'anon'}`;
  }

  private fechaHoyISO(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tegucigalpa' }).format(new Date());
  }

  private fechaMananaISO(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tegucigalpa' }).format(new Date(Date.now() + 86400000));
  }

  private fechaHoraLocalSql(fecha = new Date()): string {
    const tz = 'America/Tegucigalpa';
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(fecha);
    const g = (t: string) => p.find((x: Intl.DateTimeFormatPart) => x.type === t)?.value ?? '00';
    const hr = String(Number(g('hour')) % 24).padStart(2, '0');
    const ms = String(fecha.getMilliseconds()).padStart(3, '0');
    return `${g('year')}-${g('month')}-${g('day')} ${hr}:${g('minute')}:${g('second')}.${ms}`;
  }

  private async cargarBancosActivos(): Promise<void> {
    try {
      this.bancosActivos = await this.bancosService.getBancos();
      for (const banco of this.bancosActivos) {
        if (this.saldosInicialesBanco[banco.id] === undefined) {
          this.saldosInicialesBanco[banco.id] = null;
        }
      }
    } catch {
      this.bancosActivos = [];
    }
  }

  private async cargarConfiguracionAperturaApi(): Promise<void> {
    const usuarioId = this.usuarioSesionId;
    if (!usuarioId) {
      return;
    }

    const config = await this.cajaService.getConfigApertura(usuarioId, this.fechaHoyISO());
    this.efectivoInicial = Number(config.efectivoInicial || 0);

    for (const banco of this.bancosActivos) {
      const encontrado = (config.saldosBancos || []).find((x) => Number(x.idBanco) === Number(banco.id));
      this.saldosInicialesBanco[banco.id] = encontrado ? Number(encontrado.saldoInicialBanco || 0) : null;
    }
  }

  private async cargarConfiguracionApertura(): Promise<void> {
    try {
      await this.cargarConfiguracionAperturaApi();
      this.guardarConfiguracionAperturaLocal();
      return;
    } catch {
      // Si falla API, usar respaldo local.
    }

    this.cargarConfiguracionAperturaLocal();
  }

  private cargarConfiguracionAperturaLocal(): void {
    try {
      const raw = localStorage.getItem(this.configAperturaKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as {
        fecha?: string;
        efectivoInicial?: number;
        saldosBanco?: Record<string, number | null>;
      };

      if (parsed?.fecha !== this.fechaHoyISO()) {
        return;
      }

      if (typeof parsed.efectivoInicial === 'number') {
        this.efectivoInicial = parsed.efectivoInicial;
      }

      const saldosBanco = parsed.saldosBanco || {};
      for (const banco of this.bancosActivos) {
        const value = saldosBanco[String(banco.id)];
        this.saldosInicialesBanco[banco.id] =
          value === null || value === undefined || Number.isNaN(Number(value)) ? null : Number(value);
      }
    } catch {
      // Ignorar configuraciones corruptas y continuar con valores por defecto.
    }
  }

  private guardarConfiguracionAperturaLocal(): void {
    try {
      const saldosBanco: Record<string, number | null> = {};
      for (const banco of this.bancosActivos) {
        const value = this.saldosInicialesBanco[banco.id];
        saldosBanco[String(banco.id)] = value === null || value === undefined ? null : Number(value);
      }

      localStorage.setItem(
        this.configAperturaKey,
        JSON.stringify({
          fecha: this.fechaHoyISO(),
          efectivoInicial: this.efectivoInicial === null ? null : Number(this.efectivoInicial),
          saldosBanco,
        })
      );
    } catch {
      // Si falla localStorage, no bloquear el flujo de caja.
    }
  }

  private buildConfigPayload(): { efectivoInicial: number; saldosBancos: CajaConfigAperturaBanco[] } {
    return {
      efectivoInicial: this.efectivoInicial && this.efectivoInicial > 0 ? Number(this.efectivoInicial) : 0,
      saldosBancos: this.bancosActivos.map((banco) => ({
        idBanco: banco.id,
        saldoInicialBanco: this.saldosInicialesBanco[banco.id] && Number(this.saldosInicialesBanco[banco.id]) > 0
          ? Number(this.saldosInicialesBanco[banco.id])
          : 0,
      })),
    };
  }

  async guardarConfiguracionApertura(): Promise<void> {
    const usuarioId = this.usuarioSesionId;
    if (!usuarioId) {
      return;
    }

    const payload = this.buildConfigPayload();
    this.guardarConfiguracionAperturaLocal();

    try {
      await this.cajaService.guardarConfigApertura({
        idUsuario: usuarioId,
        fecha: this.fechaHoyISO(),
        efectivoInicial: payload.efectivoInicial,
        saldosBancos: payload.saldosBancos,
      });
      await this.showToast('Configuracion diaria guardada.', 'success');
    } catch {
      await this.showToast('No se pudo guardar en servidor. Se mantuvo local.', 'warning');
    }
  }

  onCambiarEfectivoInicial(value: string | number | null): void {
    this.efectivoInicial = this.parseDecimal(value);
    this.guardarConfiguracionAperturaLocal();
  }

  onCambiarSaldoBanco(idBanco: number, value: string | number | null): void {
    this.saldosInicialesBanco[idBanco] = this.parseDecimal(value);
    this.guardarConfiguracionAperturaLocal();
  }

  onMontoCierreChange(value: string | number | null): void {
    this.montoCierre = value;
  }

  get totalSaldosBancos(): number {
    return this.bancosActivos.reduce((acc, banco) => {
      const value = this.saldosInicialesBanco[banco.id];
      return acc + (value && value > 0 ? Number(value) : 0);
    }, 0);
  }

  get saldoInicialTotal(): number {
    const efectivo = this.efectivoInicial && this.efectivoInicial > 0 ? Number(this.efectivoInicial) : 0;
    return efectivo + this.totalSaldosBancos;
  }

  private esCajaAbierta(estado: string | null | undefined): boolean {
    const valor = String(estado || '').trim().toLowerCase();
    return valor === 'abierta' || valor === 'abierto' || valor === 'open';
  }

  async cargarCaja(): Promise<void> {
    const usuario = this.auth.getUsuarioSesion();
    if (!usuario) {
      await this.router.navigateByUrl('/login');
      return;
    }

    try {
      const cajaHoy = await this.cajaService.getCajaHoy(usuario.id, this.fechaHoyISO());
      this.caja = cajaHoy && this.esCajaAbierta(cajaHoy.estado) ? cajaHoy : null;
    } catch {
      this.caja = null;
    }
  }

  async abrirCaja(): Promise<void> {
    const usuario = this.auth.getUsuarioSesion();
    if (!usuario) {
      await this.router.navigateByUrl('/login');
      return;
    }

    this.loading = true;
    try {
      const payload = this.buildConfigPayload();
      const fechaAperturaDispositivo = this.fechaHoraLocalSql();
      await this.cajaService.guardarConfigApertura({
        idUsuario: usuario.id,
        fecha: this.fechaHoyISO(),
        efectivoInicial: payload.efectivoInicial,
        saldosBancos: payload.saldosBancos,
      });
      await this.cajaService.abrir(usuario.id, this.saldoInicialTotal, fechaAperturaDispositivo);
      this.guardarConfiguracionAperturaLocal();
      await this.showToast('Caja abierta correctamente.', 'success');
      this.observacionCierre = '';
      await this.cargarCaja();
      await this.cargarSaldosActualesPorBanco();
      await this.cargarResumenOperativo();
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo abrir caja.', 'danger');
    } finally {
      this.loading = false;
    }
  }

  async cerrarCaja(): Promise<void> {
    const usuario = this.auth.getUsuarioSesion();
    if (!usuario || !this.caja) {
      return;
    }

    const montoCierreNum = this.parseDecimal(this.montoCierre);
    if (montoCierreNum === null || montoCierreNum < 0) {
      await this.showToast('Ingresa el monto contado de cierre de caja.', 'warning');
      return;
    }

    const diferencia = montoCierreNum - this.saldoActual;
    const detalleCierre = `Monto contado: ${montoCierreNum.toFixed(2)} | Diferencia: ${diferencia.toFixed(2)}`;
    const observacionCompleta = [this.observacionCierre?.trim(), detalleCierre]
      .filter((x) => !!x)
      .join(' | ');

    const alert = await this.alertController.create({
      header: 'Cerrar caja',
      message: `Desea cerrar la caja del dia? Diferencia calculada: ${this.formatMoney(diferencia)}`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cerrar',
          handler: async () => {
            try {
              await this.cargarSaldosActualesPorBanco();
              await this.cargarResumenOperativo();

              const fechaCierreDispositivo = this.fechaHoraLocalSql();
              await this.cajaService.cerrar(this.caja!.id, usuario.id, observacionCompleta, fechaCierreDispositivo);

              // Al cerrar: el saldo acumulado del día se convierte en saldo inicial de mañana
              // Así los ingresos y egresos por banco quedan en 0 el próximo día
              const efectivoFinal = Number(this.resumenOperativo?.efectivoActual || 0);
              const saldosCierreBancos = this.saldosActualesPorBanco.map((item) => ({
                idBanco: Number(item.idBanco),
                saldoInicialBanco: Number(item.saldoActualBanco || 0),
              }));

              try {
                // Actualizar saldo inicial de HOY con los saldos de cierre,
                // para que al reabrir la misma caja ese dia el saldo inicial sea correcto
                await this.cajaService.guardarConfigApertura({
                  idUsuario: usuario.id,
                  fecha: this.fechaHoyISO(),
                  efectivoInicial: efectivoFinal,
                  saldosBancos: saldosCierreBancos,
                });
                // Y tambien para manana (inicio del proximo dia)
                await this.cajaService.guardarConfigApertura({
                  idUsuario: usuario.id,
                  fecha: this.fechaMananaISO(),
                  efectivoInicial: efectivoFinal,
                  saldosBancos: saldosCierreBancos,
                });
              } catch {
                // Si no se puede guardar en servidor, se sigue con cierre normal.
              }

              await this.showToast('Caja cerrada correctamente.', 'success');
              this.caja = null;
              this.efectivoInicial = efectivoFinal;
              this.saldosInicialesBanco = {};
              for (const item of this.saldosActualesPorBanco) {
                this.saldosInicialesBanco[item.idBanco] = Number(item.saldoActualBanco || 0);
              }
              this.guardarConfiguracionAperturaLocal();
              this.montoCierre = null;
              this.observacionCierre = '';
              await this.cargarSaldosActualesPorBanco();
              await this.cargarResumenOperativo();
            } catch (error: any) {
              await this.showToast(error?.message || 'No se pudo cerrar caja.', 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async abrirTodasCajas(): Promise<void> {
    const usuario = this.auth.getUsuarioSesion();
    if (!usuario) {
      await this.router.navigateByUrl('/login');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Abrir todas las cajas',
      message: `Esto abrira la caja del dia para todos los usuarios activos. Saldo inicial: ${this.formatMoney(this.saldoInicialTotal)}`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: async () => {
            this.loading = true;
            try {
              // Primero guardar la configuración de apertura (efectivo + saldos por banco)
              const payload = this.buildConfigPayload();
              await this.cajaService.guardarConfigApertura({
                idUsuario: usuario.id,
                fecha: this.fechaHoyISO(),
                efectivoInicial: payload.efectivoInicial,
                saldosBancos: payload.saldosBancos,
              });
              this.guardarConfiguracionAperturaLocal();

              // Luego abrir todas las cajas con el saldo total configurado
              const resultado = await this.cajaService.abrirTodasCajas(this.saldoInicialTotal);
              const msg = `${resultado.message}${resultado.errores?.length ? ` (${resultado.errores.length} con error)` : ''}`;
              await this.showToast(msg, resultado.abiertos > 0 ? 'success' : 'warning');
              await this.cargarCaja();
              await this.cargarSaldosActualesPorBanco();
              await this.cargarResumenOperativo();
            } catch (error: any) {
              await this.showToast(error?.message || 'No se pudieron abrir las cajas.', 'danger');
            } finally {
              this.loading = false;
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async cerrarTodasCajas(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Cerrar todas las cajas',
      message: 'Esto cerrara todas las cajas abiertas del dia para todos los usuarios. Esta accion no se puede deshacer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cerrar todas',
          cssClass: 'alert-button-danger',
          handler: async () => {
            this.loading = true;
            try {
              // Cargar saldos actuales antes de cerrar
              await this.cargarSaldosActualesPorBanco();
              await this.cargarResumenOperativo();

              const usuario = this.auth.getUsuarioSesion();
              // Al cerrar: el saldo acumulado del día se convierte en saldo inicial de mañana
              // Así los ingresos y egresos por banco quedan en 0 el próximo día
              const efectivoFinal = Number(this.resumenOperativo?.efectivoActual || 0);
              const saldosCierreBancos = this.saldosActualesPorBanco.map((item) => ({
                idBanco: Number(item.idBanco),
                saldoInicialBanco: Number(item.saldoActualBanco || 0),
              }));

              const resultado = await this.cajaService.cerrarTodasCajas('Cierre masivo');
              const msg = `${resultado.message}${resultado.errores?.length ? ` (${resultado.errores.length} con error)` : ''}`;
              await this.showToast(msg, resultado.cerrados > 0 ? 'success' : 'warning');

              // Guardar config de HOY y de manana con los saldos de cierre
              if (usuario) {
                try {
                  // HOY: para que reabrir el mismo dia use el saldo correcto de cierre
                  await this.cajaService.guardarConfigApertura({
                    idUsuario: usuario.id,
                    fecha: this.fechaHoyISO(),
                    efectivoInicial: efectivoFinal,
                    saldosBancos: saldosCierreBancos,
                  });
                  // MANANA: inicio del proximo dia
                  await this.cajaService.guardarConfigApertura({
                    idUsuario: usuario.id,
                    fecha: this.fechaMananaISO(),
                    efectivoInicial: efectivoFinal,
                    saldosBancos: saldosCierreBancos,
                  });
                } catch { /* continuar aunque falle */ }

                // Pre-llenar el formulario con los saldos de cierre
                this.efectivoInicial = efectivoFinal;
                this.saldosInicialesBanco = {};
                for (const item of this.saldosActualesPorBanco) {
                  this.saldosInicialesBanco[item.idBanco] = Number(item.saldoActualBanco || 0);
                }
                this.guardarConfiguracionAperturaLocal();
              }

              await this.cargarCaja();
              await this.cargarSaldosActualesPorBanco();
              await this.cargarResumenOperativo();
            } catch (error: any) {
              await this.showToast(error?.message || 'No se pudieron cerrar las cajas.', 'danger');
            } finally {
              this.loading = false;
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async cargarMovimientosCapital(): Promise<void> {
    this.loadingMovCapital = true;
    try {
      // Filtrar por idCaja para ver solo movimientos de esta sesion
      this.movimientosCapital = await this.cajaService.getMovimientos(
        this.fechaHoyISO(),
        this.filtroMovCapital,
        this.caja?.id ?? null,
      );
    } catch {
      this.movimientosCapital = [];
    } finally {
      this.loadingMovCapital = false;
    }
  }

  async registrarMovimientoCapital(): Promise<void> {
    const monto = this.parseDecimal(this.movCapitalForm.monto);
    if (!monto || monto <= 0) {
      await this.showToast('Ingrese un monto valido mayor a 0.', 'warning');
      return;
    }
    if (!this.movCapitalForm.concepto.trim()) {
      await this.showToast('Ingrese el concepto.', 'warning');
      return;
    }
    if (this.movCapitalForm.modalidad === 'banco' && !this.movCapitalForm.idBanco) {
      await this.showToast('Seleccione el banco.', 'warning');
      return;
    }

    const usuario = this.auth.getUsuarioSesion();
    if (!usuario?.id) {
      await this.showToast('No hay sesion activa.', 'danger');
      return;
    }

    this.savingMovCapital = true;
    try {
      await this.cajaService.registrarMovimiento({
        idUsuario: usuario.id,
        tipo: this.movCapitalForm.tipo,
        monto,
        concepto: this.movCapitalForm.concepto.trim(),
        modalidad: this.movCapitalForm.modalidad,
        idBanco: this.movCapitalForm.modalidad === 'banco' ? this.movCapitalForm.idBanco! : undefined,
        idCaja: this.caja?.id,
      });
      const label = this.movCapitalForm.tipo === 'ingreso' ? 'Ingreso de Capital' : 'Gasto';
      await this.showToast(`${label} registrado correctamente.`, 'success');
      this.movCapitalForm = { tipo: this.movCapitalForm.tipo, monto: null, concepto: '', modalidad: 'efectivo', idBanco: null };
      await this.cargarResumenOperativo();
      await this.cargarSaldosActualesPorBanco();
      await this.cargarMovimientosCapital();
    } catch (err: any) {
      await this.showToast(err?.message || 'No se pudo registrar.', 'danger');
    } finally {
      this.savingMovCapital = false;
    }
  }

  async eliminarMovimientoCapital(m: MovimientoCaja): Promise<void> {
    const label = m.tipo === 'ingreso' ? 'Ingreso de Capital' : 'Gasto';
    const alert = await this.alertController.create({
      header: `Eliminar ${label}`,
      message: `¿Eliminar este ${label.toLowerCase()} de ${m.modalidad === 'banco' ? (m.nombreBanco || 'banco') : 'efectivo'} por ${this.formatMoney(m.monto)}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.cajaService.eliminarMovimiento(m.id);
              await this.showToast(`${label} eliminado.`, 'success');
              await this.cargarResumenOperativo();
              await this.cargarSaldosActualesPorBanco();
              await this.cargarMovimientosCapital();
            } catch {
              await this.showToast('No se pudo eliminar.', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  get saldoActual(): number {
    if (this.resumenOperativo) {
      return this.montoGeneralCalculado;
    }

    if (!this.caja) {
      return 0;
    }
    return Number(this.caja.saldoInicial || 0) + Number(this.caja.totalIngresos || 0) - Number(this.caja.totalEgresos || 0);
  }

  get montoGeneralCalculado(): number {
    const efectivoActual = Number(this.resumenOperativo?.efectivoActual || 0);
    const montoBancosActual = Number(this.resumenOperativo?.montoBancosActual || 0);
    return efectivoActual + montoBancosActual;
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: 'HNL',
      minimumFractionDigits: 2,
    }).format(value || 0);
  }

  get puedeAbrirCaja(): boolean {
    const efectivoOk = this.efectivoInicial !== null && Number(this.efectivoInicial) > 0;
    const todosLosBancosOk = this.bancosActivos.length > 0 &&
      this.bancosActivos.every(banco => {
        const val = this.saldosInicialesBanco[banco.id];
        // Acepta cualquier número >= 0 (incluyendo 0 cuando viene del cierre anterior)
        // Solo bloquea si el valor no fue configurado aún (null/undefined)
        return val !== null && val !== undefined && !Number.isNaN(Number(val));
      });
    return !this.loading && efectivoOk && todosLosBancosOk;
  }

  get diferenciaCierre(): number {
    const montoCierreNum = this.parseDecimal(this.montoCierre);
    if (!this.caja || montoCierreNum === null) {
      return 0;
    }

    return montoCierreNum - this.saldoActual;
  }

  get puedeCerrarCaja(): boolean {
    const montoCierreNum = this.parseDecimal(this.montoCierre);
    return !!this.caja && this.esCajaAbierta(this.caja.estado) && montoCierreNum !== null && montoCierreNum >= 0;
  }

  toggleReglas(): void {
    this.reglasExpandida = !this.reglasExpandida;
  }

  private parseDecimal(value: unknown): number | null {
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
