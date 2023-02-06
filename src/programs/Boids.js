class BoidsProgram extends GPUIO.GPUProgram {
  constructor (
    composer,
    sizeCbrt,
    worldScalingFactor,
    senseRadius,
  ) {
    super(composer, {
      name: 'boidsProgram',
      uniforms: [{
        name: 'u_velocities',
        value: 0,
        type: GPUIO.INT,
      }, {
        name: 'u_positions',
        value: 1,
        type: GPUIO.INT,
      }, {
        name: 'u_size',
        value: [sizeCbrt, sizeCbrt, sizeCbrt],
        type: GPUIO.FLOAT,
      }, {
        name: 'u_worldScalingFactor',
        value: worldScalingFactor.toArray(),
        type: GPUIO.FLOAT,
      }, {
        name: 'u_alignmentForceFactor',
        value: 0.1,
        type: GPUIO.FLOAT,
      }, {
        name: 'u_alignmentRadius',
        value: senseRadius * 0.4,
        type: GPUIO.FLOAT,
      }, {
        name: 'u_cohesionForceFactor',
        value: 0.000017,
        type: GPUIO.FLOAT,
      }, {
        name: 'u_cohesionRadius',
        value: senseRadius * 1,
        type: GPUIO.FLOAT,
      }, {
        name: 'u_separationForceFactor',
        value: 0.05,
        type: GPUIO.FLOAT,
      }, {
        name: 'u_separationRadius',
        value: senseRadius * 0.85,
        type: GPUIO.FLOAT,
      }, {
        name: 'u_velocityDamping',
        value: 0.98,
        type: GPUIO.FLOAT,
      }, {
        name: 'u_windForceFactor',
        value: 0.00015,
        type: GPUIO.FLOAT,
      }, {
        name: 'u_time',
        value: 0,
        type: GPUIO.FLOAT,
      }],
      fragmentShader: `
        in vec2 v_uv;

        uniform sampler2D u_velocities;
        uniform sampler2D u_positions;
        uniform vec3 u_size;
        uniform vec3 u_worldScalingFactor;
        uniform float u_alignmentForceFactor;
        uniform float u_alignmentRadius;
        uniform float u_cohesionForceFactor;
        uniform float u_cohesionRadius;
        uniform float u_separationForceFactor;
        uniform float u_separationRadius;
        uniform float u_velocityDamping;
        uniform float u_time;
        uniform float u_windForceFactor;

        out vec4 out_result;

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

        vec3 toWorldSpace (vec3 pos) {
          return pos * u_worldScalingFactor.x;
        }

        vec3 limitVelocity (vec3 vel, float maxSpeed) {
          float speed = min(length(vel), maxSpeed);
          return vel * (speed / length(vel));
        }

        ${noise2D}

        vec3 windForce (vec3 pos) {
          float angle = snoise((pos.xz + vec2(sin(u_time * 0.01))) * 0.005) * 3.1457 * 2.0;
          return vec3(
            cos(angle),
            0.0, // sin(angle),
            sin(angle)
          ) * u_windForceFactor;
        }

        vec4 applyRules (
          vec3 cubeIndex,
          vec3 cubeSize
        ) {
          vec2 selfUv = cubeToUv(cubeIndex, cubeSize);
          vec3 selfPos = toWorldSpace(texture(u_positions, selfUv).xyz);
          vec4 selfVel = texture(u_velocities, selfUv);
          selfVel.xyz *= u_velocityDamping;
          vec3 perceivedCenter = vec3(0.0, 0.0, 0.0);
          vec3 separationSum = vec3(0.0, 0.0, 0.0);
          vec3 perceivedDirection = vec3(0.0, 0.0, 0.0);
          int cohesionNeighborCount = 0;
          int separationNeighborCount = 0;
          int alignmentNeighborCount = 0;
          float radius = 4.0;
          for (float z = -radius; z <= radius; z++) {
            for (float y = -radius; y <= radius; y++) {
              for (float x = -radius; x <= radius; x++) {
                vec3 cubePos = (cubeIndex * cubeSize + vec3(x, y, z));
                if (cubePos.x < 0.0 || cubePos.y < 0.0 || cubePos.z < 0.0 || cubePos.x > cubeSize.x || cubePos.y > cubeSize.y || cubePos.z > cubeSize.z) {
                  continue;
                }
                vec2 uv = cubeToUv(cubePos / cubeSize, cubeSize);
                vec3 neighborPos = toWorldSpace(texture(u_positions, uv).xyz);
                vec4 neighborVel = texture(u_velocities, uv);
                // logic goes here
                float gap = length(neighborPos - selfPos);
                if (gap < 0.0002) {
                  continue;
                }
                if (gap > 0.0) {
                  if (gap < u_cohesionRadius) {
                    cohesionNeighborCount += 1;
                    perceivedCenter += neighborPos;
                  }
                  if (gap < u_alignmentRadius) {
                    alignmentNeighborCount += 1;
                    perceivedDirection += neighborVel.xyz;
                  }
                  if (gap < u_separationRadius) {
                    separationNeighborCount += 1;
                    separationSum += normalize(selfPos - neighborPos) / gap;
                  }
                }
              }
            }
          }
          vec3 cohesion = vec3(0.0, 0.0, 0.0);
          vec3 separation = vec3(0.0, 0.0, 0.0);
          vec3 alignment = vec3(0.0, 0.0, 0.0);
          if (cohesionNeighborCount > 0) {
            cohesion = ((perceivedCenter / float(cohesionNeighborCount)) - selfPos) * u_cohesionForceFactor;
          }
          if (separationNeighborCount > 0) {
            separation = ((separationSum / float(separationNeighborCount)) * u_separationForceFactor);
          }
          if (alignmentNeighborCount > 0) {
            alignment = (((perceivedDirection / float(alignmentNeighborCount)) - selfVel.xyz) * u_alignmentForceFactor);
          }
          selfVel.xyz += separation;
          selfVel.xyz += alignment;
          selfVel.xyz += cohesion;
          selfVel.xyz += windForce(selfPos);
          selfVel.xyz = limitVelocity(selfVel.xyz, 0.01);
          return selfVel;
        }

        void main () {
          vec3 cubeCoord = uvToCube(v_uv, u_size);
          vec2 uv = cubeToUv(cubeCoord, u_size);
          out_result = applyRules(cubeCoord, u_size);
        }
      `,
    })
  }
}
