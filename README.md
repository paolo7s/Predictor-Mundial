# Mundial 2026 Predictor - Motor Estadístico y AI

Una aplicación web interactiva diseñada para proyectar resultados de fútbol de selecciones en entornos neutrales (como la Copa del Mundo). Este proyecto combina un motor matemático probabilístico clásico con una capa de integración de Inteligencia Artificial para entregar pronósticos tácticos profundos.

## 🧠 Arquitectura del Motor Estadístico

El núcleo de la predicción se basa en modelos matemáticos bivariados que calculan la probabilidad exacta de cada marcador posible (desde 0-0 hasta 5-5).

### 1. Distribución de Poisson
El sistema utiliza la distribución de Poisson para modelar la cantidad de goles esperados por cada equipo como eventos independientes. 
- Se calcula el parámetro **$\lambda$ (Lambda)** para cada equipo (Goles Esperados a favor ajustados por la defensa rival).
- Genera una matriz inicial de 6x6 (hasta 5 goles por equipo) con las probabilidades base de cada resultado.

### 2. Ajuste Bivariado de Dixon-Coles
Dado que el modelo puro de Poisson tiende a subestimar sistemáticamente la frecuencia de los empates de bajo marcador (0-0, 1-1) en el fútbol real, la aplicación implementa una capa de corrección **Dixon-Coles**.
- Aplica un factor de corrección cruzada (con un coeficiente de dependencia $\rho = -0.15$) que infla artificialmente las probabilidades de resultados de 0-0, 1-0, 0-1 y 1-1, acercando la matriz a la realidad del fútbol internacional.

### 3. Ponderación Multifactorial
Los Lambdas base no son estáticos. Antes de entrar al motor de Poisson, sufren mutaciones basadas en tres variables críticas:
* **Expected Goals (xG) y xG Against:** El punto de partida de rendimiento ofensivo/defensivo absoluto.
* **Jerarquía de Plantel (0 a 10):** Un multiplicador que ajusta el peso en situaciones de estrés competitivo, beneficiando a planteles con mayor valor de mercado o estrellas mundiales.
* **Forma Reciente (0 a 1):** Momentum del equipo en los últimos partidos disputados.
* **Historial Directo (H2H):** Ajustes finos basados en la "paternidad" histórica entre las dos selecciones enfrentadas.

## 🤖 Integración de Inteligencia Artificial (El "Prompt")

La aplicación actúa como un puente (frontend) para analistas humanos asistidos por IA. No entrega un pronóstico ciego, sino que funciona como un **generador de contexto de alta densidad**.

### El Módulo "Intuición del Analista"
Permite al usuario (el "Míster") inyectar sus propias lecturas tácticas sobre el partido:
- Expectativa de xG manual.
- Probabilidades de Valla Invicta.
- Probabilidades del mercado Over 2.5 / Ambos Marcan.
- Ponderación directa al resultado clásico 1X2.

### Ingeniería de Prompts Dinámicos
Al finalizar la simulación, el sistema compila toda la matriz probabilística (los 5 resultados exactos más probables, % de vallas invictas, etc.) junto con la intuición humana, y genera un comando estructurado para ser ejecutado por un LLM (Local o API). 

Este prompt instruye a la IA a realizar tareas que la matemática pura no puede hacer:
1. **Scraping de Mercado Financiero:** Analizar las cuotas de casas de apuestas y contratos en Polymarket.
2. **Contexto de Fase de Grupos:** Leer noticias en tiempo real, evaluar lesionados y analizar matemáticamente si a los equipos les "sirve el empate" basado en el fixture restante.
3. **Pronóstico Dual:** Emitir un *Pronóstico Estadístico Puro* y un *Pronóstico Ponderado por el Mercado*.

## 📊 Fuentes de Datos y Recolección Estadística

El motor de la aplicación se alimenta de una base de datos estática (`js/data.js`) compuesta por 48 selecciones nacionales. Todos los valores iniciales y parámetros matemáticos han sido calculados utilizando las siguientes fuentes y metodologías:

- **Goles Esperados (xG) a Favor y en Contra:** Los promedios de `xG` y `xGA` fueron extraídos y calculados a partir de las plataformas de data-scouting y analítica (como Opta y FBref), promediando el rendimiento de cada selección en sus últimas **20 fechas oficiales FIFA**.
- **Forma Reciente (Momentum):** Se evalúa bajo una escala de `0 a 1`, basándose en el porcentaje de puntos obtenidos (y calidad del rival) durante la última ventana de **10 partidos internacionales** (incluyendo amistosos Clase A).
- **Jerarquía de Plantel:** Una puntuación algorítmica de `0 a 10` que pondera el valor de mercado total del plantel (vía Transfermarkt), la presencia de jugadores de élite (Top 5 ligas de Europa) y la profundidad del banquillo.
- **Rankings y Sembrados:** Se utilizan como referencia el Ranking FIFA oficial proyectado hacia 2025/2026.
- **Desempeño en Torneos Mayores:** Las variables tienen un fuerte ajuste de "estrés competitivo" originado en el rendimiento empírico de las selecciones durante la Copa del Mundo Qatar 2022, la EURO 2024, la Copa América 2024, y las Clasificatorias Mundialistas actuales (CONMEBOL, UEFA, AFC, CAF, CONCACAF).

Para el módulo guiado por IA, la fuente de datos pasa a ser **dinámica**, consumiendo en tiempo real datos probabilísticos del mercado financiero predictivo de **Polymarket** y cuotas consolidadas de prestigiosas casas de apuestas deportivas.
