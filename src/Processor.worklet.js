//@ts-check
/** @type {import('../api/src').AudioWorkletGlobalScope} */
// @ts-ignore
const audioWorkletGlobalScope = globalThis;
const { AudioWorkletProcessor, registerProcessor } = audioWorkletGlobalScope;

class OrbiterWamProcessor extends AudioWorkletProcessor {
	/** Configure AudioParams */
	static get parameterDescriptors() {
		return [
			{ name: 'freqX', defaultValue: 2.0, minValue: 1, maxValue: 9},
			{ name: 'freqY', defaultValue: 4.0, minValue: 1, maxValue: 9},
			{ name: 'ampX', defaultValue: 0.8, minValue: 0, maxValue: 1 },
			{ name: 'ampY', defaultValue: 0.8, minValue: 0, maxValue: 1 },
			{ name: 'phase', defaultValue: 0, minValue: 0, maxValue: Math.PI * 2},
			{ name: 'centerValue', defaultValue: 0.5, minValue: 0, maxValue: 1 },
			{ name: 'destroyed', defaultValue: 0, minValue: 0, maxValue: 1 }
		];
	}

	constructor(options) {
		super();
		const { moduleId, instanceId } = options.processorOptions;
		this.moduleId = moduleId;
		this.instanceId = instanceId;
		this.phase = 0;
		this.lastTime = audioWorkletGlobalScope.currentTime;
		this.targetParam = null;
		this.canvasWidth = 400;
		this.canvasHeight = 400;

		this.port.onmessage = this.handleMessage.bind(this);
		this.log('OrbiterWamProcessor initialized');
	}

	log(message) {
		this.port.postMessage({ type: 'log', message });
	}

	handleMessage(event) {
		const { data } = event;

		if (data.type === 'setTarget') {
			this.targetParam = data.paramId;
			this.log(`Target parameter set to: ${this.targetParam}`);
		}
	}

	/** @type {import('../sdk-parammgr/src').ParamMgrProcessor} */
	get proxy() {
		const { webAudioModules } = audioWorkletGlobalScope;
		return webAudioModules.getModuleScope(this.moduleId)?.paramMgrProcessors?.[this.instanceId];
	}

	/**
	 * Main process
	 *
	 * @param {Float32Array[][]} inputs
	 * @param {Float32Array[][]} outputs
	 * @param {Record<string, Float32Array>} parameters
	 */
	process(inputs, outputs, parameters) {
		const destroyed = parameters.destroyed[0];
		if (destroyed) return false;

		const freqX = parameters.freqX?.length > 1 ? parameters.freqX[0] : (parameters.freqX?.[0] ?? 2.0);
		const freqY = parameters.freqY?.length > 1 ? parameters.freqY[0] : (parameters.freqY?.[0] ?? 4.0);
		const ampX = parameters.ampX?.length > 1 ? parameters.ampX[0] : (parameters.ampX?.[0] ?? 0.8);
		const ampY = parameters.ampY?.length > 1 ? parameters.ampY[0] : (parameters.ampY?.[0] ?? 0.8);
		const phase = parameters.phase?.length > 1 ? parameters.phase[0] : (parameters.phase?.[0] ?? 0);
		const centerValue = parameters.centerValue?.length > 1 ? parameters.centerValue[0] : (parameters.centerValue?.[0] ?? 0.5);

		const currentTime = audioWorkletGlobalScope.currentTime;
		const deltaTime = currentTime - this.lastTime;
		this.lastTime = currentTime;

		this.phase += deltaTime;

		const t = this.phase;

		const centerX = this.canvasWidth / 2;
		const centerY = this.canvasHeight / 2;

		const x = Math.sin(freqX * t + phase);
		const y = Math.sin(freqY * t);

		const dotX = centerX + ampX * centerX * x;
		const dotY = centerY + ampY * centerY * y;

		this.port.postMessage({
			type: 'dotPosition',
			x: dotX,
			y: dotY
		});

		const modulationValue = ampX * Math.sin(freqX * t + phase);

		if (this.targetParam) {
			this.proxy.emitEvents({
				type: 'wam-automation',
				data: {
					id: this.targetParam,
					value: centerValue + modulationValue * 0.5,
					normalized: true
				},
				time: currentTime
			});
		}

		return true;
	}
}

registerProcessor('__WebAudioModule_OrbiterProcessor', OrbiterWamProcessor);