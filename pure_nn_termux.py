import urllib.request
import csv
import math
import random
import json
import codecs

print("\n[1/5] Descargando base de datos histórica de Kaggle (1872-2024)...")
url = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
response = urllib.request.urlopen(url)
reader = csv.DictReader(codecs.iterdecode(response, 'utf-8'))

data_rows = []
for row in reader:
    try:
        year = int(row['date'][:4])
        if year >= 2018: # Last 6 years to speed up mobile training
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
        'inputs': [hXg/3.0, hXga/3.0, aXg/3.0, aXga/3.0],
        'target': res
    })

split_idx = int(len(dataset) * 0.8)
train_data = dataset[:split_idx]
test_data = dataset[split_idx:]

print(f"[3/5] Construyendo Ensemble de Redes Neuronales (Cero Dependencias, Pure Python)...")
print(f"      Entrenamiento: {len(train_data)} partidos | Prueba: {len(test_data)} partidos.")

# --- SIMPLE MULTILAYER PERCEPTRON IN PURE PYTHON ---
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
        # Forward pass
        hid_outs = []
        for i in range(len(self.b_hid)):
            val = sum(inputs[j] * self.w_in_hid[i][j] for j in range(len(inputs))) + self.b_hid[i]
            hid_outs.append(self.sigmoid(val))
            
        out_val = sum(hid_outs[j] * self.w_hid_out[j] for j in range(len(hid_outs))) + self.b_out
        out = self.sigmoid(out_val)
        
        # Backward pass
        error = target - out
        d_out = error * out * (1 - out)
        
        d_hids = []
        for i in range(len(hid_outs)):
            d_hid = d_out * self.w_hid_out[i] * hid_outs[i] * (1 - hid_outs[i])
            d_hids.append(d_hid)
            
        # Update weights
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

models = [SimpleNN(4, 8) for _ in range(3)]

print("[4/5] Entrenando el modelo (In-Sample)... (Aguarde unos segundos)")
for _ in range(30): # Epochs
    for item in train_data:
        for m in models:
            m.train(item['inputs'], item['target'])

print("\n[5/5] Realizando Tests de Precisión y calculando capacidad de acierto...\n")

def evaluate(data_subset):
    correct = 0
    for item in data_subset:
        preds = [m.predict(item['inputs']) for m in models]
        avg_pred = sum(preds) / len(preds)
        
        # Clasificar: < 0.4 Visita, > 0.6 Local, sino Empate
        if avg_pred > 0.55:
            p = 1.0
        elif avg_pred < 0.45:
            p = 0.0
        else:
            p = 0.5
            
        # Para partidos de fútbol, acertar 1X2.
        if p == item['target']:
            correct += 1
    return (correct / len(data_subset)) * 100

acc_train = evaluate(train_data)
acc_test = evaluate(test_data)

print("="*50)
print("📊 RESULTADOS DEL NEURAL NETWORK ENSEMBLE LOCAL")
print("="*50)
print(f"🎯 Precisión IN-SAMPLE (Datos Vistos):     {acc_train:.2f}%")
print(f"🔮 Precisión OUT-OF-SAMPLE (Datos Futuros): {acc_test:.2f}%")
print("="*50)
print("NOTA: ¡Este modelo se ejecutó 100% nativo en tu dispositivo Android sin dependencias!")
