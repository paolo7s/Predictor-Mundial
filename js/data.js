// ════════════════════════════════════════════════════════════════════════════
//  BASE DE DATOS — 48 SELECCIONES
//  Cada equipo tiene:
//    xg:    Expected Goals generados p/90 min (calidad ofensiva)
//    xga:   Expected Goals concedidos p/90 min (solidez defensiva)
//    form:  Puntos en últimos 10 partidos internacionales /30 (escala 0-1)
//    squad: Jerarquía del plantel 0-10 (valor de mercado, estrellas, profundidad)
//    rank:  Posición FIFA aproximada a 2025 (se usa para H2H weighting)
//
//  FUENTES CONCEPTUALES: Rankings FIFA 2025, Eliminatorias, EURO 2024,
//  Copa América 2024, Clasificatorias mundialistas AFC/CAF/CONCACAF 2025.
//  Los xG son promedios estimados de las últimas 20 fechas FIFA.
// ════════════════════════════════════════════════════════════════════════════
const TEAMS = [
  // CONMEBOL
  { name:"Argentina",           flag:"🇦🇷", confed:"CONMEBOL", xg:2.10, xga:0.58, form:0.83, squad:9.4, rank:1,
    h2h:{} },
  { name:"Brasil",              flag:"🇧🇷", confed:"CONMEBOL", xg:1.90, xga:0.72, form:0.70, squad:9.0, rank:5,
    h2h:{} },
  { name:"Uruguay",             flag:"🇺🇾", confed:"CONMEBOL", xg:1.72, xga:0.80, form:0.73, squad:7.8, rank:6,
    h2h:{} },
  { name:"Colombia",            flag:"🇨🇴", confed:"CONMEBOL", xg:1.68, xga:0.70, form:0.77, squad:7.5, rank:9,
    h2h:{} },
  { name:"Ecuador",             flag:"🇪🇨", confed:"CONMEBOL", xg:1.38, xga:0.88, form:0.60, squad:6.2, rank:43,
    h2h:{} },
  { name:"Paraguay",            flag:"🇵🇾", confed:"CONMEBOL", xg:0.92, xga:1.00, form:0.50, squad:5.5, rank:63,
    h2h:{} },
  // UEFA
  { name:"España",              flag:"🇪🇸", confed:"UEFA",    xg:2.12, xga:0.52, form:0.90, squad:9.6, rank:2,
    h2h:{} },
  { name:"Francia",             flag:"🇫🇷", confed:"UEFA",    xg:2.05, xga:0.55, form:0.80, squad:9.5, rank:3,
    h2h:{} },
  { name:"Inglaterra",          flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", confed:"UEFA",    xg:1.92, xga:0.60, form:0.75, squad:9.2, rank:4,
    h2h:{} },
  { name:"Portugal",            flag:"🇵🇹", confed:"UEFA",    xg:1.88, xga:0.68, form:0.78, squad:9.0, rank:6,
    h2h:{} },
  { name:"Alemania",            flag:"🇩🇪", confed:"UEFA",    xg:1.82, xga:0.78, form:0.72, squad:8.8, rank:12,
    h2h:{} },
  { name:"Países Bajos",        flag:"🇳🇱", confed:"UEFA",    xg:1.72, xga:0.75, form:0.68, squad:8.5, rank:7,
    h2h:{} },
  { name:"Bélgica",             flag:"🇧🇪", confed:"UEFA",    xg:1.58, xga:0.90, form:0.58, squad:7.8, rank:3,
    h2h:{} },
  { name:"Croacia",             flag:"🇭🇷", confed:"UEFA",    xg:1.42, xga:0.85, form:0.63, squad:7.5, rank:10,
    h2h:{} },
  { name:"Suiza",               flag:"🇨🇭", confed:"UEFA",    xg:1.38, xga:0.88, form:0.65, squad:7.2, rank:19,
    h2h:{} },
  { name:"Austria",             flag:"🇦🇹", confed:"UEFA",    xg:1.35, xga:0.95, form:0.63, squad:7.0, rank:25,
    h2h:{} },
  { name:"Turquía",             flag:"🇹🇷", confed:"UEFA",    xg:1.32, xga:1.10, form:0.60, squad:6.8, rank:29,
    h2h:{} },
  { name:"Noruega",             flag:"🇳🇴", confed:"UEFA",    xg:1.42, xga:1.05, form:0.62, squad:7.0, rank:20,
    h2h:{} },
  { name:"Suecia",              flag:"🇸🇪", confed:"UEFA",    xg:1.30, xga:1.08, form:0.55, squad:6.5, rank:32,
    h2h:{} },
  { name:"República Checa",     flag:"🇨🇿", confed:"UEFA",    xg:1.25, xga:1.12, form:0.50, squad:6.2, rank:37,
    h2h:{} },
  { name:"Escocia",             flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿", confed:"UEFA",    xg:1.15, xga:1.18, form:0.47, squad:5.8, rank:41,
    h2h:{} },
  { name:"Bosnia y Herzegovina",flag:"🇧🇦", confed:"UEFA",    xg:1.10, xga:1.28, form:0.45, squad:5.5, rank:55,
    h2h:{} },
  // CONCACAF
  { name:"Estados Unidos",      flag:"🇺🇸", confed:"CONCACAF", xg:1.42, xga:1.00, form:0.65, squad:7.2, rank:13,
    h2h:{} },
  { name:"México",              flag:"🇲🇽", confed:"CONCACAF", xg:1.28, xga:1.10, form:0.55, squad:6.8, rank:15,
    h2h:{} },
  { name:"Canadá",              flag:"🇨🇦", confed:"CONCACAF", xg:1.32, xga:1.05, form:0.63, squad:6.8, rank:38,
    h2h:{} },
  { name:"Panamá",              flag:"🇵🇦", confed:"CONCACAF", xg:1.02, xga:1.22, form:0.52, squad:5.5, rank:50,
    h2h:{} },
  { name:"Haití",               flag:"🇭🇹", confed:"CONCACAF", xg:0.88, xga:1.48, form:0.38, squad:4.5, rank:80,
    h2h:{} },
  { name:"Curazao",             flag:"🇨🇼", confed:"CONCACAF", xg:0.82, xga:1.52, form:0.35, squad:4.2, rank:95,
    h2h:{} },
  // CAF
  { name:"Marruecos",           flag:"🇲🇦", confed:"CAF",     xg:1.48, xga:0.60, form:0.75, squad:7.8, rank:14,
    h2h:{} },
  { name:"Senegal",             flag:"🇸🇳", confed:"CAF",     xg:1.42, xga:0.82, form:0.68, squad:7.5, rank:18,
    h2h:{} },
  { name:"Egipto",              flag:"🇪🇬", confed:"CAF",     xg:1.22, xga:0.92, form:0.60, squad:6.8, rank:34,
    h2h:{} },
  { name:"Costa de Marfil",     flag:"🇨🇮", confed:"CAF",     xg:1.28, xga:1.02, form:0.62, squad:7.0, rank:42,
    h2h:{} },
  { name:"Argelia",             flag:"🇩🇿", confed:"CAF",     xg:1.12, xga:1.15, form:0.53, squad:6.5, rank:56,
    h2h:{} },
  { name:"Sudáfrica",           flag:"🇿🇦", confed:"CAF",     xg:1.12, xga:1.12, form:0.50, squad:6.2, rank:58,
    h2h:{} },
  { name:"Túnez",               flag:"🇹🇳", confed:"CAF",     xg:1.08, xga:1.18, form:0.48, squad:6.0, rank:49,
    h2h:{} },
  { name:"Ghana",               flag:"🇬🇭", confed:"CAF",     xg:1.08, xga:1.22, form:0.45, squad:6.0, rank:60,
    h2h:{} },
  { name:"Rep. Dem. del Congo", flag:"🇨🇩", confed:"CAF",     xg:1.02, xga:1.28, form:0.43, squad:5.8, rank:68,
    h2h:{} },
  { name:"Cabo Verde",          flag:"🇨🇻", confed:"CAF",     xg:0.92, xga:1.32, form:0.47, squad:5.2, rank:75,
    h2h:{} },
  // AFC
  { name:"Japón",               flag:"🇯🇵", confed:"AFC",     xg:1.62, xga:0.82, form:0.78, squad:8.0, rank:16,
    h2h:{} },
  { name:"Corea del Sur",       flag:"🇰🇷", confed:"AFC",     xg:1.38, xga:0.92, form:0.65, squad:7.5, rank:23,
    h2h:{} },
  { name:"Australia",           flag:"🇦🇺", confed:"AFC",     xg:1.22, xga:0.98, form:0.60, squad:6.8, rank:24,
    h2h:{} },
  { name:"Irán",                flag:"🇮🇷", confed:"AFC",     xg:1.18, xga:0.92, form:0.57, squad:6.5, rank:22,
    h2h:{} },
  { name:"Arabia Saudita",      flag:"🇸🇦", confed:"AFC",     xg:1.02, xga:1.18, form:0.48, squad:6.2, rank:56,
    h2h:{} },
  { name:"Uzbekistán",          flag:"🇺🇿", confed:"AFC",     xg:1.02, xga:1.22, form:0.50, squad:6.0, rank:71,
    h2h:{} },
  { name:"Qatar",               flag:"🇶🇦", confed:"AFC",     xg:0.88, xga:1.42, form:0.40, squad:5.5, rank:77,
    h2h:{} },
  { name:"Irak",                flag:"🇮🇶", confed:"AFC",     xg:0.82, xga:1.42, form:0.40, squad:5.2, rank:72,
    h2h:{} },
  { name:"Jordania",            flag:"🇯🇴", confed:"AFC",     xg:0.82, xga:1.38, form:0.42, squad:5.0, rank:83,
    h2h:{} },
  // OFC
  { name:"Nueva Zelanda",       flag:"🇳🇿", confed:"OFC",     xg:0.78, xga:1.52, form:0.38, squad:4.8, rank:100,
    h2h:{} },
];

// ════════════════════════════════════════════════════════════════════════════
//  HISTORIAL H2H — Partidos históricos entre selecciones clave
//  Formato: { "A_B": [winsA, draws, winsB, last_advantage] }
//  last_advantage: 1=A ganó último, 0=empate, -1=B ganó último
// ════════════════════════════════════════════════════════════════════════════
const H2H_DATA = {
  "Argentina_Brasil":     [41, 25, 43, -1],
  "Argentina_Francia":    [3, 0, 2, 1],   // Final Qatar 2022 ARG ganó
  "Argentina_España":     [7, 4, 5, 1],
  "Argentina_Inglaterra": [5, 0, 5, 1],   // EURO 87 ARG ganó
  "Argentina_Alemania":   [6, 3, 5, 1],   // Final Brasil 2014 ARG ganó pen
  "Argentina_Uruguay":    [47, 18, 35, 0],
  "Argentina_Colombia":   [18, 11, 13, -1], // Copa Am 2024 COL venció en grupos
  "Argentina_Portugal":   [4, 2, 3, 1],
  "Argentina_México":     [5, 2, 3, 1],   // Qatar 2022
  "Argentina_Países Bajos":[4, 2, 5, 1],  // Qatar 2022 ARG pen
  "Argentina_Croacia":    [3, 1, 2, 1],   // Qatar 2022
  "Argentina_Japón":      [2, 0, 1, 1],
  "Argentina_Marruecos":  [4, 1, 0, 1],
  "Brasil_Francia":       [3, 2, 3, 0],   // QF 2006 FRA ganó
  "Brasil_España":        [4, 3, 5, -1],  // Final Confederaciones 2013 ESP
  "Brasil_Alemania":      [12, 7, 12, -1],// 2014 1-7
  "Brasil_Uruguay":       [48, 11, 36, 1],
  "Brasil_Colombia":      [12, 5, 7, 1],
  "Brasil_Portugal":      [4, 3, 3, 1],
  "Brasil_México":        [8, 2, 1, 1],
  "Brasil_Países Bajos":  [5, 3, 5, -1],  // 2010 NED ganó
  "Brasil_Inglaterra":    [5, 6, 3, 1],
  "Brasil_Japón":         [5, 0, 0, 1],
  "Brasil_Marruecos":     [3, 2, 0, 1],
  "Brasil_Croacia":       [3, 1, 0, 1],
  "España_Francia":       [16, 7, 14, 1],  // UEFA NL 2024 ESP
  "España_Alemania":      [14, 7, 15, 1],  // EURO 2024 SF ESP
  "España_Portugal":      [15, 7, 17, 1],  // NL 2021 ESP
  "España_Inglaterra":    [16, 7, 15, 1],  // Final EURO 2024 ESP
  "España_Países Bajos":  [10, 3, 10, -1], // 2022 NL NED
  "España_Croacia":       [6, 1, 2, 1],
  "España_Italia":        [14, 8, 12, 1],
  "España_Marruecos":     [7, 5, 2, 1],
  "Francia_Alemania":     [15, 11, 16, 1], // EURO 2020 FRA
  "Francia_Portugal":     [8, 4, 9, 0],   // QF EURO 2024 empate pen
  "Francia_Inglaterra":   [17, 10, 9, 1],
  "Francia_Países Bajos": [12, 5, 10, 1],
  "Francia_Croacia":      [5, 1, 2, 1],   // Final 2018 FRA
  "Francia_Marruecos":    [4, 1, 0, 1],   // SF Qatar 2022
  "Alemania_Portugal":    [12, 3, 8, 1],  // EURO 2020 GER 4-2
  "Alemania_Inglaterra":  [15, 6, 14, 1],
  "Alemania_Países Bajos":[22, 9, 18, 1],
  "Alemania_Croacia":     [6, 2, 2, -1],  // NL 2022 CRO
  "Portugal_Inglaterra":  [7, 3, 5, 0],
  "Portugal_Países Bajos":[5, 3, 5, 1],
  "Portugal_Francia":     [5, 4, 8, 0],
  "Inglaterra_Países Bajos":[9, 7, 11, -1], // SF EURO 2024 ENG pen
  "Uruguay_Colombia":     [17, 9, 11, 1],
  "Uruguay_Ecuador":      [15, 5, 9, 1],
  "Colombia_Ecuador":     [14, 9, 8, 1],
  "Estados Unidos_México":[36, 15, 14, 1],
  "Estados Unidos_Canadá":[19, 4, 9, 1],
  "Japón_Corea del Sur":  [14, 24, 16, 1],
  "Japón_Australia":      [9, 3, 5, 1],
  "Marruecos_Senegal":    [11, 5, 8, 0],
  "Marruecos_Egipto":     [9, 6, 7, 1],
  "Senegal_Costa de Marfil":[8, 4, 6, 1],
};

// ════════════════════════════════════════════════════════════════════════════
//  PESOS DEL MODELO COMPUESTO (suman 1.0)
// ════════════════════════════════════════════════════════════════════════════
const W = {
  xg:    0.35,   // Calidad ofensiva/defensiva (Expected Goals)
  form:  0.28,   // Forma reciente (últimos 10 partidos)
  squad: 0.22,   // Jerarquía del plantel
  h2h:   0.15,   // Historial de enfrentamientos directos
};

const CONFEDERACIONES = {
  "CONMEBOL": "CONMEBOL — Sudamérica",
  "UEFA":     "UEFA — Europa",
  "CONCACAF": "CONCACAF — Norte y Centroamérica",
  "CAF":      "CAF — África",
  "AFC":      "AFC — Asia",
  "OFC":      "OFC — Oceanía"
};