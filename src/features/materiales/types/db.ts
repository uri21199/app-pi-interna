export interface Material {
  id: string;
  nombre: string;
  en_stock: boolean;
  comprando_militante_id: string | null;
  comprando_nombre: string | null;
  comprando_desde: string | null;
  notas: string | null;
  creado_en: string;
}
