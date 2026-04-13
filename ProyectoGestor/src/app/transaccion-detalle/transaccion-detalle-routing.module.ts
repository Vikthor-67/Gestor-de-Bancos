import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TransaccionDetallePage } from './transaccion-detalle.page';

const routes: Routes = [
  {
    path: '',
    component: TransaccionDetallePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TransaccionDetallePageRoutingModule {}
