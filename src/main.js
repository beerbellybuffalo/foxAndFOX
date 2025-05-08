import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import GUI from "lil-gui";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { BasicCharacterController } from "./characterController.js";

/**
 * Base
 */
// Debug
const gui = new GUI();
const debugUIParams = {
  EnvMap: "day", // default key
};

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100
);
const camStartPos = new THREE.Vector3(-10, 10, 20);
const origin = new THREE.Vector3(0, 0, 0);

camera.position.copy(camStartPos);
camera.zoom = 0.5;
scene.add(camera);

debugUIParams.resetCam = () => {
  camera.position.copy(camStartPos);
  camera.zoom = 1;
  camera.rotation.z = Math.PI;
  camera.updateProjectionMatrix();
  controls.target.copy(origin);
  controls.update();
};

gui.add(debugUIParams, "resetCam").name("Reset Camera");

//show the updated camera coordinates on GUI everytime it changes
const cameraPositionDisplay = {
  get x() {
    return Number(camera.position.x.toFixed(2));
  },
  get y() {
    return Number(camera.position.y.toFixed(2));
  },
  get z() {
    return Number(camera.position.z.toFixed(2));
  },
};

const cameraFolder = gui.addFolder("Camera Position");
cameraFolder.add(cameraPositionDisplay, "x").listen();
cameraFolder.add(cameraPositionDisplay, "y").listen();
cameraFolder.add(cameraPositionDisplay, "z").listen();

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/**
 * Instantiate CharacterController
 */
const myCharacterController = new BasicCharacterController({
  scene: scene,
  camera: camera,
});

/**
 * Models
 */

//declare animation mixer in global scope
let mixer = null;
var envModel;
const gltfLoader = new GLTFLoader();
gltfLoader.load(
  "/models/seashack_waterNoLighting/seashack_waterNoLighting.gltf",
  (gltf) => {
    // console.log(gltf);
    envModel = gltf.scene.clone();
    scene.add(envModel);
    console.log(envModel);
    setScaleAndConstraints();
  }
);

gltfLoader.load("/models/Fox/glTF/Fox.gltf", (gltf) => {
  const fox = gltf.scene;
  mixer = new THREE.AnimationMixer(gltf.scene);
  const action = mixer.clipAction(gltf.animations[0]);
  action.play();

  fox.scale.set(0.01, 0.01, 0.01);
  fox.position.set(-4.4, 5.6, 1.5);
  scene.add(fox);
});

/**
 * Env Maps
 */

const HDRIs = {
  day: "autumn_field_puresky_2k.hdr", //set as default in debugUIParams
  sunset: "rosendal_park_sunset_puresky_2k.hdr",
  midnight: "NightSky4_2K.hdr",
};

const rgbeLoader = new RGBELoader();

function loadHDRI(key) {
  const filename = HDRIs[key];
  rgbeLoader.load(`./hdri/${filename}`, (environmentMap) => {
    environmentMap.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = environmentMap;
    scene.environment = environmentMap;
  });
}

const intensitySlider = gui
  .add(scene, "environmentIntensity")
  .min(0.2)
  .max(2)
  .step(0.1)
  .name("Env Light Intensity");

// Load initial HDRI
loadHDRI(debugUIParams.EnvMap);

// Dropdown menu instead of a slider
gui
  .add(debugUIParams, "EnvMap", Object.keys(HDRIs))
  .name("Time")
  .onChange((key) => {
    loadHDRI(key);
    setIntensity(key);
  });

const intensityByKey = {
  day: 0.7,
  sunset: 0.3,
  midnight: 2,
};

function setIntensity(key) {
  scene.environmentIntensity = intensityByKey[key] ?? 1;
  intensitySlider.updateDisplay();
}

/**
 * Lights
 */
// const ambientLight = new THREE.AmbientLight(0xffffff, 2.4);
// scene.add(ambientLight);

// const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
// directionalLight.castShadow = true;
// directionalLight.shadow.mapSize.set(1024, 1024);
// directionalLight.shadow.camera.far = 15;
// directionalLight.shadow.camera.left = -7;
// directionalLight.shadow.camera.top = 7;
// directionalLight.shadow.camera.right = 7;
// directionalLight.shadow.camera.bottom = -7;
// directionalLight.position.set(5, 5, 5);
// scene.add(directionalLight);

/**
 * Map Controls
 */
const controls = new MapControls(camera, renderer.domElement);
controls.enableDamping = true;
// Prevent going below horizon (~81°)
controls.maxPolarAngle = Math.PI * 0.4;
// Prevent looking straight up
controls.minPolarAngle = 0.1;

/**
 * Ensure Zoom and Pan stays within the limits of the seabed bounds
 */
function setScaleAndConstraints() {
  // console.log(
  //   "scene clone loaded successfully, setting scale and constraints..."
  // );

  const sand = envModel.getObjectByName("sand");
  const water = envModel.getObjectByName("water");

  const seabedScale = 10; // Scale multiplier — adjust as needed
  sand.scale.set(seabedScale, 1, seabedScale);
  water.scale.set(seabedScale, 1, seabedScale);

  const seabed = new THREE.Group();
  seabed.add(sand);
  seabed.add(water);
  scene.add(seabed);

  const seabedBox = new THREE.Box3().setFromObject(seabed);
  const seabedCenter = seabed.position;
  // const seabedCenter = seabedBox.getCenter(new THREE.Vector3());
  const seabedSize = seabedBox.getSize(new THREE.Vector3());

  // Center camera target on seabed
  controls.target.copy(seabedCenter);
  controls.update();

  // Zoom constraints
  const maxSide = Math.max(seabedSize.x, seabedSize.z);
  controls.minDistance = maxSide * 0.1;
  controls.maxDistance = maxSide * 0.2;

  // Compute current visible bounds at camera distance
  const distance = camera.position.distanceTo(seabedCenter);
  const vFOV = THREE.MathUtils.degToRad(camera.fov);
  const visibleHeight = 2 * Math.tan(vFOV / 2) * distance;
  const visibleWidth = visibleHeight * camera.aspect;

  const offsetX = visibleWidth / 4;
  const offsetZ = visibleHeight / 4;

  const min = new THREE.Vector3(
    seabedBox.min.x + offsetX,
    seabedCenter.y,
    seabedBox.min.z + offsetZ
  );
  const max = new THREE.Vector3(
    seabedBox.max.x - offsetX,
    seabedCenter.y,
    seabedBox.max.z - offsetZ
  );

  // Override controls.update to clamp pan movement
  const originalUpdate = controls.update.bind(controls);
  controls.update = function () {
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, min.x, max.x);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, min.z, max.z);

    camera.position.x = THREE.MathUtils.clamp(camera.position.x, min.x, max.x);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, min.z, max.z);

    originalUpdate();
  };
}

/**
 * Animate
 */
const clock = new THREE.Clock();
let previousTime = 0;

const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - previousTime;
  previousTime = elapsedTime;

  if (myCharacterController) {
    myCharacterController.Update(deltaTime);
  }

  if (mixer !== null) {
    mixer.update(deltaTime);
  }
  controls.update();
  renderer.render(scene, camera);
  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
};

tick();
