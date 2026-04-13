export interface Banco {
  id: number;
  nombre: string;
  codigo: string;
  telefono?: string | null;
  logo?: string | null;
  estado: boolean;
}

export interface BancoPayload {
  nombre: string;
  codigo: string;
  telefono?: string | null;
  logo?: string | null;
  estado?: boolean;
}
