//@ts-check
/** @type {import('../api/src').AudioWorkletGlobalScope} */
// @ts-ignore
const audioWorkletGlobalScope = globalThis;
const { AudioWorkletProcessor, registerProcessor } = audioWorkletGlobalScope;

class OrbiterWamProcessor extends AudioWorkletProcessor {
	/** Configure AudioParams */
	static get parameterDescriptors() {
		return [
			{ name: 'freqX', defaultValue: 1.0, minValue: 0.1, maxValue: 10 },
			{ name: 'freqY', defaultValue: 1.0, minValue: 0.1, maxValue: 10 },
			{ name: 'ampX', defaultValue: 0.5, minValue: 0, maxValue: 1 },
			{ name: 'ampY', defaultValue: 0.5, minValue: 0, maxValue: 1 },
			{ name: 'centerValue', defaultValue: 0.5, minValue: 0, maxValue: 1 },
			{ name: 'positionX', defaultValue: 0.5, minValue: 0, maxValue: 1 },
			{ name: 'positionY', defaultValue: 0.5, minValue: 0, maxValue: 1 },
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

		// Setup message handling
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
		else if (data.type === 'setAvailableParams') {
			this.availableParams = data.params;
			this.log(`Available parameters updated: ${Object.keys(data.params).length} params`);
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

		// Ensure proxy is set
		if (!this.proxy) {
			return true;
		}

		// Get parameters
		const freqX = parameters.freqX[0];
		const freqY = parameters.freqY[0];
		const ampX = parameters.ampX[0];
		const ampY = parameters.ampY[0];
		const centerValue = parameters.centerValue[0];
		const positionX = parameters.positionX[0];
		const positionY = parameters.positionY[0];

		// Update time and phase
		const currentTime = audioWorkletGlobalScope.currentTime;
		const deltaTime = currentTime - this.lastTime;
		this.lastTime = currentTime;

		// Update phase based on time
		this.phase += deltaTime;
		if (this.phase >= 1000) this.phase = 0; // Prevent floating point issues over time

		// Skip processing if no target parameter is set
		if (!this.targetParam) return true;


		const sineX = Math.sin(2 * Math.PI * (this.phase * freqX + positionX)) * ampX;
		const sineY = Math.sin(2 * Math.PI * (this.phase * freqY + positionY)) * ampY;

		const modulationValue = sineX + sineY;

		this.port.postMessage({
			type: 'modulationValue',
			value: modulationValue
		});

		// Send automation event for the target parameter
		this.proxy.emitEvents({
			type: 'wam-automation',
			data: {
				id: this.targetParam,
				value: centerValue + modulationValue,
				normalized: true
			},
			time: currentTime
		});

		return true;
	}
}

registerProcessor('__WebAudioModule_OrbiterProcessor', OrbiterWamProcessor);