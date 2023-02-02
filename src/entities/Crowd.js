class Crowd extends THREE.Group {
  constructor ( // TODO extract some things
    crowdCountCbrt,
    stageSize,
    composer,
  ) {
    const senseRadius = 120
    super()
    const geometry = new CrowdGeometry(
      crowdCountCbrt,
      stageSize,
    )
    const material = new CrowdMaterial(
      crowdCountCbrt,
      stageSize,
    )
    this.mesh = new THREE.Mesh(geometry, material)
    this.add(this.mesh)
    const positionTexture = new THREE.Texture()
    const velocityTexture = new THREE.Texture()
    const width = crowdCountCbrt
    const height = crowdCountCbrt
    const depth = crowdCountCbrt
    const positions = new Float32Array(width * height * depth * 4)
    const velocities = new Float32Array(width * height * depth * 4)
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x + (z * height * width)) * 4
          positions[index + 0] = x / width // random()
          positions[index + 1] = y / height // random()
          positions[index + 2] = z / depth // random()
          positions[index + 3] = x / width
          const vel = (new THREE.Vector3(
            0, // random() * 2 - 1,
            0, // random() * 2 - 1,
            0, // random() * 2 - 1,
          )).normalize().multiplyScalar(0.01)
          velocities[index + 0] = vel.x
          velocities[index + 1] = vel.y
          velocities[index + 2] = vel.z
          velocities[index + 3] = z / depth
        }
      }
    }
    const vCubeSize = new THREE.Vector3(crowdCountCbrt, crowdCountCbrt, crowdCountCbrt)
    const vStageSize = new THREE.Vector3(stageSize, stageSize, stageSize)
    const worldScalingFactor = new THREE.Vector3(1, 1, 1)
      .multiply(vCubeSize)
      .multiply(vStageSize)
      .sub(vCubeSize.clone().multiply(vStageSize).divideScalar(2.0))
      .multiplyScalar(2)
    this.positionLayer = new GPUIO.GPULayer(composer, {
      name: 'positionLayer',
      dimensions: [crowdCountCbrt, crowdCountCbrt ** 2],
      numComponents: 4,
      type: GPUIO.FLOAT,
      filter: GPUIO.NEAREST,
      numBuffers: 2,
      wrapX: GPUIO.CLAMP_TO_EDGE,
      wrapY: GPUIO.CLAMP_TO_EDGE,
      array: positions,
    })
    this.velocityLayer = new GPUIO.GPULayer(composer, {
      name: 'velocityLayer',
      dimensions: [crowdCountCbrt, crowdCountCbrt ** 2],
      numComponents: 4,
      type: GPUIO.FLOAT,
      filter: GPUIO.NEAREST,
      numBuffers: 2,
      wrapX: GPUIO.CLAMP_TO_EDGE,
      wrapY: GPUIO.CLAMP_TO_EDGE,
      array: velocities,
    })
    this.renderPositionLayer = new GPUIO.GPULayer(composer, {
      name: 'renderPositionLayer',
      dimensions: [crowdCountCbrt, crowdCountCbrt ** 2],
      type: GPUIO.FLOAT,
      numComponents: 4,
      filter: GPUIO.NEAREST,
    })
    this.renderPositionLayer.attachToThreeTexture(positionTexture)
    this.renderVelocityLayer = new GPUIO.GPULayer(composer, {
      name: 'renderVelocityLayer',
      dimensions: [crowdCountCbrt, crowdCountCbrt ** 2],
      type: GPUIO.FLOAT,
      numComponents: 4,
      filter: GPUIO.NEAREST,
    })
    this.renderVelocityLayer.attachToThreeTexture(velocityTexture)
    this.sortProgram = new SortProgram(
      composer,
      crowdCountCbrt,
    )
    this.verletIntegrationProgram = new VerletIntegrationProgram(
      composer,
    )
    this.behaviorProgram = new BoidsProgram(
      composer,
      crowdCountCbrt,
      worldScalingFactor,
      senseRadius,
    )
    this.renderProgram = GPUIO.copyProgram(composer, {
      name: 'copyPosition',
      type: GPUIO.FLOAT,
      component: 'xyzw',
    })
    this.composer = composer
    this.mesh.frustumCulled = true
    this.mesh.material.uniforms.u_positionTexture.value = positionTexture
    this.mesh.material.uniforms.u_velocityTexture.value = velocityTexture
    for (let i = 0; i < 6 * 32; i++) {
      this.sortProgram.setUniform('u_iteration', (this.sortProgram._uniforms.u_iteration.value + 1) % 6)
      this.composer.step({
        program: this.sortProgram,
        input: [this.velocityLayer, this.positionLayer],
        output: this.velocityLayer,
      })
      this.composer.step({
        program: this.sortProgram,
        input: [this.positionLayer, this.positionLayer],
        output: this.positionLayer,
      })
    }
  }

  step (time) {
    this.composer.step({
      program: this.verletIntegrationProgram,
      input: [this.positionLayer, this.velocityLayer],
      output: this.positionLayer,
    })
    for (let i = 0; i < 6; i++) {
      this.sortProgram.setUniform('u_iteration', (this.sortProgram._uniforms.u_iteration.value + 1) % 6)
      this.composer.step({
        program: this.sortProgram,
        input: [this.velocityLayer, this.positionLayer],
        output: this.velocityLayer,
      })
      this.composer.step({
        program: this.sortProgram,
        input: [this.positionLayer, this.positionLayer],
        output: this.positionLayer,
      })
    }
    this.behaviorProgram.setUniform('u_time', time)
    this.composer.step({
      program: this.behaviorProgram,
      input :[this.velocityLayer, this.positionLayer],
      output: this.velocityLayer,
    })
    this.composer.step({
      program: this.renderProgram,
      input: this.positionLayer,
      output: this.renderPositionLayer,
    })
    this.composer.step({
      program: this.renderProgram,
      input: this.velocityLayer,
      output: this.renderVelocityLayer,
    })
  }
}

class CrowdMaterial extends BAS.PhongAnimationMaterial {
  constructor (
    sizeCbrt,
    stageSize,
  ) {
    super({
      flatShading: true,
      side: THREE.FrontSide,
      uniforms: {
        u_time: { value: 0 },
        u_positionTexture: { value: null },
        u_velocityTexture: { value: null },
        u_cubeSize: { value: [sizeCbrt, sizeCbrt, sizeCbrt,] },
        u_stageSize: { value: stageSize },
      },
      varyingParameters: [`
        varying vec3 v_textureCoord;
        varying vec2 v_uv;
      `],
      vertexFunctions: [`
      `],
      vertexParameters: [`
        uniform float u_time;
        uniform sampler2D u_positionTexture;
        uniform vec3 u_cubeSize;
        uniform float u_stageSize;
        attribute vec3 a_position;
        attribute vec3 a_textureCoord;
      `],
      vertexFunctions: [`
        vec3 uvToCube (vec2 uv, vec3 cubeSize) {
          return vec3(
            uv.x,
            mod(uv.y, 1.0 / cubeSize.y) * cubeSize.y,
            floor(uv.y / (1.0 / cubeSize.y)) / cubeSize.z
          );
        }

        vec2 cubeToUv (vec3 cubeCoord, vec3 cubeSize) {
          return vec2(
            cubeCoord.x,
            cubeCoord.z + cubeCoord.y / cubeSize.z
          );
        }
      `],
      vertexInit: [`
      `],
      vertexNormal: [`
      `],
      vertexPosition: [`
        vec2 uv = cubeToUv(a_textureCoord, u_cubeSize);
        transformed += (texture2D(u_positionTexture, uv).xyz * u_cubeSize) * u_stageSize - (u_cubeSize * u_stageSize) / 2.0;
      `],
      vertexColor: [`
        v_textureCoord = a_textureCoord;
        v_uv = uv;
      `],
      fragmentParameters: [`
        uniform sampler2D u_positionTexture;
        uniform sampler2D u_velocityTexture;
        uniform vec3 u_cubeSize;
      `],
      fragmentFunctions: [`
        vec3 uvToCube (vec2 uv, vec3 cubeSize) {
          return vec3(
            uv.x,
            mod(uv.y, 1.0 / cubeSize.y) * cubeSize.y,
            floor(uv.y / (1.0 / cubeSize.y)) / cubeSize.z
          );
        }

        vec2 cubeToUv (vec3 cubeCoord, vec3 cubeSize) {
          return vec2(
            cubeCoord.x,
            cubeCoord.z + cubeCoord.y / cubeSize.z
          );
        }
      `],
      fragmentDiffuse: [`
        vec2 uv = cubeToUv(v_textureCoord, u_cubeSize);
        vec3 color = vec3(
          texture2D(u_positionTexture, uv).w,
          texture2D(u_velocityTexture, uv).w,
          0.0 // length(texture2D(u_velocityTexture, uv).xyz) * 1000.0
        );
        diffuseColor.rgb = color;
      `],
    })
  }
}

class CrowdGeometry extends BAS.PrefabBufferGeometry {
  constructor (
    countCbrt,
    stageSize,
  ) {
    const size = 6
    const baseGeometry = new THREE.BoxGeometry(size, size, size, 1)
    super(baseGeometry, countCbrt ** 3)
    this.bufferUvs()
    const aTextureCoord = this.createAttribute('a_textureCoord', 3)
    const aPosition = this.createAttribute('a_position', 3)
    for (let z = 0; z < countCbrt; z++) {
      for (let y = 0; y < countCbrt; y++) {
        for (let x = 0; x < countCbrt; x++) {
          const i = x + countCbrt * y + z * countCbrt * countCbrt
          this.setPrefabData(aTextureCoord, i, [
            x / countCbrt,
            y / countCbrt,
            z / countCbrt,
          ])
          this.setPrefabData(aPosition, i, [
            x * stageSize - (countCbrt * stageSize) / 2,
            y * stageSize - (countCbrt * stageSize) / 2,
            z * stageSize - (countCbrt * stageSize) / 2,
          ])
        }
      }
    }
  }
}
