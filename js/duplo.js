let models = {
  "corner.stl":null,
  "cornerHole.stl":null,
  "cosinusSlope.stl":null,
  "crossing.stl":null,
  "end.stl":null,
  "longRamp.stl":null,
  "ramp.stl":null,
  "ramp2.stl":null,
  "rampCorner1.stl":null,
  "rampCorner2.stl":null,
  "straight.stl":null,
  "straightHole.stl":null,
  "verticalCurveHole.stl":null,
  "verticalCurveHoleStart.stl":null,
  "verticalHolde.stl":null,
  "duplo-2x1x4.stl":null,
  "duplo-2x2x2.stl":null,
  "duplo-2x2x4.stl":null,
  "duplo-2x4x1.stl":null,
  "duplo-2x4x2.stl":null,
  "duplo-8x8-place.stl":null,
  "duplo-8x8-plate.stl":null
};
let modelNames = Object.keys(models);
let loader = new THREE.STLLoader();
function loadModel() {
  let modelName = modelNames.pop();
  if (modelName) {
    loader.load(`models/${modelName}`, function (geometry) {
      console.log(modelName);
      models[modelName] = geometry;
      loadModel();
    });
  }
}
loadModel();

const BOTTOM = new THREE.Vector3(0, -1, 0);
const TOP = new THREE.Vector3(0, 1, 0);
const LEFT = new THREE.Vector3(-1, 0, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);
const BACK = new THREE.Vector3(0, 0, -1);
const FRONT = new THREE.Vector3(0, 0, 1);

class Cursor {
  constructor(grid, settings) {
    this.grid = grid;
    this.settings = settings;
    this.position = new THREE.Vector3(0, this.settings.world.y - 1, 0);
    this.started = false;
    this.track = new Track();
    this.mesh = null;
  }

  getMesh() {
    if (!this.mesh) {
      //let geometry = new THREE.BoxGeometry(this.settings.block.x, this.settings.block.y, this.settings.block.z);
      let geometry = new THREE.SphereGeometry(this.settings.tube.r, 32, 32);
      let material = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        depthTest:false,
        transparent:true
      });
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.userData['cursor'] = this;
    }
    this.updatePosition()
    return this.mesh;
  }

  setPosition(position) {
    this.position.copy(position);
    this.updatePosition()
  }

  updatePosition() {
    this.mesh.position.set(
      (this.position.x + 0.5) * this.settings.block.x,
      //(this.position.y + 0.5) * this.settings.block.y
      //  + (this.settings.tube.r - this.settings.block.y / 2)
      //  + (this.settings.block.y - this.settings.tube.r),
      (this.position.y + 0.5) * this.settings.block.y + this.settings.block.y / 2,
      (this.position.z + 0.5) * this.settings.block.z
    );
  }

  spawnBlock() {
    let block = new Block(this.settings);
    block.position.copy(this.position);
    this.grid.set(block, this.position);
    this.track.add(block);
    let lastBlock = this.track.peek(1);
    if (lastBlock) {
      let mesh = lastBlock.getMesh(this.grid);
      if (mesh) {
        this.grid.getMesh().add(mesh);
      }
    }
    return block;
  }

  start() {
    this.started = true;
    this.spawnBlock();
  }

  verifyNextPosition(nextPosition) {
    let isInsideGrid = 0 <= nextPosition.x && nextPosition.x < this.settings.world.x && 
      0 <= nextPosition.y && nextPosition.y < this.settings.world.y &&
      0 <= nextPosition.z && nextPosition.z < this.settings.world.z;
    if (!isInsideGrid) return false;

    let isCrossRoad = this.grid.get(nextPosition) instanceof Block;
    if (isCrossRoad) return false;

    let upOrDown = nextPosition.clone().sub(this.position).y;
    if (upOrDown !== 1) {
      let belowNextBlock = this.grid.get(nextPosition.clone().add(new THREE.Vector3(0, -1, 0)))
      let hasBelowRoad = belowNextBlock instanceof Block;
      if (hasBelowRoad) return false
    }
    if (upOrDown !== -1) {
      let aboveNextBlock = this.grid.get(nextPosition.clone().add(new THREE.Vector3(0, 1, 0)))
      let hasAboveRoad = aboveNextBlock instanceof Block;
      if (hasAboveRoad) return false
    }

    return true;
  }

  moveTo(position) {
    this.setPosition(position);
    if (this.started) {
      return this.spawnBlock();
    }
    else {
      return null;
    }
  }

  moveInDirection(direction) {
    let prevBlock = this.track.peek(1)
    let nextPosition = new THREE.Vector3().addVectors(this.position, direction);
    if (this.started && prevBlock && prevBlock.position.equals(nextPosition)) {
      return this.cancelLastMove();
    }
    else if (this.verifyNextPosition(nextPosition)) {
      return this.moveTo(nextPosition);
    }
    else {
      return null;
    }
  }

  moveBottom() {
    return this.moveInDirection(BOTTOM);
  }

  moveTop() {
    return this.moveInDirection(TOP);
  }

  moveLeft() {
    return this.moveInDirection(LEFT);
  }

  moveRight() {
    return this.moveInDirection(RIGHT);
  }

  moveBack() {
    return this.moveInDirection(BACK);
  }

  moveFront() {
    return this.moveInDirection(FRONT);
  }

  cancelLastMove() {
    var removedBlock = this.track.removeLast();
    this.grid.remove(removedBlock);
    var lastBlock = this.track.peek();
    this.setPosition(lastBlock.position);
  }
}

class Grid {
  constructor(settings) {
    this.settings = settings;
    this.cells = this.buildCells();
    this.mesh = null;
  }

  getMesh() {
    if (!this.mesh) {
      this.mesh = this.createMesh();
    }
    return this.mesh;
  }

  createMesh() {
    const block = this.settings.block;
    const world = this.settings.world;
    let lineMaterial = new THREE.LineBasicMaterial({color: 0x000000, opacity:0.1, transparent:true});
    let lineGeometry = new THREE.Geometry();
    for (let x = 0; x <= world.x; x++) {
      for (let y = 0; y <= world.y; y++) {
        lineGeometry.vertices.push(
          new THREE.Vector3(block.x * x, block.y * y, 0),
          new THREE.Vector3(block.x * x, block.y * y, block.z * world.z)
        );
      }
    }
    for (let y = 0; y <= world.y; y++) {
      for (let z = 0; z <= world.z; z++) {
        lineGeometry.vertices.push(
          new THREE.Vector3(0,                 block.y * y, block.z * z),
          new THREE.Vector3(block.x * world.x, block.y * y, block.z * z)
        );
      }
    }
    for (let z = 0; z <= world.z; z++) {
      for (let x = 0; x <= world.x; x++) {
        lineGeometry.vertices.push(
          new THREE.Vector3(block.x * x,                 0, block.z * z),
          new THREE.Vector3(block.x * x, block.y * world.y, block.z * z)
        );
      }
    }
    let lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
    lineSegments.position.set(
      -block.x * world.x / 2,
      -block.y * world.y / 2,
      -block.z * world.z / 2,
    );
    return lineSegments;
  }

  buildCells() {
    let cells = [];
    for (let x = 0; x < this.settings.world.x; x++) {
      let plane = []
      cells.push(plane);
      for (let y = 0; y < this.settings.world.y; y++) {
        let columns = [];
        plane.push(columns);
        for (let z = 0; z < this.settings.world.z; z++) {
          columns.push(null); 
        }
      }
    }
    return cells;
  }

  get(position) {
    //return this.cells[position.x][position.y][position.z];
    let yzPlane = this.cells[position.x];
    if (yzPlane) {
      let zPlane = yzPlane[position.y];
      if (zPlane) {
        return zPlane[position.z];
      }
    }
    return null;
  }

  set(block, position) {
    this.cells[position.x][position.y][position.z] = block;
  }

  remove(block) {
    this.getMesh().remove(block.getMesh());
    this.set(null, block.position);
  }
}

class Block {
  constructor(settings) {
    this.settings = settings;
    this.position = new THREE.Vector3(-1, -1, -1);
    this.mesh = null;
    this.from = null;
    this.to = null;
  }

  isOpenSides(s1, s2) {
    return (this.from.equals(s1) && this.to.equals(s2)) || (this.from.equals(s2) && this.to.equals(s1));
  }

  getMesh(grid) {
    let hasCeil = this.hasCeil(grid);
    let offsetY = 0;
    if (!this.mesh) {
      let rotateZ = 0;
      let geometry;
      if (this.from === null || this.to === null) {
        geometry = models['end.stl'];
        let openSide = this.from || this.to;
        if      (openSide.equals(FRONT)) rotateZ =  Math.PI;
        else if (openSide.equals(LEFT))  rotateZ =  Math.PI / 2;
        else if (openSide.equals(RIGHT)) rotateZ = -Math.PI / 2;
      }
      else if (this.isOpenSides(LEFT, RIGHT)) {
        if (hasCeil) {
          geometry = models['straightHole.stl'];
          offsetY = this.settings.block.y / 2;
        }
        else {
          geometry = models['straight.stl'];
        }
        rotateZ = Math.PI / 2;
      }
      else if (this.isOpenSides(FRONT, BACK)) {
        if (hasCeil) {
          geometry = models['straightHole.stl'];
          offsetY = this.settings.block.y / 2;
        }
        else {
          geometry = models['straight.stl'];
        }
      }
      else if (this.from.clone().sub(this.to).y === 0) {
        if (hasCeil) {
          geometry = models['cornerHole.stl'];
          offsetY = this.settings.block.y / 2;
        }
        else {
          geometry = models['corner.stl'];
        }
        if      (this.isOpenSides(BACK, LEFT))   rotateZ = -Math.PI / 2;
        else if (this.isOpenSides(BACK, RIGHT))  rotateZ =  Math.PI;
        else if (this.isOpenSides(FRONT, RIGHT)) rotateZ =  Math.PI / 2;
      }
      else if (this.isOpenSides(TOP, BOTTOM)) {
      }
      else {
        return null;
        //geometry = new THREE.BoxGeometry(this.settings.block.x, this.settings.block.z, this.settings.block.y);
      }
      //let geometry = models['corner.stl']
      let color = new THREE.Color(
        this.position.x / this.settings.world.x,
        this.position.y / this.settings.world.y,
        this.position.z / this.settings.world.z
      );
      //let material = new THREE.MeshPhongMaterial({color: 0x0000ff});
      let material = new THREE.MeshPhongMaterial({color: color});
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.rotation.z = rotateZ;
      this.mesh.userData['block'] = this;
    }
    this.mesh.position.set(
      (this.position.x + 0.5) * this.settings.block.x,
      (this.position.y + 0.5) * this.settings.block.y + offsetY,
      (this.position.z + 0.5) * this.settings.block.z
    );
    return this.mesh;
  }

  isAdded() {
    return this.mesh && this.mesh.parent;
  }

  hasCeil(grid) {
    let p = this.position.clone();
    for (p.y = this.position.y + 1; p.y < this.settings.world.y; p.y++) {
      if (grid.get(p)) {
        return true;
      }
    }
    return false;
  }
}

class Track {
  constructor(x, y, z) {
    this.track = [];
  }

  add(block) {
    let lastBlock = this.track[this.track.length - 1];
    if (lastBlock) {
      let direction = block.position.clone().sub(lastBlock.position);
      lastBlock.to = direction;
      block.from = direction.clone().negate();
    }
    this.track.push(block);
  }

  removeLast() {
    return this.track.pop();
  }

  peek(index=0) {
    return this.track[this.track.length - 1 - index];
  }

  createDuplo() {
    // TODO
  }
}

