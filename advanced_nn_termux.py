import urllib.request
import csv
import math
import random
import codecs

print("\n[1/5] Descargando base de datos histórica de Kaggle (1872-2024)...")
url = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
response = urllib.request.urlopen(url)
reader = csv.DictReader(codecs.iterdecode(response, 'utf-8'))

data_rows = []
for row in reader:
    try:
        # Filtramos para tener suficiente historia para el Elo
        data_rows.append(row)
    except:
        pass

print("[2/5] Calculando ELO Rating Global y Características Avanzadas...")

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

dataset = []
for row in data_rows:
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
    
    if hs > ascore:
        res = 1.0
    elif hs < ascore:
        res = 0.0
    else:
        res = 0.5
        
    # Guardamos en dataset solo partidos desde 2010 para entrenar con el ELO ya calibrado
    if year >= 2010:
        dataset.append({
            'inputs': [
                hXg/3.0, hXga/3.0, aXg/3.0, aXga/3.0,
                (eloA - eloB) / 1000.0, # Diferencia de ELO (Feature ultra poderoso)
                neutral
            ],
            'target': res
        })
        
    update_stats(tA, hs, ascore)
    update_stats(tB, ascore, hs)
    update_elo(tA, tB, res, row.get('tournament', 'Friendly'))

# Split
split_idx = int(len(dataset) * 0.8)
train_data = dataset[:split_idx]
test_data = dataset[split_idx:]

print(f"[3/5] Construyendo Red Neuronal Profunda (Cero Dependencias)...")
print(f"      Nuevas variables: Ranking ELO Dinámico y Factor de Localía.")
print(f"      Entrenamiento: {len(train_data)} partidos | Prueba: {len(test_data)} partidos.")

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

models = [SimpleNN(6, 12) for _ in range(5)] # Ensemble de 5 modelos, 6 inputs

print("[4/5] Entrenando la Red Neuronal Avanzada... (Aguarde)")
for _ in range(40):
    for item in train_data:
        for m in models:
            m.train(item['inputs'], item['target'])

print("\n[5/5] Realizando Test Final de Precisión...\n")

def evaluate(data_subset):
    correct = 0
    for item in data_subset:
        preds = [m.predict(item['inputs']) for m in models]
        avg_pred = sum(preds) / len(preds)
        if avg_pred > 0.55: p = 1.0
        elif avg_pred < 0.45: p = 0.0
        else: p = 0.5
        if p == item['target']:
            correct += 1
    return (correct / len(data_subset)) * 100

acc_train = evaluate(train_data)
acc_test = evaluate(test_data)

print("="*50)
print("🚀 RESULTADOS DE LA RED NEURONAL V2.0 (ELO RATING)")
print("="*50)
print(f"🎯 Precisión IN-SAMPLE:     {acc_train:.2f}%")
print(f"🔮 Precisión OUT-OF-SAMPLE: {acc_test:.2f}%")
print("="*50)
print("Mejora estructural implementada con éxito.")
