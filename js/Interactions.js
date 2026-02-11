import * as THREE from 'three';

export class Interactions {
    constructor(sceneManager, island) {
        this.sceneManager = sceneManager;
        this.island = island;

        this.raycaster = new THREE.Raycaster();
        this.lastHoveredObject = [null, null]; 
        
        this.thrownObjects = []; 
        
        // WICHTIG: Hier speichern wir deine "Points"-Trails
        this.particleTrails = []; 

        // Controller States
        this.controllerStates = [
            { 
                gripped: false, grabbedObject: null, 
                velocity: new THREE.Vector3(), lastPosition: new THREE.Vector3(), 
                positionHistory: [], grabOffset: new THREE.Vector3() 
            },
            { 
                gripped: false, grabbedObject: null, 
                velocity: new THREE.Vector3(), lastPosition: new THREE.Vector3(), 
                positionHistory: [], grabOffset: new THREE.Vector3() 
            }
        ];

        this.rotationState = { isRotating: false, lastVec: new THREE.Vector3(), momentum: 0, damping: 0.95 };
        this.grabLines = [];
        this.tempMatrix = new THREE.Matrix4();
        this.hoverMaterials = new Map(); 

        // Mouse Fallback (Komplett)
        this.mouseState = {
            active: false, 
            mouse: new THREE.Vector2(),
            raycaster: new THREE.Raycaster(),
            isDown: false,
            gripped: false,
            grabbedObject: null,
            dragPlane: new THREE.Plane(),
            dragOffset: new THREE.Vector3(),
            virtualHandPos: new THREE.Vector3(), 
            grabDistance: 5,
            velocity: new THREE.Vector3(),
            lastPosition: new THREE.Vector3(),
            positionHistory: []
        };
    }

    init() {
        this.sceneManager.onSelectStart = (c, i) => this.onTriggerStart(c, i);
        this.sceneManager.onSelectEnd = (c, i) => this.onTriggerEnd(c, i);
        
        this.createGrabLines();
        
        this.boundOnMouseMove = (e) => this.onMouseMove(e);
        this.boundOnKeyDown = (e) => this.onKeyDown(e);
        this.boundOnKeyUp = (e) => this.onKeyUp(e);

        window.addEventListener('mousemove', this.boundOnMouseMove);
        window.addEventListener('keydown', this.boundOnKeyDown);
        window.addEventListener('keyup', this.boundOnKeyUp);

        console.log("Interactions initialized (Original Points-Trail Restored)");
    }

    // ==========================================
    // DESKTOP INPUT
    // ==========================================

    onMouseMove(event) {
        this.mouseState.active = true;
        this.mouseState.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouseState.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    onKeyDown(event) {
        if (event.key.toLowerCase() === 'b' && !this.mouseState.gripped) {
            this.mouseState.gripped = true;
            this.tryDesktopGrab();
        }
    }

    onKeyUp(event) {
        if (event.key.toLowerCase() === 'b' && this.mouseState.gripped) {
            this.mouseState.gripped = false;
            this.releaseDesktopObject();
        }
    }

    // ==========================================
    // DESKTOP LOGIC
    // ==========================================

    updateDesktopInteraction(delta) {
        if (!this.mouseState.active) return;

        this.mouseState.raycaster.setFromCamera(this.mouseState.mouse, this.sceneManager.camera);
        const ray = this.mouseState.raycaster.ray;
        
        this.mouseState.virtualHandPos.copy(ray.origin).add(ray.direction.clone().multiplyScalar(this.mouseState.grabDistance));

        this.calculateVelocity(this.mouseState, this.mouseState.virtualHandPos, delta);

        if (this.mouseState.grabbedObject) {
            this.mouseState.grabbedObject.position.lerp(this.mouseState.virtualHandPos, 0.2);
            this.mouseState.grabbedObject.rotation.x += delta * 2;
            this.mouseState.grabbedObject.rotation.z += delta * 2;
        } else {
            this.updateDesktopHover();
        }
    }

    tryDesktopGrab() {
        const intersects = this.mouseState.raycaster.intersectObjects(this.island.grabbableObjects, true);
        
        if (intersects.length > 0) {
            let object = intersects[0].object;
            let safety = 0;
            while(object.parent && !object.userData.grabbable && safety < 50) {
                object = object.parent;
                safety++;
            }

            if (object.userData.grabbable && !object.userData.isGrabbed) {
                this.grabObjectCommon(object, this.mouseState);
                this.mouseState.grabDistance = intersects[0].distance;
            }
        }
    }

    releaseDesktopObject() {
        if (this.mouseState.grabbedObject) {
            const throwVelocity = this.mouseState.velocity.clone().multiplyScalar(1.5);
            this.releaseObjectCommon(this.mouseState, throwVelocity);
        }
    }

    updateDesktopHover() {
        const intersects = this.mouseState.raycaster.intersectObjects(this.island.grabbableObjects, true);
        let hovered = null;

        if (intersects.length > 0) {
            let obj = intersects[0].object;
            let safety = 0;
            while(obj.parent && !obj.userData.grabbable && safety < 50) {
                obj = obj.parent;
                safety++;
            }
            if (obj.userData.grabbable) hovered = obj;
        }

        this.handleHoverVisuals(hovered);
    }

    // ==========================================
    // SHARED LOGIC
    // ==========================================

    grabObjectCommon(object, state) {
        object.userData.isGrabbed = true;
        state.grabbedObject = object;

        this.island.islandGroup.remove(object);
        this.sceneManager.scene.add(object);

        if (object.userData.originalScale) {
            object.scale.copy(object.userData.originalScale).multiplyScalar(0.4);
        }

        state.positionHistory = [];
        state.velocity.set(0,0,0);
        state.lastPosition.copy(object.position); 
    }

    releaseObjectCommon(state, velocity) {
        const object = state.grabbedObject;
        if (!object) return;

        if (object.userData.originalScale) {
            object.scale.copy(object.userData.originalScale);
        }

        if (velocity.length() > 2) {
            this.throwObject(object, velocity);
        } else {
            this.island.islandGroup.add(object);
            this.island.respawnObject(object);
        }

        object.userData.isGrabbed = false;
        state.grabbedObject = null;
    }

    handleHoverVisuals(newHovered) {
        if (newHovered !== this.hoveredObject) {
            if (this.hoveredObject) this.unhighlightObject(this.hoveredObject);
            if (newHovered) this.highlightObject(newHovered);
            this.hoveredObject = newHovered;
            document.body.style.cursor = newHovered ? 'grab' : 'default';
        }
    }

    calculateVelocity(state, currentPos, delta) {
        // Aktuelle Geschwindigkeit berechnen
        const currentVel = new THREE.Vector3().subVectors(currentPos, state.lastPosition).divideScalar(delta);
        state.velocity.copy(currentVel);

        // History füllen (Jetzt mit Velocity!)
        state.positionHistory.push({ 
            position: currentPos.clone(), 
            velocity: currentVel.clone(), // WICHTIG: Geschwindigkeit merken
            delta: delta 
        });
        
        // Puffer auf 6 Frames erhöhen (ca. 100ms Gedächtnis)
        // Das reicht, um den "Flick" vor dem Stoppen zu finden
        if (state.positionHistory.length > 6) state.positionHistory.shift(); 
        
        state.lastPosition.copy(currentPos);
    }

    // ==========================================
    // VISUALS & HIGHLIGHTING
    // ==========================================

    highlightObject(object) {
        object.traverse(c => {
            if (c.isMesh && c.material) {
                if (!this.hoverMaterials.has(c)) this.hoverMaterials.set(c, c.material.color.getHex());
                c.material.color.lerp(new THREE.Color(0xffffff), 0.3);
                if (c.material.emissive) c.material.emissive.setHex(0x444444);
            }
        });
    }

    unhighlightObject(object) {
        object.traverse(c => {
            if (c.isMesh && this.hoverMaterials.has(c)) {
                c.material.color.setHex(this.hoverMaterials.get(c));
                if (c.material.emissive) c.material.emissive.setHex(0x000000);
            }
        });
    }

    // ==========================================
    // VR LOGIC
    // ==========================================
    
    createGrabLines() {
        for (let i = 0; i < 2; i++) {
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
            const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: i === 0 ? 0x4488ff : 0xff8844, transparent: true, opacity: 0 }));
            line.frustumCulled = false;
            this.sceneManager.scene.add(line);
            this.grabLines.push(line);
        }
    }

    updateRotation(delta) {
        const [c0, c1] = this.sceneManager.controllers;
        const bothGripsPressed = c0.userData.isSqueezing && c1.userData.isSqueezing;

        if (bothGripsPressed) {
            const p0 = new THREE.Vector3();
            const p1 = new THREE.Vector3();
            c0.getWorldPosition(p0);
            c1.getWorldPosition(p1);

            const currentVec = new THREE.Vector3().subVectors(p1, p0);
            currentVec.y = 0;
            currentVec.normalize();

            if (this.rotationState.isRotating) {
                const angleCurrent = Math.atan2(currentVec.z, currentVec.x);
                const angleLast = Math.atan2(this.rotationState.lastVec.z, this.rotationState.lastVec.x);
                let angleDiff = angleCurrent - angleLast;

                if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                this.island.islandGroup.rotation.y -= angleDiff; 
            } else {
                this.rotationState.isRotating = true;
            }
            this.rotationState.lastVec = currentVec;
        } else {
            this.rotationState.isRotating = false;
        }
    }

    onTriggerStart(controller, index) {
        this.controllerStates[index].gripped = true;
        const obj = this.checkGrabVR(controller);
        if (obj) {
            this.grabObjectVR(obj, index);
        }
    }

    onTriggerEnd(controller, index) {
        this.controllerStates[index].gripped = false;
        if (this.controllerStates[index].grabbedObject) this.releaseObjectVR(index);
    }

    checkGrabVR(controller) {
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

        const intersects = this.raycaster.intersectObjects(this.island.grabbableObjects, true);

        if (intersects.length > 0) {
            let obj = intersects[0].object;
            let safety = 0;
            while(obj && !obj.userData.grabbable && obj.parent && safety < 50) {
                obj = obj.parent;
                safety++;
            }
            if (obj && obj.userData.grabbable) {
                return obj;
            }
        }
        return null;
    }

    grabObjectVR(object, index) {
        const controller = this.sceneManager.controllers[index];
        const state = this.controllerStates[index];
        
        const cPos = new THREE.Vector3();
        controller.getWorldPosition(cPos);
        object.position.copy(cPos); 

        state.grabOffset = new THREE.Vector3(0, 0, 0);
        this.grabObjectCommon(object, state);

        state.lastPosition.copy(cPos);
        state.velocity.set(0, 0, 0);
        state.positionHistory = [];
        
        controller.attach(object);

        if (object.userData.originalScale) {
            object.scale.copy(object.userData.originalScale).multiplyScalar(0.4);
        }
        object.rotation.set(0, 0, 0);
        
        this.grabLines[index].material.opacity = 0;
    }

    releaseObjectVR(index) {
        const state = this.controllerStates[index];
        
        // 1. Das Objekt holen
        const object = state.grabbedObject;
        if (!object) return; // Sicherheitshalber

        // --- WICHTIGSTER FIX: HIERARCHIE ÄNDERN ---
        // Das Objekt hängt noch am Controller. Wir müssen es lösen!
        // scene.attach(object) behält die Welt-Position bei, wechselt aber den Parent zur Scene.
        this.sceneManager.scene.attach(object);
        // ------------------------------------------

        const cPos = new THREE.Vector3();
        this.sceneManager.controllers[index].getWorldPosition(cPos);
        
        this.calculateVelocity(state, cPos, 0.016);
        
        // ... (dein Velocity Code bleibt gleich) ...
        let maxSpeed = 0;
        let bestVelocity = new THREE.Vector3(0, 0, 0);

        state.positionHistory.forEach(entry => {
            const speed = entry.velocity.length();
            if (speed > maxSpeed) {
                maxSpeed = speed;
                bestVelocity = entry.velocity;
            }
        });

        if (state.positionHistory.length === 0) bestVelocity = state.velocity;

        // Wurfstärke
        const finalVelocity = bestVelocity.clone().multiplyScalar(10.0); 
        
        // Jetzt übergeben wir das (nun freie) Objekt an die Physik
        this.releaseObjectCommon(state, finalVelocity);
        
        this.grabLines[index].material.opacity = 0.5;
    }

    // ==========================================
    // PHYSICS & YOUR ORIGINAL TRAIL SYSTEM
    // ==========================================

    throwObject(object, velocity) {
        object.userData.isThrown = true;
        object.userData.velocity = velocity;
        object.userData.gravity = -15;

        // Zeitstempel für Schonfrist
        object.userData.throwTime = Date.now();
        
        // Trail starten (mit Farbe je nach Typ)
        this.createParticleTrail(object);
        
        this.thrownObjects.push(object);
    }

    createParticleTrail(object) {
        const positions = new Float32Array(30 * 3);
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Farbe anpassen: Rot für Monster, Orange für Objekte
        const color = object.userData.type === 'monster' ? 0xff0000 : 0xffaa44;

        const points = new THREE.Points(geom, new THREE.PointsMaterial({ 
            color: color, 
            size: 0.15, // Etwas größer damit man es gut sieht 
            transparent: true, 
            opacity: 0.8, 
            blending: THREE.AdditiveBlending 
        }));
        
        this.sceneManager.scene.add(points);
        this.particleTrails.push({ object, points, positions, currentIndex: 0, maxParticles: 30 });
    }

    updateParticleTrail(trail, pos) {
        const idx = trail.currentIndex * 3;
        trail.positions[idx] = pos.x;
        trail.positions[idx + 1] = pos.y;
        trail.positions[idx + 2] = pos.z;
        trail.currentIndex = (trail.currentIndex + 1) % trail.maxParticles;
        trail.points.geometry.attributes.position.needsUpdate = true;
        
        // Leichtes Flackern/Faden
        trail.points.material.opacity = Math.max(0.3, trail.points.material.opacity - 0.005);
    }

    removeParticleTrail(object) {
        const idx = this.particleTrails.findIndex(t => t.object === object);
        if (idx > -1) {
            const trail = this.particleTrails[idx];
            this.sceneManager.scene.remove(trail.points);
            
            // Sauber aufräumen um Memory Leaks zu verhindern
            trail.points.geometry.dispose();
            trail.points.material.dispose();
            
            this.particleTrails.splice(idx, 1);
        }
    }

    // ==========================================
    // UPDATE
    // ==========================================

    update(delta) {
        if (this.sceneManager.renderer.xr.isPresenting) {
            this.updateRotation(delta);
            this.updateVRHover();
            this.updateControllerTracking(delta);
            this.updateGrabbedObjectsAnimation(delta); 
        } else {
            this.updateDesktopInteraction(delta);
        }

        if (this.thrownObjects && this.thrownObjects.length > 0) {
            this.updateThrownObjects(delta);
        }

        this.updateGrabLines();
    }

    updateControllerTracking(delta) {
        this.sceneManager.controllers.forEach((controller, index) => {
            const cPos = new THREE.Vector3();
            controller.getWorldPosition(cPos);
            this.calculateVelocity(this.controllerStates[index], cPos, delta);
        });
    }

    updateVRHover() {
        let newHovered = null;
        
        this.sceneManager.controllers.forEach((controller, index) => {
            if (this.controllerStates[index].grabbedObject) return;

            const tempMatrix = new THREE.Matrix4();
            tempMatrix.extractRotation(controller.matrixWorld);
            this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
            this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

            const intersects = this.raycaster.intersectObjects(this.island.grabbableObjects, true);
            if (intersects.length > 0) {
                let obj = intersects[0].object;
                let safety = 0;
                while(obj && obj.parent && !obj.userData.grabbable && safety < 50) {
                    obj = obj.parent;
                    safety++;
                }
                if (obj && obj.userData.grabbable) newHovered = obj;
            }
        });

        this.handleHoverVisuals(newHovered);
    }

    updateGrabbedObjectsAnimation(delta) {
        this.controllerStates.forEach(state => {
            if (state.grabbedObject) {
                // Exakt wie Desktop: Rotation auf X und Z Achse
                state.grabbedObject.rotation.x += delta * 2;
                state.grabbedObject.rotation.z += delta * 2;
            }
        });
    }

    updateThrownObjects(delta) {
        this.thrownObjects = this.thrownObjects.filter(obj => {
            if (!obj.userData.isThrown) return false;
            
            // NEU: Schonfrist von 200ms (0.2 Sekunden)
            // In dieser Zeit ignorieren wir Kollisionen komplett, damit das Objekt
            // die Hand sicher verlassen kann.
            const isSafeTime = (Date.now() - obj.userData.throwTime) < 200;

            const vel = obj.userData.velocity;
            vel.y += obj.userData.gravity * delta;
            obj.position.add(vel.clone().multiplyScalar(delta));
            obj.rotation.x += delta * 5;
            obj.rotation.z += delta * 3;

            const trail = this.particleTrails.find(t => t.object === obj);
            if (trail) this.updateParticleTrail(trail, obj.position);

            // Wenn wir noch in der Schonfrist sind, überspringen wir Kollisions-Checks
            if (!isSafeTime) {
                const collision = this.checkCollisions(obj);
                if (collision) { this.handleCollision(obj, collision); return false; }
                
                // Fall-Limit (Sicherheitshalber tief genug ansetzen)
                if (obj.position.y < -20) { this.handleObjectFall(obj); return false; }
            }
            
            return true;
        });
    }

    checkCollisions(obj) {
        // 1. Monster Check (Welt-Koordinaten sind hier okay, da Monster Kugeln/Boxen sind)
        for (const m of this.island.monsters) {
            if (m === obj) continue;
            if (m.userData.isGrabbed || (this.mouseState.grabbedObject === m)) continue;
            
            const mPos = new THREE.Vector3();
            m.getWorldPosition(mPos);
            // Distanz Check (Radius ca. 1.6m)
            if (obj.position.distanceTo(mPos) < 1.6) return { type: 'monster', target: m };
        }

        // 2. Umrechnung in LOKALE Insel-Koordinaten
        // Das ist der wichtigste Fix für die schräge Insel!
        const localPos = obj.position.clone();
        this.island.islandGroup.worldToLocal(localPos);

        // Jetzt können wir prüfen, ob das Objekt "auf der Insel" ist.
        // Die Insel ist lokal flach. Der Boden ist bei y = 0 (oder knapp darunter).
        
        // Distanz zur Mitte der Insel (XZ-Ebene)
        const distToCenter = Math.sqrt(localPos.x * localPos.x + localPos.z * localPos.z);

        // Radius der Insel ist ca. 10-12. Alles darüber hinaus fliegt ins Wasser (Abgrund).
        if (distToCenter < 11) {
            
            // --- BODEN CHECK ---
            // In lokalen Koordinaten ist der Boden bei ca. y = -1 bis 0.
            // Wir prüfen: Ist es tiefer als 0.2 (etwas Toleranz)?
            if (localPos.y < 0.2) {
                return { type: 'ground' };
            }

            // --- DORF / HAUS CHECK ---
            // Das Dorf steht meistens in der Mitte bei (0, 0, 0) lokal.
            // Das Haus ist ca. 3 Meter hoch.
            if (distToCenter < 2.5 && localPos.y < 3.0 && localPos.y > 0) {
                return { type: 'ground' }; // Wir werten das Haus auch als "Boden"-Aufprall
            }
        }

        // Wenn es nicht die Insel getroffen hat, fällt es weiter.
        // Kein Return hier, damit es physikalisch weiter fällt bis -20.
        return null;
    }

    handleCollision(obj, collision) {
        if (obj.parent === this.sceneManager.scene) {
            this.island.islandGroup.worldToLocal(obj.position);
        }

        if(this.island.createImpactEffect) this.island.createImpactEffect(obj.position);

        if (collision.type === 'monster') {
            const m = collision.target;
            m.userData.health -= obj.userData.damage || 1;
            if (m.userData.health <= 0) {
                this.island.removeMonster(m);
            }
        }
        
        this.handleObjectFall(obj);
    }

    handleObjectFall(obj) {
        this.sceneManager.scene.remove(obj);
        // Trail entfernen wenn Objekt despawnt
        this.removeParticleTrail(obj); 

        obj.userData.isThrown = false;
        obj.userData.velocity = null;
        
        if (obj.userData.type === 'monster') {
            this.island.removeMonster(obj); 
        } else {
            setTimeout(() => this.island.respawnObject(obj), 3000);
        }
    }

    updateGrabLines() {
        this.sceneManager.controllers.forEach((controller, index) => {
            const state = this.controllerStates[index];
            const line = this.grabLines[index];
            if (state.grabbedObject && line.material.opacity > 0) {
                const cPos = new THREE.Vector3();
                controller.getWorldPosition(cPos);
                const oPos = state.grabbedObject.position;
                const pos = line.geometry.attributes.position.array;
                pos[0] = cPos.x; pos[1] = cPos.y; pos[2] = cPos.z;
                pos[3] = oPos.x; pos[4] = oPos.y; pos[5] = oPos.z;
                line.geometry.attributes.position.needsUpdate = true;
            }
        });
    } 

    dispose() {
        this.grabLines.forEach(line => this.sceneManager.scene.remove(line));
        this.particleTrails.forEach(trail => {
            this.sceneManager.scene.remove(trail.points);
            trail.points.geometry.dispose();
            trail.points.material.dispose();
        });
        window.removeEventListener('mousemove', this.boundOnMouseMove);
        window.removeEventListener('keydown', this.boundOnKeyDown);
        window.removeEventListener('keyup', this.boundOnKeyUp);
    }
}