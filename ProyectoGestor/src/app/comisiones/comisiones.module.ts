import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ComisionesPageRoutingModule } from './comisiones-routing.module';
import { ComisionesPage } from './comisiones.page';
import { MoneyInputDirective } from '../directives/money-input.directive';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MoneyInputDirective,
    ComisionesPageRoutingModule,
  ],
  declarations: [ComisionesPage],
})
export class ComisionesPageModule {}
