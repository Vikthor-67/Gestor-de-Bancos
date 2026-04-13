import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CajaPageRoutingModule } from './caja-routing.module';

import { CajaPage } from './caja.page';
import { MoneyInputDirective } from '../directives/money-input.directive';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MoneyInputDirective,
    CajaPageRoutingModule
  ],
  declarations: [CajaPage]
})
export class CajaPageModule {}
