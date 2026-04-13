import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BancosPage } from './bancos.page';

const routes: Routes = [
  {
    path: '',
    component: BancosPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BancosPageRoutingModule {}
