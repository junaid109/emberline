// A minimal stand-in for Three.js, enough to construct the scene graph.
//
// It is NOT a renderer and proves nothing about pixels. What it does prove is
// that every render module builds without throwing: no missing export, no
// undefined constant, no typo in a geometry name, no userData hook the frame
// loop calls that was never attached. Those are precisely the failures that
// otherwise present as a black screen with an empty console, and they cost a
// whole debugging cycle each to find by hand.

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  setLength(l) { const k = l / (this.length() || 1); return this.set(this.x * k, this.y * k, this.z * k); }
}

class Vector2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
}

class Euler {
  constructor() { this.x = 0; this.y = 0; this.z = 0; }
}

class Color {
  constructor(hex = 0) { this.hex = hex; }
  setHex(h) { this.hex = h; return this; }
  copy(c) { this.hex = c.hex; return this; }
  lerp() { return this; }
}

class Object3D {
  constructor() {
    this.position = new Vector3();
    this.rotation = new Euler();
    this.scale = new Vector3(1, 1, 1);
    this.children = [];
    this.userData = {};
    this.visible = true;
  }
  add(...kids) { this.children.push(...kids); return this; }
  remove(kid) {
    const i = this.children.indexOf(kid);
    if (i !== -1) this.children.splice(i, 1);
    return this;
  }
  clear() { this.children.length = 0; return this; }
}

class Geometry {
  constructor(...args) { this.args = args; this.disposed = false; Geometry.created++; }
  dispose() { this.disposed = true; }
}
Geometry.created = 0;
class Material {
  constructor(opts = {}) {
    Object.assign(this, opts);
    this.color = new Color(opts.color ?? 0);
    this.disposed = false;
    Material.created++;
  }
  dispose() { this.disposed = true; }
}
Material.created = 0;

class Mesh extends Object3D {
  constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; }
}

class InstancedMesh extends Mesh {
  constructor(geometry, material, count) {
    super(geometry, material);
    this.count = count;
    this.matrices = new Array(count).fill(null);
    this.instanceMatrix = { needsUpdate: false, setUsage(u) { this.usage = u; } };
    this.disposed = false;
  }
  setMatrixAt(i, m) { this.matrices[i] = { ...m }; }
  // Three.js frees the per-instance matrix buffer here. Removing an
  // InstancedMesh from a scene does NOT release it.
  dispose() { this.disposed = true; }
}

class Matrix4 {
  compose(p, q, s) { this.p = { ...p }; this.q = { ...q }; this.s = { ...s }; return this; }
}

class Quaternion {
  setFromAxisAngle(axis, angle) { this.axis = axis; this.angle = angle; return this; }
}

class Light extends Object3D {
  constructor(color, intensity = 1) { super(); this.color = new Color(color); this.intensity = intensity; }
}

class Raycaster {
  constructor() {
    this.ray = { intersectPlane: (_plane, target) => target.set(3, 0, -4) };
  }
  setFromCamera() {}
}

export function makeThreeStub() {
  return {
    Vector2, Vector3, Color, Object3D, Mesh, Raycaster,
    InstancedMesh, Matrix4, Quaternion,
    Geometry,
    Material,
    DodecahedronGeometry: Geometry,
    IcosahedronGeometry: Geometry,
    OctahedronGeometry: Geometry,
    StaticDrawUsage: 35044,
    Group: Object3D,
    Scene: class Scene extends Object3D {},
    Fog: class Fog { constructor(color, near, far) { this.color = new Color(color); this.near = near; this.far = far; } },
    PerspectiveCamera: class PerspectiveCamera extends Object3D {
      constructor(fov, aspect, near, far) {
        super();
        Object.assign(this, { fov, aspect, near, far });
        this.updateProjectionMatrix = () => {};
        this.lookAt = () => {};
      }
    },
    WebGLRenderer: class WebGLRenderer {
      constructor({ canvas }) { this.canvas = canvas; this.calls = []; }
      setClearColor(c) { this.clearColor = c; }
      setPixelRatio(r) { this.pixelRatio = r; }
      setSize(w, h) { this.size = [w, h]; }
      render() { this.calls.push('render'); }
    },
    BoxGeometry: Geometry,
    SphereGeometry: Geometry,
    CapsuleGeometry: Geometry,
    CylinderGeometry: Geometry,
    ConeGeometry: Geometry,
    CircleGeometry: Geometry,
    RingGeometry: Geometry,
    PlaneGeometry: Geometry,
    Plane: class Plane { constructor(n, c) { this.normal = n; this.constant = c; } },
    MeshLambertMaterial: Material,
    MeshBasicMaterial: Material,
    MeshStandardMaterial: Material,
    HemisphereLight: Light,
    DirectionalLight: Light,
    AmbientLight: Light,
    PointLight: class PointLight extends Light {
      constructor(color, intensity, distance, decay) {
        super(color, intensity);
        Object.assign(this, { distance, decay });
      }
    },
    DoubleSide: 2,
  };
}

/** A DOM element stand-in with a real client box, as the canvas has in the page. */
export function makeCanvasStub(width = 393, height = 852) {
  const listeners = new Map();
  return {
    clientWidth: width,
    clientHeight: height,
    width: 0,
    height: 0,
    style: {},
    children: [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener: () => {},
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    appendChild: () => {},
    append: () => {},
    dispatch(type, event) {
      for (const fn of listeners.get(type) ?? []) fn(event);
    },
    listenerCount: (type) => (listeners.get(type) ?? []).length,
  };
}
