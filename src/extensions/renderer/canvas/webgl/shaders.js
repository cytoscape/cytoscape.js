
function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  console.log(gl.getShaderInfoLog(shader));
  return shader;
}

function createProgram(gl, vertexSource, fragementSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragementSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Could not initialize shaders');
  }
  return program;
}

export function createNodeShaderProgram(gl) {
  const vertexShaderSource = `#version 300 es
    precision highp float;

    uniform mat4 uMatrix;

    in vec3 aVertexPosition;
    // in vec3 aVertexColor;
    in vec2 aTexCoord;

    // out vec4 vVertexColor;
    out vec2 vTexCoord;

    void main(void) {
      // vVertexColor = vec4(aVertexColor, 1.0);
      vTexCoord = aTexCoord;
      gl_Position = uMatrix * vec4(aVertexPosition, 1.0);
    }
  `;

  const fragmentShaderSource = `#version 300 es
    precision highp float;

    uniform sampler2D uEleTexture;
    // uniform sampler2D uLabelTexture;

    // in vec4 vVertexColor;
    in vec2 vTexCoord;

    out vec4 outColor;

    void main(void) {
      // outColor = vVertexColor;
      vec4 bodyColor = texture(uEleTexture, vTexCoord);
      // vec4 bottomColor = texture(uEleTexture, vTexCoord);
      // vec4 topColor = texture(uLabelTexture, vTexCoord);
      // outColor = mix(bottomColor, topColor, topColor.a);
      outColor = bodyColor;
    }
  `;

  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  program.uMatrix = gl.getUniformLocation(program, 'uMatrix');
  program.uEleTexture = gl.getUniformLocation(program, 'uEleTexture');
  // program.uLabelTexture = gl.getUniformLocation(program, 'uLabelTexture');
  // program.layerUniforms = [ program.uEleTexture, program.uLabelTexture ];

  program.aVertexPosition = gl.getAttribLocation(program,  'aVertexPosition');
  // program.aVertexColor = gl.getAttribLocation(program,  'aVertexColor');
  program.aTexCoord = gl.getAttribLocation(program, 'aTexCoord');

  return program;
}


export function createEdgeShaderProgram(gl) {
  const vertexShaderSource = `#version 300 es
    precision highp float;

    uniform mat3 uMatrix;

    in vec2 aVertexPosition;
    // in vec3 aVertexColor;

    out vec4 vVertexColor;

    void main(void) {
      // vVertexColor = vec4(aVertexColor, 1.0);
      vVertexColor = vec4(0.0, 1.0, 0.0, 1.0);
      gl_Position  = vec4(uMatrix * vec3(aVertexPosition, 1.0), 1.0);
    }
  `;

  const fragmentShaderSource = `#version 300 es
    precision highp float;

    in vec4 vVertexColor;
    out vec4 fragColor;

    void main(void) {
      fragColor = vVertexColor;
    }
  `;

  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  program.aVertexPosition = gl.getAttribLocation(program,  'aVertexPosition');
  // program.aVertexColor = gl.getAttribLocation(program,  'aVertexColor');
  program.uMatrix = gl.getUniformLocation(program, 'uMatrix');

  return program;
}
