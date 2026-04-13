import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { TipoTransaccion } from '../models/tipo-transaccion.model';

@Injectable({
  providedIn: 'root',
})
export class Catalogos {
  private baseUrl = `${environment.apiUrl}/api/catalogos`;

  async getTiposTransaccion(): Promise<TipoTransaccion[]> {
    const response = await CapacitorHttp.get({
      url: `${this.baseUrl}/tipos-transaccion`,
      headers: { Accept: 'application/json' },
    });

    return (response.data || []) as TipoTransaccion[];
  }
}
