import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { Banco } from '../models/banco.model';
import { Servicio } from '../models/servicio.model';
import { TipoTransaccion } from '../models/tipo-transaccion.model';
import { Auth } from '../services/auth';
import { Bancos } from '../services/bancos';
import { Catalogos } from '../services/catalogos';
import { Comisiones } from '../services/comisiones';
import { formatMoneyNumber, parseMoneyNumber } from '../services/money-format';
import { Servicios } from '../services/servicios';
import { Transacciones } from '../services/transacciones';

@Component({
  selector: 'app-transaccion-form',
  templateUrl: './transaccion-form.page.html',
  styleUrls: ['./transaccion-form.page.scss'],
  standalone: false,
})
export class TransaccionFormPage implements OnInit {
  bancos: Banco[] = [];
  servicios: Servicio[] = [];
  serviciosFiltrados: Servicio[] = [];
  tiposTransaccion: TipoTransaccion[] = [];
  private comisionTimer: ReturnType<typeof setTimeout> | null = null;

  form = {
    idBanco: null as number | null,
    idTipoTrans: null as number | null,
    idServicio: null as number | null,
    idBancoOrigen: null as number | null,
    numeroReferencia: '',
    nombreCliente: '',
    monto: null as number | null,
    comision: 0,
    observacion: '',
    cuentaDestino: '',
  };

  esTransferencia = false;

  latitud: number | null = null;
  longitud: number | null = null;
  fotoComprobante: string | null = null;
  ubicacionLoading = false;
  fotoLoading = false;
  loading = false;

  constructor(
    private bancosService: Bancos,
    private serviciosService: Servicios,
    private catalogosService: Catalogos,
    private comisionesService: Comisiones,
    private auth: Auth,
    private transaccionesService: Transacciones,
    private router: Router,
    private toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    this.resetFormulario();
    await Promise.all([this.cargarBancos(), this.cargarServicios(), this.cargarTiposTransaccion()]);
  }

  ionViewWillEnter(): void {
    this.resetFormulario();
  }

  private resetFormulario(): void {
    this.form = {
      idBanco: null,
      idTipoTrans: null,
      idServicio: null,
      idBancoOrigen: null,
      numeroReferencia: '',
      nombreCliente: '',
      monto: null,
      comision: 0,
      observacion: '',
      cuentaDestino: '',
    };
    this.esTransferencia = false;
    this.latitud = null;
    this.longitud = null;
    this.fotoComprobante = null;
    this.generarNuevaReferencia();
  }

  private generarNuevaReferencia(): void {
    this.form.numeroReferencia = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
  }

  private fechaLocalSql(): string {
    const tz = 'America/Tegucigalpa';
    const now = new Date();
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(now);
    const g = (t: string) => p.find(x => x.type === t)?.value ?? '00';
    const hr = String(Number(g('hour')) % 24).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${g('year')}-${g('month')}-${g('day')} ${hr}:${g('minute')}:${g('second')}.${ms}`;
  }

  async cargarBancos(): Promise<void> {
    try {
      this.bancos = await this.bancosService.getBancos();
    } catch {
      this.bancos = [];
    }
  }

  async cargarServicios(): Promise<void> {
    try {
      this.servicios = await this.serviciosService.getServicios();
      this.aplicarFiltroServiciosPorTipo();
    } catch {
      this.servicios = [];
      this.serviciosFiltrados = [];
    }
  }

  async cargarTiposTransaccion(): Promise<void> {
    try {
      this.tiposTransaccion = await this.catalogosService.getTiposTransaccion();
    } catch {
      this.tiposTransaccion = [];
    }
  }

  async onDatosComisionChange(): Promise<void> {
    await this.calcularComision();
  }

  onMontoInput(value: any): void {
    const monto = this.parseDecimal(value);
    this.form.monto = monto;
    this.programarCalculoComision();
  }

  private programarCalculoComision(delayMs = 220): void {
    if (this.comisionTimer) {
      clearTimeout(this.comisionTimer);
    }

    this.comisionTimer = setTimeout(() => {
      void this.calcularComision();
    }, delayMs);
  }

  private parseDecimal(value: unknown): number | null {
    return parseMoneyNumber(value);
  }

  formatMoneyInput(value: unknown): string {
    return formatMoneyNumber(value);
  }

  async onTipoTransaccionChange(): Promise<void> {
    const idTipo = Number(this.form.idTipoTrans || 0);
    const tipo = this.tiposTransaccion.find((x) => Number(x.id) === idTipo);
    const nombre = this.normalizarTexto(tipo?.nombre || '');
    this.esTransferencia = nombre === 'transferencia';
    if (this.esTransferencia) {
      this.form.idBancoOrigen = null;
    } else {
      this.form.cuentaDestino = '';
      this.form.idBancoOrigen = null;
    }
    this.aplicarFiltroServiciosPorTipo();
    await this.onDatosComisionChange();
  }

  private normalizarTexto(valor: string): string {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private tipoServicioPorTipoTransaccion(): 'publico' | 'privado' | null {
    const idTipo = Number(this.form.idTipoTrans || 0);
    if (!idTipo) {
      return null;
    }

    const tipo = this.tiposTransaccion.find((x) => Number(x.id) === idTipo);
    const nombre = this.normalizarTexto(tipo?.nombre || '');

    const esServicio = nombre.includes('servicio');
    if (!esServicio) {
      return null;
    }

    if (nombre.includes('publico')) {
      return 'publico';
    }

    if (nombre.includes('privado')) {
      return 'privado';
    }

    return null;
  }

  get puedeSeleccionarServicio(): boolean {
    return this.tipoServicioPorTipoTransaccion() !== null;
  }

  private aplicarFiltroServiciosPorTipo(): void {
    const tipoServicio = this.tipoServicioPorTipoTransaccion();
    this.serviciosFiltrados = tipoServicio
      ? this.servicios.filter((s) => this.normalizarTexto(s.tipo) === tipoServicio)
      : [];

    if (this.form.idServicio !== null) {
      const existe = this.serviciosFiltrados.some((s) => Number(s.id) === Number(this.form.idServicio));
      if (!existe) {
        this.form.idServicio = null;
      }
    }
  }

  async calcularComision(): Promise<void> {
    const idBanco = Number(this.form.idBanco || 0);
    const idTipoTrans = Number(this.form.idTipoTrans || 0);
    const monto = Number(this.form.monto || 0);

    if (!idBanco || !idTipoTrans || !monto || Number.isNaN(monto) || monto <= 0) {
      this.form.comision = 0;
      return;
    }

    try {
      this.form.comision = await this.comisionesService.calcular(idBanco, idTipoTrans, monto);
    } catch {
      this.form.comision = 0;
    }
  }

  async capturarUbicacion(): Promise<void> {
    this.ubicacionLoading = true;
    try {
      let latitud: number;
      let longitud: number;

      // Detectar si la app corre en web o en nativo (Android/iOS)
      if (Capacitor.getPlatform() === 'web') {
        console.log('🌐 Usando geolocalización WEB (navegador)');
        const position = await this.obtenerUbicacionWeb();
        latitud = position.coords.latitude;
        longitud = position.coords.longitude;
      } else {
        console.log('📱 Usando geolocalización NATIVA (Capacitor)');
        // En nativo, primero solicitar permisos
        await Geolocation.requestPermissions();
        
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 30000, // 30 segundos para dar tiempo al GPS
          maximumAge: 0,
        });
        
        latitud = position.coords.latitude;
        longitud = position.coords.longitude;
      }

      this.latitud = Number(latitud.toFixed(6));
      this.longitud = Number(longitud.toFixed(6));
      
      console.log('✅ Ubicación obtenida:', { lat: this.latitud, lng: this.longitud });
      await this.showToast('Ubicación obtenida correctamente.', 'success');
    } catch (error: any) {
      this.latitud = null;
      this.longitud = null;
      
      const errorMsg = error?.message || error?.code || String(error);
      console.error('❌ Error en geolocalización:', errorMsg, error);

      // Mensajes específicos según el tipo de error
      let mensajeFinal = '';
      
      if (errorMsg.toLowerCase().includes('location') || errorMsg.toLowerCase().includes('not enabled') || errorMsg.toLowerCase().includes('not enab')) {
        mensajeFinal = 'GPS desactivado. Actívalo en Configuración → Ubicación.';
      } else if (errorMsg.toLowerCase().includes('permission') || errorMsg.toLowerCase().includes('denied')) {
        mensajeFinal = 'Permiso de ubicación denegado. Actívalo en Configuración → Aplicaciones.';
      } else if (errorMsg.toLowerCase().includes('timeout')) {
        mensajeFinal = 'Timeout: GPS tardó demasiado. Intenta en exterior, sin obstáculos.';
      } else if (errorMsg.toLowerCase().includes('unavailable') || errorMsg.toLowerCase().includes('position unavailable')) {
        mensajeFinal = 'GPS no disponible. Asegúrate estar al aire libre con cielo despejado.';
      } else {
        mensajeFinal = `Error: ${errorMsg.substring(0, 40)}...`;
      }
      
      await this.showToast(mensajeFinal, 'danger');
    } finally {
      this.ubicacionLoading = false;
    }
  }

  private obtenerUbicacionWeb(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('El navegador no soporta geolocalización'));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  }

  async tomarFoto(): Promise<void> {
    this.fotoLoading = true;
    try {
      const permission = await Camera.checkPermissions();
      if (permission.camera !== 'granted' && permission.photos !== 'granted') {
        const requested = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
        const cameraGranted = requested.camera === 'granted';
        const photosGranted = requested.photos === 'granted' || requested.photos === 'limited';
        if (!cameraGranted && !photosGranted) {
          await this.showToast('Permisos de camara/fotos denegados.', 'warning');
          return;
        }
      }

      const image = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
      });

      this.fotoComprobante = image.dataUrl || null;
      if (this.fotoComprobante) {
        await this.showToast('Foto de comprobante cargada.', 'success');
      }
    } catch (error: any) {
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('cancel')) {
        await this.showToast('Captura de foto cancelada.', 'warning');
      } else {
        await this.showToast('No se pudo tomar/seleccionar la foto.', 'danger');
      }
    } finally {
      this.fotoLoading = false;
    }
  }

  async guardar(): Promise<void> {
    const usuario = this.auth.getUsuarioSesion();
    if (!usuario) {
      await this.showToast('Debe iniciar sesion primero.', 'warning');
      await this.router.navigateByUrl('/login');
      return;
    }

    if (!this.form.idBanco || !this.form.idTipoTrans || !this.form.monto) {
      await this.showToast('Complete los campos obligatorios del formulario.', 'warning');
      return;
    }

    if (this.esTransferencia && !this.form.cuentaDestino?.trim()) {
      await this.showToast('Ingrese la cuenta destino para la transferencia.', 'warning');
      return;
    }

    if (this.esTransferencia && !this.form.idBancoOrigen) {
      await this.showToast('Seleccione el banco de destino para la transferencia.', 'warning');
      return;
    }

    await this.calcularComision();

    this.loading = true;
    try {
      await this.transaccionesService.crear({
        idBanco: this.form.idBanco,
        idTipoTrans: this.form.idTipoTrans,
        idServicio: this.form.idServicio,
        idUsuario: usuario.id,
        anulado: 'completada',
        numeroReferencia: this.form.numeroReferencia,
        nombreCliente: (this.form.nombreCliente || '').trim(),
        monto: this.form.monto,
        comision: this.form.comision || 0,
        observacion: this.form.observacion ? this.form.observacion.trim() : null,
        latitud: this.latitud,
        longitud: this.longitud,
        fechaTransaccion: this.fechaLocalSql(),
        fotoComprobante: this.fotoComprobante,
        cuentaDestino: this.esTransferencia ? (this.form.cuentaDestino?.trim() || null) : null,
        idBancoOrigen: this.esTransferencia ? (this.form.idBancoOrigen ?? null) : null,
      });
      await this.showToast('Transaccion guardada correctamente.', 'success');
      this.resetFormulario();
      await this.router.navigateByUrl('/transaccion-form', { replaceUrl: true });
    } catch (error: any) {
      await this.showToast(error?.message || 'No se pudo guardar la transaccion.', 'danger');
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.comisionTimer) {
      clearTimeout(this.comisionTimer);
      this.comisionTimer = null;
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
