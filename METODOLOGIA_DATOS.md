# Metodología y Fuentes de Datos (Predictor Mundial)

Este documento detalla la procedencia, el significado y la fórmula para obtener los "Valores Fijos" (`xg`, `xga`, `form`, `squad`) que alimentan el archivo `data.js` del Predictor Clásico. Como estos valores son estáticos, es necesario actualizarlos manualmente antes de un gran torneo (ej. Mundial 2026). Aquí tienes la guía exacta para calcularlos.

---

## 1. Jerarquía del Plantel (`squad`)
**¿Qué es?** 
Es un valor numérico del 1 al 10 que representa el poderío individual, la calidad técnica y el peso económico de los jugadores de una selección. No mide "cómo juegan en equipo", sino "qué tan buenos son sus jugadores uno por uno".

**¿De dónde se obtiene?**
La fuente principal para esto es **Transfermarkt** (Valor total de mercado de la plantilla en millones de Euros) o el **Ranking ELO de la FIFA** (como proxy secundario).

**Fórmula de cálculo (Método Transfermarkt):**
1. Ingresas a Transfermarkt y buscas el valor de las selecciones.
2. Tomas a la selección más cara del mundo (Ej: Inglaterra, ~1.500 Millones de Euros) y le asignas el valor máximo: **10.0**.
3. Tomas a una selección de nivel muy bajo (Ej: San Marino o Bolivia) y le asignas un valor base: **1.0**.
4. Interpolas el resto. *Ejemplo:* Si Argentina vale 800 Millones de Euros, su puntuación sería de aproximadamente **8.5**.
*Nota: También puedes usar el Ranking FIFA para ajustarlo (Ej: Top 3 del mundo = 9.5 a 10; Top 10 = 8.5 a 9.0, etc.).*

---

## 2. Forma Reciente (`form`)
**¿Qué es?**
Un multiplicador entre 0.0 y 1.0 (o ligeramente superior a 1.0 en rachas históricas) que mide el momentum anímico y de resultados de la selección en sus últimos partidos.

**¿De dónde se obtiene?**
De portales de resultados como **Flashscore**, **Sofascore** o **Kaggle** (bases de datos de resultados internacionales). Se toman en cuenta estrictamente los **últimos 10 partidos**.

**Fórmula de cálculo (Puntos por Partido - PPG):**
1. Tomas los últimos 10 partidos de la selección.
2. Calculas los puntos obtenidos: Victoria = 3, Empate = 1, Derrota = 0.
3. El máximo posible son 30 puntos (10 victorias).
4. Divides los puntos obtenidos entre 30.
*Ejemplo:* Si Colombia ganó 7, empató 2 y perdió 1 en sus últimos 10 partidos: `(7*3) + (2*1) + (1*0) = 23 puntos`. 
Forma = `23 / 30 = 0.76`.

---

## 3. Poder Ofensivo (`xg` - Expected Goals)
**¿Qué es?**
Los "Goles Esperados" a favor. Es la cantidad promedio de goles que una selección *debería* marcar por partido basándose en la calidad y cantidad de tiros que genera. Es un valor mucho más preciso que los "goles reales" porque elimina el factor suerte.

**¿De dónde se obtiene?**
Páginas de analítica avanzada de fútbol como **FBRef** (proveedor Opta) o **FootyStats**. Debes filtrar por las competiciones oficiales (Eliminatorias, Copas Continentales, Mundial) del último año o dos años.

**Fórmula de cálculo:**
1. Buscas el xG total generado por el equipo en sus últimos 15-20 partidos oficiales.
2. Lo divides por la cantidad de partidos.
*Ejemplo:* Si Uruguay generó un xG total de 24.5 en sus últimos 15 partidos de Eliminatorias.
`xg` = `24.5 / 15 = 1.63`.

---

## 4. Solidez Defensiva (`xga` - Expected Goals Against)
**¿Qué es?**
Los "Goles Esperados en Contra". Es la cantidad promedio de goles que un equipo concede, midiendo la calidad de las ocasiones que sus rivales logran crearle. Un número bajo significa una defensa impenetrable.

**¿De dónde se obtiene?**
Al igual que el xG, se obtiene de **FBRef** o **FootyStats**, observando la métrica `xGA` (Expected Goals Allowed).

**Fórmula de cálculo:**
1. Buscas el xGA total concedido por el equipo en sus últimos 15-20 partidos oficiales.
2. Lo divides por la cantidad de partidos.
*Ejemplo:* Si Brasil concedió un xGA de 12.0 en 15 partidos.
`xga` = `12.0 / 15 = 0.80`.

---

## ¿Por qué el modelo es tan preciso con estos 4 datos?
Porque el algoritmo interno de la página hace lo siguiente cuando se enfrentan el Equipo A y el Equipo B:
1. Toma el ataque del Equipo A (`xg`) y lo estrella contra la defensa del Equipo B (`xga`).
2. Toma el ataque del Equipo B (`xg`) y lo estrella contra la defensa del Equipo A (`xga`).
3. Ajusta el resultado de ese choque multiplicándolo por la Jerarquía del plantel (`squad`) y la racha anímica (`form`).
4. Finalmente, le pasa esos números a la Distribución de Poisson (Dixon-Coles) para generar la matriz de probabilidad de cada marcador exacto.
