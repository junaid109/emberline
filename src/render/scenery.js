// src/render/scenery.js
/* global THREE */
//
// Draws the landscape. Around 600 props, in six draw calls.
//
// InstancedMesh is not premature optimisation here: 600 separate Meshes is 600
// draw calls per frame, which is the difference between a smooth phone and a
// slideshow, and Playability is a quarter of the score. Batching by prop kind
// keeps the whole forest at one draw call per kind no matter how dense it gets.
import { groupByKind } from '../core/scatter.js';

const SNOW = 0xdce8f2;
const NEEDLE_DARK = 0x1f3b2f;
const NEEDLE = 0x2c5545;
const BARK = 0x4a3728;
const STONE = 0x77808c;
const SHRUB = 0x35503f;

/**
 * The geometries and materials, built once and shared by every landscape for
 * the rest of the session.
 *
 * Lazy rather than module-level because THREE is a global loaded by a separate
 * script tag, and this module is evaluated before it exists.
 *
 * buildPartsets used to run on every createScenery() call. That was harmless
 * while the landscape was built once per session — but once the layout became
 * per-run, every restart allocated a fresh set of geometries and materials, and
 * removing a mesh from a Three.js scene frees neither.
 */
let SHARED = null;

function partsets() {
  if (!SHARED) SHARED = buildPartsets();
  return SHARED;
}

/**
 * Each builder returns parts of one prop as [geometry, material, yOffset].
 *
 * Segment counts are deliberately low — this is a low-poly art style, and
 * hundreds of copies of a smooth cone would cost real milliseconds for a
 * difference nobody can see at this camera distance.
 */
function buildPartsets() {
  const cone = (r, h, seg = 7) => new THREE.ConeGeometry(r, h, seg);
  const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);

  // One material per colour, shared by every prop that uses it. Materials
  // used to be created per part per call, which meant a fresh set on every
  // restart that nothing ever freed.
  const cache = new Map();
  const mat = (color) => {
    if (!cache.has(color)) {
      cache.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
    }
    return cache.get(color);
  };

  return {
    // A plain conifer: two stacked skirts on a short trunk.
    pine: [
      [cyl(0.16, 0.22, 1.1), mat(BARK), 0.55],
      [cone(1.05, 2.3), mat(NEEDLE_DARK), 2.0],
      [cone(0.78, 1.8), mat(NEEDLE), 3.1],
    ],
    // The same tree wearing snow. Mixing the two through the forest is what
    // makes the treeline read as weather rather than as one repeated asset.
    snowpine: [
      [cyl(0.16, 0.22, 1.1), mat(BARK), 0.55],
      [cone(1.05, 2.3), mat(NEEDLE_DARK), 2.0],
      [cone(0.8, 1.7), mat(SNOW), 3.15],
    ],
    // Dead standing trunk — visual variety, and a hint the cold kills things.
    snag: [
      [cyl(0.1, 0.26, 3.4, 5), mat(BARK), 1.7],
    ],
    rock: [
      [new THREE.DodecahedronGeometry(0.8, 0), mat(STONE), 0.42],
    ],
    shrub: [
      [new THREE.IcosahedronGeometry(0.62, 0), mat(SHRUB), 0.4],
    ],
    // A flattened dome: a wind-piled bank of snow, cheap relief on a flat plane.
    drift: [
      [new THREE.SphereGeometry(1.35, 8, 5), mat(SNOW), 0.05],
    ],
  };
}

/**
 * Adds every prop to the scene as instanced geometry.
 *
 * @param {object} scene
 * @param {{kind:string,x:number,z:number,scale:number,rotY:number}[]} props
 * @returns {{count:number, drawCalls:number, meshes:object[], dispose:() => void}}
 *
 * The landscape is keyed to the run's seed now that the layout varies, so it is
 * rebuilt per run — a forest scattered around last run's trees would leave props
 * standing in this run's clearings. Call dispose() before building the next one.
 */
export function createScenery(scene, props) {
  const shared = partsets();
  const groups = groupByKind(props);

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  const scaleVec = new THREE.Vector3();

  let drawCalls = 0;
  const meshes = [];

  for (const [kind, list] of groups) {
    const parts = shared[kind];
    if (!parts) continue;                 // an unknown kind is skipped, not fatal

    for (const [geometry, material, yOffset] of parts) {
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);

      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        // yOffset is scaled with the prop, or a tall tree would sink into the
        // ground and a small one would float above it.
        position.set(p.x, yOffset * p.scale, p.z);
        quaternion.setFromAxisAngle(axis, p.rotY);
        scaleVec.set(p.scale, p.scale, p.scale);
        matrix.compose(position, quaternion, scaleVec);
        mesh.setMatrixAt(i, matrix);
      }

      // Static for the whole run: tell the driver it never has to re-upload.
      mesh.instanceMatrix.needsUpdate = true;
      if (THREE.StaticDrawUsage !== undefined) mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

      // Frustum culling on an InstancedMesh tests the whole batch by a bounding
      // sphere around the origin, which for a 190-unit-wide forest is always on
      // screen anyway — so the test is pure cost. Skip it.
      mesh.frustumCulled = false;

      scene.add(mesh);
      meshes.push(mesh);
      drawCalls++;
    }
  }

  return {
    count: props.length,
    drawCalls,
    meshes,

    /**
     * Removes this landscape and frees what it owns.
     *
     * The InstancedMeshes are disposed but their geometries and materials are
     * NOT: those are shared with every other landscape built this session, and
     * disposing them would leave the next run drawing from freed buffers.
     */
    dispose() {
      for (const mesh of meshes) {
        scene.remove(mesh);
        mesh.dispose();
      }
      meshes.length = 0;
    },
  };
}
