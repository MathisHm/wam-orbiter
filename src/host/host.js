import ModulationTargetExtension from '../../wam-extension/ModulationTargetExtension.js';

/** @type {HTMLDivElement} */
const mount = document.querySelector('#mount');
// Safari...
/** @type {typeof AudioContext} */
const AudioContext = window.AudioContext || window.webkitAudioContext;

const audioContext = new AudioContext();
window.audioContext = audioContext;

const initExtensions = async () => {
	window.WAMExtensions = window.WAMExtensions || {};
	window.WAMExtensions.modulation = new ModulationTargetExtension();
};

(async () => {
	await initExtensions();

	const { default: apiVersion } = await import("../../api/src/version.js");
	const { default: addFunctionModule } = await import("../../sdk/src/addFunctionModule.js");
	const { default: initializeWamEnv } = await import("../../sdk/src/WamEnv.js");
	await addFunctionModule(audioContext.audioWorklet, initializeWamEnv, apiVersion); 

	const { default: initializeWamGroup } = await import("../../sdk/src/WamGroup.js");
	const hostGroupId = 'test-host';
	const hostGroupKey = performance.now().toString();
	await addFunctionModule(audioContext.audioWorklet, initializeWamGroup, hostGroupId, hostGroupKey);

	const { default: wamSynth } = await import('https://wam-4tt.pages.dev/Pro54/index.js');
	const synthInstance = await wamSynth.createInstance(hostGroupId, audioContext);

	const { default: wamOrbiter } = await import('/src/index.js');
	const orbiterInstance = await wamOrbiter.createInstance(hostGroupId, audioContext);

	window.synth = synthInstance;
	window.orbiter = orbiterInstance;

	synthInstance.audioNode.connect(audioContext.destination);
	orbiterInstance.audioNode.connect(audioContext.destination);

	// Register synth as modulation target
	const synthParams = await synthInstance.audioNode.getParameterInfo();
	window.WAMExtensions.modulation.setModulationTargetDelegate(
		synthInstance.instanceId,
		{
			async connectModulation() {
				return synthParams;
			},

		}
	);

	// Connect modulator to synth as target
	await orbiterInstance.audioNode.connectEvents(synthInstance.instanceId);



	const synthDomNode = await synthInstance.createGui();
	const orbiterDomNode = await orbiterInstance.createGui();

	mount.appendChild(synthDomNode);
	mount.appendChild(orbiterDomNode);
	
	mount.onclick = () => audioContext.resume();
})();
