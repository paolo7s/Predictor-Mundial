import urllib.request
import csv
import math
import random
import codecs

print("\n[1/5] Descargando base de datos histórica...")
url = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
response = urllib.request.urlopen(url)
reader = list(csv.DictReader(codecs.iterdecode(response, 'utf-8')))

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

print("[2/5] Calculando Ranking ELO y recolectando datos...")
elo_dict = {}
def get_elo(team):
    return elo_dict.get(team, 1500)

def update_elo(t1, t2, res1, tournament):
    k = 20
    if 'World Cup' in tournament:
        k = 40
    elif 'Friendly' in tournament:
        k = 10
    r1 = get_elo(t1)
    r2 = get_elo(t2)
    e1 = 1 / (1 + 10 ** ((r2 - r1) / 400))
    elo_dict[t1] = r1 + k * (res1 - e1)
    elo_dict[t2] = r2 + k * ((1 - res1) - (1 - e1))

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

train_data = []
test_matches = []

for row in reader:
    try:
        hs = int(row['home_score'])
        ascore = int(row['away_score'])
        year = int(row['date'][:4])
    except:
        continue
        
    tA = row['home_team']
    tB = row['away_team']
    neutral = 1.0 if row.get('neutral', 'FALSE') == 'TRUE' else 0.0
    
    hXg, hXga = get_stats(tA)
    aXg, aXga = get_stats(tB)
    eloA = get_elo(tA)
    eloB = get_elo(tB)
    
    if hs > ascore: res = 1.0
    elif hs < ascore: res = 0.0
    else: res = 0.5
        
    inputs = [
        hXg/3.0, hXga/3.0, aXg/3.0, aXga/3.0,
        (eloA - eloB) / 1000.0,
        neutral
    ]
    
    if 2010 <= year < 2024:
        train_data.append({'inputs': inputs, 'target': res})
    elif year == 2024:
        if tA in github_data and tB in github_data:
            test_matches.append({'inputs': inputs, 'target': res, 'tA': tA, 'tB': tB})
            
    update_stats(tA, hs, ascore)
    update_stats(tB, ascore, hs)
    update_elo(tA, tB, res, row.get('tournament', 'Friendly'))

print("[3/5] Entrenando RED NEURONAL V2.0 con ELO (Modelo B)...")
class SimpleNN:
    def __init__(self, inputs, hidden):
        self.w_in_hid = [[random.uniform(-1, 1) for _ in range(inputs)] for _ in range(hidden)]
        self.b_hid = [random.uniform(-1, 1) for _ in range(hidden)]
        self.w_hid_out = [random.uniform(-1, 1) for _ in range(hidden)]
        self.b_out = random.uniform(-1, 1)
        self.lr = 0.05

    def sigmoid(self, x):
        return 1 / (1 + math.exp(max(min(-x, 100), -100)))

    def train(self, inputs, target):
        hid_outs = []
        for i in range(len(self.b_hid)):
            val = sum(inputs[j] * self.w_in_hid[i][j] for j in range(len(inputs))) + self.b_hid[i]
            hid_outs.append(self.sigmoid(val))
        out_val = sum(hid_outs[j] * self.w_hid_out[j] for j in range(len(hid_outs))) + self.b_out
        out = self.sigmoid(out_val)
        
        error = target - out
        d_out = error * out * (1 - out)
        
        d_hids = []
        for i in range(len(hid_outs)):
            d_hid = d_out * self.w_hid_out[i] * hid_outs[i] * (1 - hid_outs[i])
            d_hids.append(d_hid)
            
        for i in range(len(self.w_hid_out)):
            self.w_hid_out[i] += self.lr * d_out * hid_outs[i]
        self.b_out += self.lr * d_out
        
        for i in range(len(self.b_hid)):
            for j in range(len(inputs)):
                self.w_in_hid[i][j] += self.lr * d_hids[i] * inputs[j]
            self.b_hid[i] += self.lr * d_hids[i]

    def predict(self, inputs):
        hid_outs = []
        for i in range(len(self.b_hid)):
            val = sum(inputs[j] * self.w_in_hid[i][j] for j in range(len(inputs))) + self.b_hid[i]
            hid_outs.append(self.sigmoid(val))
        out_val = sum(hid_outs[j] * self.w_hid_out[j] for j in range(len(hid_outs))) + self.b_out
        return self.sigmoid(out_val)

models = [SimpleNN(6, 12) for _ in range(3)]
for _ in range(20):
    for item in train_data:
        for m in models:
            m.train(item['inputs'], item['target'])

print("[4/5] Evaluando Modelo A (GitHub) y Modelo B (Red Neuronal V2.0)...")

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

correct_A = 0
correct_B = 0

for m in test_matches:
    target = m['target']
    tA = m['tA']
    tB = m['tB']
    
    # MODELO A: GitHub Web App Logic
    sqA = github_data[tA]['squad'] / 8.0
    sqB = github_data[tB]['squad'] / 8.0
    lA = github_data[tA]['xg'] * sqA * github_data[tA]['form'] * (github_data[tB]['xga']/1.0)
    lB = github_data[tB]['xg'] * sqB * github_data[tB]['form'] * (github_data[tA]['xga']/1.0)
    pred_A = predict_dixon_coles(lA, lB)
    
    # MODELO B: Red Neuronal V2.0
    preds = [mod.predict(m['inputs']) for mod in models]
    avg_pred = sum(preds) / len(preds)
    if avg_pred > 0.55: pred_B = 1.0
    elif avg_pred < 0.45: pred_B = 0.0
    else: pred_B = 0.5
    
    if pred_A == target: correct_A += 1
    if pred_B == target: correct_B += 1

acc_A = (correct_A / len(test_matches)) * 100
acc_B = (correct_B / len(test_matches)) * 100

print("\n" + "="*60)
print("🏆 TORNEOS 2024: EL GRAN COMBATE (Partidos Élite Euro/Copa)")
print(f"   Cantidad de Partidos Evaluados: {len(test_matches)}")
print("="*60)
print(f"⭐ MODELO A (GitHub Poisson + Valores Manuales): {acc_A:.2f}% de acierto.")
print(f"🤖 MODELO B (Red Neuronal V2.0 + Ranking ELO):  {acc_B:.2f}% de acierto.")
print("="*60)
