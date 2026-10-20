import * as THREE from 'three';
import { birthdayConfig } from './config.js';

export class BirthdayScene {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101827); // Biru malam
    this.scene.fog = new THREE.FogExp2(0x101827, 0.05);

    // Camera targets & positions
    this.cameraDefaultPos = new THREE.Vector3(0, 2.6, 4.8);
    this.cameraDefaultTarget = new THREE.Vector3(0, 0.9, 0);

    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
    this.camera.position.copy(this.cameraDefaultPos);
    this.currentTarget = this.cameraDefaultTarget.clone();
    this.camera.lookAt(this.currentTarget);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    // State
    this.isCandleLit = true;
    this.isBookOpen = false;
    this.cityBeacons = [];
    this.targetParallax = new THREE.Vector2(0, 0);
    this.currentParallax = new THREE.Vector2(0, 0);
    this.startTime = performance.now();
    this.interactiveObjects = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
    this.hoveredObject = null;
    this.isTransitioningCamera = false;

    // Target positions for camera views
    this.views = {
      overview: { pos: new THREE.Vector3(0, 2.6, 4.8), target: new THREE.Vector3(0, 0.9, 0) },
      cake: { pos: new THREE.Vector3(0, 1.8, 2.1), target: new THREE.Vector3(0, 1.35, 0) },
      photo: { pos: new THREE.Vector3(-1.8, 1.7, 2.2), target: new THREE.Vector3(-1.6, 1.25, -0.1) },
      card: { pos: new THREE.Vector3(0.0, 1.95, 3.15), target: new THREE.Vector3(0.0, 1.42, 1.6) },
      finale: { pos: new THREE.Vector3(0, 3.8, 6.2), target: new THREE.Vector3(0, 1.6, -1.0) }
    };

    this.initLights();
    this.initEnvironmentMap();
    this.buildRoomAndWindow();
    this.buildTable();
    this.buildCake();
    this.buildPictureFrame();
    this.buildCard();
    this.buildStarParticles();

    this.initEvents();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initEnvironmentMap() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    const envCanvas = document.createElement('canvas');
    envCanvas.width = 1024;
    envCanvas.height = 512;
    const ctx = envCanvas.getContext('2d');

    // Equirectangular night city sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#04070e');
    grad.addColorStop(0.45, '#0b1422');
    grad.addColorStop(0.72, '#1a2a40');
    grad.addColorStop(0.85, '#cca048'); // warm city horizon lights
    grad.addColorStop(1, '#05080e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Warm city light points for realistic IBL reflections
    for (let i = 0; i < 140; i++) {
      const x = Math.random() * 1024;
      const y = 340 + Math.random() * 80;
      const r = Math.random() * 2.8 + 1;
      ctx.fillStyle = Math.random() > 0.4 ? '#ffd580' : '#90caf9';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const envTexture = new THREE.CanvasTexture(envCanvas);
    envTexture.colorSpace = THREE.SRGBColorSpace;
    const envMap = pmremGenerator.fromEquirectangular(envTexture).texture;
    this.scene.environment = envMap;
    pmremGenerator.dispose();
  }

  initLights() {
    // Ambient moonlight
    this.ambientLight = new THREE.AmbientLight(0x243b53, 1.3);
    this.scene.add(this.ambientLight);

    // Directional moonlight through window
    this.moonLight = new THREE.DirectionalLight(0x9cb4d8, 1.8);
    this.moonLight.position.set(-5, 8, -4);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.width = 2048;
    this.moonLight.shadow.mapSize.height = 2048;
    this.moonLight.shadow.radius = 3.5;
    this.moonLight.shadow.bias = -0.0003;
    this.scene.add(this.moonLight);

    // Warm candle point light
    this.candleLight = new THREE.PointLight(0xffa733, 3.2, 5.0, 1.5);
    this.candleLight.position.set(0, 1.95, 0);
    this.candleLight.castShadow = true;
    this.candleLight.shadow.mapSize.width = 1024;
    this.candleLight.shadow.mapSize.height = 1024;
    this.candleLight.shadow.bias = -0.001;
    this.candleLight.shadow.radius = 2.5;
    this.scene.add(this.candleLight);

    // Warm candle bounce light on tabletop
    this.candleBounce = new THREE.PointLight(0xff7711, 0.9, 2.2);
    this.candleBounce.position.set(0, 1.15, 0);
    this.scene.add(this.candleBounce);

    // Cozy fill light from room lamp
    this.lampLight = new THREE.PointLight(0xffc580, 1.0, 7.0);
    this.lampLight.position.set(2.8, 3.2, 1.8);
    this.scene.add(this.lampLight);
  }

  buildRoomAndWindow() {
    // Penthouse Floor (Dark hardwood floor)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f18,
      roughness: 0.8
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.01, 0);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Penthouse Ceiling
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x090d15,
      roughness: 0.9
    });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 7.2, 0);
    this.scene.add(ceiling);

    // Penthouse Side Walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0f1520,
      roughness: 0.85
    });
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7.5), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-7.5, 3.6, 0);
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7.5), wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(7.5, 3.6, 0);
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    // Grand Floor-to-Ceiling Panoramic Window Wall at back (z = -3.8)
    const windowGroup = new THREE.Group();
    windowGroup.position.set(0, 3.6, -3.8);

    // Slim Architectural Dark Bronze Steel Mullions
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x161c28,
      roughness: 0.35,
      metalness: 0.5
    });

    // Outer frame perimeter
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(15.0, 0.14, 0.12), frameMat);
    topBeam.position.y = 3.55;
    windowGroup.add(topBeam);

    const bottomBeam = new THREE.Mesh(new THREE.BoxGeometry(15.0, 0.14, 0.12), frameMat);
    bottomBeam.position.y = -3.55;
    windowGroup.add(bottomBeam);

    // Vertical structural mullions separating the glass panes
    const mullionXs = [-5.0, -2.5, 0, 2.5, 5.0];
    mullionXs.forEach(mx => {
      const vert = new THREE.Mesh(new THREE.BoxGeometry(0.08, 7.2, 0.14), frameMat);
      vert.position.x = mx;
      windowGroup.add(vert);
    });

    // Horizontal transom bar
    const transom = new THREE.Mesh(new THREE.BoxGeometry(15.0, 0.08, 0.12), frameMat);
    transom.position.y = 0.5;
    windowGroup.add(transom);

    // Crystal clear glass pane
    const glassMat = new THREE.MeshPhysicalMaterial({
      roughness: 0.04,
      transmission: 0.88,
      transparent: true,
      opacity: 0.15,
      ior: 1.5
    });
    const glassWall = new THREE.Mesh(new THREE.PlaneGeometry(15.0, 7.2), glassMat);
    glassWall.position.z = 0.01;
    windowGroup.add(glassWall);

    this.scene.add(windowGroup);

    // 3D City Skyline (Gedung-Gedung) outside the window
    this.buildCitySkyline();

    // Ambient floating warm dust motes
    this.buildDustParticles();
  }

  generateBuildingTexture(cols = 12, rows = 32, warmRatio = 0.45) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Dark architectural facade
    ctx.fillStyle = '#070b12';
    ctx.fillRect(0, 0, 512, 1024);

    const cellW = 512 / cols;
    const cellH = 1024 / rows;
    const padX = cellW * 0.28;
    const padY = cellH * 0.35;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rand = Math.random();
        if (rand < warmRatio) {
          const isWarm = Math.random() > 0.35;
          ctx.fillStyle = isWarm 
            ? (Math.random() > 0.5 ? '#ffe082' : '#ffb74d') 
            : '#b3e5fc';
          ctx.fillRect(c * cellW + padX, r * cellH + padY, cellW - padX * 2, cellH - padY * 2);
        } else {
          ctx.fillStyle = '#101620';
          ctx.fillRect(c * cellW + padX, r * cellH + padY, cellW - padX * 2, cellH - padY * 2);
        }
      }
    }
    return canvas;
  }

  buildCitySkyline() {
    this.cityGroup = new THREE.Group();

    // 1. Deep Twilight City Sky Backdrop
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512;
    skyCanvas.height = 512;
    const sCtx = skyCanvas.getContext('2d');
    const skyGrad = sCtx.createLinearGradient(0, 0, 0, 512);
    skyGrad.addColorStop(0, '#050810');
    skyGrad.addColorStop(0.55, '#0e1626');
    skyGrad.addColorStop(1, '#1e293d');
    sCtx.fillStyle = skyGrad;
    sCtx.fillRect(0, 0, 512, 512);

    const skyTex = new THREE.CanvasTexture(skyCanvas);
    const skyMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(32, 18),
      new THREE.MeshBasicMaterial({ map: skyTex })
    );
    skyMesh.position.set(0, 6.0, -12.0);
    this.cityGroup.add(skyMesh);

    // 2. Skyscraper Facade Textures
    const texWarm = new THREE.CanvasTexture(this.generateBuildingTexture(12, 34, 0.55));
    const texCool = new THREE.CanvasTexture(this.generateBuildingTexture(10, 28, 0.4));
    const texTower = new THREE.CanvasTexture(this.generateBuildingTexture(14, 40, 0.48));

    [texWarm, texCool, texTower].forEach(t => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
    });

    const matWarm = new THREE.MeshStandardMaterial({
      map: texWarm,
      emissiveMap: texWarm,
      emissive: 0xffffff,
      emissiveIntensity: 0.65,
      roughness: 0.35,
      metalness: 0.2
    });

    const matCool = new THREE.MeshStandardMaterial({
      map: texCool,
      emissiveMap: texCool,
      emissive: 0xffffff,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.3
    });

    const matTower = new THREE.MeshStandardMaterial({
      map: texTower,
      emissiveMap: texTower,
      emissive: 0xffffff,
      emissiveIntensity: 0.7,
      roughness: 0.25,
      metalness: 0.2
    });

    const buildingMats = [matWarm, matCool, matTower];

    // Beacon Material for spires
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.95
    });

    // 3. Procedural Modern Skyscrapers Layout (Gedung-Gedung)
    const buildingConfigs = [
      // Left Cluster
      { x: -8.0, z: -8.5, w: 1.5, d: 1.5, h: 6.5, mat: 0, spire: true },
      { x: -6.7, z: -6.8, w: 1.2, d: 1.2, h: 4.8, mat: 1 },
      { x: -5.4, z: -7.6, w: 1.4, d: 1.3, h: 5.8, mat: 2, crown: true },
      { x: -4.3, z: -5.6, w: 1.0, d: 1.0, h: 4.0, mat: 0 },
      { x: -3.4, z: -8.2, w: 1.6, d: 1.4, h: 7.5, mat: 2, spire: true },
      { x: -2.4, z: -6.2, w: 1.1, d: 1.1, h: 4.6, mat: 1 },

      // Center Skyline (Directly framed behind cake and desk)
      { x: -1.5, z: -7.8, w: 1.3, d: 1.3, h: 6.0, mat: 0 },
      { x: -0.5, z: -6.4, w: 0.9, d: 0.9, h: 4.3, mat: 1 },
      { x: 0.6, z: -8.5, w: 1.7, d: 1.5, h: 8.2, mat: 2, spire: true, crown: true },
      { x: 1.6, z: -6.6, w: 1.1, d: 1.1, h: 4.8, mat: 0 },
      { x: 2.6, z: -8.0, w: 1.4, d: 1.3, h: 6.8, mat: 1, spire: true },

      // Right Cluster
      { x: 3.6, z: -5.9, w: 1.0, d: 1.0, h: 4.1, mat: 0 },
      { x: 4.6, z: -7.5, w: 1.5, d: 1.4, h: 5.7, mat: 2 },
      { x: 5.6, z: -6.4, w: 1.2, d: 1.2, h: 5.0, mat: 1 },
      { x: 6.6, z: -8.2, w: 1.6, d: 1.5, h: 7.0, mat: 0, spire: true },
      { x: 7.8, z: -6.8, w: 1.3, d: 1.3, h: 5.2, mat: 2 }
    ];

    buildingConfigs.forEach(b => {
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const mesh = new THREE.Mesh(geo, buildingMats[b.mat]);
      mesh.position.set(b.x, b.h / 2, b.z);
      this.cityGroup.add(mesh);

      // Rooftop Spire & Aviation Beacon
      if (b.spire) {
        const spire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.025, 1.0, 8),
          new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.8 })
        );
        spire.position.set(b.x, b.h + 0.5, b.z);
        this.cityGroup.add(spire);

        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), beaconMat.clone());
        beacon.position.set(b.x, b.h + 1.02, b.z);
        this.cityGroup.add(beacon);
        this.cityBeacons.push(beacon);
      }

      // Crown illumination on prominent towers
      if (b.crown) {
        const crown = new THREE.Mesh(
          new THREE.BoxGeometry(b.w * 0.94, 0.18, b.d * 0.94),
          new THREE.MeshBasicMaterial({ color: 0xffdf80 })
        );
        crown.position.set(b.x, b.h + 0.09, b.z);
        this.cityGroup.add(crown);
      }
    });

    // 4. Distant Highway Traffic Light Trails (Glowing amber/white light strip on horizon)
    const trafficMat = new THREE.MeshBasicMaterial({
      color: 0xff9933,
      transparent: true,
      opacity: 0.45
    });
    const trafficStrip = new THREE.Mesh(new THREE.PlaneGeometry(28, 0.14), trafficMat);
    trafficStrip.position.set(0, 0.35, -5.2);
    this.cityGroup.add(trafficStrip);

    this.scene.add(this.cityGroup);
  }

  buildDustParticles() {
    const count = 55;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 4.2;
      pos[i * 3 + 1] = 0.95 + Math.random() * 2.2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3.2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.035,
      color: 0xffdf80,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    this.dustParticles = new THREE.Points(geo, mat);
    this.scene.add(this.dustParticles);
  }

  generateWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Rich warm walnut base
    ctx.fillStyle = '#4a2c1d';
    ctx.fillRect(0, 0, 1024, 1024);

    // Realistic wood fibers
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 1024;
      const width = Math.random() * 5 + 1;
      const alpha = Math.random() * 0.14 + 0.03;
      ctx.fillStyle = Math.random() > 0.4 ? `rgba(110, 70, 45, ${alpha})` : `rgba(35, 18, 10, ${alpha})`;
      ctx.fillRect(x, 0, width, 1024);
    }

    // Wood rings and organic grain curves
    ctx.strokeStyle = 'rgba(28, 14, 8, 0.18)';
    ctx.lineWidth = 2;
    for (let y = 0; y < 1024; y += 14) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 40) {
        const wave = Math.sin(x * 0.008 + y * 0.04) * 10 + Math.cos(x * 0.015) * 6;
        ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }

    // Subtle wooden plank dividers
    ctx.fillStyle = 'rgba(15, 8, 4, 0.6)';
    ctx.fillRect(340, 0, 3, 1024);
    ctx.fillRect(680, 0, 3, 1024);

    // Warm lacquer reflection highlight in center
    const grad = ctx.createRadialGradient(512, 512, 50, 512, 512, 600);
    grad.addColorStop(0, 'rgba(255, 175, 110, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    return canvas;
  }

  buildTable() {
    this.tableGroup = new THREE.Group();
    this.tableGroup.position.set(0, 0, 0);

    const woodCanvas = this.generateWoodTexture();
    const woodTex = new THREE.CanvasTexture(woodCanvas);
    woodTex.colorSpace = THREE.SRGBColorSpace;
    woodTex.wrapS = THREE.RepeatWrapping;
    woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(2, 1);

    const woodMat = new THREE.MeshPhysicalMaterial({
      map: woodTex,
      roughness: 0.28,
      metalness: 0.05,
      clearcoat: 0.45,
      clearcoatRoughness: 0.15,
      reflectivity: 0.6
    });

    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.12, 2.4), woodMat);
    tableTop.position.set(0, 0.85, 0);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    this.tableGroup.add(tableTop);

    // Table runner / cozy woven placemat in center
    const runnerMat = new THREE.MeshStandardMaterial({
      color: 0x1b2838,
      roughness: 0.85
    });
    const runner = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.006, 1.8), runnerMat);
    runner.position.set(0, 0.915, 0);
    runner.receiveShadow = true;
    this.tableGroup.add(runner);

    // Gold trim border on runner
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.5 });
    const trim1 = new THREE.Mesh(new THREE.BoxGeometry(4.62, 0.007, 0.03), trimMat);
    trim1.position.set(0, 0.916, -0.9);
    this.tableGroup.add(trim1);

    const trim2 = new THREE.Mesh(new THREE.BoxGeometry(4.62, 0.007, 0.03), trimMat);
    trim2.position.set(0, 0.916, 0.9);
    this.tableGroup.add(trim2);

    // Table Legs with brass ferrules
    const legGeo = new THREE.CylinderGeometry(0.065, 0.05, 0.85, 24);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3d2215, roughness: 0.6 });
    const ferruleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.8 });

    const legPositions = [
      [-2.3, 0.425, -1.0],
      [2.3, 0.425, -1.0],
      [-2.3, 0.425, 1.0],
      [2.3, 0.425, 1.0]
    ];

    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, y, z);
      leg.castShadow = true;
      this.tableGroup.add(leg);

      const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 24), ferruleMat);
      ferrule.position.set(x, 0.05, z);
      this.tableGroup.add(ferrule);
    });

    this.scene.add(this.tableGroup);
  }

  buildCake() {
    this.cakeGroup = new THREE.Group();
    this.cakeGroup.position.set(0, 0.92, 0);
    this.cakeGroup.name = 'cake';
    this.cakeGroup.userData = { id: 'cake', name: 'Kue Ulang Tahun' };

    // Ground Contact Shadow under cake
    const cakeShadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    const cakeShadow = new THREE.Mesh(new THREE.CircleGeometry(1.05, 32), cakeShadowMat);
    cakeShadow.rotation.x = -Math.PI / 2;
    cakeShadow.position.y = 0.002;
    this.cakeGroup.add(cakeShadow);

    // Porcelain Cake Stand (Ivory ceramic with subtle gloss reflection)
    const ceramicMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbf9f5,
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
      reflectivity: 0.8
    });

    // Stand Base
    const standBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.04, 32), ceramicMat);
    standBase.position.y = 0.02;
    standBase.castShadow = true;
    standBase.receiveShadow = true;
    this.cakeGroup.add(standBase);

    // Stand Fluted Stem
    const standStem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.14, 24), ceramicMat);
    standStem.position.y = 0.1;
    standStem.castShadow = true;
    this.cakeGroup.add(standStem);

    // Stand Top Plate with raised lip
    const standPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.94, 0.04, 48), ceramicMat);
    standPlate.position.y = 0.18;
    standPlate.castShadow = true;
    standPlate.receiveShadow = true;
    this.cakeGroup.add(standPlate);

    const plateRim = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.02, 16, 48), ceramicMat);
    plateRim.rotation.x = Math.PI / 2;
    plateRim.position.y = 0.2;
    this.cakeGroup.add(plateRim);

    // Cake Tier 1 (Vanilla Buttercream)
    const cakeMat = new THREE.MeshStandardMaterial({
      color: 0xfff9ef,
      roughness: 0.55
    });
    const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.36, 48), cakeMat);
    tier1.position.y = 0.38;
    tier1.castShadow = true;
    tier1.receiveShadow = true;
    this.cakeGroup.add(tier1);

    // Strawberry glaze drip band around tier 1
    const glazeMat = new THREE.MeshPhysicalMaterial({
      color: 0xc81e3d,
      roughness: 0.15,
      metalness: 0.08,
      clearcoat: 0.95,
      clearcoatRoughness: 0.08
    });
    const glazeBand1 = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 48), glazeMat);
    glazeBand1.position.y = 0.28;
    this.cakeGroup.add(glazeBand1);

    // Scalloped piped cream rosettes around base of Tier 1
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xfffaea, roughness: 0.45 });
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2;
      const x = Math.cos(angle) * 0.74;
      const z = Math.sin(angle) * 0.74;
      const pip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), creamMat);
      pip.position.set(x, 0.22, z);
      this.cakeGroup.add(pip);
    }

    // Cake Tier 2
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.32, 48), cakeMat);
    tier2.position.y = 0.72;
    tier2.castShadow = true;
    tier2.receiveShadow = true;
    this.cakeGroup.add(tier2);

    const glazeBand2 = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.51, 0.05, 48), glazeMat);
    glazeBand2.position.y = 0.62;
    this.cakeGroup.add(glazeBand2);

    // Piped cream swirls on Tier 2 top perimeter
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const x = Math.cos(angle) * 0.47;
      const z = Math.sin(angle) * 0.47;
      const rosette = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), creamMat);
      rosette.position.set(x, 0.88, z);
      this.cakeGroup.add(rosette);
    }

    // 6 Realistic Strawberries on top
    const berryMat = new THREE.MeshPhysicalMaterial({
      color: 0xcc1824,
      roughness: 0.14,
      metalness: 0.05,
      clearcoat: 0.95,
      clearcoatRoughness: 0.08
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2d6a4f,
      roughness: 0.6
    });

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const bx = Math.cos(angle) * 0.28;
      const bz = Math.sin(angle) * 0.28;

      const berryGroup = new THREE.Group();
      berryGroup.position.set(bx, 0.91, bz);

      // Conical strawberry body
      const berry = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.1, 16), berryMat);
      berry.rotation.x = Math.PI;
      berry.position.y = 0.05;
      berry.castShadow = true;
      berryGroup.add(berry);

      // Green star leaves on top
      const leafCrest = new THREE.Mesh(new THREE.CircleGeometry(0.045, 5), leafMat);
      leafCrest.rotation.x = -Math.PI / 2;
      leafCrest.position.y = 0.1;
      berryGroup.add(leafCrest);

      this.cakeGroup.add(berryGroup);
    }

    // Edible Gold Flakes on Tier 2
    const goldFlakeMat = new THREE.MeshStandardMaterial({
      color: 0xe9b44c,
      roughness: 0.2,
      metalness: 0.9
    });
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.2 + 0.12;
      const flake = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.02), goldFlakeMat);
      flake.position.set(Math.cos(angle) * r, 0.89, Math.sin(angle) * r);
      flake.rotation.x = -Math.PI / 2;
      flake.rotation.z = Math.random() * Math.PI;
      this.cakeGroup.add(flake);
    }

    // Birthday Candle (Gold & Ivory spiral stripes)
    const candleMat = new THREE.MeshPhysicalMaterial({
      color: 0xf5d47a,
      roughness: 0.22,
      metalness: 0.35,
      clearcoat: 0.35,
      clearcoatRoughness: 0.15
    });
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.34, 24), candleMat);
    candle.position.set(0, 1.05, 0);
    candle.castShadow = true;
    this.cakeGroup.add(candle);

    // Wax melt droplet at candle base
    const meltCollar = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.012, 12, 24), candleMat);
    meltCollar.rotation.x = Math.PI / 2;
    meltCollar.position.set(0, 0.89, 0);
    this.cakeGroup.add(meltCollar);

    // Charred Wick
    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.05, 8),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
    );
    wick.position.set(0, 1.23, 0);
    this.cakeGroup.add(wick);

    // Multi-Layer Realistic Candle Flame
    this.flameGroup = new THREE.Group();
    this.flameGroup.position.set(0, 1.3, 0);

    // 1. Outer warm flame halo (Additive)
    const flameOuterMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.16, 24), flameOuterMat);

    // 2. Inner golden brilliant core
    const flameInnerMat = new THREE.MeshBasicMaterial({
      color: 0xfff275
    });
    const flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.1, 20), flameInnerMat);
    flameInner.position.y = -0.018;

    // 3. Blue combustion base
    const flameBlueMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const flameBlue = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 16), flameBlueMat);
    flameBlue.position.y = -0.055;

    this.flameGroup.add(flameOuter);
    this.flameGroup.add(flameInner);
    this.flameGroup.add(flameBlue);
    this.cakeGroup.add(this.flameGroup);

    // Invisible bounding box for easy clicking on mobile & desktop
    const hitBox = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.0, 1.6, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.position.y = 0.8;
    hitBox.userData = { parent: this.cakeGroup };
    this.cakeGroup.add(hitBox);

    this.scene.add(this.cakeGroup);
    this.interactiveObjects.push(hitBox);
  }

  buildPictureFrame() {
    this.photoGroup = new THREE.Group();
    this.photoGroup.position.set(-1.6, 0.92, -0.1);
    this.photoGroup.rotation.y = 0.28; // tilted naturally towards viewer
    this.photoGroup.rotation.x = -0.08; // leaning back
    this.photoGroup.name = 'photo';
    this.photoGroup.userData = { id: 'photo', name: 'Bingkai Foto' };

    // Ground Contact Shadow under photo stand
    const photoShadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });
    const photoShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.45), photoShadowMat);
    photoShadow.rotation.x = -Math.PI / 2;
    photoShadow.position.set(0, 0.002, 0);
    this.photoGroup.add(photoShadow);

    // Outer Wooden/Gold Baroque Frame with bevel profile
    const frameMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4af37, // warm brushed gold
      roughness: 0.22,
      metalness: 0.85,
      clearcoat: 0.35,
      clearcoatRoughness: 0.15
    });

    const outerFrame = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.28, 0.06), frameMat);
    outerFrame.position.y = 0.64;
    outerFrame.castShadow = true;
    outerFrame.receiveShadow = true;
    this.photoGroup.add(outerFrame);

    // Inner Velvet Matting Border
    const innerMat = new THREE.MeshStandardMaterial({ color: 0x1a2332, roughness: 0.85 });
    const innerBorder = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.12, 0.065), innerMat);
    innerBorder.position.y = 0.64;
    this.photoGroup.add(innerBorder);

    // Frame Stand behind
    const standMat = new THREE.MeshStandardMaterial({ color: 0x2e1e12, roughness: 0.7 });
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.68, 0.02), standMat);
    stand.rotation.x = 0.42;
    stand.position.set(0, 0.35, -0.22);
    this.photoGroup.add(stand);

    // Photo Plane with dynamic texture
    const photoCanvas = this.generatePhotoCanvas();
    const photoTexture = new THREE.CanvasTexture(photoCanvas);
    photoTexture.colorSpace = THREE.SRGBColorSpace;

    const photoMat = new THREE.MeshStandardMaterial({
      map: photoTexture,
      roughness: 0.35
    });
    this.photoMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.04), photoMat);
    this.photoMesh.position.set(0, 0.64, 0.036);
    this.photoGroup.add(this.photoMesh);

    // Front Glass Pane with realistic specular reflections
    const glassMat = new THREE.MeshPhysicalMaterial({
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.35,
      ior: 1.52
    });
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.06), glassMat);
    glassPane.position.set(0, 0.64, 0.04);
    this.photoGroup.add(glassPane);

    // Attempt to load user photo if available
    const loader = new THREE.TextureLoader();
    loader.load(
      birthdayConfig.photoUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.photoMesh.material.map = tex;
        this.photoMesh.material.needsUpdate = true;
      },
      undefined,
      () => {
        // Fallback already active with procedural canvas
      }
    );

    // Invisible clickable box
    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 1.4, 0.3),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.position.set(0, 0.64, 0);
    hitBox.userData = { parent: this.photoGroup };
    this.photoGroup.add(hitBox);

    this.scene.add(this.photoGroup);
    this.interactiveObjects.push(hitBox);
  }

  generatePhotoCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');

    // Deep midnight city sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 480);
    skyGrad.addColorStop(0, '#090f1d');
    skyGrad.addColorStop(0.5, '#16233b');
    skyGrad.addColorStop(1, '#2c3e5a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 512, 480);

    // City skyline skyscrapers in photo
    const buildings = [
      { x: 18, w: 55, h: 220, winCols: 3, winRows: 12 },
      { x: 78, w: 45, h: 280, winCols: 2, winRows: 16 },
      { x: 128, w: 72, h: 350, winCols: 4, winRows: 18, spire: true },
      { x: 205, w: 60, h: 260, winCols: 3, winRows: 14 },
      { x: 270, w: 85, h: 370, winCols: 5, winRows: 20, crown: true },
      { x: 360, w: 55, h: 290, winCols: 3, winRows: 15 },
      { x: 420, w: 74, h: 240, winCols: 4, winRows: 13 }
    ];

    buildings.forEach(b => {
      const topY = 480 - b.h;
      ctx.fillStyle = '#0b1320';
      ctx.fillRect(b.x, topY, b.w, b.h);

      if (b.spire) {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(b.x + b.w / 2 - 1.5, topY - 35, 3, 35);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, topY - 35, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (b.crown) {
        ctx.fillStyle = 'rgba(233, 180, 76, 0.75)';
        ctx.fillRect(b.x + 4, topY + 4, b.w - 8, 8);
      }

      // Lit Windows
      const cw = b.w / b.winCols;
      const ch = b.h / b.winRows;
      for (let r = 2; r < b.winRows - 1; r++) {
        for (let c = 0; c < b.winCols; c++) {
          if (Math.random() > 0.4) {
            ctx.fillStyle = Math.random() > 0.35 ? '#ffeaa7' : '#74b9ff';
            ctx.fillRect(b.x + c * cw + cw * 0.25, topY + r * ch + ch * 0.3, cw * 0.5, ch * 0.4);
          }
        }
      }
    });

    // Waterfront city light reflections
    const waterGrad = ctx.createLinearGradient(0, 480, 0, 540);
    waterGrad.addColorStop(0, '#101e33');
    waterGrad.addColorStop(1, '#080d17');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 480, 512, 60);

    // Warm street light streaks
    ctx.fillStyle = 'rgba(233, 180, 76, 0.45)';
    ctx.fillRect(30, 482, 452, 2.5);

    // Polaroid-style bottom banner
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(16, 535, 480, 90);

    ctx.fillStyle = '#101827';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(birthdayConfig.recipientName, 256, 574);

    ctx.fillStyle = '#64748b';
    ctx.font = '13px Georgia, serif';
    ctx.fillText('A Little Night for You', 256, 602);

    return canvas;
  }

  wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
    return currentY + lineHeight;
  }

  generateBookCoverCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1440;
    const ctx = canvas.getContext('2d');

    // Deep midnight navy leather background
    ctx.fillStyle = '#111927';
    ctx.fillRect(0, 0, 1024, 1440);

    // Subtle leather vignette
    const vignette = ctx.createRadialGradient(512, 720, 200, 512, 720, 800);
    vignette.addColorStop(0, 'rgba(25, 40, 65, 0.35)');
    vignette.addColorStop(1, 'rgba(8, 12, 20, 0.9)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, 1024, 1440);

    // Ornate gold foil geometric borders
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 8;
    ctx.strokeRect(45, 45, 934, 1350);

    ctx.strokeStyle = '#b89628';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, 904, 1320);

    // Center Gold Monogram Emblem
    ctx.strokeStyle = '#e9b44c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(512, 450, 75, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#d4af37';
    ctx.font = '36px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText("N", 512, 462);

    // Gold Title Calligraphy
    ctx.fillStyle = '#f4d06f';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText("A LITTLE NIGHT", 512, 680);
    ctx.fillText("FOR YOU", 512, 755);

    // Recipient line
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'italic 32px Georgia, serif';
    ctx.fillText(`Dedicated to ${birthdayConfig.recipientName}`, 512, 850);

    // Gold divider
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(360, 900);
    ctx.lineTo(664, 900);
    ctx.stroke();

    // Call to action
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 24px monospace';
    ctx.letterSpacing = '4px';
    ctx.fillText("BUKA BUKU", 512, 1180);

    return canvas;
  }

  generateBookLeftPageCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1440;
    const ctx = canvas.getContext('2d');

    // Warm cream aged parchment (#fbf7ee)
    ctx.fillStyle = '#fbf7ee';
    ctx.fillRect(0, 0, 1024, 1440);

    // Spine shadow
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, 'rgba(215, 195, 165, 0.4)');
    grad.addColorStop(0.15, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.9, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(1, 'rgba(180, 155, 125, 0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1440);

    // Vintage decorative frame
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.strokeRect(60, 60, 904, 1320);

    ctx.strokeStyle = '#e2c582';
    ctx.lineWidth = 1;
    ctx.strokeRect(75, 75, 874, 1290);

    // Left Page Title
    ctx.fillStyle = '#854d0e';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText("A SPECIAL CHAPTER", 512, 220);

    ctx.fillStyle = '#a16207';
    ctx.font = 'italic 28px Georgia, serif';
    ctx.fillText("Di Malam Yang Tenang", 512, 275);

    // Decorative divider
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(340, 315);
    ctx.lineTo(684, 315);
    ctx.stroke();

    // Illustration: Modern Architectural / Candle Silhouette
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(512, 600, 130, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1c2838';
    ctx.beginPath();
    ctx.arc(512, 600, 126, 0, Math.PI * 2);
    ctx.fill();

    // City skyline silhouette inside circle
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(440, 610, 28, 70);
    ctx.fillRect(475, 560, 34, 120);
    ctx.fillRect(516, 530, 38, 150);
    ctx.fillRect(560, 580, 32, 100);

    // Warm blessing message on left page
    ctx.fillStyle = '#451a03';
    ctx.font = 'italic 32px Georgia, serif';
    ctx.fillText("“Setiap tahun adalah lembaran baru,", 512, 880);
    ctx.fillText("penuh kisah, harapan, dan langkah terbaik.”", 512, 930);

    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 36px Georgia, serif';
    ctx.fillText(`Happy Birthday, ${birthdayConfig.recipientName}!`, 512, 1080);

    ctx.fillStyle = '#92400e';
    ctx.font = '20px Georgia, serif';
    ctx.fillText("— — —", 512, 1200);

    return canvas;
  }

  generateBookRightPageCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1440;
    const ctx = canvas.getContext('2d');

    // Warm cream aged parchment (#fbf7ee)
    ctx.fillStyle = '#fbf7ee';
    ctx.fillRect(0, 0, 1024, 1440);

    // Spine shadow
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, 'rgba(180, 155, 125, 0.45)');
    grad.addColorStop(0.12, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.9, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(1, 'rgba(215, 195, 165, 0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1440);

    // Border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.strokeRect(60, 60, 904, 1320);

    ctx.strokeStyle = '#e2c582';
    ctx.lineWidth = 1;
    ctx.strokeRect(75, 75, 874, 1290);

    // Right Page Header: Birthday Title
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 50px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(birthdayConfig.cardTitle, 512, 180);

    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(340, 220);
    ctx.lineTo(684, 220);
    ctx.stroke();

    // Body letter paragraphs
    ctx.textAlign = 'left';
    ctx.fillStyle = '#292524';
    ctx.font = '33px Georgia, serif';

    let startY = 310;
    const maxWidth = 750;
    const lineHeight = 50;

    birthdayConfig.cardParagraphs.forEach(p => {
      startY = this.wrapCanvasText(ctx, p, 136, startY, maxWidth, lineHeight);
      startY += 28; // Paragraph spacing
    });

    // Sender Signature
    ctx.textAlign = 'right';
    ctx.fillStyle = '#78350f';
    ctx.font = 'italic 34px Georgia, serif';
    ctx.fillText(birthdayConfig.cardSender, 880, Math.max(startY + 30, 1180));

    // Vintage Wax Seal Stamp (bottom center)
    const sealX = 512;
    const sealY = 1260;
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.arc(sealX, sealY, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sealX, sealY, 40, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#fef2f2';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText("SEALED", sealX, sealY + 6);

    return canvas;
  }

  buildCard() {
    this.cardGroup = new THREE.Group();
    this.bookInitialPos = new THREE.Vector3(1.5, 0.92, 0.1);
    this.bookInitialRot = new THREE.Euler(0, -0.32, 0);
    this.cardGroup.position.copy(this.bookInitialPos);
    this.cardGroup.rotation.copy(this.bookInitialRot);
    this.cardGroup.name = 'card';
    this.cardGroup.userData = { id: 'card', name: 'Buku Ucapan' };

    // Book Dimensions
    const pageWidth = 0.82;
    const pageHeight = 1.15;
    const bookThickness = 0.04;

    // 1. Back Cover Base (right half when open, resting underneath)
    const leatherMat = new THREE.MeshPhysicalMaterial({
      color: 0x141e2e, // Midnight navy leather
      roughness: 0.38,
      metalness: 0.12,
      clearcoat: 0.25
    });

    const backCover = new THREE.Mesh(
      new THREE.BoxGeometry(pageWidth, 0.015, pageHeight),
      leatherMat
    );
    backCover.position.set(pageWidth / 2, 0.0075, 0);
    backCover.castShadow = true;
    backCover.receiveShadow = true;
    this.cardGroup.add(backCover);

    // 2. Spine cylinder along z axis at x = 0
    const spineMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Gold leather trim
      roughness: 0.35,
      metalness: 0.4
    });
    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, pageHeight, 16),
      spineMat
    );
    spine.rotation.x = Math.PI / 2;
    spine.position.set(0, 0.02, 0);
    spine.castShadow = true;
    this.cardGroup.add(spine);

    // 3. Right Page Stack with Birthday Letter Texture
    const rightPageCanvas = this.generateBookRightPageCanvas();
    const rightPageTexture = new THREE.CanvasTexture(rightPageCanvas);
    rightPageTexture.colorSpace = THREE.SRGBColorSpace;

    const pageMat = new THREE.MeshStandardMaterial({
      map: rightPageTexture,
      roughness: 0.7
    });

    const pageSideMat = new THREE.MeshStandardMaterial({
      color: 0xede4d4,
      roughness: 0.8
    });

    // Multi-material cube: top face (+y = index 2) has the letter
    const pageBlockMaterials = [
      pageSideMat, // +x
      pageSideMat, // -x
      pageMat,     // +y (top printed letter)
      pageSideMat, // -y
      pageSideMat, // +z
      pageSideMat  // -z
    ];

    this.rightPageBlock = new THREE.Mesh(
      new THREE.BoxGeometry(pageWidth - 0.03, bookThickness, pageHeight - 0.04),
      pageBlockMaterials
    );
    this.rightPageBlock.position.set(pageWidth / 2, 0.015 + bookThickness / 2, 0);
    this.rightPageBlock.castShadow = true;
    this.rightPageBlock.receiveShadow = true;
    this.cardGroup.add(this.rightPageBlock);

    // 4. Front Cover Hinge (rotates around spine at x=0)
    this.bookCoverHinge = new THREE.Group();
    this.bookCoverHinge.position.set(0, 0.025 + bookThickness, 0);

    // Left inside page canvas
    const leftPageCanvas = this.generateBookLeftPageCanvas();
    const leftPageTexture = new THREE.CanvasTexture(leftPageCanvas);
    leftPageTexture.colorSpace = THREE.SRGBColorSpace;
    const leftPageMat = new THREE.MeshStandardMaterial({
      map: leftPageTexture,
      roughness: 0.7
    });

    // Front outer cover canvas
    const coverCanvas = this.generateBookCoverCanvas();
    const coverTexture = new THREE.CanvasTexture(coverCanvas);
    coverTexture.colorSpace = THREE.SRGBColorSpace;
    const outerCoverMat = new THREE.MeshPhysicalMaterial({
      map: coverTexture,
      roughness: 0.35,
      metalness: 0.2,
      clearcoat: 0.3
    });

    // Multi-material cover:
    // +y = Outer front cover when closed
    // -y = Inside left page when opened
    const coverMaterials = [
      leatherMat,     // +x
      spineMat,       // -x
      outerCoverMat,  // +y
      leftPageMat,    // -y
      leatherMat,     // +z
      leatherMat      // -z
    ];

    this.frontCoverMesh = new THREE.Mesh(
      new THREE.BoxGeometry(pageWidth, 0.015, pageHeight),
      coverMaterials
    );
    this.frontCoverMesh.position.set(pageWidth / 2, 0.0075, 0);
    this.frontCoverMesh.castShadow = true;
    this.bookCoverHinge.add(this.frontCoverMesh);

    this.cardGroup.add(this.bookCoverHinge);

    // Purple ribbon bookmark hanging from bottom
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.4 });
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.005, 0.35), ribbonMat);
    ribbon.position.set(pageWidth * 0.45, 0.02, pageHeight * 0.52);
    ribbon.rotation.x = 0.25;
    this.cardGroup.add(ribbon);

    // Invisible clickable box
    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(pageWidth * 1.3, 0.4, pageHeight * 1.2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.position.set(pageWidth / 2, 0.2, 0);
    hitBox.userData = { parent: this.cardGroup };
    this.cardGroup.add(hitBox);

    this.scene.add(this.cardGroup);
    this.interactiveObjects.push(hitBox);
  }

  openBook(duration = 1.6, onComplete = null) {
    if (this.isBookOpen) {
      if (onComplete) onComplete();
      return;
    }
    this.isBookOpen = true;
    this.resetHover();

    const startPos = this.cardGroup.position.clone();
    const startRot = this.cardGroup.rotation.clone();
    
    // Lift up to center floating reading position
    const endPos = new THREE.Vector3(0.0, 1.48, 1.6);
    const endRot = new THREE.Euler(0.48, 0.0, 0);

    const startCoverAngle = this.bookCoverHinge.rotation.z;
    const endCoverAngle = Math.PI * 0.95; // Swing open to left

    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // Smooth cubic ease-in-out
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      // 1. Lift and tilt the book
      this.cardGroup.position.lerpVectors(startPos, endPos, ease);
      this.cardGroup.rotation.x = THREE.MathUtils.lerp(startRot.x, endRot.x, ease);
      this.cardGroup.rotation.y = THREE.MathUtils.lerp(startRot.y, endRot.y, ease);
      this.cardGroup.rotation.z = THREE.MathUtils.lerp(startRot.z, endRot.z, ease);

      // 2. Open cover with a natural delay once book is rising
      const coverP = Math.min(Math.max((progress - 0.22) / 0.78, 0), 1);
      const coverEase = coverP < 0.5 
        ? 2 * coverP * coverP 
        : -1 + (4 - 2 * coverP) * coverP;
      this.bookCoverHinge.rotation.z = THREE.MathUtils.lerp(startCoverAngle, endCoverAngle, coverEase);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animate);
  }

  closeBook(duration = 1.3, onComplete = null) {
    if (!this.isBookOpen) {
      if (onComplete) onComplete();
      return;
    }

    const startPos = this.cardGroup.position.clone();
    const startRot = this.cardGroup.rotation.clone();
    const endPos = this.bookInitialPos.clone();
    const endRot = this.bookInitialRot.clone();

    const startCoverAngle = this.bookCoverHinge.rotation.z;
    const endCoverAngle = 0;

    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress < 0.5 
        ? 2 * progress * progress 
        : -1 + (4 - 2 * progress) * progress;

      // 1. Close front cover first (progress 0 to 0.65)
      const coverP = Math.min(progress / 0.65, 1);
      const coverEase = coverP < 0.5 ? 2 * coverP * coverP : -1 + (4 - 2 * coverP) * coverP;
      this.bookCoverHinge.rotation.z = THREE.MathUtils.lerp(startCoverAngle, endCoverAngle, coverEase);

      // 2. Lower book back down to table (progress 0.25 to 1.0)
      const moveP = Math.min(Math.max((progress - 0.25) / 0.75, 0), 1);
      const moveEase = moveP < 0.5 ? 2 * moveP * moveP : -1 + (4 - 2 * moveP) * moveP;

      this.cardGroup.position.lerpVectors(startPos, endPos, moveEase);
      this.cardGroup.rotation.x = THREE.MathUtils.lerp(startRot.x, endRot.x, moveEase);
      this.cardGroup.rotation.y = THREE.MathUtils.lerp(startRot.y, endRot.y, moveEase);
      this.cardGroup.rotation.z = THREE.MathUtils.lerp(startRot.z, endRot.z, moveEase);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isBookOpen = false;
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animate);
  }

  buildStarParticles() {
    const starCount = 350;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const baseColor = new THREE.Color(0xffffff);
    const goldColor = new THREE.Color(0xffe082);
    const blueColor = new THREE.Color(0x90caf9);

    for (let i = 0; i < starCount; i++) {
      // Scatter in background behind window and high ceiling
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = 2.0 + Math.random() * 7;
      positions[i * 3 + 2] = -4.2 - Math.random() * 4;

      const pick = Math.random();
      const col = pick < 0.6 ? baseColor : pick < 0.85 ? goldColor : blueColor;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.stars = new THREE.Points(geometry, material);
    this.scene.add(this.stars);
  }

  extinguishCandle() {
    if (!this.isCandleLit) return;
    this.isCandleLit = false;

    // Fade out flame mesh
    let fadeStep = 0;
    const fadeTimer = setInterval(() => {
      fadeStep += 0.1;
      if (this.flameGroup) {
        this.flameGroup.scale.setScalar(Math.max(0, 1 - fadeStep));
      }
      if (this.candleLight) {
        this.candleLight.intensity = Math.max(0.1, 2.8 * (1 - fadeStep));
      }

      if (fadeStep >= 1) {
        clearInterval(fadeTimer);
        this.flameGroup.visible = false;
        this.candleLight.intensity = 0.2; // soft warm afterglow
        this.candleLight.color.setHex(0xff7733);
      }
    }, 30);
  }

  relightCandle() {
    this.isCandleLit = true;
    if (this.flameGroup) {
      this.flameGroup.visible = true;
      this.flameGroup.scale.set(1, 1, 1);
    }
    if (this.candleLight) {
      this.candleLight.color.setHex(0xffaa33);
      this.candleLight.intensity = 2.8;
    }
  }

  setCameraView(viewName, duration = 1.2, onComplete = null) {
    const targetView = this.views[viewName];
    if (!targetView) return;

    this.isTransitioningCamera = true;
    const startPos = this.camera.position.clone();
    const startTarget = this.currentTarget.clone();
    const endPos = targetView.pos.clone();
    const endTarget = targetView.target.clone();

    // Adapt position for narrow mobile screens
    if (this.width < 768) {
      if (viewName === 'overview') {
        endPos.z += 1.3;
        endPos.y += 0.4;
      } else if (viewName === 'cake') {
        endPos.z += 0.6;
      }
    }

    const startTime = performance.now();

    const animateTransition = (now) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // Smooth ease-in-out curve
      const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

      this.camera.position.lerpVectors(startPos, endPos, ease);
      this.currentTarget.lerpVectors(startTarget, endTarget, ease);
      this.camera.lookAt(this.currentTarget);

      if (progress < 1) {
        requestAnimationFrame(animateTransition);
      } else {
        this.isTransitioningCamera = false;
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animateTransition);
  }

  initEvents() {
    window.addEventListener('resize', () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });

    const updateMouse = (clientX, clientY) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    window.addEventListener('mousemove', (e) => {
      updateMouse(e.clientX, e.clientY);
      this.targetParallax.x = this.mouse.x * 0.28;
      this.targetParallax.y = this.mouse.y * 0.16;
      this.checkHover();
    });

    // Touch support
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        updateMouse(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
  }

  checkHover() {
    if (this.isTransitioningCamera || this.isBookOpen) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object.userData.parent;
      if (this.hoveredObject !== hit) {
        this.resetHover();
        this.hoveredObject = hit;
        document.body.style.cursor = 'pointer';
        // Gentle hover float effect
        if (this.hoveredObject && (!this.isBookOpen || this.hoveredObject !== this.cardGroup)) {
          this.hoveredObject.position.y += 0.04;
        }
      }
    } else {
      this.resetHover();
    }
  }

  resetHover() {
    if (this.hoveredObject) {
      if (!this.isBookOpen || this.hoveredObject !== this.cardGroup) {
        this.hoveredObject.position.y -= 0.04;
      }
      this.hoveredObject = null;
      document.body.style.cursor = 'default';
    }
  }

  getClickedObject(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const clickMouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    this.raycaster.setFromCamera(clickMouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, false);

    if (intersects.length > 0) {
      return intersects[0].object.userData.parent.userData.id;
    }
    return null;
  }

  animate() {
    requestAnimationFrame(this.animate);
    const elapsed = (performance.now() - this.startTime) * 0.001;

    // Organic candle flame flicker
    if (this.isCandleLit && this.candleLight && this.flameGroup) {
      const f1 = Math.sin(elapsed * 11) * 0.12;
      const f2 = Math.cos(elapsed * 17) * 0.08;
      const f3 = Math.sin(elapsed * 29) * 0.05;
      const totalFlicker = f1 + f2 + f3;

      this.candleLight.intensity = 3.2 + totalFlicker;
      if (this.candleBounce) {
        this.candleBounce.intensity = 0.9 + totalFlicker * 0.3;
      }
      this.flameGroup.scale.y = 1.0 + totalFlicker * 0.35;
      this.flameGroup.scale.x = 1.0 - totalFlicker * 0.12;
      this.flameGroup.rotation.z = Math.sin(elapsed * 7) * 0.06;
      this.flameGroup.rotation.x = Math.cos(elapsed * 9) * 0.04;
    }

    // Skyscraper rooftop aviation warning beacons pulse
    if (this.cityBeacons && this.cityBeacons.length > 0) {
      const beaconOn = Math.sin(elapsed * 2.8) > 0.1;
      this.cityBeacons.forEach(b => {
        b.material.opacity = beaconOn ? 0.95 : 0.18;
      });
    }

    // Floating warm dust motes
    if (this.dustParticles) {
      const positions = this.dustParticles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(elapsed * 0.8 + i) * 0.0012;
        positions[i] += Math.cos(elapsed * 0.5 + i) * 0.0008;
      }
      this.dustParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Gentle twinkling stars
    if (this.stars) {
      this.stars.rotation.y = Math.sin(elapsed * 0.04) * 0.015;
    }

    // Subtle mouse parallax & gentle breathing when in overview
    if (!this.isTransitioningCamera && this.camera.position.z > 3.5) {
      this.currentParallax.lerp(this.targetParallax, 0.05);
      this.camera.position.x = this.cameraDefaultPos.x + this.currentParallax.x + Math.sin(elapsed * 0.35) * 0.04;
      this.camera.position.y = this.cameraDefaultPos.y + this.currentParallax.y;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
