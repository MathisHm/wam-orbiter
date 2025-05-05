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

    this.connect(this.orbiterProcessorNode);
    this.orbiterProcessorNode.connect(module.audioContext.destination);

    const freqX = this.orbiterProcessorNode.parameters.get('freqX');
    const freqY = this.orbiterProcessorNode.parameters.get('freqY');
    const ampX = this.orbiterProcessorNode.parameters.get('ampX');
    const ampY = this.orbiterProcessorNode.parameters.get('ampY');
    const phase = this.orbiterProcessorNode.parameters.get('phase');

    const optionsIn = {
      internalParamsConfig: {
        freqX,
        freqY,
        ampX,
        ampY,
        phase,
      }
    };

    this._wamNode = await ParamMgrFactory.create(module, optionsIn);

    this.messageListeners = [];

    this.orbiterProcessorNode.port.onmessage = (e) => {
      if (e.data.type === 'log') {
        console.log('[OrbiterWamNode]', e.data.message);
      }
      this.messageListeners.forEach(listener => listener(e));
    };

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


  async setTargetParameter(paramId) {
    if (this.orbiterProcessorNode) {
      this.orbiterProcessorNode.port.postMessage({
        type: 'setTarget',
        paramId
      });
    }
  }


  async getAvailableParams() {
      if (window.WAMExtensions && window.WAMExtensions.modulation) {
        const delegate = window.WAMExtensions.modulation.getModulationTargetDelegate(this.targetInstanceId);
        if (delegate) {
          return await delegate.connectModulation();
        }
      }
      
  }

  setTargetInstance(instanceId) {
    this.targetInstanceId = instanceId;
    this.getAvailableParams().then(params => {
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