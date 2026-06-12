// Canvas Upscaling Plugin

interface MiscUpscalerOptions {
  useEdgeDetection?: boolean;
  scaleFactor?: number;
}

class MiscUpscaler {
    options: Required<MiscUpscalerOptions>;
    gl: WebGL2RenderingContext | null;
    program: WebGLProgram | null;
    frameBuffer: WebGLFramebuffer | null;
    texture: WebGLTexture | null;
    outputTexture: WebGLTexture | null;
    inputCanvas!: HTMLCanvasElement;
    outputCanvas!: HTMLCanvasElement;
    positionBuffer!: WebGLBuffer;
    texCoordBuffer!: WebGLBuffer;
    positionLocation!: number;
    texCoordLocation!: number;
    resolutionLocation!: WebGLUniformLocation | null;
    textureLocation!: WebGLUniformLocation | null;

    constructor(options: MiscUpscalerOptions = {}) {
        // Plugin Settings
        this.options = Object.assign({
            useEdgeDetection: true,  // Edge Detection
            scaleFactor: 2.0,        // Upscaling Value
        }, options);
        
        this.gl = null;
        this.program = null;
        this.frameBuffer = null;
        this.texture = null;
        this.outputTexture = null;
    }

    init(inputCanvas: HTMLCanvasElement, outputCanvas: HTMLCanvasElement): boolean {
        this.inputCanvas = inputCanvas;
        this.outputCanvas = outputCanvas;
        
        // Set output canvas size based on scale factor
        this.outputCanvas.width = this.inputCanvas.width * this.options.scaleFactor;
        this.outputCanvas.height = this.inputCanvas.height * this.options.scaleFactor;
        
        // Initialize WebGL context
        this.gl = this.outputCanvas.getContext('webgl2');
        if (!this.gl) {
            console.error('WebGL not supported');
            return false;
        }
        
        // Initialize shaders and buffers
        this.initShaders();
        this.initBuffers();
        this.initTextures();
        
        return true;
    }
    
    initShaders() {
        const gl = this.gl!;
        // Vertex shader
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 vUv;
            void main() {
                vUv = a_texCoord;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;
        
        // Fragment shader
        const fragmentShaderSource = `
            precision mediump float;
            uniform sampler2D tDiffuse;
            uniform vec2 resolution;
            varying vec2 vUv;

            void main() {
                vec2 texelSize = 1.0 / resolution;

                // Get Neighbor Pixels
                vec4 color = texture2D(tDiffuse, vUv);
                vec4 colorUp = texture2D(tDiffuse, vUv + vec2(0.0, texelSize.y));
                vec4 colorDown = texture2D(tDiffuse, vUv - vec2(0.0, texelSize.y));
                vec4 colorLeft = texture2D(tDiffuse, vUv - vec2(texelSize.x, 0.0));
                vec4 colorRight = texture2D(tDiffuse, vUv + vec2(texelSize.x, 0.0));

                // Work with edges
                float edgeStrength = 1.0 - smoothstep(0.1, 0.3, length(color.rgb - colorUp.rgb));
                edgeStrength += 1.0 - smoothstep(0.1, 0.3, length(color.rgb - colorDown.rgb));
                edgeStrength += 1.0 - smoothstep(0.1, 0.3, length(color.rgb - colorLeft.rgb));
                edgeStrength += 1.0 - smoothstep(0.1, 0.3, length(color.rgb - colorRight.rgb));
                edgeStrength = clamp(edgeStrength, 0.0, 1.0);

                // Applying edges incresing and filtering
                vec3 enhancedColor = mix(color.rgb, vec3(1.0) - (1.0 - color.rgb) * edgeStrength, 0.5);

                gl_FragColor = vec4(enhancedColor, color.a);
            }
        `;
        
        // Create shader program
        const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
        this.program = this.createProgram(vertexShader, fragmentShader);

        // Get attribute and uniform locations
        this.positionLocation = gl.getAttribLocation(this.program!, 'a_position');
        this.texCoordLocation = gl.getAttribLocation(this.program!, 'a_texCoord');
        this.resolutionLocation = gl.getUniformLocation(this.program!, 'resolution');
        this.textureLocation = gl.getUniformLocation(this.program!, 'tDiffuse');
    }

    createShader(type: number, source: string): WebGLShader | null {
        const gl = this.gl!;
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    createProgram(vertexShader: WebGLShader | null, fragmentShader: WebGLShader | null): WebGLProgram | null {
        const gl = this.gl!;
        const program = gl.createProgram()!;
        gl.attachShader(program, vertexShader!);
        gl.attachShader(program, fragmentShader!);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    initBuffers() {
        const gl = this.gl!;
        // Create a buffer for positions
        this.positionBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);

        // Full screen quad (2 triangles)
        const positions = [
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        // Create a buffer for texture coordinates
        this.texCoordBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);

        // Texture coordinates for the quad with Y-flipped to match canvas coordinates
        const texCoords = [
            0, 1,  // top-left (flipped from 0,0)
            1, 1,  // top-right (flipped from 1,0)
            0, 0,  // bottom-left (flipped from 0,1)
            0, 0,  // bottom-left (flipped from 0,1)
            1, 1,  // top-right (flipped from 1,0)
            1, 0   // bottom-right (flipped from 1,1)
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    }

    initTextures() {
        const gl = this.gl!;
        // Create texture for input canvas
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        // Set parameters for texture
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }

    render() {
        if (!this.gl) return;
        const gl = this.gl;

        // Update texture from input canvas
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.inputCanvas);

        // Set viewport and clear
        gl.viewport(0, 0, this.outputCanvas.width, this.outputCanvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Use shader program
        gl.useProgram(this.program);

        // Set uniforms
        gl.uniform2f(this.resolutionLocation, this.inputCanvas.width, this.inputCanvas.height);
        gl.uniform1i(this.textureLocation, 0);

        // Set position attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.positionLocation);
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Set texture coordinate attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.enableVertexAttribArray(this.texCoordLocation);
        gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    resize() {
        if (this.inputCanvas && this.outputCanvas) {
            this.outputCanvas.width = this.inputCanvas.width * this.options.scaleFactor;
            this.outputCanvas.height = this.inputCanvas.height * this.options.scaleFactor;
        }
    }
}

export { MiscUpscaler as UpscalerPlugin };