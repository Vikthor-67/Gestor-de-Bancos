import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'folder/:id',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin'] },
    loadChildren: () => import('./folder/folder.module').then( m => m.FolderPageModule)
  },
  {
    path: 'login',
    loadChildren: () => import('./login/login.module').then( m => m.LoginPageModule)
  },
  {
    path: 'cambiar-password',
    canActivate: [AuthGuard],
    loadChildren: () => import('./cambiar-password/cambiar-password.module').then( m => m.CambiarPasswordPageModule)
  },
  {
    path: 'dashboard',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin'] },
    loadChildren: () => import('./dashboard/dashboard.module').then( m => m.DashboardPageModule)
  },
  {
    path: 'transacciones',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin', 'cajero'] },
    loadChildren: () => import('./transacciones/transacciones.module').then( m => m.TransaccionesPageModule)
  },
  {
    path: 'transaccion-form',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin', 'cajero'] },
    loadChildren: () => import('./transaccion-form/transaccion-form.module').then( m => m.TransaccionFormPageModule)
  },
  {
    path: 'transaccion-detalle',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin', 'cajero'] },
    loadChildren: () => import('./transaccion-detalle/transaccion-detalle.module').then( m => m.TransaccionDetallePageModule)
  },
  {
    path: 'transaccion/:id',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin', 'cajero'] },
    loadChildren: () => import('./transaccion-detalle/transaccion-detalle.module').then( m => m.TransaccionDetallePageModule)
  },
  {
    path: 'bancos',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin'] },
    loadChildren: () => import('./bancos/bancos.module').then( m => m.BancosPageModule)
  },
  {
    path: 'servicios',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin'] },
    loadChildren: () => import('./servicios/servicios.module').then( m => m.ServiciosPageModule)
  },
  {
    path: 'comisiones',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin'] },
    loadChildren: () => import('./comisiones/comisiones.module').then( m => m.ComisionesPageModule)
  },
  {
    path: 'caja',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin'] },
    loadChildren: () => import('./caja/caja.module').then( m => m.CajaPageModule)
  },
  {
    path: 'corte',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin'] },
    loadChildren: () => import('./corte/corte.module').then( m => m.CortePageModule)
  },
  {
    path: 'usuarios',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin', 'cajero'] },
    loadChildren: () => import('./usuarios/usuarios.module').then( m => m.UsuariosPageModule)
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
