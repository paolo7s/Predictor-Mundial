# Mundial 2026 Predictor - Motor Estadístico y AI

🌐 **Enlace directo a la aplicación:** [https://paolo7s.github.io/PredictorWeb/](https://paolo7s.github.io/PredictorWeb/)

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

### El Módulo "Intuición del Analista" y Aislamiento Matemático
Es crucial destacar que **la intuición humana del analista NO corrompe ni influye sobre el cálculo estadístico puro** generado por la aplicación. El motor matemático de Dixon-Coles siempre entregará resultados crudos y objetivos. 

La intuición del usuario (expectativas de xG, vallas invictas, etc.) solamente se refleja al final del proceso, inyectándose de forma aislada dentro del prompt final generado.

### Ingeniería de Prompts Dinámicos y Predicción Real
Al finalizar la simulación, el sistema compila toda la matriz teórica probabilística (los 5 resultados exactos más probables, % de vallas invictas, BTTS, etc.) junto con la intuición humana, generando un comando estructurado para ser ejecutado por un LLM.

La función vital de este prompt es guiar a la IA para que contraste los datos teóricos previamente calculados con **información del mundo real en tiempo real**, investigando:
- Las cuotas en las prestigiosas **casas de apuestas**.
- El sentimiento financiero del **mercado de Polymarket**.
- Las **últimas noticias** y la situación actual de los jugadores (lesiones, suspensiones, estado anímico).
- El **contexto de fase de grupos**, considerando empates convenientes o la urgencia de puntos basada en los rivales restantes.

Finalmente, a partir de toda esta información, la IA emitirá obligatoriamente **dos pronósticos distintos**:
1. **Pronóstico Estadístico Puro:** Analizando solo el fútbol, las estadísticas teóricas y las noticias, *sin estar influenciado* por lo que dicte el mercado financiero o las apuestas.
2. **Pronóstico Ponderado por el Mercado:** Un resultado híbrido que equilibra la realidad futbolística con las tendencias y cuotas del dinero global.

## 📊 Fuentes de Datos y Recolección Estadística

El motor de la aplicación se alimenta de una base de datos estática (`js/data.js`) compuesta por 48 selecciones nacionales. Todos los valores iniciales y parámetros matemáticos han sido calculados utilizando las siguientes fuentes y metodologías:

- **Goles Esperados (xG) a Favor y en Contra:** Los promedios de `xG` y `xGA` fueron extraídos y calculados a partir de las plataformas de data-scouting y analítica (como Opta y FBref), promediando el rendimiento de cada selección en sus últimas **20 fechas oficiales FIFA**.
- **Forma Reciente (Momentum):** Se evalúa bajo una escala de `0 a 1`, basándose en el porcentaje de puntos obtenidos (y calidad del rival) durante la última ventana de **10 partidos internacionales** (incluyendo amistosos Clase A).
- **Jerarquía de Plantel:** Una puntuación algorítmica de `0 a 10` que pondera el valor de mercado total del plantel (vía Transfermarkt), la presencia de jugadores de élite (Top 5 ligas de Europa) y la profundidad del banquillo.
- **Rankings y Sembrados:** Se utilizan como referencia el Ranking FIFA oficial proyectado hacia 2025/2026.
- **Desempeño en Torneos Mayores:** Las variables tienen un fuerte ajuste de "estrés competitivo" originado en el rendimiento empírico de las selecciones durante la Copa del Mundo Qatar 2022, la EURO 2024, la Copa América 2024, y las Clasificatorias Mundialistas actuales (CONMEBOL, UEFA, AFC, CAF, CONCACAF).

Para el módulo guiado por IA, la fuente de datos pasa a ser **dinámica**, consumiendo en tiempo real datos probabilísticos del mercado financiero predictivo de **Polymarket** y cuotas consolidadas de prestigiosas casas de apuestas deportivas.
