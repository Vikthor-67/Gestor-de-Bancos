import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { Auth } from '../services/auth';
import { UsuarioSesion } from '../models/usuario.model';

@Injectable({
  providedIn: 'root',
})
export class RoleGuard implements CanActivate {
  constructor(private auth: Auth, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const usuario = this.auth.getUsuarioSesion();
    if (!usuario) {
      return this.router.createUrlTree(['/login']);
    }

    if (usuario.mustChangePassword && route.routeConfig?.path !== 'cambiar-password') {
      return this.router.createUrlTree(['/cambiar-password']);
    }

    const allowedRoles = (route.data?.['roles'] as UsuarioSesion['rol'][] | undefined) || [];
    if (allowedRoles.length === 0 || allowedRoles.includes(usuario.rol)) {
      return true;
    }

    return this.router.createUrlTree([this.auth.getRutaInicioPorRol(usuario.rol)]);
  }
}
