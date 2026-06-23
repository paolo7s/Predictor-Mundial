import urllib.request
import csv
import math
import codecs

print("\n[1/4] Descargando base de datos histórica de Kaggle...")
url = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
response = urllib.request.urlopen(url)
reader = list(csv.DictReader(codecs.iterdecode(response, 'utf-8')))

# Diccionario de equipos top (Mapeo GitHub -> Kaggle)
github_data = {
    "Argentina": {"xg":2.10, "xga":0.58, "form":0.83, "squad":9.4},
    "Brazil": {"xg":1.90, "xga":0.72, "form":0.70, "squad":9.0},
    "Uruguay": {"xg":1.72, "xga":0.80, "form":0.73, "squad":7.8},
    "Colombia": {"xg":1.68, "xga":0.70, "form":0.77, "squad":7.5},
    "Spain": {"xg":2.12, "xga":0.52, "form":0.90, "squad":9.6},
    "France": {"xg":2.05, "xga":0.55, "form":0.80, "squad":9.5},
    "England": {"xg":1.92, "xga":0.60, "form":0.75, "squad":9.2},
    "Portugal": {"xg":1.88, "xga":0.68, "form":0.78, "squad":9.0},
    "Germany": {"xg":1.82, "xga":0.78, "form":0.72, "squad":8.8},
    "Netherlands": {"xg":1.72, "xga":0.75, "form":0.68, "squad":8.5},
    "Belgium": {"xg":1.58, "xga":0.90, "form":0.58, "squad":7.8},
    "Croatia": {"xg":1.42, "xga":0.85, "form":0.63, "squad":7.5},
    "United States": {"xg":1.42, "xga":1.00, "form":0.65, "squad":7.2},
    "Morocco": {"xg":1.48, "xga":0.60, "form":0.75, "squad":7.8}
}

# MODELO B: Dinámico (Promedios Históricos Ciegos como si fuera la Red Neuronal)
hist_stats = {}
def update_hist(team, scored, conceded):
    if team not in hist_stats:
        hist_stats[team] = {'gs': 0, 'gc': 0, 'm': 0}
    hist_stats[team]['gs'] += scored
    hist_stats[team]['gc'] += conceded
    hist_stats[team]['m'] += 1

print("[2/4] Calculando estadísticas ciegas (Modelo B) pre-2024...")
for row in reader:
    try:
        year = int(row['date'][:4])
        if year < 2024:
            update_hist(row['home_team'], int(row['home_score']), int(row['away_score']))
            update_hist(row['away_team'], int(row['away_score']), int(row['home_score']))
    except:
        pass

print("[3/4] Evaluando Torneos 2024 (Eurocopa / Copa América) en equipos TOP...")
matches_2024 = []
for row in reader:
    try:
        if int(row['date'][:4]) == 2024:
            if row['home_team'] in github_data and row['away_team'] in github_data:
                matches_2024.append(row)
    except:
        pass

def poisson(k, l):
    if l <= 0: return 0
    return ((l**k) * math.exp(-l)) / math.factorial(k)

def predict_dixon_coles(lA, lB):
    p_home, p_draw, p_away = 0.0, 0.0, 0.0
    for i in range(6):
        for j in range(6):
            p_base = poisson(i, lA) * poisson(j, lB)
            if i > j: p_home += p_base
            elif i < j: p_away += p_base
            else: p_draw += p_base
    if p_home > p_draw and p_home > p_away: return 1.0
    elif p_away > p_home and p_away > p_draw: return 0.0
    else: return 0.5

correct_A = 0 # GitHub Model (Fixed xG + Squad + Form)
correct_B = 0 # Neural/Dynamic Model (Historical averages only)

for m in matches_2024:
    hs = int(m['home_score'])
    ascore = int(m['away_score'])
    target = 1.0 if hs > ascore else (0.0 if hs < ascore else 0.5)
    
    tA = m['home_team']
    tB = m['away_team']
    
    # MODELO A: GitHub Web App Logic (xG * form * squad_ratio)
    # Simulating the app.js calculation logic for base expected goals
    squad_adv_A = github_data[tA]['squad'] / 8.0
    squad_adv_B = github_data[tB]['squad'] / 8.0
    
    lA_model_A = github_data[tA]['xg'] * squad_adv_A * github_data[tA]['form'] * (github_data[tB]['xga']/1.0)
    lB_model_A = github_data[tB]['xg'] * squad_adv_B * github_data[tB]['form'] * (github_data[tA]['xga']/1.0)
    pred_A = predict_dixon_coles(lA_model_A, lB_model_A)
    
    # MODELO B: Dynamic / Historical Model Logic
    statA = hist_stats[tA]
    statB = hist_stats[tB]
    lA_model_B = (statA['gs']/statA['m']) * (statB['gc']/statB['m'])
    lB_model_B = (statB['gs']/statB['m']) * (statA['gc']/statA['m'])
    pred_B = predict_dixon_coles(lA_model_B, lB_model_B)
    
    if pred_A == target: correct_A += 1
    if pred_B == target: correct_B += 1

acc_A = (correct_A / len(matches_2024)) * 100
acc_B = (correct_B / len(matches_2024)) * 100

print("\n" + "="*50)
print("🏆 TORNEOS 2024: CHOQUE DE GIGANTES (Equipos Élite)")
print(f"   Partidos analizados: {len(matches_2024)}")
print("="*50)
print(f"⭐ MODELO A (GitHub - Jerarquía/Forma/Mercado): {acc_A:.2f}% de precisión.")
print(f"🤖 MODELO B (Dinámico Ciego - Puros goles):   {acc_B:.2f}% de precisión.")
print("="*50)
