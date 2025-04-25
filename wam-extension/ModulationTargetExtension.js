export default class ModulationTargetExtension {
    constructor() {
        this.delegates = new Map();
    }

    setModulationTargetDelegate(pluginId, delegate) {
        if (delegate) {
            this.delegates.set(pluginId, delegate);
        } else {
            this.delegates.delete(pluginId);
        }
    }

    getModulationTargetDelegate(pluginId) {
        return this.delegates.get(pluginId);
    }

}
