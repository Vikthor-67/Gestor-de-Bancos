import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TransaccionesPage } from './transacciones.page';

const routes: Routes = [
  {
    path: '',
    component: TransaccionesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TransaccionesPageRoutingModule {}
