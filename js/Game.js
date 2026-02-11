import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { Island } from './Island.js';
import { Interactions } from './Interactions.js';
import { GameLogic } from './GameLogic.js';

export class Game {
    constructor() {
        this.sceneManager = null;
        this.island = null;
        this.interactions = null;
        this.gameLogic = null;
        this.clock = new THREE.Clock();
    }

    async init() {
        // 1. Scene setup
        this.sceneManager = new SceneManager();
        await this.sceneManager.init();

        // 2. Game world
        this.island = new Island();
        this.island.create();
        this.sceneManager.scene.add(this.island.pivotGroup);

        // 3. Interactions
        this.interactions = new Interactions(this.sceneManager, this.island);
        this.interactions.init();

        // 4. Game Rules
        this.gameLogic = new GameLogic(this.island, this.interactions);
        this.gameLogic.init();

        // Hide loading screen
        document.getElementById('loading').style.display = 'none';

        // Start Loop
        this.sceneManager.renderer.setAnimationLoop(this.update.bind(this));
        console.log('VR Island Defense Game initialized!');
    }

    update() {
        const delta = this.clock.getDelta();
        
        // Update all modules
        this.interactions.update(delta);
        this.gameLogic.update(delta);
        this.island.update(delta);
        
        // Render
        this.sceneManager.render();
    }
}