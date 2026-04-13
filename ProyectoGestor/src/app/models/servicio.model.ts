export type TipoServicio = 'publico' | 'privado';

export interface Servicio {
  id: number;
  nombre: string;
  tipo: TipoServicio;
  descripcion?: string | null;
  estado: boolean;
}

export interface ServicioPayload {
  nombre: string;
  tipo: TipoServicio;
  descripcion?: string | null;
  estado?: boolean;
}
