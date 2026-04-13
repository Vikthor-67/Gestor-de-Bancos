import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BancosPageRoutingModule } from './bancos-routing.module';

import { BancosPage } from './bancos.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BancosPageRoutingModule
  ],
  declarations: [BancosPage]
})
export class BancosPageModule {}
