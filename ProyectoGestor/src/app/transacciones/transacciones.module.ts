import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TransaccionesPageRoutingModule } from './transacciones-routing.module';

import { TransaccionesPage } from './transacciones.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TransaccionesPageRoutingModule
  ],
  declarations: [TransaccionesPage]
})
export class TransaccionesPageModule {}
