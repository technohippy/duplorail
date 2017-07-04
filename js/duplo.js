let models = {
  "corner_low.stl":null,
  "corner_hole_low.stl":null,
  "straight_low.stl":null,
  "straight_hole_low.stl":null,
  "ramp_low.stl":null,
  "ramp_hole_low.stl":null,
  "rampCorner1_low.stl":null,
  "rampCorner2_low.stl":null,
  "rampCorner1_hole_low.stl":null,
  "rampCorner2_hole_low.stl":null,
  "end_low.stl":null,
  "verticalHole_low.stl":null,
  "verticalCurveStart_low.stl":null,
  "verticalCurveStart_hole_low.stl":null,
  "verticalCurveEnd_hole_low.stl":null,
  "duplo-2x2x2_low.stl":null,
  "duplo-5x5x0.5_low.stl":null
};

let toHole = {
  "corner_low.stl":"corner_hole_low.stl",
  "straight_low.stl":"straight_hole_low.stl",
  "ramp_low.stl":"ramp_hole_low.stl",
  "rampCorner1_low.stl":"rampCorner1_hole_low.stl",
  "rampCorner2_low.stl":"rampCorner2_hole_low.stl",
  "end_low.stl":"straight_hole_low.stl",
  "verticalCurveStart_low.stl":"verticalCurveStart_hole_low.stl",
  "verticalCurveStart_hole_low.stl":null,
  "verticalCurveEnd_low.stl":null,
}

function getModel(name) {
  return models[name];
}

function getGroundMesh() {
  let geom = getModel('duplo-5x5x0.5_low.stl');
  let material = new THREE.MeshPhongMaterial({color:0xcccccc});
  let mesh = new THREE.Mesh(geom, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

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
    this.tracks = [new Track()];
    this.mesh = null;
  }

  getTrack() {
    return this.tracks[0];
  }

  get track() {
    return this.getTrack();
  }

  getMesh() {
    if (!this.mesh) {
      let geometry = new THREE.PlaneGeometry(this.settings.block.x, this.settings.block.z);
      let material = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        depthTest:false,
        opacity:0.5,
        transparent:true
      });
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.rotation.x = -Math.PI / 2;
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
      //  + (this.settings.sphere.r - this.settings.block.y / 2)
      //  + (this.settings.block.y - this.settings.sphere.r),
      (this.position.y + 0.5) * this.settings.block.y - this.settings.block.y / 2,
      (this.position.z + 0.5) * this.settings.block.z
    );
  }

  spawnBlock() {
    let block = new Block(this.settings);
    block.position.copy(this.position);
    this.grid.set(block, this.position);
    this.getTrack().add(block);
    /*
    let lastBlock = this.getTrack().peek(1);
    if (lastBlock) {
      let mesh = lastBlock.getMesh(this.grid);
      if (mesh) {
        this.grid.getMesh().add(mesh);
      }
    }
    */

    for (let i = 1; i < this.getTrack().length; i++) {
      let lastBlock = this.getTrack().peek(i);
      if (lastBlock && !lastBlock.mesh) {
        let mesh = lastBlock.getMesh(this.grid);
        if (mesh) {
          this.grid.getMesh().add(mesh);
        }
      }
    }

    return block;
  }

  start() {
    if (this.started) return;
    if (this.grid.get(this.position)) return;

    this.started = true;
    this.spawnBlock();
  }

  stop() {
    if (!this.started) return;
    if (this.track.peek().fromSide.equals(TOP)) return;

    this.started = false;
    let mesh = this.getTrack().peek().getMesh(this.grid);
    if (mesh) {
      this.grid.getMesh().add(mesh);
    }

    this.tracks.unshift(new Track());
  }

  complete() {
    let needSupport = false;
    for (let x = 0; x < this.settings.world.x; x++) {
      for (let z = 0; z < this.settings.world.z; z++) {
        needSupport = false;
        for (let y = this.settings.world.y - 1; 0 <= y; y--) {
          let block = this.grid.get({x:x, y:y, z:z});
          if (block && block.mesh) {
            if (needSupport) {
              if (!block.isHole()) {
                block.convertToHole();
              }
            }
            else {
              needSupport = true;
            }
          }
          else if (!block && needSupport) {
            let underBlock = this.grid.get({x:x, y:y-1, z:z});
            if (!underBlock) {
              let position = new THREE.Vector3(x, y, z);
              let block = new Block(this.settings);
              block.position.copy(position);
              this.grid.set(block, position);
              let mesh = block.getMesh(this.grid);
              if (mesh) {
                this.grid.getMesh().add(mesh);
              }
            }
          }
        }
      }
    }
    this.grid.getMesh().material.visible = false;
    this.getMesh().material.visible = false;
    this.grid.showAllLayers();
  }

  reset() {
    this.grid.reset();
    this.tracks = [new Track()];
    this.started = false;
    this.setPosition({x:0, y:this.settings.world.y - 1, z:0});
    this.mesh.material.visible = true;
  }

  isInsideGrid(nextPosition) {
    return 0 <= nextPosition.x && nextPosition.x < this.settings.world.x && 
      0 <= nextPosition.y && nextPosition.y < this.settings.world.y &&
      0 <= nextPosition.z && nextPosition.z < this.settings.world.z;
  }

  verifyNextPosition(nextPosition) {
    if (!this.isInsideGrid(nextPosition)) return false;

    let isCrossRoad = this.grid.get(nextPosition) instanceof Block;
    if (isCrossRoad) return false;

    let upOrDown = nextPosition.clone().sub(this.position).y;
    if (upOrDown !== 0 && this.getTrack().length === 1) return false;
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
    let prevBlock = this.getTrack().peek(1)
    let nextPosition = new THREE.Vector3().addVectors(this.position, direction);
    if (this.started) {
      if (prevBlock && prevBlock.position.equals(nextPosition)) {
        this.cancelLastMove();
        if (prevBlock.prevBlock && 0 <= ['verticalCurveStart.stl', 'verticalHole_low.stl'].indexOf(prevBlock.prevBlock.type)) {
          prevBlock.prevBlock.removeNext();
        }
        return;
      }
      else if (this.verifyNextPosition(nextPosition)) {
        return this.moveTo(nextPosition);
      }
      else {
        return null;
      }
    }
    else {
      if (this.isInsideGrid(nextPosition)) {
        return this.moveTo(nextPosition);
      }
    }
  }

  moveBottom() {
    const block = this.moveInDirection(BOTTOM);
    this.grid.hilightLayers(this.position.y);
    this.grid.board.setPosition(this.position.y);
    this.grid.board.show();
    return block;
  }

  moveTop() {
    let nextPosition = new THREE.Vector3().addVectors(this.position, TOP);
    if (!this.started || this.grid.get(nextPosition)) {
      const block = this.moveInDirection(TOP);
      this.grid.hilightLayers(this.position.y);
      this.grid.board.setPosition(this.position.y);
      this.grid.board.show();
      return block;
    }
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
    var removedBlock = this.getTrack().removeLast();
    this.grid.remove(removedBlock);
    var lastBlock = this.getTrack().peek();
    this.setPosition(lastBlock.position);
  }
}

class Board {
  constructor(settings) {
    this.settings = settings;
    this.mesh = null;
    this.layer = this.settings.world.y - 1;
  }

  getMesh() {
    if (!this.mesh) {
      this.mesh = this.createMesh();
    }
    this.setPosition(this.layer);
    return this.mesh;
  }

  createMesh() {
    const block = this.settings.block;
    const world = this.settings.world;
    let lineMaterial = new THREE.LineBasicMaterial({
      color: 0x0000ff, opacity:0.2, transparent:true});
    let lineGeometry = new THREE.Geometry();
    for (let x = 0; x <= world.x; x++) {
      lineGeometry.vertices.push(
        new THREE.Vector3(block.x * x, 0, 0),
        new THREE.Vector3(block.x * x, 0, block.z * world.z)
      );
    }
    for (let z = 0; z <= world.z; z++) {
      lineGeometry.vertices.push(
        new THREE.Vector3(0,                 0, block.z * z),
        new THREE.Vector3(block.x * world.x, 0, block.z * z)
      );
    }
    let lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
    return lineSegments;
  }

  setPosition(layer) {
    this.layer = layer;
    if (this.mesh) {
      this.mesh.position.y = this.settings.block.y * layer;
    }
  }

  show() {
    if (this.mesh) {
      this.mesh.material.visible = true;
    }
  }

  hide() {
    if (this.mesh) {
      this.mesh.material.visible = false;
    }
  }
}

class Grid {
  constructor(settings) {
    this.settings = settings;
    this.cells = this.buildCells();
    this.board = new Board(this.settings);
    this.mesh = null;
  }

  getMesh() {
    if (!this.mesh) {
      this.mesh = this.createMesh();
      this.mesh.add(this.board.getMesh());
    }
    return this.mesh;
  }

  createMesh() {
    const block = this.settings.block;
    const world = this.settings.world;
    let lineMaterial = new THREE.LineBasicMaterial({
      color: 0x000000, opacity:0.1, transparent:true});
    let lineGeometry = new THREE.Geometry();
    //for (let x = 0; x <= world.x; x++) {
    //  for (let y = 0; y <= world.y; y++) {
    for (let x = 0; x <= world.x; x += world.x) {
      for (let y = 0; y < world.y; y++) {
        lineGeometry.vertices.push(
          new THREE.Vector3(block.x * x, block.y * y, 0),
          new THREE.Vector3(block.x * x, block.y * y, block.z * world.z)
        );
      }
    }
    //for (let y = 0; y <= world.y; y++) {
    //  for (let z = 0; z <= world.z; z++) {
    for (let y = 0; y < world.y; y++) {
      for (let z = 0; z <= world.z; z += world.z) {
        lineGeometry.vertices.push(
          new THREE.Vector3(0,                 block.y * y, block.z * z),
          new THREE.Vector3(block.x * world.x, block.y * y, block.z * z)
        );
      }
    }
    /*
    for (let z = 0; z <= world.z; z++) {
      for (let x = 0; x <= world.x; x++) {
        lineGeometry.vertices.push(
          new THREE.Vector3(block.x * x,                 0, block.z * z),
          new THREE.Vector3(block.x * x, block.y * world.y, block.z * z)
        );
      }
    }
    */
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

  forEach(handler) {
    for (let x = 0; x < this.settings.world.x; x++) {
      for (let y = 0; y < this.settings.world.y; y++) {
        for (let z = 0; z < this.settings.world.z; z++) {
          let position = new THREE.Vector3(x, y, z);
          let block = this.get(position);
          handler(block, position);
        }
      }
    }
  }

  remove(block) {
    block.prevBlock.removeNext();
    this.set(null, block.position);
  }

  reset() {
    if (this.mesh) {
      this.forEach((block) => {
        if (block && block.mesh) {
          this.mesh.remove(block.mesh);
          block.mesh.geometry.dispose();
          block.mesh.material.dispose();
        }
      });
      this.mesh.material.visible = true;
    }
    this.cells = this.buildCells();
  }

  showAllLayers() {
    this.showLayers(-1);
  }

  showLayers(layer) {
    this.board.hide();
    this.forEach((block, position) => {
      if (block && block.mesh) {
        if (layer < 0 || position.y < layer) {
          block.mesh.material.opacity = 1.0;
          block.mesh.material.visible = true;
        }
        else {
          block.mesh.material.visible = false;
        }
      }
    });
  }

  hilightLayers(layer) {
    console.log(layer);
    this.forEach((block, position) => {
      if (block && block.mesh) {
        block.mesh.material.visible = true;
        if (layer < 0 || position.y === layer) {
          block.mesh.material.opacity = 1.0;
        }
        else {
          block.mesh.material.opacity = 0.2;
          //block.mesh.material.opacity = 1.0;
        }
      }
    });
  }

  getSummary() {
    let summary = {};
    this.forEach((block) => {
      if (block && block.type) {
        if (summary[block.type]) {
          summary[block.type] += 1;
        }
        else {
          summary[block.type] = 1;
        }
      }
    });
    return summary;
  }
}

class Block {
  static prepareConstants() {
    Block.MODELS = {
      "corner_low.stl":null,
      "corner_hole_low.stl":null,
      "straight_low.stl":null,
      "straight_hole_low.stl":null,
      "ramp_low.stl":null,
      "ramp_hole_low.stl":null,
      "rampCorner1_low.stl":null,
      "rampCorner2_low.stl":null,
      "rampCorner1_hole_low.stl":null,
      "rampCorner2_hole_low.stl":null,
      "end_low.stl":null,
      "verticalHole_low.stl":null,
      "verticalCurveStart_low.stl":null,
      "verticalCurveStart_hole_low.stl":null,
      "verticalCurveEnd_hole_low.stl":null,
      "duplo-2x2x2_low.stl":null,
      "duplo-5x5x0.5_low.stl":null
    };
    Block.TO_HOLE = {
      "corner_low.stl":"corner_hole_low.stl",
      "straight_low.stl":"straight_hole_low.stl",
      "ramp_low.stl":"ramp_hole_low.stl",
      "rampCorner1_low.stl":"rampCorner1_hole_low.stl",
      "rampCorner2_low.stl":"rampCorner2_hole_low.stl",
      "end_low.stl":"straight_hole_low.stl",
      "verticalCurveStart_low.stl":"verticalCurveStart_hole_low.stl",
      "verticalCurveStart_hole_low.stl":null,
      "verticalCurveEnd_low.stl":null,
    }
  }

  static getModelNames() {
    return Object.keys(Block.MODELS);
  }

  static getModel(type) {
    return Block.MODELS[type];
  }

  static getGroundMesh() {
    let geom = Block.getModel('duplo-5x5x0.5_low.stl');
    let material = new THREE.MeshPhongMaterial({color:0xcccccc});
    let mesh = new THREE.Mesh(geom, material);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  static loadModels(callback) {
    Block.prepareConstants();

    //var modelNames = Object.keys(models);
    var modelNames = Block.getModelNames();
    let loader = new THREE.STLLoader();
    function loadModel() {
      let modelName = modelNames.pop();
      if (modelName) {
        loader.load(`models/${modelName}`, (geometry) => {
          models[modelName] = geometry;
          loadModel();
        });
      }
    }
    loadModel();

    function checkModelLoad() {
      for (let modelName in models) {
        if (modelName) {
          if (models[modelName] === null) {
            setTimeout(checkModelLoad, 100);
            return;
          }
        }
      }
      callback();
    }
    checkModelLoad();
  }

  constructor(settings) {
    this.settings = settings;
    this.position = new THREE.Vector3(-1, -1, -1);
    this.type = null;
    this.mesh = null;
    this.fromSide = null;
    this.toSide = null;
    this.prevBlock = null;
    this.nextBlock = null;
  }

  isHole() {
    if (!this.type) {
      //throw 'type is null';
      return true;
    }
    return this.type.match('Hole') !== null || this.type.match('_hole') !== null;
  }

  isOpenSides(s1, s2) {
    return this.toSide && ((this.fromSide.equals(s1) && this.toSide.equals(s2)) || (this.fromSide.equals(s2) && this.toSide.equals(s1)));
  }

  _setType(type) {
    //console.log(`type: ${type}`);
    this.type = type;
  }

  getGeometry() {
    return models[this.type];
  }

  getMesh(grid) {
    let hasCeil = this.hasCeil(grid);
    if (!this.mesh) {
      let rotateZ = 0;
      if (this.fromSide === null && this.toSide === null) {
        this._setType('duplo-2x2x2_low.stl');
      }
      else if (this.fromSide === null || this.toSide === null) {
        this._setType('end_low.stl');
        let openSide = this.fromSide || this.toSide;
        if      (openSide.equals(FRONT)) rotateZ =  Math.PI;
        else if (openSide.equals(LEFT))  rotateZ =  Math.PI / 2;
        else if (openSide.equals(RIGHT)) rotateZ = -Math.PI / 2;
      }
      else if (this.isOpenSides(LEFT, RIGHT)) {
        if (hasCeil) {
          this._setType('straight_hole_low.stl');
        }
        else {
          this._setType('straight_low.stl');
        }
        rotateZ = Math.PI / 2;
      }
      else if (this.isOpenSides(FRONT, BACK)) {
        if (hasCeil) {
          this._setType('straight_hole_low.stl');
        }
        else {
          this._setType('straight_low.stl');
        }
      }
      else if (this.fromSide.clone().sub(this.toSide).y === 0) {
        if (hasCeil) {
          this._setType('corner_hole_low.stl');
        }
        else {
          this._setType('corner_low.stl');
        }
        if      (this.isOpenSides(BACK, LEFT))   rotateZ = -Math.PI / 2;
        else if (this.isOpenSides(BACK, RIGHT))  rotateZ =  Math.PI;
        else if (this.isOpenSides(FRONT, RIGHT)) rotateZ =  Math.PI / 2;
      }
      else if (!this.fromSide.equals(TOP) && this.toSide.equals(BOTTOM)) {
        if (this.nextBlock && this.nextBlock.toSide && this.nextBlock.toSide.equals(BOTTOM)) {
          if (hasCeil) {
            this._setType('verticalCurveStart_hole_low.stl');
          }
          else {
            this._setType('verticalCurveStart_low.stl');
          }
          if      (this.fromSide.equals(BACK))  rotateZ =  Math.PI;
          else if (this.fromSide.equals(LEFT))  rotateZ = -Math.PI / 2;
          else if (this.fromSide.equals(RIGHT)) rotateZ =  Math.PI / 2;
        }
      }
      else if (this.fromSide.equals(TOP) && !this.toSide.equals(BOTTOM)) {
        if (this.prevBlock.fromSide.equals(TOP)) {
          this._setType('verticalCurveEnd_hole_low.stl');
          if      (this.toSide.equals(BACK))  rotateZ =  Math.PI;
          else if (this.toSide.equals(LEFT))  rotateZ = -Math.PI / 2;
          else if (this.toSide.equals(RIGHT)) rotateZ =  Math.PI / 2;
        }
        else {
          if ((this.prevBlock.fromSide.equals(FRONT) && this.toSide.equals(BACK)) ||
              (this.prevBlock.fromSide.equals(BACK) && this.toSide.equals(FRONT)) ||
              (this.prevBlock.fromSide.equals(RIGHT) && this.toSide.equals(LEFT)) ||
              (this.prevBlock.fromSide.equals(LEFT) && this.toSide.equals(RIGHT))) {
            if (this.prevBlock.hasCeil(grid)) {
              this._setType('ramp_hole_low.stl');
            }
            else {
              this._setType('ramp_low.stl');
            }
            if      (this.toSide.equals(BACK))  rotateZ =  Math.PI;
            else if (this.toSide.equals(LEFT))  rotateZ = -Math.PI / 2;
            else if (this.toSide.equals(RIGHT)) rotateZ =  Math.PI / 2;
          }
          else if ((this.prevBlock.fromSide.equals(BACK) && this.toSide.equals(LEFT)) ||
              (this.prevBlock.fromSide.equals(FRONT) && this.toSide.equals(RIGHT)) ||
              (this.prevBlock.fromSide.equals(LEFT) && this.toSide.equals(FRONT)) ||
              (this.prevBlock.fromSide.equals(RIGHT) && this.toSide.equals(BACK))) {
            if (this.prevBlock.hasCeil(grid)) {
              this._setType('rampCorner1_hole_low.stl');
            }
            else {
              this._setType('rampCorner1_low.stl');
            }
            if      (this.prevBlock.fromSide.equals(BACK))  rotateZ = -Math.PI / 2;
            else if (this.prevBlock.fromSide.equals(FRONT)) rotateZ =  Math.PI / 2;
            else if (this.prevBlock.fromSide.equals(RIGHT)) rotateZ =  Math.PI;
          }
          else if ((this.prevBlock.fromSide.equals(BACK) && this.toSide.equals(RIGHT)) ||
              (this.prevBlock.fromSide.equals(FRONT) && this.toSide.equals(LEFT)) ||
              (this.prevBlock.fromSide.equals(LEFT) && this.toSide.equals(BACK)) ||
              (this.prevBlock.fromSide.equals(RIGHT) && this.toSide.equals(FRONT))) {
            if (this.prevBlock.hasCeil(grid)) {
              this._setType('rampCorner2_hole_low.stl');
            }
            else {
              this._setType('rampCorner2_low.stl');
            }
            if      (this.prevBlock.fromSide.equals(BACK))  rotateZ = -Math.PI / 2;
            else if (this.prevBlock.fromSide.equals(FRONT)) rotateZ =  Math.PI / 2;
            else if (this.prevBlock.fromSide.equals(RIGHT)) rotateZ =  Math.PI;
          }
        }
      }
      else if (this.isOpenSides(TOP, BOTTOM) && this.nextBlock && this.nextBlock.isOpenSides(TOP, BOTTOM)) {
        this._setType('verticalHole_low.stl');
      }
      if (!this.type) return null;

      let color = new THREE.Color(
        1.0, //this.position.x / this.settings.world.x,
        this.position.y / this.settings.world.y,
        0.2  //this.position.z / this.settings.world.z
      );
      let material = new THREE.MeshPhongMaterial({color: color, transparent:true, opacity:1.0});
      this.mesh = new THREE.Mesh(this.getGeometry(), material);
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.rotation.z = rotateZ;
      this.mesh.userData['block'] = this;
    }
    this.mesh.position.set(
      (this.position.x + 0.5) * this.settings.block.x,
      this.position.y * this.settings.block.y,
      (this.position.z + 0.5) * this.settings.block.z
    );
    return this.mesh;
  }

  convertToHole() {
    if (!this.mesh) throw 'invalid mesh';

    let holeType = toHole[this.type];
    if (holeType) {
      let oldGeometry = this.mesh.geometry;
      this._setType(holeType);
      this.mesh.geometry = this.getGeometry();
      oldGeometry.dispose();
    }
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

  removeNext() {
    if (this.mesh) {
      this.mesh.parent.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
      this.type = null;
    }
    this.nextBlock = null;
    this.toSide = null;
  }
}

class Track {
  constructor(x, y, z) {
    this.track = [];
  }

  add(block) {
    let lastBlock = this.track[this.track.length - 1];
    if (lastBlock) {
      lastBlock.nextBlock = block;
      block.prevBlock = lastBlock;

      let direction = block.position.clone().sub(lastBlock.position);
      lastBlock.toSide = direction;
      block.fromSide = direction.clone().negate();
    }
    this.track.push(block);
  }

  removeLast() {
    return this.track.pop();
  }

  peek(index=0) {
    if (this.track.length - 1 < index) {
      return null;
    }
    return this.track[this.track.length - 1 - index];
  }

  get length() {
    return this.track.length;
  }
}
