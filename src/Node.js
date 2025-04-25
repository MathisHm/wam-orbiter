import CompositeAudioNode from '../../sdk-parammgr/src/CompositeAudioNode.js';
import ParamMgrFactory from '../../sdk-parammgr/src/ParamMgrFactory.js';

export default class OrbiterWamNode extends CompositeAudioNode {
  /**
   * Create all the nodes and setup the ParamMgr
   *
   * @param {import('./index').default} module
   */
  async createNodes(module) {
    const workletUrl = new URL('./Processor.worklet.js', module._baseURL).href;
    await module.audioContext.audioWorklet.addModule(workletUrl);

    const orbiterProcessorOptions = {
      processorOptions: {
        moduleId: module.moduleId,
        instanceId: module.instanceId
      }
    };

    this.orbiterProcessorNode = new AudioWorkletNode(
      module.audioContext,
      '__WebAudioModule_OrbiterProcessor',
      orbiterProcessorOptions
    );

    // Connect processor node to our inputs/outputs
    this.connect(this.orbiterProcessorNode);
    this.orbiterProcessorNode.connect(module.audioContext.destination);

    // Get parameters we need to control
    const freqX = this.orbiterProcessorNode.parameters.get('freqX');
    const freqY = this.orbiterProcessorNode.parameters.get('freqY');
    const ampX = this.orbiterProcessorNode.parameters.get('ampX');
    const ampY = this.orbiterProcessorNode.parameters.get('ampY');
    const centerValue = this.orbiterProcessorNode.parameters.get('centerValue');
    const positionX = this.orbiterProcessorNode.parameters.get('positionX');
    const positionY = this.orbiterProcessorNode.parameters.get('positionY');

    // Create Parameter Manager
    const optionsIn = {
      internalParamsConfig: {
        freqX,
        freqY,
        ampX,
        ampY,
        centerValue,
        positionX,
        positionY
      }
    };

    this._wamNode = await ParamMgrFactory.create(module, optionsIn);

    // Array to store message listeners
    this.messageListeners = [];

    // Setup communication with the processor
    this.orbiterProcessorNode.port.onmessage = (e) => {
      if (e.data.type === 'log') {
        console.log('[OrbiterWamNode]', e.data.message);
      }
      // Relay modulation value or any other messages to GUI
      this.messageListeners.forEach(listener => listener(e));
    };

    // Set initial parameter values
    this.setParameterValues({
      freqX: { id: 'freqX', value: 1.0, normalized: false },
      freqY: { id: 'freqY', value: 1.0, normalized: false },
      ampX: { id: 'ampX', value: 0.5, normalized: false },
      ampY: { id: 'ampY', value: 0.5, normalized: false },
      centerValue: { id: 'centerValue', value: 0.5, normalized: false },
      positionX: { id: 'positionX', value: 0.5, normalized: false },
      positionY: { id: 'positionY', value: 0.5, normalized: false }
    });
  }

  /**
   * Add a listener for processor messages
   * @param {Function} callback 
   */
  addMessageListener(callback) {
    this.messageListeners.push(callback);
  }

  /**
   * Remove a message listener
   * @param {Function} callback 
   */
  removeMessageListener(callback) {
    const index = this.messageListeners.indexOf(callback);
    if (index !== -1) {
      this.messageListeners.splice(index, 1);
    }
  }

  /**
   * Set the target parameter to modulate
   * @param {string} paramId 
   */
  async setTargetParameter(paramId) {
    if (this.orbiterProcessorNode) {
      this.orbiterProcessorNode.port.postMessage({
        type: 'setTarget',
        paramId
      });
    }
  }

  /**
   * Get available parameters to modulate
   */
  async getAvailableParams() {
    // Use the modulation extension to get parameters
    if (window.WAMExtensions && window.WAMExtensions.modulation) {
      const delegate = window.WAMExtensions.modulation.getModulationTargetDelegate(this.targetInstanceId);
      if (delegate) {
        return await delegate.connectModulation();
      }
    }
    return {};
  }

  // Add this method to track the target instance
  setTargetInstance(instanceId) {
    this.targetInstanceId = instanceId;
    // Refresh available parameters
    this.getAvailableParams().then(params => {
      // Update processor with available parameters
      this.orbiterProcessorNode.port.postMessage({
        type: 'setAvailableParams',
        params
      });
    });
  }

  /**
   * Connect all the nodes define the output
   *
   * @param {import('./index.js').default} module
   */
  async setup(module) {
    await this.createNodes(module);
    this._output = this;
  }

  destroy() {
    if (this.orbiterProcessorNode) {
      this.orbiterProcessorNode.parameters.get('destroyed').value = 1;
    }
    // Clear message listeners
    this.messageListeners = [];
    super.destroy();
  }
}