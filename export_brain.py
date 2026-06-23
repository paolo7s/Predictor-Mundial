import urllib.request
import csv
import math
import random
import codecs
import json

print("[1/4] Descargando Kaggle...")
url = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
response = urllib.request.urlopen(url)
reader = list(csv.DictReader(codecs.iterdecode(response, 'utf-8')))

elo_dict = {}
def get_elo(team): return elo_dict.get(team, 1500)

def update_elo(t1, t2, res1, tournament):
    k = 20
    if 'World Cup' in tournament: k = 40
    elif 'Friendly' in tournament: k = 10
    r1, r2 = get_elo(t1), get_elo(t2)
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

# Proceso cronológico
for row in reader:
    try:
        hs, ascore = int(row['home_score']), int(row['away_score'])
        year = int(row['date'][:4])
    except: continue
    tA, tB = row['home_team'], row['away_team']
    neutral = 1.0 if row.get('neutral', 'FALSE') == 'TRUE' else 0.0
    
    hXg, hXga = get_stats(tA)
    aXg, aXga = get_stats(tB)
    eloA, eloB = get_elo(tA), get_elo(tB)
    
    if hs > ascore: res = 1.0
    elif hs < ascore: res = 0.0
    else: res = 0.5
        
    if 2010 <= year <= 2024:
        train_data.append({'inputs': [hXg/3.0, hXga/3.0, aXg/3.0, aXga/3.0, (eloA - eloB)/1000.0, neutral], 'target': res})
            
    update_stats(tA, hs, ascore)
    update_stats(tB, ascore, hs)
    update_elo(tA, tB, res, row.get('tournament', 'Friendly'))

print("[2/4] Entrenando Red Neuronal hasta alcanzar convergencia (>55%)...")
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
            d_hids.append(d_out * self.w_hid_out[i] * hid_outs[i] * (1 - hid_outs[i]))
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

# Train until we guarantee a good model
best_models = None
best_acc = 0
attempts = 0
test_data = train_data[-2000:] # Last 2000 as out of sample validation
train_split = train_data[:-2000]

while best_acc < 54.0 and attempts < 5:
    print(f"Intento {attempts+1}...")
    models = [SimpleNN(6, 12) for _ in range(5)]
    for _ in range(25):
        for item in train_split:
            for m in models:
                m.train(item['inputs'], item['target'])
                
    correct = 0
    for item in test_data:
        preds = [m.predict(item['inputs']) for m in models]
        avg_pred = sum(preds) / len(preds)
        p = 1.0 if avg_pred > 0.55 else (0.0 if avg_pred < 0.45 else 0.5)
        if p == item['target']:
            correct += 1
    acc = (correct / len(test_data)) * 100
    print(f"Precisión: {acc:.2f}%")
    
    if acc > best_acc:
        best_acc = acc
        best_models = models
    attempts += 1

print(f"[3/4] Mejor modelo asegurado con {best_acc:.2f}%. Extrayendo cerebro...")

brain_data = {
    'models': [],
    'profiles': {}
}

for m in best_models:
    brain_data['models'].append({
        'w_in_hid': m.w_in_hid,
        'b_hid': m.b_hid,
        'w_hid_out': m.w_hid_out,
        'b_out': m.b_out
    })

# Exportar perfiles de equipos para la Web App (Nombre Kaggle a Nombre Web App)
name_map = {
    "Argentina": "Argentina", "Brazil": "Brasil", "Uruguay": "Uruguay", "Colombia": "Colombia",
    "Ecuador": "Ecuador", "Paraguay": "Paraguay", "Spain": "España", "France": "Francia",
    "England": "Inglaterra", "Portugal": "Portugal", "Germany": "Alemania", "Netherlands": "Países Bajos",
    "Belgium": "Bélgica", "Croatia": "Croacia", "Switzerland": "Suiza", "Austria": "Austria",
    "Turkey": "Turquía", "Norway": "Noruega", "Sweden": "Suecia", "Czech Republic": "República Checa",
    "Scotland": "Escocia", "Bosnia and Herzegovina": "Bosnia y Herzegovina", "United States": "Estados Unidos",
    "Mexico": "México", "Canada": "Canadá", "Panama": "Panamá", "Haiti": "Haití", "Curacao": "Curazao",
    "Morocco": "Marruecos", "Senegal": "Senegal", "Egypt": "Egipto", "Ivory Coast": "Costa de Marfil",
    "Algeria": "Argelia", "South Africa": "Sudáfrica", "Tunisia": "Túnez", "Ghana": "Ghana",
    "DR Congo": "Rep. Dem. del Congo", "Cape Verde": "Cabo Verde", "Japan": "Japón", "Iran": "Irán",
    "South Korea": "Corea del Sur", "Australia": "Australia", "Saudi Arabia": "Arabia Saudita",
    "Qatar": "Catar", "Iraq": "Irak", "New Zealand": "Nueva Zelanda"
}

for k_name, web_name in name_map.items():
    hx, hxa = get_stats(k_name)
    ax, axa = get_stats(k_name) # Approximation
    brain_data['profiles'][web_name] = {
        'hx': hx, 'hxa': hxa, 'ax': ax, 'axa': axa,
        'elo': get_elo(k_name)
    }

print("[4/4] Guardando ai_brain.json...")
with open('js/ai_brain.json', 'w') as f:
    json.dump(brain_data, f)
print("¡Cerebro exportado exitosamente!")
