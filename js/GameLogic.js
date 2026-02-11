import * as THREE from 'three';

export class GameLogic {
    constructor(island, interactions) {
        this.island = island;
        this.interactions = interactions;
        this.gameState = 'waiting';
        this.score = 0;
        this.currentWave = 0;
        this.monstersPerWave = 3;
        this.waveIncrement = 2;
        this.monstersRemaining = 0;
        this.monstersSpawned = 0;
        this.waveDelay = 5;
        this.spawnInterval = 1.5;
        this.timeSinceLastSpawn = 0;
        this.timeSinceWaveEnd = 0;
        this.strongMonsterChance = 0.2;
        
        // UI Elemente
        this.uiTexture = null;
        this.uiMesh = null;
        this.canvas = null;
        this.ctx = null;
    }

    init() {
        this.createVRUI(); // Erstellt das 3D Scoreboard
        this.interactions.onMonsterHit = (m) => this.onMonsterKilled(m);
        this.startGame();
    }

    createVRUI() {
        // 1. Canvas setup (bleibt gleich)
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1024;
        this.canvas.height = 512;
        this.ctx = this.canvas.getContext('2d');
        this.uiTexture = new THREE.CanvasTexture(this.canvas);
        
        // 2. Mesh erstellen
        const geometry = new THREE.PlaneGeometry(8, 4);
        const material = new THREE.MeshBasicMaterial({ 
            map: this.uiTexture, 
            transparent: true, 
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthTest: false // Immer im Vordergrund
        });
        
        this.uiMesh = new THREE.Mesh(geometry, material);
        
        // ÄNDERUNG: Zurück zur Insel-Gruppe!
        // Damit bewegt sich das UI im Raum mit der Insel mit.
        this.island.islandGroup.add(this.uiMesh);

        // Position: Schön hoch über dem Dorf (Y=5)
        this.uiMesh.position.set(0, 10, 0);
        
        // Skalierung: Wieder größer (0.5), da es weiter weg ist
        this.uiMesh.scale.set(0.5, 0.5, 0.5);
        
        // WICHTIG: Frustum Culling aus, damit es nicht verschwindet
        this.uiMesh.frustumCulled = false; 
        this.uiMesh.renderOrder = 999;

        this.updateVRUI("Loading...");
    }

    updateVRUI(mainText = null) {
        if (!this.ctx) return;

        // Hintergrund leeren (transparent)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Hintergrund-Box malen (halbtransparent schwarz)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.roundRect(50, 50, 924, 412, 50);
        this.ctx.fill();

        // Texteinstellungen
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Score & Wave (Oben)
        this.ctx.font = 'bold 60px Arial';
        this.ctx.fillStyle = '#64c8ff';
        this.ctx.fillText(`Wave: ${this.currentWave}   |   Monsters: ${this.monstersRemaining}`, 512, 120);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(`Score: ${this.score}`, 512, 200);

        // Große Nachricht (Mitte/Unten) - z.B. "Game Over"
        if (mainText) {
            this.ctx.font = 'bold 100px Arial';
            this.ctx.fillStyle = '#ffaa44';
            this.ctx.fillText(mainText, 512, 350);
        }

        // WICHTIG: Three.js sagen, dass sich die Textur geändert hat!
        this.uiTexture.needsUpdate = true;
    }

    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.currentWave = 0;
        this.island.reset();
        
        this.updateVRUI("Defend the Village!");
        setTimeout(() => this.startNextWave(), 3000);
    }

    startNextWave() {
        this.currentWave++;
        this.monstersPerWave = 3 + (this.currentWave - 1) * this.waveIncrement;
        this.monstersRemaining = this.monstersPerWave;
        this.monstersSpawned = 0;
        this.timeSinceLastSpawn = this.spawnInterval;
        this.strongMonsterChance = Math.min(0.5, 0.2 + this.currentWave * 0.05);
        this.spawnInterval = Math.max(0.5, 1.5 - this.currentWave * 0.1);
        
        this.updateVRUI(`⚔️ Wave ${this.currentWave}!`);
        
        // Nach 2 Sekunden Text wegnehmen
        setTimeout(() => this.updateVRUI(), 2000);
    }

    update(delta) {
        // UI Rotation (Billboarding)
        // Wir greifen über interactions.sceneManager auf die Kamera zu
        if (this.uiMesh && this.interactions.sceneManager.camera) {
            this.uiMesh.lookAt(this.interactions.sceneManager.camera.position);
        }

        // Restlicher Update Code (bleibt gleich)
        if (this.gameState !== 'playing') return;
        this.updateSpawning(delta);
        this.updateMonsters(delta);
        this.checkWaveEnd(delta);
    }

    updateSpawning(delta) {
        if (this.monstersSpawned >= this.monstersPerWave) return;
        this.timeSinceLastSpawn += delta;
        if (this.timeSinceLastSpawn >= this.spawnInterval) {
            this.timeSinceLastSpawn = 0;
            this.island.spawnMonster(Math.random() < this.strongMonsterChance ? 'strong' : 'basic');
            this.monstersSpawned++;
        }
    }

    updateMonsters(delta) {
        this.island.monsters.forEach(m => {
            if (!m.userData.isActive || m.userData.isGrabbed) return;
            if (m.position.length() < 2) this.onMonsterReachedVillage(m);
        });
    }

    onMonsterReachedVillage(monster) {
        const isGameOver = this.island.damageVillage(monster.userData.damage || 10);
        this.island.removeMonster(monster);
        this.monstersRemaining--;
        if (isGameOver) this.gameOver();
        else this.updateVRUI(); // Update Score/Monsters count
    }

    onMonsterKilled(monster) {
        const points = monster.userData.type === 'strong' ? 100 : 50;
        this.score += points;
        this.monstersRemaining--;
        this.updateVRUI(); // Update Score
    }

    checkWaveEnd(delta) {
        if (this.monstersSpawned >= this.monstersPerWave && this.island.monsters.length === 0) {
            this.timeSinceWaveEnd += delta;
            if (this.timeSinceWaveEnd >= this.waveDelay) {
                this.timeSinceWaveEnd = 0;
                this.startNextWave();
            } else if (this.timeSinceWaveEnd < 0.1) {
                const bonus = this.currentWave * 50;
                this.score += bonus;
                this.updateVRUI(`✓ Wave Complete! +${bonus}`);
            }
        }
    }

    gameOver() {
        this.gameState = 'gameover';
        this.updateVRUI("GAME OVER");
        
        setTimeout(() => {
            this.updateVRUI("🔄 Restarting...");
            setTimeout(() => this.startGame(), 2000);
        }, 5000);
    }
}