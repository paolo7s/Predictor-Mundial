"""
🚀 SCRIPT PARA GOOGLE COLAB: Variational Neural Network Ensemble para Predicción de Fútbol

INSTRUCCIONES:
1. Abre https://colab.research.google.com/
2. Crea un 'Nuevo Cuaderno' (New Notebook).
3. Copia TODO el contenido de este archivo y pégalo en la primera celda.
4. Presiona el botón de 'Play' (Ejecutar celda).
"""

import os
print("Instalando librerías necesarias...")
os.system('pip install torchbnn')

import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import torchbnn as bnn
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score
import urllib.request

# 1. Descarga de Datos
print("\n[1/5] Descargando base de datos histórica de Kaggle (1872-2024)...")
url = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
df = pd.read_csv(url)
df['date'] = pd.to_datetime(df['date'])

# Filtrar últimos 20 años para mayor relevancia
df = df[df['date'].dt.year >= 2004].copy()

# 2. Feature Engineering Básico (Data Preprocessing)
print("[2/5] Procesando datos y calculando características...")
# Variables objetivo: 0 = Gana Visitante, 1 = Empate, 2 = Gana Local
conditions = [
    (df['home_score'] > df['away_score']),
    (df['home_score'] == df['away_score']),
    (df['home_score'] < df['away_score'])
]
choices = [2, 1, 0]
df['result'] = np.select(conditions, choices)

# Promedios históricos móviles simples (simplificación para el modelo)
team_stats = {}
def get_stats(team):
    if team not in team_stats:
        team_stats[team] = {'goals_scored': 1.0, 'goals_conceded': 1.0, 'matches': 1}
    return team_stats[team]['goals_scored'] / team_stats[team]['matches'], team_stats[team]['goals_conceded'] / team_stats[team]['matches']

def update_stats(team, scored, conceded):
    if team not in team_stats:
        team_stats[team] = {'goals_scored': 0, 'goals_conceded': 0, 'matches': 0}
    team_stats[team]['goals_scored'] += scored
    team_stats[team]['goals_conceded'] += conceded
    team_stats[team]['matches'] += 1

home_xg, home_xga, away_xg, away_xga = [], [], [], []
for index, row in df.iterrows():
    h_xg, h_xga = get_stats(row['home_team'])
    a_xg, a_xga = get_stats(row['away_team'])
    home_xg.append(h_xg)
    home_xga.append(h_xga)
    away_xg.append(a_xg)
    away_xga.append(a_xga)
    
    update_stats(row['home_team'], row['home_score'], row['away_score'])
    update_stats(row['away_team'], row['away_score'], row['home_score'])

df['home_xg'] = home_xg
df['home_xga'] = home_xga
df['away_xg'] = away_xg
df['away_xga'] = away_xga

# Seleccionar características
X = df[['home_xg', 'home_xga', 'away_xg', 'away_xga']].values
y = df['result'].values

# Escalar
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# In-Sample vs Out-of-Sample (Entrenamiento 80%, Prueba 20%)
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, shuffle=False)
X_train_t = torch.tensor(X_train, dtype=torch.float32)
y_train_t = torch.tensor(y_train, dtype=torch.long)
X_test_t = torch.tensor(X_test, dtype=torch.float32)
y_test_t = torch.tensor(y_test, dtype=torch.long)

# 3. Definición del Variational Neural Network Ensemble
print("[3/5] Construyendo Ensemble de Redes Neuronales Bayesianas (VNN)...")
class VNN(nn.Module):
    def __init__(self):
        super(VNN, self).__init__()
        # Capas Bayesianas: Inyectan incertidumbre probabilística en los pesos
        self.fc1 = bnn.BayesLinear(prior_mu=0, prior_sigma=0.1, in_features=4, out_features=16)
        self.relu = nn.ReLU()
        self.fc2 = bnn.BayesLinear(prior_mu=0, prior_sigma=0.1, in_features=16, out_features=3)
        
    def forward(self, x):
        x = self.relu(self.fc1(x))
        return self.fc2(x)

# Ensemble de 3 modelos VNN
ensemble_size = 3
models = [VNN() for _ in range(ensemble_size)]
optimizers = [optim.Adam(m.parameters(), lr=0.01) for m in models]
ce_loss = nn.CrossEntropyLoss()
kl_loss = bnn.BKLLoss(reduction='mean', last_layer_only=False)
kl_weight = 0.01

# 4. Entrenamiento
print("[4/5] Entrenando el modelo (In-Sample)... Esto tomará unos segundos.")
epochs = 300
for i in range(ensemble_size):
    for epoch in range(epochs):
        models[i].train()
        optimizers[i].zero_grad()
        
        predictions = models[i](X_train_t)
        cross_entropy = ce_loss(predictions, y_train_t)
        kl = kl_loss(models[i])
        
        cost = cross_entropy + kl_weight * kl
        cost.backward()
        optimizers[i].step()

# 5. Evaluación
print("[5/5] Realizando Tests de Precisión y calculando capacidad de acierto...\n")

def get_ensemble_predictions(X_tensor):
    # Muestreo probabilístico múltiple (Monte Carlo Dropout / Bayesiano)
    # Hacemos 10 predicciones por cada modelo en el ensamble para capturar la distribución
    all_preds = []
    for m in models:
        m.eval()
        for _ in range(10):
            with torch.no_grad():
                out = m(X_tensor)
                all_preds.append(torch.softmax(out, dim=1).numpy())
    
    # Promediar todas las predicciones probabilísticas
    avg_probs = np.mean(all_preds, axis=0)
    return np.argmax(avg_probs, axis=1)

# Test In-Sample (Datos vistos)
y_pred_train = get_ensemble_predictions(X_train_t)
acc_train = accuracy_score(y_train, y_pred_train)

# Test Out-of-Sample (Datos NO vistos - Prediciendo el futuro)
y_pred_test = get_ensemble_predictions(X_test_t)
acc_test = accuracy_score(y_test, y_pred_test)

print("="*50)
print("📊 RESULTADOS DEL VARIATIONAL NEURAL NETWORK ENSEMBLE")
print("="*50)
print(f"🎯 Precisión IN-SAMPLE (Datos Vistos):     {acc_train*100:.2f}%")
print(f"🔮 Precisión OUT-OF-SAMPLE (Datos Futuros): {acc_test*100:.2f}%")
print("="*50)
print("NOTA: En el fútbol, las casas de apuestas más potentes del mundo alcanzan alrededor del 53-55% de precisión Out-Of-Sample para mercados 1X2.")
