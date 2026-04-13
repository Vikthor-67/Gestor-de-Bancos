import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FechasLocales {
  // Honduras (America/Tegucigalpa) = UTC-6 sin horario de verano
  private readonly TZ = 'America/Tegucigalpa';

  private pad(value: number, length = 2): string {
    return String(value).padStart(length, '0');
  }

  /** Extrae los componentes de fecha/hora en zona horaria de Honduras. */
  private partsHN(d: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const g = (t: string) => Number(p.find(x => x.type === t)?.value ?? '0');
    return {
      year: g('year'),
      month: g('month'),
      day: g('day'),
      hour: g('hour') % 24,   // guarda contra '24' en medianoche
      minute: g('minute'),
      second: g('second'),
    };
  }

  /**
   * Parsea una fecha/hora y retorna un Date cuyas partes locales (.getHours(), etc.)
   * reflejan la hora de Honduras.
   * - Strings con TZ (Z o +/-offset): convierte de UTC a Honduras.
   * - Strings sin TZ: trata los valores como hora local de Honduras (el servidor envía hora hondureña).
   * - Date nativo: convierte a Honduras.
   */
  parseFechaLocal(valor: string | Date | null | undefined): Date | null {
    if (!valor) return null;

    if (valor instanceof Date) {
      if (isNaN(valor.getTime())) return null;
      const c = this.partsHN(valor);
      return new Date(c.year, c.month - 1, c.day, c.hour, c.minute, c.second, 0);
    }

    const texto = String(valor).trim();
    if (!texto) return null;

    // ¿Tiene indicador de zona horaria explícito?
    const hasTZ = /(?:Z|[+-]\d{2}:?\d{2})$/.test(texto);

    if (hasTZ) {
      // Parsea como UTC con TZ y convierte a Honduras
      const d = new Date(texto);
      if (isNaN(d.getTime())) return null;
      const c = this.partsHN(d);
      return new Date(c.year, c.month - 1, c.day, c.hour, c.minute, c.second, 0);
    }

    // Sin TZ: los valores del string YA son hora de Honduras (servidor en Honduras)
    const m = texto.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?/
    );
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0), 0);
  }

  formatearFechaHora(valor: string | Date | null | undefined): string {
    const fecha = this.parseFechaLocal(valor);
    if (!fecha) return 'Sin fecha';
    return `${this.pad(fecha.getDate())}/${this.pad(fecha.getMonth() + 1)}/${fecha.getFullYear()} ${this.pad(
      fecha.getHours()
    )}:${this.pad(fecha.getMinutes())}`;
  }

  formatearFecha(valor: string | Date | null | undefined): string {
    const fecha = this.parseFechaLocal(valor);
    if (!fecha) return 'Sin fecha';
    return `${this.pad(fecha.getDate())}/${this.pad(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
  }

  /** Retorna solo HH:mm en hora de Honduras. */
  formatearHora(valor: string | Date | null | undefined): string {
    const fecha = this.parseFechaLocal(valor);
    if (!fecha) return '--:--';
    return `${this.pad(fecha.getHours())}:${this.pad(fecha.getMinutes())}`;
  }

  /** Fecha de hoy en Honduras como 'YYYY-MM-DD'. */
  fechaHoyISO(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: this.TZ }).format(new Date());
  }

  /** Mes actual en Honduras como 'YYYY-MM'. */
  mesActualISO(): string {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.TZ,
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    const g = (t: string) => p.find(x => x.type === t)?.value ?? '';
    return `${g('year')}-${g('month')}`;
  }

  /** Fecha/hora actual en Honduras como string SQL: 'YYYY-MM-DD HH:mm:ss.mmm'. */
  ahoraSql(): string {
    const now = new Date();
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const g = (t: string) => p.find(x => x.type === t)?.value ?? '00';
    const hr = String(Number(g('hour')) % 24).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${g('year')}-${g('month')}-${g('day')} ${hr}:${g('minute')}:${g('second')}.${ms}`;
  }

  /** Hora actual en Honduras como 'HH:mm:ss'. */
  ahoraHMS(): string {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.TZ,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const g = (t: string) => p.find(x => x.type === t)?.value ?? '00';
    return `${String(Number(g('hour')) % 24).padStart(2, '0')}:${g('minute')}:${g('second')}`;
  }
}
