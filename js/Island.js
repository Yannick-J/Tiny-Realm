import * as THREE from 'three';
import { createLowPolyMaterial } from './utils/Materials.js';

export class Island {
    constructor() {
        this.islandGroup = new THREE.Group();
        this.pivotGroup = null;
        this.islandGroup.name = 'island';
        this.villageHP = 100;
        this.maxVillageHP = 100;
        this.grabbableObjects = [];
        this.trees = [];
        this.rocks = [];
        this.monsters = [];
        this.monsterSpawnPoints = [];
        this.buildings = [];
        this.particleSystems = [];
        this.hpBarGroup = null;
    }

    create() {
        // 1. Alles erstellen (Reihenfolge ist wichtig!)
        this.createIslandBase();
        this.createVillage();
        this.createTrees();
        this.createRocks();
        this.createSpawnPoints();
        this.createDecorations(); // <-- Das hattest du noch, der Rest fehlte vermutlich

        // 2. Pivot-Gruppe erstellen (Der "Ständer")
        this.pivotGroup = new THREE.Group();
        
        // 3. Ständer positionieren und neigen
        // Position: Weiter weg (-5) und etwas tiefer (-2) für gute Übersicht
        // Rotation: 25 Grad Neigung zu dir hin
        this.pivotGroup.position.set(0, -7.0, -13.0);
        this.pivotGroup.rotation.x = THREE.MathUtils.degToRad(25);

        // 4. Die Insel in den Ständer packen
        this.pivotGroup.add(this.islandGroup);

        // 5. Insel lokal nullen (damit sie mittig auf dem Ständer sitzt)
        this.islandGroup.position.set(0, 0, 0);
        this.islandGroup.rotation.set(0, 0, 0); 
    }

    createIslandBase() {
        // Main island
        const island = new THREE.Mesh(
            new THREE.CylinderGeometry(8, 6, 2, 6, 1),
            createLowPolyMaterial(0x4a7c4e)
        );
        island.receiveShadow = true;
        this.islandGroup.add(island);

        // Underside
        const under = new THREE.Mesh(new THREE.ConeGeometry(6, 4, 6), createLowPolyMaterial(0x5d4037));
        under.rotation.x = Math.PI;
        under.position.y = -3;
        this.islandGroup.add(under);

        // Grass surface
        const grass = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 7.8, 0.1, 6), createLowPolyMaterial(0x6ab04c));
        grass.position.y = 1.05;
        grass.receiveShadow = true;
        this.islandGroup.add(grass);

        // Paths
        const pathMaterial = createLowPolyMaterial(0xc4a76c);
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const path = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 5), pathMaterial);
            path.position.set(Math.cos(angle) * 3.5, 1.1, Math.sin(angle) * 3.5);
            path.rotation.y = angle + Math.PI / 2;
            this.islandGroup.add(path);
        }
    }

    createBuilding(x, z, size, height, roofColor) {
        const building = new THREE.Group();
        
        const base = new THREE.Mesh(new THREE.BoxGeometry(size, height, size), createLowPolyMaterial(0xf5f5f5));
        base.position.y = height / 2;
        base.castShadow = true;
        building.add(base);

        const roof = new THREE.Mesh(new THREE.ConeGeometry(size * 0.8, height * 0.6, 4), createLowPolyMaterial(roofColor));
        roof.position.y = height + height * 0.3;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        building.add(roof);

        const door = new THREE.Mesh(new THREE.BoxGeometry(size * 0.3, height * 0.4, 0.1), createLowPolyMaterial(0x8b4513));
        door.position.set(0, height * 0.2, size / 2 + 0.05);
        building.add(door);

        building.position.set(x, 0, z);
        return building;
    }

    createVillage() {
        const village = new THREE.Group();
        village.name = 'village';

        // Main building
        this.buildings.push(village.add(this.createBuilding(0, 0, 1.5, 3, 0xdaa520)) && village.children[0]);

        // Houses
        [{ x: 2, z: 1.5 }, { x: -2, z: 1.5 }, { x: 2, z: -1.5 }, { x: -2, z: -1.5 }, { x: 0, z: 2.5 }, { x: 0, z: -2.5 }]
            .forEach(pos => {
                const house = this.createBuilding(pos.x, pos.z, 0.8, 1.2, 0xe0e0e0);
                village.add(house);
                this.buildings.push(house);
            });

        // HP Bar
        this.hpBarGroup = new THREE.Group();
        const bg = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 0.1), new THREE.MeshBasicMaterial({ color: 0x333333 }));
        this.hpBarGroup.add(bg);
        
        const hpFill = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.25, 0.12), new THREE.MeshBasicMaterial({ color: 0x44ff44 }));
        hpFill.name = 'hpFill';
        hpFill.position.z = 0.01;
        this.hpBarGroup.add(hpFill);
        this.hpBarGroup.position.set(0, 5, 0);
        village.add(this.hpBarGroup);

        village.position.y = 1;
        this.islandGroup.add(village);
    }

    createTree() {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1, 5), createLowPolyMaterial(0x8b4513));
        trunk.position.y = 0.5;
        trunk.castShadow = true;
        tree.add(trunk);

        const colors = [0x228b22, 0x2e8b57, 0x32cd32];
        [{ r: 0.8, h: 1, y: 1.5 }, { r: 0.6, h: 0.8, y: 2.3 }, { r: 0.4, h: 0.6, y: 2.9 }].forEach((s, i) => {
            const crown = new THREE.Mesh(new THREE.ConeGeometry(s.r, s.h, 6), createLowPolyMaterial(colors[i]));
            crown.position.y = s.y;
            crown.castShadow = true;
            tree.add(crown);
        });
        return tree;
    }

    createTrees() {
        [{ x: 5, z: 3 }, { x: -5, z: 3 }, { x: 5, z: -3 }, { x: -5, z: -3 },
         { x: 4, z: 5 }, { x: -4, z: 5 }, { x: 4, z: -5 }, { x: -4, z: -5 },
         { x: 6, z: 0 }, { x: -6, z: 0 }, { x: 0, z: 6 }, { x: 0, z: -6 }]
        .forEach((pos, i) => {
            const tree = this.createTree();
            tree.position.set(pos.x, 1, pos.z);
            tree.name = `tree-${i}`;
            
            // UPDATE: Original Rotation speichern
            tree.userData = { 
                type: 'tree', 
                grabbable: true, 
                damage: 30, 
                originalPosition: tree.position.clone(),
                originalRotation: tree.rotation.clone(),
                originalScale: tree.scale.clone()
            };
            
            this.islandGroup.add(tree);
            this.trees.push(tree);
            this.grabbableObjects.push(tree);
        });
    }

    createRocks() {
        [{ x: 3, z: 4 }, { x: -3, z: 4 }, { x: 3, z: -4 }, { x: -3, z: -4 },
         { x: 5.5, z: 1 }, { x: -5.5, z: 1 }, { x: 5.5, z: -1 }, { x: -5.5, z: -1 }]
        .forEach((pos, i) => {
            const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), createLowPolyMaterial(0x808080));
            const scale = 0.8 + Math.random() * 0.6;
            rock.scale.set(scale, scale * 0.8, scale);
            
            // Zufällige Rotation beim Start
            rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            rock.position.set(pos.x, 1, pos.z);
            rock.name = `rock-${i}`;
            
            // UPDATE: Original Rotation (die zufällige von oben) speichern
            rock.userData = { 
                type: 'rock', 
                grabbable: true, 
                damage: 50, 
                originalPosition: rock.position.clone(),
                originalRotation: rock.rotation.clone(),
                originalScale: rock.scale.clone()
            };
            
            rock.castShadow = true;
            this.islandGroup.add(rock);
            this.rocks.push(rock);
            this.grabbableObjects.push(rock);
        });
    }

    createSpawnPoints() {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            this.monsterSpawnPoints.push({ x: Math.cos(angle) * 6.5, z: Math.sin(angle) * 6.5, angle });
        }
    }

    createDecorations() {
        const fenceMat = createLowPolyMaterial(0x8b4513);
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const fenceGroup = new THREE.Group();
            for (let j = 0; j < 5; j++) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), fenceMat);
                post.position.set(j * 0.3 - 0.6, 0.3, 0);
                fenceGroup.add(post);
            }
            const rail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.08), fenceMat);
            rail.position.y = 0.4;
            fenceGroup.add(rail);
            fenceGroup.position.set(Math.cos(angle) * 4, 1, Math.sin(angle) * 4);
            fenceGroup.rotation.y = angle;
            this.islandGroup.add(fenceGroup);
        }

        const bushMat = createLowPolyMaterial(0x228b22);
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), bushMat);
            bush.position.set(Math.cos(angle) * (3 + Math.random() * 3), 1.1, Math.sin(angle) * (3 + Math.random() * 3));
            bush.scale.set(1, 0.7, 1);
            this.islandGroup.add(bush);
        }
    }

    spawnMonster(type = 'basic') {
        const sp = this.monsterSpawnPoints[Math.floor(Math.random() * this.monsterSpawnPoints.length)];
        const monster = new THREE.Group();
        monster.name = `monster-${this.monsters.length}`;

        const isStrong = type !== 'basic';
        const color = isStrong ? 0x88304e : 0x6b5b95;
        const size = isStrong ? 0.6 : 0.4;

        const body = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 4), createLowPolyMaterial(color, { roughness: 0.3 }));
        body.scale.set(1, 0.8, 1);
        body.castShadow = true;
        monster.add(body);

        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        [-1, 1].forEach(side => {
            monster.add(new THREE.Mesh(new THREE.SphereGeometry(size * 0.2, 4, 4), eyeMat).translateX(side * size * 0.4).translateY(size * 0.2).translateZ(size * 0.6));
            monster.add(new THREE.Mesh(new THREE.SphereGeometry(size * 0.1, 4, 4), pupilMat).translateX(side * size * 0.4).translateY(size * 0.2).translateZ(size * 0.8));
        });

        monster.position.set(sp.x, 1, sp.z);
        monster.userData = {
            targetPosition: new THREE.Vector3(0, 1, 0),
            type: 'monster',
            grabbable: true,
            health: isStrong ? 2 : 1,
            damage: isStrong ? 20 : 10,
            speed: isStrong ? 0.3 : 0.5,
            isActive: true,
            originalScale: monster.scale.clone()
        };

        this.islandGroup.add(monster);
        this.monsters.push(monster);
        this.grabbableObjects.push(monster);
        return monster;
    }

    removeMonster(monster) {
        this.monsters = this.monsters.filter(m => m !== monster);
        this.grabbableObjects = this.grabbableObjects.filter(o => o !== monster);
        this.islandGroup.remove(monster);
        this.createImpactEffect(monster.position);
    }

    damageVillage(amount) {
        this.villageHP = Math.max(0, this.villageHP - amount);
        this.updateHPBar();
        this.flashVillage();
        return this.villageHP <= 0;
    }

    updateHPBar() {
        const hpFill = this.hpBarGroup?.getObjectByName('hpFill');
        if (hpFill) {
            const pct = this.villageHP / this.maxVillageHP;
            hpFill.scale.x = pct;
            hpFill.position.x = -(1 - pct) * 1.45;
            hpFill.material.color.setHex(pct > 0.5 ? 0x44ff44 : pct > 0.25 ? 0xffff44 : 0xff4444);
        }
    }

    flashVillage() {
        this.buildings.forEach(b => b.traverse(c => {
            if (c.isMesh) {
                const orig = c.material.color.getHex();
                c.material.color.setHex(0xff0000);
                setTimeout(() => c.material.color.setHex(orig), 100);
            }
        }));
    }

    createImpactEffect(position) {
        const count = 20;
        const positions = new Float32Array(count * 3);
        const velocities = [];
        for (let i = 0; i < count; i++) {
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;
            velocities.push(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3));
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particles = new THREE.Points(geom, new THREE.PointsMaterial({ color: 0xffaa00, size: 0.15, transparent: true }));
        particles.userData = { velocities, lifetime: 1, age: 0 };
        this.islandGroup.add(particles);
        this.particleSystems.push(particles);
    }

    // UPDATE: Respawn Funktion korrigiert
    respawnObject(object) {
        if (object.userData.originalPosition) {
            object.position.copy(object.userData.originalPosition);
            
            // NEU: Rotation zurücksetzen, falls vorhanden
            if (object.userData.originalRotation) {
                object.rotation.copy(object.userData.originalRotation);
            } else {
                // Fallback: Rotation nullen
                object.rotation.set(0, 0, 0);
            }

            object.userData.velocity = null;
            object.userData.isThrown = false;
            this.islandGroup.add(object);
            if (!this.grabbableObjects.includes(object)) this.grabbableObjects.push(object);
        }
    }

    update(delta, camera) {
        // Move monsters
        this.monsters.forEach(m => {
            // WICHTIG: !m.userData.isThrown hinzufügen!
            // Das Monster darf sich nur selbst bewegen, wenn es NICHT gegriffen UND NICHT geworfen ist.
            if (m.userData.isActive && !m.userData.isGrabbed && !m.userData.isThrown) {
                const dir = new THREE.Vector3().subVectors(m.userData.targetPosition, m.position).normalize();
                m.position.add(dir.multiplyScalar(m.userData.speed * delta));
                
                // Diese Zeile war das Problem - sie hat die Schwerkraft überschrieben:
                m.position.y = 1 + Math.abs(Math.sin(Date.now() * 0.01)) * 0.2;
                
                m.lookAt(0, m.position.y, 0);
            }
        });

        // HP Bar billboard
        if (this.hpBarGroup && camera) {
            this.hpBarGroup.lookAt(camera.position);
        }

        // Particles
        this.particleSystems = this.particleSystems.filter(p => {
            p.userData.age += delta;
            if (p.userData.age >= p.userData.lifetime) { this.islandGroup.remove(p); return false; }
            const pos = p.geometry.attributes.position.array;
            p.userData.velocities.forEach((v, i) => {
                v.y -= 9.8 * delta;
                pos[i * 3] += v.x * delta;
                pos[i * 3 + 1] += v.y * delta;
                pos[i * 3 + 2] += v.z * delta;
            });
            p.geometry.attributes.position.needsUpdate = true;
            p.material.opacity = 1 - p.userData.age / p.userData.lifetime;
            return true;
        });
    }

    reset() {
        this.monsters.forEach(m => this.islandGroup.remove(m));
        this.monsters = [];
        this.villageHP = this.maxVillageHP;
        this.updateHPBar();
        [...this.trees, ...this.rocks].forEach(o => this.respawnObject(o));
    }
}