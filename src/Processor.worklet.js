//@ts-check
/** @type {import('../api/src').AudioWorkletGlobalScope} */
// @ts-ignore
const audioWorkletGlobalScope = globalThis;
const { AudioWorkletProcessor, registerProcessor } = audioWorkletGlobalScope;

function map(value, istart, istop, ostart, ostop) {
  return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
}

class OrbiterWamProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'freqX', defaultValue: 2.0, minValue: 1, maxValue: 9 },
      { name: 'freqY', defaultValue: 4.0, minValue: 1, maxValue: 9 },
      { name: 'ampX', defaultValue: 0.8, minValue: 0, maxValue: 1 },
      { name: 'ampY', defaultValue: 0.8, minValue: 0, maxValue: 1 },
      { name: 'phase', defaultValue: 0, minValue: 0, maxValue: Math.PI * 2 },
    ];
  }

  constructor(options) {
    super();
    const { moduleId, instanceId } = options.processorOptions;
    this.moduleId = moduleId;
    this.instanceId = instanceId;
    this.t = 0;
    this.lastTime = audioWorkletGlobalScope.currentTime;

    this.targetParams = {
      TopLeft: null,
      TopRight: null,
      BottomLeft: null,
      BottomRight: null
    };

    this.canvasWidth = 400;
    this.canvasHeight = 400;
    this.port.onmessage = this.handleMessage.bind(this);
  }

  log(message) {
    this.port.postMessage({ type: 'log', message });
  }

  handleMessage(event) {
    const { data } = event;
    if (data.type === 'setTarget') {
      const { corner, paramId } = data;
      this.targetParams[corner] = paramId;
    }
  }

  get proxy() {
    const { webAudioModules } = audioWorkletGlobalScope;
    return webAudioModules.getModuleScope(this.moduleId)?.paramMgrProcessors?.[this.instanceId];
  }

  calculateCornerModulations(normX, normY) {
    return {
      TopLeft: ((1 - normX) + (1 - normY)) / 2,
      TopRight: (normX + (1 - normY)) / 2,
      BottomLeft: ((1 - normX) + normY) / 2,
      BottomRight: (normX + normY) / 2
    };
  }

  process(inputs, outputs, parameters) {
    const freqX = parameters.freqX[0];
    const freqY = parameters.freqY[0];
    const ampX = parameters.ampX[0];
    const ampY = parameters.ampY[0];
    const phase = parameters.phase[0];

    const currentTime = audioWorkletGlobalScope.currentTime;
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.t += deltaTime;

    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;

    const x = Math.sin(freqX * this.t + phase);
    const y = Math.sin(freqY * this.t);

    const dotX = centerX + ampX * centerX * x;
    const dotY = centerY + ampY * centerY * y;

    this.port.postMessage({
      type: 'dotPosition',
      x: dotX,
      y: dotY
    });

    const normX = dotX / this.canvasWidth;
    const normY = dotY / this.canvasHeight;

    const modulations = this.calculateCornerModulations(normX, normY);

    for (const [corner, targetParam] of Object.entries(this.targetParams)) {
      if (targetParam) {
        this.proxy.emitEvents({
          type: 'wam-automation',
          data: {
            id: targetParam,
            value: modulations[corner],
            normalized: true
          },
          time: currentTime
        });
      }
    }

    return true;
  }
}

registerProcessor('__WebAudioModule_OrbiterProcessor', OrbiterWamProcessor);
