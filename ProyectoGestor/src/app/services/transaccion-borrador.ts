import { Injectable } from '@angular/core';
import { TransaccionPayload } from '../models/transaccion.model';

interface BorradorTransaccion {
  payload: TransaccionPayload;
  fechaTransaccion: string;
}

@Injectable({
  providedIn: 'root',
})
export class TransaccionBorradorService {
  private readonly key = 'transaccion_borrador';

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

  guardar(payload: TransaccionPayload): void {
    const borrador: BorradorTransaccion = {
      payload: {
        ...payload,
        fechaTransaccion: payload.fechaTransaccion || this.fechaLocalSql(),
      },
      fechaTransaccion: payload.fechaTransaccion || this.fechaLocalSql(),
    };
    sessionStorage.setItem(this.key, JSON.stringify(borrador));
  }

  obtener(): BorradorTransaccion | null {
    try {
      const raw = sessionStorage.getItem(this.key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as BorradorTransaccion;
    } catch {
      return null;
    }
  }

  limpiar(): void {
    sessionStorage.removeItem(this.key);
  }
}
