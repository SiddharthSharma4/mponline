import gsap from 'gsap';
import * as THREE from 'three';
import { Booklet3D } from './booklet.js';
import { EvaluationLens3D } from './lens.js';
import { AgentSystem3D } from './agents.js';
// Import terrain and integrity later when they are ready
// import { AnomalyTerrain3D } from './terrain.js';
// import { IntegrityChain3D } from './integrity.js';

export class SceneController {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.camera = engine.camera;
    
    // Initialize components
    this.booklet = new Booklet3D(this.scene, window.EvalOS.state.data);
    this.lens = new EvaluationLens3D(this.scene);
    this.agents = new AgentSystem3D(this.scene);
    
    // Stage configurations (Camera pos, rotation, active objects)
    this.stageConfigs = {
      1: { // Upload & Configure
        camPos: new THREE.Vector3(0, 15, 20),
        camLookAt: new THREE.Vector3(0, 0, 0),
        agent: 'Registrar',
        setup: () => {
          this.booklet.openToPage(0);
          this.lens.deactivate();
        }
      },
      2: { // AI Prepare
        camPos: new THREE.Vector3(-5, 12, 10),
        camLookAt: new THREE.Vector3(0, 0, 0),
        agent: 'Registrar',
        setup: () => {
          this.booklet.openToPage(0);
          // Lens activates during this stage
          setTimeout(() => this.lens.activate(new THREE.Vector3(-2, 0.5, 0), [new THREE.Vector3(2, 0.5, 2)]), 1000);
        }
      },
      3: { // AI Categorise
        camPos: new THREE.Vector3(0, 18, 5),
        camLookAt: new THREE.Vector3(0, 0, 0),
        agent: 'Assessor',
        setup: () => {
          this.booklet.openToPage(0);
          this.lens.deactivate();
        }
      },
      4: { // Human Check
        camPos: new THREE.Vector3(-4, 8, 2), // Left-aligned to make room for right panel
        camLookAt: new THREE.Vector3(-2, 0, 0),
        agent: null, // Human active
        setup: () => {
          this.booklet.openToPage(5); // Open to Q4/Q5
          this.lens.deactivate();
        }
      },
      5: { // Submit Checked Copy
        camPos: new THREE.Vector3(0, 10, 15),
        camLookAt: new THREE.Vector3(0, 0, 0),
        agent: null,
        setup: () => {
          this.booklet.openToPage(0);
        }
      },
      6: { // AI Post-Verify
        camPos: new THREE.Vector3(0, 12, 8),
        camLookAt: new THREE.Vector3(0, 0, 0),
        agent: 'Proctor',
        setup: () => {
          this.booklet.openToPage(5); // Unchecked Q6
        }
      },
      7: { // Moderation
        camPos: new THREE.Vector3(-3, 8, 4),
        camLookAt: new THREE.Vector3(-1, 0, 0),
        agent: 'Auditor',
        setup: () => {
          this.booklet.openToPage(3); // Q4 discrepancy
        }
      },
      8: { // Result Ready
        camPos: new THREE.Vector3(0, 15, 10),
        camLookAt: new THREE.Vector3(0, 0, 0),
        agent: 'Proctor',
        setup: () => {
          this.booklet.openToPage(0);
        }
      },
      9: { // Analytics & Learning
        camPos: new THREE.Vector3(0, 25, 20),
        camLookAt: new THREE.Vector3(0, 0, 0),
        agent: 'Archivist',
        setup: () => {
          this.booklet.openToPage(0);
          // Activate terrain here later
        }
      }
    };

    // Attach to engine render loop
    if (!this.engine.updatables) this.engine.updatables = [];
    this.engine.updatables.push(this.agents);
    this.engine.updatables.push(this.lens);
  }

  transitionToStage(stageNum) {
    const config = this.stageConfigs[stageNum];
    if (!config) return;

    // Animate Camera
    const dummyTarget = this.engine.controls && this.engine.controls.target ? { ...this.engine.controls.target } : { x: 0, y: 0, z: 0 };
    
    gsap.to(this.camera.position, {
      x: config.camPos.x,
      y: config.camPos.y,
      z: config.camPos.z,
      duration: 1.5,
      ease: "power3.inOut"
    });

    gsap.to(dummyTarget, {
      x: config.camLookAt.x,
      y: config.camLookAt.y,
      z: config.camLookAt.z,
      duration: 1.5,
      ease: "power3.inOut",
      onUpdate: () => {
        this.camera.lookAt(dummyTarget.x, dummyTarget.y, dummyTarget.z);
        if (this.engine.controls && this.engine.controls.target) {
            this.engine.controls.target.copy(dummyTarget);
        }
      }
    });

    // Agents
    if (config.agent) {
      this.agents.activateAgent(config.agent);
    } else {
      this.agents.deactivateAll();
    }

    // Specific Setup
    if (config.setup) {
      config.setup();
    }
  }
}
