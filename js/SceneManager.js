import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controllers = [];
        this.controllerGrips = [];
        this.orbitControls = null;
        
        // Callbacks (werden von Interactions.js gesetzt)
        this.onSqueezeStart = null;
        this.onSqueezeEnd = null;
    }

    async init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createLighting();
        this.createSkybox();
        this.setupVR();
        this.setupDesktopControls();
        this.setupEventListeners();
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.012);
    }

    createCamera() {
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 12, 15);
        this.camera.lookAt(0, 0, 0);
        this.scene.add(this.camera);
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
    }

    createLighting() {
        this.scene.add(new THREE.AmbientLight(0x404080, 0.6));

        const sunLight = new THREE.DirectionalLight(0xffeedd, 1.5);
        sunLight.position.set(10, 20, 10);
        sunLight.castShadow = true;
        
        // Schattenbereich
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 50;
        sunLight.shadow.camera.left = -20;
        sunLight.shadow.camera.right = 20;
        sunLight.shadow.camera.top = 20;
        sunLight.shadow.camera.bottom = -20;
        
        this.scene.add(sunLight);
        this.scene.add(new THREE.DirectionalLight(0x8888ff, 0.4).translateX(-10).translateY(5).translateZ(-10));
        
        const villageLight = new THREE.PointLight(0xffaa55, 0.8, 15);
        villageLight.position.set(0, 3, 0);
        this.scene.add(villageLight);
    }

    createSkybox() {
        const starGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(2000 * 3);
        for (let i = 0; i < 2000 * 3; i += 3) {
            const radius = 80 + Math.random() * 120;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions[i] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = radius * Math.cos(phi);
        }
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 })));
    }

    setupVR() {
        this.renderer.xr.enabled = true;
        
        // WICHTIG: Wir definieren explizit die Features, die wir wollen.
        // Wir lassen 'layers' weg, um den Absturz zu verhindern.
        const sessionInit = { optionalFeatures: ['local-floor', 'bounded-floor'] };
        document.body.appendChild(VRButton.createButton(this.renderer, sessionInit));

        const factory = new XRControllerModelFactory();

        for (let i = 0; i < 2; i++) {
            const controller = this.renderer.xr.getController(i);
            // ... (Rest bleibt gleich)
            controller.userData = { index: i, isSelecting: false, isSqueezing: false };
            this.scene.add(controller);
            this.controllers.push(controller);

            const grip = this.renderer.xr.getControllerGrip(i);
            grip.add(factory.createControllerModel(grip));
            this.scene.add(grip);
            this.controllerGrips.push(grip);

            // Ray line
            const line = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -5)]),
                new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 })
            );
            controller.add(line);

            // Hand sphere (optional, aber gut fürs Feedback)
            controller.add(new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 8, 8),
                new THREE.MeshBasicMaterial({ color: i === 0 ? 0x4488ff : 0xff8844, transparent: true, opacity: 0.7 })
            ));
        }
    }

    setupDesktopControls() {
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.minDistance = 8;
        this.orbitControls.maxDistance = 30;
        this.orbitControls.maxPolarAngle = Math.PI / 2.2;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        this.controllers.forEach((controller, index) => {
            // FIX 3: Buttons getauscht!
            
            // GRIP (Mittelfinger) -> Nur Status setzen (für Rotation)
            controller.addEventListener('squeezestart', () => {
                controller.userData.isSqueezing = true;
            });
            controller.addEventListener('squeezeend', () => {
                controller.userData.isSqueezing = false;
            });

            // TRIGGER (Zeigefinger) -> Callbacks feuern (für Greifen)
            controller.addEventListener('selectstart', () => {
                controller.userData.isSelecting = true;
                if (this.onSelectStart) this.onSelectStart(controller, index);
            });
            controller.addEventListener('selectend', () => {
                controller.userData.isSelecting = false;
                if (this.onSelectEnd) this.onSelectEnd(controller, index);
            });
        });
    }

    render() {
        if (this.orbitControls && !this.renderer.xr.isPresenting) this.orbitControls.update();
        this.renderer.render(this.scene, this.camera);
    }
}