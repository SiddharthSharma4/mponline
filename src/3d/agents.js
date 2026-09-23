import * as THREE from 'three';
import { gsap } from 'gsap';

export class AgentSystem3D {
  constructor(scene) {
    this.scene = scene;
    this.agents = {};
    this.activeAgentName = null;
    
    // Group for all agents
    this.group = new THREE.Group();
    this.scene.add(this.group);
    
    this.initAgents();
  }
  
  initAgents() {
    const agentConfigs = [
      { name: 'Registrar', color: 0xffbf00, geometry: new THREE.OctahedronGeometry(0.5) }, // Amber/Gold
      { name: 'Assessor', color: 0xff6600, geometry: new THREE.TetrahedronGeometry(0.5) }, // Orange
      { name: 'Proctor', color: 0x00cc44, geometry: new THREE.BoxGeometry(0.7, 0.7, 0.7) }, // Green
      { name: 'Auditor', color: 0xdc143c, geometry: new THREE.DodecahedronGeometry(0.5) }, // Crimson
      { name: 'Archivist', color: 0x0066cc, geometry: new THREE.SphereGeometry(0.4, 32, 32) } // Blue
    ];
    
    const spacing = 1.8;
    const startX = -((agentConfigs.length - 1) * spacing) / 2;
    
    agentConfigs.forEach((config, index) => {
      const agentGroup = new THREE.Group();
      
      // Inner solid mesh
      const solidMaterial = new THREE.MeshPhysicalMaterial({
        color: config.color,
        metalness: 0.3,
        roughness: 0.2,
        transparent: true,
        opacity: 0.9,
        transmission: 0.5,
        clearcoat: 1.0,
      });
      const solidMesh = new THREE.Mesh(config.geometry, solidMaterial);
      agentGroup.add(solidMesh);
      
      // Outer wireframe
      const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: config.color,
        wireframe: true,
        transparent: true,
        opacity: 0.3
      });
      const outerMesh = new THREE.Mesh(config.geometry, wireframeMaterial);
      outerMesh.scale.set(1.3, 1.3, 1.3);
      agentGroup.add(outerMesh);
      
      // Add a ring if Archivist
      if (config.name === 'Archivist') {
        const ringGeo = new THREE.RingGeometry(0.7, 0.8, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: config.color, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        agentGroup.add(ring);
        agentGroup.userData.ring = ring;
      }
      
      // Beam mesh (initially invisible)
      const beamGeometry = new THREE.CylinderGeometry(0.05, 0.4, 5, 16);
      const beamMaterial = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      // Move pivot to top
      beamGeometry.translate(0, -2.5, 0);
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      agentGroup.add(beam);
      
      // Point light
      const light = new THREE.PointLight(config.color, 0, 8);
      agentGroup.add(light);
      
      // Base positions
      const baseX = startX + index * spacing;
      const baseY = 3;
      const baseZ = -3;
      
      agentGroup.position.set(baseX, baseY, baseZ);
      
      // Store references for animation
      agentGroup.userData = {
        baseX, baseY, baseZ,
        inner: solidMesh,
        outer: outerMesh,
        beam: beam,
        light: light,
        timeOffset: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5
      };
      
      this.agents[config.name] = agentGroup;
      this.group.add(agentGroup);
    });
  }
  
  activateAgent(name) {
    if (this.activeAgentName === name) return;
    
    this.deactivateAll();
    
    const agent = this.agents[name];
    if (agent) {
      this.activeAgentName = name;
      
      // Move to prominent position
      gsap.to(agent.position, {
        x: 0,
        y: 2.5,
        z: 0,
        duration: 1.5,
        ease: "power2.out"
      });
      
      // Scale up slightly
      gsap.to(agent.scale, {
        x: 1.5,
        y: 1.5,
        z: 1.5,
        duration: 1.5,
        ease: "back.out(1.2)"
      });
      
      // Activate beam and light
      gsap.to(agent.userData.beam.material, {
        opacity: 0.5,
        duration: 1,
        delay: 0.5
      });
      
      gsap.to(agent.userData.light, {
        intensity: 2,
        duration: 1,
        delay: 0.5
      });
    }
  }
  
  deactivateAll() {
    this.activeAgentName = null;
    
    Object.values(this.agents).forEach(agent => {
      // Return to base position
      gsap.to(agent.position, {
        x: agent.userData.baseX,
        y: agent.userData.baseY,
        z: agent.userData.baseZ,
        duration: 1.5,
        ease: "power2.inOut"
      });
      
      // Reset scale
      gsap.to(agent.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 1.5,
        ease: "power2.inOut"
      });
      
      // Deactivate beam and light
      gsap.to(agent.userData.beam.material, {
        opacity: 0,
        duration: 0.5
      });
      
      gsap.to(agent.userData.light, {
        intensity: 0,
        duration: 0.5
      });
    });
  }
  
  update(delta) {
    // A simple internal clock to drive continuous idle animations
    if (!this.clockTime) this.clockTime = 0;
    this.clockTime += delta;
    
    Object.values(this.agents).forEach(agent => {
      const data = agent.userData;
      const t = this.clockTime * data.speed + data.timeOffset;
      
      // Hover effect applied to inner/outer meshes to not conflict with GSAP position tweens
      const hoverOffset = Math.sin(t * 2) * 0.1;
      data.inner.position.y = hoverOffset;
      data.outer.position.y = hoverOffset;
      
      // Rotation
      data.inner.rotation.x += delta * 0.5;
      data.inner.rotation.y += delta * 0.8;
      
      data.outer.rotation.x -= delta * 0.3;
      data.outer.rotation.y -= delta * 0.5;
      
      if (data.ring) {
        data.ring.position.y = hoverOffset;
        data.ring.rotation.z += delta * 0.5;
      }
    });
  }
}
