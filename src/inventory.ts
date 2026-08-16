/**
 * @module inventory
 * Piccolo modulo di esempio per gestire l'inventario, usato come terreno
 * di prova per esercitarsi con Claude Code (Edit, subagent di review,
 * hook post-modifica, ecc.).
 */

/** Rappresenta una voce di inventario con SKU, quantità e prezzo unitario in centesimi. */
export interface Item {
  sku: string;
  quantity: number;
  unitPriceCents: number;
}

/**
 * Calcola il valore totale dell'inventario in centesimi.
 * Le righe con quantity negativa (reso/storno) vengono ignorate.
 */
export function totalValueCents(items: Item[]): number {
  return items.reduce(
    (sum, item) => (item.quantity < 0 ? sum : sum + item.quantity * item.unitPriceCents),
    0,
  );
}

/**
 * Trova l'item con la scorta più bassa. Ritorna undefined su array vuoto.
 */
export function lowestStock(items: Item[]): Item | undefined {
  if (items.length === 0) return undefined;
  return items.reduce((min, item) => (item.quantity < min.quantity ? item : min));
}
