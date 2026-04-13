import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { Transaccion, TransaccionPayload } from '../models/transaccion.model';

interface FiltrosTransacciones {
  idBanco?: number;
  idTipo?: number;
}

@Injectable({
  providedIn: 'root',
})
export class Transacciones {
  private baseUrl = `${environment.apiUrl}/api/transacciones`;

  private getErrorMessage(error: any, fallback: string): string {
    return (
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      fallback
    );
  }

  private assertSuccess(response: any, fallback: string): void {
    if (!response) {
      throw new Error(fallback);
    }

    const status = Number(response.status ?? response.statusCode ?? 0);
    if (status >= 400) {
      const message =
        response.data?.message ||
        response.data?.error ||
        response.message ||
        fallback;
      throw new Error(message);
    }
  }

  private fotoABytes(foto?: string | null): number[] | null {
    if (!foto) {
      return null;
    }

    const base64 = foto.includes(',') ? foto.split(',')[1] : foto;
    if (!base64) {
      return null;
    }

    const binario = atob(base64);
    const bytes = new Array<number>(binario.length);
    for (let i = 0; i < binario.length; i += 1) {
      bytes[i] = binario.charCodeAt(i);
    }
    return bytes;
  }

  private bytesADataUrl(foto: any): string | null {
    if (!foto) {
      return null;
    }

    const bytes = Array.isArray(foto)
      ? foto
      : Array.isArray(foto?.data)
      ? foto.data
      : foto?.type === 'Buffer' && Array.isArray(foto?.data)
      ? foto.data
      : null;

    if (!bytes || bytes.length === 0) {
      return typeof foto === 'string' ? foto : null;
    }

    let binario = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      binario += String.fromCharCode(...chunk);
    }

    return `data:image/jpeg;base64,${btoa(binario)}`;
  }

  private fechaLocalSql(): string {
    const tz = 'America/Tegucigalpa';
    const now = new Date();
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(now);
    const g = (t: string) => p.find(x => x.type === t)?.value ?? '00';
    const hr = String(Number(g('hour')) % 24).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${g('year')}-${g('month')}-${g('day')} ${hr}:${g('minute')}:${g('second')}.${ms}`;
  }

  private toNumber(value: any, fallback = 0): number {
    const num = Number(value);
    return Number.isNaN(num) ? fallback : num;
  }

  private normalizeTransaccion(raw: any): Transaccion {
    return {
      id: this.toNumber(raw?.id ?? raw?.Id, 0),
      idBanco: this.toNumber(raw?.idBanco ?? raw?.IdBanco, 0),
      idTipoTrans: this.toNumber(raw?.idTipoTrans ?? raw?.IdTipoTrans, 0),
      idServicio: raw?.idServicio ?? raw?.IdServicio ?? null,
      idUsuario: this.toNumber(raw?.idUsuario ?? raw?.IdUsuario, 0),
      banco: raw?.banco ?? raw?.Banco ?? null,
      tipo: raw?.tipo ?? raw?.Tipo ?? null,
      servicio: raw?.servicio ?? raw?.Servicio ?? null,
      numeroReferencia: raw?.numeroReferencia ?? raw?.NumeroReferencia ?? null,
      nombreCliente: String(raw?.nombreCliente ?? raw?.NombreCliente ?? ''),
      nombreUsuario: raw?.nombreUsuario ?? raw?.NombreUsuario ?? null,
      monto: this.toNumber(raw?.monto ?? raw?.Monto, 0),
      comision: this.toNumber(raw?.comision ?? raw?.Comision, 0),
      anulado: raw?.anulado ?? raw?.Anulado ?? null,
      observacion: raw?.observacion ?? raw?.Observacion ?? null,
      fechaTransaccion: String(raw?.fechaTransaccion ?? raw?.FechaTransaccion ?? ''),
      latitud: raw?.latitud ?? raw?.Latitud ?? null,
      longitud: raw?.longitud ?? raw?.Longitud ?? null,
      fotoComprobante: this.bytesADataUrl(raw?.fotoComprobante ?? raw?.FotoComprobante ?? null),
      cuentaDestino: raw?.cuentaDestino ?? raw?.CuentaDestino ?? null,
      idBancoOrigen: raw?.idBancoOrigen ?? raw?.IdBancoOrigen ?? null,
    };
  }

  async getTransacciones(filtros?: FiltrosTransacciones): Promise<Transaccion[]> {
    const query = new URLSearchParams();
    if (filtros?.idBanco) query.set('idBanco', String(filtros.idBanco));
    if (filtros?.idTipo) query.set('idTipo', String(filtros.idTipo));

    const url = query.toString() ? `${this.baseUrl}?${query.toString()}` : this.baseUrl;
    let response: any;
    try {
      response = await CapacitorHttp.get({
        url,
        headers: { Accept: 'application/json' },
      });
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error, 'No se pudo cargar transacciones.'));
    }
    this.assertSuccess(response, 'No se pudo cargar transacciones.');

    const listado = Array.isArray(response.data)
      ? response.data
      : Array.isArray((response.data as any)?.value)
      ? (response.data as any).value
      : [];
    return listado.map((item: any) => this.normalizeTransaccion(item));
  }

  async getTransaccionById(id: number): Promise<Transaccion | null> {
    try {
      const response = await CapacitorHttp.get({
        url: `${this.baseUrl}/${id}`,
        headers: { Accept: 'application/json' },
      });

      return response.data ? this.normalizeTransaccion(response.data) : null;
    } catch {
      const listado = await this.getTransacciones();
      return listado.find((item) => item.id === id) || null;
    }
  }

  async crear(data: TransaccionPayload): Promise<any> {
    const payload = {
      ...data,
      fotoComprobante: this.fotoABytes(data.fotoComprobante ?? null),
      fechaTransaccion: data.fechaTransaccion ?? this.fechaLocalSql(),
    };

    let response: any;
    try {
      response = await CapacitorHttp.post({
        url: this.baseUrl,
        data: payload,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error, 'No se pudo crear la transaccion.'));
    }
    this.assertSuccess(response, 'No se pudo crear la transaccion.');

    return response.data;
  }

  async actualizar(id: number, data: Partial<TransaccionPayload> & { anulado?: string | null }): Promise<any> {
    const payload = {
      ...data,
      fotoComprobante:
        data.fotoComprobante !== undefined ? this.fotoABytes(data.fotoComprobante ?? null) : undefined,
    };

    let response: any;
    try {
      response = await CapacitorHttp.put({
        url: `${this.baseUrl}/${id}`,
        data: payload,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error, 'No se pudo actualizar la transaccion.'));
    }
    this.assertSuccess(response, 'No se pudo actualizar la transaccion.');

    return response.data;
  }

  async anular(id: number): Promise<any> {
    return this.actualizar(id, { anulado: 'anulada' });
  }

  async aprobar(id: number): Promise<any> {
    return this.actualizar(id, { anulado: 'completada' });
  }
}
