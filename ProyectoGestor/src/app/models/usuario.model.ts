export interface UsuarioSesion {
  id: number;
  nombre: string;
  correo: string;
  rol: 'admin' | 'cajero';
  mustChangePassword: boolean;
}

export interface LoginPayload {
  correo: string;
  password: string;
}
