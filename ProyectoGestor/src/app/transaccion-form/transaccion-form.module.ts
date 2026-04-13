import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TransaccionFormPageRoutingModule } from './transaccion-form-routing.module';

import { TransaccionFormPage } from './transaccion-form.page';
import { MoneyInputDirective } from '../directives/money-input.directive';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MoneyInputDirective,
    TransaccionFormPageRoutingModule
  ],
  declarations: [TransaccionFormPage]
})
export class TransaccionFormPageModule {}
