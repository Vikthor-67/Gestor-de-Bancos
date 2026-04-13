import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TransaccionDetallePageRoutingModule } from './transaccion-detalle-routing.module';

import { TransaccionDetallePage } from './transaccion-detalle.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TransaccionDetallePageRoutingModule
  ],
  declarations: [TransaccionDetallePage]
})
export class TransaccionDetallePageModule {}
