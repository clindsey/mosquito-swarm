class SortProgram extends GPUIO.GPUProgram {
  constructor (
    composer,
    sizeCbrt,
  ) {
    super(composer, {
      name: 'sortProgram',
      uniforms: [{
        name: 'u_state', // this is the texture that will get updated
        value: 0,
        type: GPUIO.INT,
      }, {
        name: 'u_positions', // this is the texture the sorting alg will use
        value: 1,
        type: GPUIO.INT,
      }, {
        name: 'u_resolution',
        value: [sizeCbrt, sizeCbrt ** 2],
        type: GPUIO.FLOAT,
      }, {
        name: 'u_iteration',
        value: 0,
        type: GPUIO.FLOAT,
      }],
      fragmentShader: `
        in vec2 v_uv;

        uniform sampler2D u_positions;
        uniform sampler2D u_state;
        uniform vec2 u_resolution;
        uniform float u_iteration;

        out vec4 out_result;

        bool applyRules (bool checkPrevious, vec3 current, vec3 reference) {
          if (checkPrevious) {
            if (current.x > reference.x) {
              return true;
            }
            if (current.x == reference.x && current.y > reference.y) {
              return true;
            }
            if (current.x == reference.x && current.y < reference.y && current.z > reference.z) {
              return true;
            }
          } else {
            if (current.x < reference.x) {
              return true;
            }
            if (current.x == reference.x && current.y < reference.y) {
              return true;
            }
            if (current.x == reference.x && current.y > reference.y && current.z < reference.z) {
              return true;
            }
          }
          return false;
        }

        void main () {
          int directionPhase = int(mod(floor(u_iteration / 2.0), 3.0));
          vec2 coord = gl_FragCoord.xy;
          vec2 uv = coord / u_resolution;
          vec4 currentValue = texture(u_state, uv);
          vec4 currentPosition = texture(u_positions, uv);
          float phaseCheck = coord.x;
          vec2 pixelOffset = vec2(-1.0, 0.0); // left
          if (directionPhase == 1) {
            phaseCheck = mod(coord.y, u_resolution.x);
            pixelOffset = vec2(0.0, -1.0); // down
          }
          if (directionPhase == 2) {
            phaseCheck = floor(coord.y / u_resolution.x);
            pixelOffset = vec2(0.0, -u_resolution.x); // out
          }
          bool checkPrevious = mod(phaseCheck + u_iteration, 2.0) < 1.0;
          vec2 pixel = pixelOffset / u_resolution.xy;
          vec2 refUvCoord = checkPrevious ? uv - pixel : uv + pixel;
          vec4 referencePosition = texture(u_positions, refUvCoord);
          vec4 referenceValue = texture(u_state, refUvCoord);
          vec2 refCoord = checkPrevious ? coord - pixelOffset : coord + pixelOffset;
          int currentPage = int(floor(coord.y / u_resolution.x));
          int referencePage = int(floor(refCoord.y / u_resolution.x));
          vec4 outputColor = currentValue;
          bool keepsCubeIsolated = referencePage >= 0 && referencePage < int(u_resolution.x);
          bool keepsPageIsolated = currentPage == referencePage;
          if ((directionPhase == 2 || keepsPageIsolated) && keepsCubeIsolated) {
            if (directionPhase == 0 && applyRules(checkPrevious, currentPosition.xyz, referencePosition.xyz)) {
              outputColor = referenceValue;
            }
            if (directionPhase == 1 && applyRules(checkPrevious, currentPosition.yzx, referencePosition.yzx)) {
              outputColor = referenceValue;
            }
            if (directionPhase == 2 && applyRules(checkPrevious, currentPosition.zxy, referencePosition.zxy)) {
              outputColor = referenceValue;
            }
          }
          out_result = outputColor;
          return;
        }
      `,
    })
  }
}
