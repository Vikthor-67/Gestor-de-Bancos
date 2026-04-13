import { Component, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { PluginListenerHandle } from '@capacitor/core';
import { IonRouterOutlet, MenuController, Platform, ToastController } from '@ionic/angular';
import { Auth } from './services/auth';
import { UsuarioSesion } from './models/usuario.model';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnDestroy {
  @ViewChild(IonRouterOutlet, { static: true }) private routerOutlet?: IonRouterOutlet;
  private lastBackToastAt = 0;
  private backgroundTimeout: ReturnType<typeof setTimeout> | null = null;
  private appStateRemoveListener: PluginListenerHandle | null = null;
  private readonly rutasRaizSesion = new Set<string>([
    '/dashboard',
    '/transacciones',
    '/transaccion-form',
    '/usuarios',
    '/bancos',
    '/servicios',
    '/comisiones',
    '/caja',
    '/corte',
    '/cambiar-password',
  ]);

  public adminPages = [
    { title: 'Dashboard', url: '/dashboard', icon: 'speedometer' },
    { title: 'Transacciones', url: '/transacciones', icon: 'swap-horizontal' },
    { title: 'Nueva Transaccion', url: '/transaccion-form', icon: 'add-circle' },
    { title: 'Usuarios', url: '/usuarios', icon: 'people' },
    { title: 'Bancos', url: '/bancos', icon: 'business' },
    { title: 'Servicios', url: '/servicios', icon: 'construct' },
    { title: 'Comisiones', url: '/comisiones', icon: 'cash' },
    { title: 'Caja', url: '/caja', icon: 'wallet' },
    { title: 'Corte', url: '/corte', icon: 'document-text' },
  ];

  public loginPage = { title: 'Login', url: '/login', icon: 'log-in' };
  public forceChangePage = { title: 'Cambiar contrasena', url: '/cambiar-password', icon: 'key' };
  public cajeroPages = [
    { title: 'Transacciones', url: '/transacciones', icon: 'swap-horizontal' },
    { title: 'Nueva Transaccion', url: '/transaccion-form', icon: 'add-circle' },
    { title: 'Usuario', url: '/usuarios', icon: 'finger-print' },
  ];

  constructor(
    private auth: Auth,
    private router: Router,
    private menuController: MenuController,
    private platform: Platform,
    private toastController: ToastController,
  ) {}

  ngOnInit(): void {
    this.inicializarBackButton();
    void this.inicializarCierrePorInactividad();
  }

  ngOnDestroy(): void {
    this.limpiarTemporizadorBackground();
    void this.desregistrarAppStateListener();
  }

  private async inicializarCierrePorInactividad(): Promise<void> {
    this.appStateRemoveListener = await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        this.limpiarTemporizadorBackground();
        if (!this.auth.estaAutenticado() && this.normalizarRuta(this.router.url) !== '/login') {
          void this.router.navigateByUrl('/login', { replaceUrl: true });
        }
        return;
      }

      this.limpiarTemporizadorBackground();
      this.backgroundTimeout = setTimeout(() => {
        if (this.auth.estaAutenticado()) {
          this.auth.logout();
        }

        if (this.normalizarRuta(this.router.url) !== '/login') {
          void this.router.navigateByUrl('/login', { replaceUrl: true });
        }
      }, 30000);
    });
  }

  private limpiarTemporizadorBackground(): void {
    if (this.backgroundTimeout) {
      clearTimeout(this.backgroundTimeout);
      this.backgroundTimeout = null;
    }
  }

  private async desregistrarAppStateListener(): Promise<void> {
    if (!this.appStateRemoveListener) {
      return;
    }

    await this.appStateRemoveListener.remove();
    this.appStateRemoveListener = null;
  }

  private inicializarBackButton(): void {
    this.platform.backButton.subscribeWithPriority(9999, async () => {
      const sesionActiva = this.auth.estaAutenticado();
      const rutaActual = this.normalizarRuta(this.router.url);
      const enLogin = rutaActual === '/login';

      if (sesionActiva && enLogin) {
        const sesion = this.auth.getUsuarioSesion();
        const destino = sesion ? this.auth.getRutaInicioPorRol(sesion.rol) : '/transacciones';
        await this.router.navigateByUrl(destino, { replaceUrl: true });
        await this.mostrarAvisoSesionActiva();
        return;
      }

      if (sesionActiva) {
        if (this.routerOutlet?.canGoBack() && !this.esRutaRaizSesion(rutaActual)) {
          await this.routerOutlet.pop();
          return;
        }

        await this.mostrarAvisoSesionActiva();
        return;
      }

      if (this.routerOutlet?.canGoBack()) {
        await this.routerOutlet.pop();
        return;
      }

      if (enLogin) {
        await App.exitApp();
      }
    });
  }

  private normalizarRuta(url: string): string {
    const limpia = String(url || '').split('?')[0].split('#')[0].trim();
    return limpia || '/';
  }

  private esRutaRaizSesion(ruta: string): boolean {
    const normalizada = this.normalizarRuta(ruta);
    if (this.rutasRaizSesion.has(normalizada)) {
      return true;
    }

    if (normalizada.startsWith('/transaccion/')) {
      return false;
    }

    return false;
  }

  private async mostrarAvisoSesionActiva(): Promise<void> {
    const ahora = Date.now();
    if (ahora - this.lastBackToastAt < 1800) {
      return;
    }

    this.lastBackToastAt = ahora;
    const toast = await this.toastController.create({
      message: 'se corremienda cerrar sesion antes de salir de la aplicacion',
      duration: 2200,
      color: 'warning',
      position: 'top',
    });
    await toast.present();
  }

  get appPages() {
    if (!this.auth.estaAutenticado()) {
      return [this.loginPage];
    }

    const sesion = this.auth.getUsuarioSesion();
    if (sesion?.mustChangePassword) {
      return [this.forceChangePage];
    }

    const rol = this.auth.getRolActual();
    if (rol === 'cajero') {
      return this.cajeroPages;
    }

    return this.adminPages;
  }

  get sesionActiva(): boolean {
    return this.auth.estaAutenticado();
  }

  get usuarioActual(): UsuarioSesion | null {
    return this.auth.getUsuarioSesion();
  }

  async cerrarSesion(): Promise<void> {
    this.auth.logout();
    await this.menuController.close();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
