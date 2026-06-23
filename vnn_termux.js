const https = require('https');
const fs = require('fs');
const papa = require('papaparse');
const brain = require('brain.js');

console.log('[1/5] Descargando base de datos histórica de Kaggle...');

https.get('https://raw.githubusercontent.com/martj42/international_results/master/results.csv', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('[2/5] Procesando datos y calculando características...');
        const parsed = papa.parse(data, { header: true, skipEmptyLines: true }).data;
        
        // Filtrar datos recientes (últimos 5 años para no sobrecargar el procesador móvil)
        const recentData = parsed.filter(row => {
            if (!row.date) return false;
            const year = parseInt(row.date.substring(0, 4));
            return year >= 2019;
        });

        // Construir estadísticas históricas simples por equipo
        const teamStats = {};
        const getStats = (team) => teamStats[team] || { gs: 1, gc: 1, m: 1 };
        const updateStats = (team, scored, conceded) => {
            if (!teamStats[team]) teamStats[team] = { gs: 0, gc: 0, m: 0 };
            teamStats[team].gs += scored;
            teamStats[team].gc += conceded;
            teamStats[team].m += 1;
        };

        const dataset = [];
        
        for (const row of recentData) {
            const hs = parseInt(row.home_score);
            const as = parseInt(row.away_score);
            if (isNaN(hs) || isNaN(as)) continue;

            const hStats = getStats(row.home_team);
            const aStats = getStats(row.away_team);

            const hXg = hStats.gs / hStats.m;
            const hXga = hStats.gc / hStats.m;
            const aXg = aStats.gs / aStats.m;
            const aXga = aStats.gc / aStats.m;

            updateStats(row.home_team, hs, as);
            updateStats(row.away_team, as, hs);

            // Resultado: 0 = Visita, 0.5 = Empate, 1.0 = Local
            let result = 0.5;
            if (hs > as) result = 1.0;
            else if (hs < as) result = 0.0;

            dataset.push({
                input: { 
                    hXg: hXg / 3.0, hXga: hXga / 3.0, 
                    aXg: aXg / 3.0, aXga: aXga / 3.0 
                },
                output: { res: result }
            });
        }

        // Split 80/20
        const splitIdx = Math.floor(dataset.length * 0.8);
        const trainData = dataset.slice(0, splitIdx);
        const testData = dataset.slice(splitIdx);

        console.log(`[3/5] Construyendo Ensemble de Redes Neuronales (Brain.js) en Termux...`);
        console.log(`      Entrenamiento: ${trainData.length} partidos. Prueba: ${testData.length} partidos.`);
        
        const ensembleSize = 3;
        const models = [];
        for(let i=0; i<ensembleSize; i++) {
            models.push(new brain.NeuralNetwork({ hiddenLayers: [6] }));
        }

        console.log('[4/5] Entrenando el modelo (In-Sample)... Esto tomará unos minutos en tu móvil.');
        
        for(let i=0; i<ensembleSize; i++) {
            models[i].train(trainData, {
                iterations: 500,
                errorThresh: 0.01,
                log: i === 0,
                logPeriod: 100
            });
        }

        console.log('\n[5/5] Realizando Tests de Precisión y calculando capacidad de acierto...\n');
        
        function evaluate(dataSubset) {
            let correct = 0;
            for (const item of dataSubset) {
                // Ensemble voting
                let sum = 0;
                for (const m of models) {
                    sum += m.run(item.input).res;
                }
                const avg = sum / ensembleSize;
                
                let pred = 0.5;
                if (avg > 0.6) pred = 1.0; // Local
                else if (avg < 0.4) pred = 0.0; // Visita
                
                if (pred === item.output.res || (pred === 0.5 && item.output.res === 0.5)) {
                    correct++;
                }
            }
            return (correct / dataSubset.length) * 100;
        }

        const accTrain = evaluate(trainData);
        const accTest = evaluate(testData);

        console.log('='.repeat(50));
        console.log('📊 RESULTADOS DEL NEURAL NETWORK ENSEMBLE (JS)');
        console.log('='.repeat(50));
        console.log(`🎯 Precisión IN-SAMPLE (Datos Vistos):     ${accTrain.toFixed(2)}%`);
        console.log(`🔮 Precisión OUT-OF-SAMPLE (Datos Futuros): ${accTest.toFixed(2)}%`);
        console.log('='.repeat(50));
        console.log('NOTA: Logrado localmente usando Brain.js en Termux.');
    });
}).on('error', (e) => {
    console.error('Error descargando CSV:', e);
});
