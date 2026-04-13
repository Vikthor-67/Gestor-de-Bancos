import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ComisionesPage } from './comisiones.page';

const routes: Routes = [
  {
    path: '',
    component: ComisionesPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ComisionesPageRoutingModule {}
