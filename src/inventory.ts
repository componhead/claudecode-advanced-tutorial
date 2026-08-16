/**
 * @module inventory
 * Piccolo modulo di esempio con una funzione bacata, usato come terreno
 * di prova per esercitarsi con Claude Code (Edit, subagent di review,
 * hook post-modifica, ecc.).
 */

export interface Item {
  sku: string;
  quantity: number;
  unitPriceCents: number;
}

/**
 * Calcola il valore totale dell'inventario in centesimi.
 * BUG intenzionale: non gestisce quantity negativa (reso/storno),
 * utile per esercitarsi con /code-review o un subagent di review.
 */
export function totalValueCents(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
}

/**
 * Trova l'item con la scorta più bassa. Ritorna undefined su array vuoto.
 */
export function lowestStock(items: Item[]): Item | undefined {
  if (items.length === 0) return undefined;
  return items.reduce((min, item) => (item.quantity < min.quantity ? item : min));
}
