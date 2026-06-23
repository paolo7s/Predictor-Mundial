import urllib.request
import csv
import math
import codecs

print("\n[1/5] Descargando base de datos histórica de Kaggle (1872-2024)...")
url = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
response = urllib.request.urlopen(url)
reader = csv.DictReader(codecs.iterdecode(response, 'utf-8'))

data_rows = []
for row in reader:
    try:
        year = int(row['date'][:4])
        if year >= 2018:
            data_rows.append(row)
    except:
        pass

print("[2/5] Procesando", len(data_rows), "partidos y calculando características...")

team_stats = {}
def get_stats(team):
    if team not in team_stats:
        team_stats[team] = {'gs': 1.0, 'gc': 1.0, 'm': 1}
    return team_stats[team]['gs']/team_stats[team]['m'], team_stats[team]['gc']/team_stats[team]['m']

def update_stats(team, scored, conceded):
    if team not in team_stats:
        team_stats[team] = {'gs': 0, 'gc': 0, 'm': 0}
    team_stats[team]['gs'] += scored
    team_stats[team]['gc'] += conceded
    team_stats[team]['m'] += 1

dataset = []
for row in data_rows:
    try:
        hs = int(row['home_score'])
        ascore = int(row['away_score'])
    except:
        continue
        
    hXg, hXga = get_stats(row['home_team'])
    aXg, aXga = get_stats(row['away_team'])
    
    update_stats(row['home_team'], hs, ascore)
    update_stats(row['away_team'], ascore, hs)
    
    # Target: 0 (Visitante), 0.5 (Empate), 1 (Local)
    if hs > ascore:
        res = 1.0
    elif hs < ascore:
        res = 0.0
    else:
        res = 0.5
        
    dataset.append({
        'lA': hXg * aXga, # Simple cross-interaction for lambda A
        'lB': aXg * hXga, # Simple cross-interaction for lambda B
        'target': res
    })

split_idx = int(len(dataset) * 0.8)
train_data = dataset[:split_idx]
test_data = dataset[split_idx:]

print(f"[3/5] Aplicando motor Matemático de Poisson y Dixon-Coles...")

def poisson(k, l):
    if l <= 0: return 0
    return ((l**k) * math.exp(-l)) / math.factorial(k)

def predict_dixon_coles(lA, lB):
    rho = -0.15
    p_home = 0.0
    p_draw = 0.0
    p_away = 0.0
    
    for i in range(6):
        for j in range(6):
            p_base = poisson(i, lA) * poisson(j, lB)
            # Ajuste Dixon-Coles
            if i == 0 and j == 0:
                p_base *= max(0, 1 - lA*lB*rho)
            elif i == 0 and j == 1:
                p_base *= max(0, 1 + lA*rho)
            elif i == 1 and j == 0:
                p_base *= max(0, 1 + lB*rho)
            elif i == 1 and j == 1:
                p_base *= max(0, 1 - rho)
                
            if i > j:
                p_home += p_base
            elif i < j:
                p_away += p_base
            else:
                p_draw += p_base
                
    # Clasificar el mayor
    if p_home > p_draw and p_home > p_away:
        return 1.0
    elif p_away > p_home and p_away > p_draw:
        return 0.0
    else:
        return 0.5

print("[4/5] Evaluando capacidad predictiva...")

def evaluate(data_subset):
    correct = 0
    for item in data_subset:
        # Proyectar el partido con el motor de Dixon-Coles
        pred = predict_dixon_coles(item['lA'], item['lB'])
        if pred == item['target']:
            correct += 1
    return (correct / len(data_subset)) * 100

acc_train = evaluate(train_data)
acc_test = evaluate(test_data)

print("="*50)
print("📊 RESULTADOS DEL MODELO DIXON-COLES (TEST ESTÁNDAR)")
print("="*50)
print(f"🎯 Precisión IN-SAMPLE (Datos Vistos):     {acc_train:.2f}%")
print(f"🔮 Precisión OUT-OF-SAMPLE (Datos Futuros): {acc_test:.2f}%")
print("="*50)
print("NOTA: Tu modelo de Dixon-Coles corriendo sin la IA humana.")
