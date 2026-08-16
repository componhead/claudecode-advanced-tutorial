---
name: inventory-report
description: Genera un report testuale del valore di inventario a partire da src/inventory.ts. Usa quando l'utente chiede un "report inventario" o "valore magazzino".
---

Leggi `src/inventory.ts`, individua le funzioni `totalValueCents` e `lowestStock`,
e produci un report in markdown con: valore totale in EUR, item con scorta minima,
eventuali problemi di gestione dati (es. quantity negative non gestite).
