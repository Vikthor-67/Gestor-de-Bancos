export interface UsuarioAdminItem {
  id: number;
  nombre: string;
  correo: string;
  rol: 'admin' | 'cajero';
  mustChangePassword: boolean;
  failedAttempts: number;
  lockUntil: string | null;
}

export interface CrearUsuarioPayload {
  nombre: string;
  correo: string;
  rol: 'admin' | 'cajero';
}

export interface CredencialTemporalResponse {
  message: string;
  tempPassword: string;
  mailSent: boolean;
  usuario?: {
    id: number;
    nombre: string;
    correo: string;
    rol?: 'admin' | 'cajero';
  };
}

export interface ParametrosSeguridad {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
  maxFailedAttempts: number;
  lockMinutes: number;
  defaultPasswordLength: number;
}
