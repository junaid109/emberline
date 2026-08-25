// src/render/sync.js
//
// Keeps a pool of meshes in step with a list of simulation entities.
//
// This lives outside main.js on purpose. The first version of this logic was
// inline in the frame loop, iterated the POOL rather than the entity list, and
// so never grew the pool past zero: wolves existed, moved, and mauled the
// furnace entirely invisibly. Nothing failed, nothing logged, and no test could
// see it because the frame loop is the one file with no coverage.

/**
 * Grows `pool` to cover `entities`, positions a mesh for each, and hides the
 * surplus. Meshes are reused rather than created and destroyed, so a wave of
 * wolves costs no GPU allocation on the frames already doing the most work.
 *
 * @param {object[]} pool      persistent mesh pool, mutated in place
 * @param {object[]} entities  things with {x, z}
 * @param {() => object} create  builds one mesh, called only when the pool must grow
 * @param {(mesh, entity) => void} [place]  positions a mesh; defaults to x/z
 * @returns {number} how many meshes are visible
 */
export function syncPool(pool, entities, create, place = defaultPlace) {
  while (pool.length < entities.length) pool.push(create());

  for (let i = 0; i < entities.length; i++) {
    const mesh = pool[i];
    mesh.visible = true;
    place(mesh, entities[i]);
  }

  for (let i = entities.length; i < pool.length; i++) pool[i].visible = false;

  return entities.length;
}

function defaultPlace(mesh, entity) {
  mesh.position.x = entity.x;
  mesh.position.z = entity.z;
}

/**
 * Places a wolf and turns it to face what it is walking at, so a player can
 * read where a wolf is headed from its silhouette alone.
 */
export function faceToward(targetX, targetZ) {
  return (mesh, entity) => {
    mesh.position.x = entity.x;
    mesh.position.z = entity.z;
    mesh.rotation.y = Math.atan2(targetX - entity.x, targetZ - entity.z);
  };
}
