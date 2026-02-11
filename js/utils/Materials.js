import * as THREE from 'three';

export function createLowPolyMaterial(color, options = {}) {
    return new THREE.MeshStandardMaterial({
        color: color,
        flatShading: true,
        roughness: options.roughness || 0.8,
        metalness: options.metalness || 0.1,
        ...options
    });
}