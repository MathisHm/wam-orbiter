const template = `
<div class="container">
  <div class="header">
    <h2>Orbiter Modulator</h2>
  </div>
  <div class="controls">
    <div class="param-selector">
      <label for="paramDropdown">Target Parameter:</label>
      <select id="paramDropdown"></select>
    </div>
    <div class="knobs-container">
      <div class="knob-group">
        <label for="freqX">Freq X</label>
        <input type="range" id="freqX" min="0.1" max="10" step="0.1" value="1">
        <span class="value">1.0</span>
      </div>
      <div class="knob-group">
        <label for="freqY">Freq Y</label>
        <input type="range" id="freqY" min="0.1" max="10" step="0.1" value="1">
        <span class="value">1.0</span>
      </div>
      <div class="knob-group">
        <label for="ampX">Amp X</label>
        <input type="range" id="ampX" min="0" max="1" step="0.01" value="0.5">
        <span class="value">0.5</span>
      </div>
      <div class="knob-group">
        <label for="ampY">Amp Y</label>
        <input type="range" id="ampY" min="0" max="1" step="0.01" value="0.5">
        <span class="value">0.5</span>
      </div>
      <div class="knob-group">
        <label for="centerValue">Center</label>
        <input type="range" id="centerValue" min="0" max="1" step="0.01" value="0.5">
        <span class="value">0.5</span>
      </div>
    </div>
    <div class="xy-container">
      <div class="xy-pad" id="xyPad">
        <div class="xy-cursor" id="xyCursor"></div>
        <div class="xy-value">X: <span id="xValue">0.5</span> Y: <span id="yValue">0.5</span></div>
      </div>
    </div>
    <div class="modulation-display" id="modulationDisplay">
      Modulation: 0.00
    </div>
  </div>
</div>
`;

const style = `
:host {
  display: block;
  font-family: sans-serif;
  width: 100%;
  height: auto;
  min-height: 300px;
}

.container {
  background: #2a2a2a;
  color: #eee;
  padding: 1rem;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 10;
  pointer-events: auto;
}

.header {
  margin-bottom: 1rem;
  border-bottom: 1px solid #444;
}

h2 {
  margin: 0;
  padding-bottom: 0.5rem;
  font-size: 1.2rem;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  pointer-events: auto;
  z-index: 10;
  position: relative;
}

.param-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  pointer-events: auto;
}

select {
  padding: 0.3rem;
  background: #444;
  color: #fff;
  border: 1px solid #666;
  border-radius: 3px;
  pointer-events: auto;
}

.knobs-container {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
  pointer-events: auto;
}

.knob-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 60px;
  pointer-events: auto;
}

.knob-group label {
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

.knob-group .value {
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

input[type=range] {
  width: 100%;
  -webkit-appearance: none;
  background: #444;
  height: 5px;
  border-radius: 5px;
  pointer-events: auto;
}

input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 15px;
  height: 15px;
  background: #6b88ff;
  border-radius: 50%;
  cursor: pointer;
  pointer-events: auto;
}

.xy-container {
  width: 100%;
  display: flex;
  justify-content: center;
  padding-top: 1rem;
  pointer-events: auto;
}

.xy-pad {
  position: relative;
  width: 200px;
  height: 200px;
  background: #333;
  border: 1px solid #555;
  border-radius: 5px;
  cursor: crosshair;
  pointer-events: auto;
  z-index: 10;
}

.xy-cursor {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #6b88ff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.xy-value {
  position: absolute;
  bottom: 5px;
  left: 5px;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 0.8rem;
  pointer-events: none;
}

.modulation-display {
  text-align: center;
  background: #333;
  padding: 8px;
  border-radius: 4px;
  font-family: monospace;
  margin-top: 10px;
}
`;


export class OrbiterWamElement extends HTMLElement {
  static is() {
    return 'webaudiomodules-orbiter';
  }

  constructor() {
    super();
    /** @type {import('./Node.js').default} */
    this.audioNode = null;
    this.root = this.attachShadow({ mode: 'open' });
    this.root.innerHTML = `<style>${style}</style>${template}`;
    
    // Define parameters
    this.sliderIds = [
      "freqX", "freqY", "ampX", "ampY", "centerValue"
    ];
    
    // Setup sliders
    this.sliders = {};
    this.sliderIds.forEach(id => {
      const el = this.root.getElementById(id);
      const valueDisplay = el.nextElementSibling;
      this.sliders[id] = el;
      
      el.oninput = e => {
        const value = +e.target.value;
        valueDisplay.textContent = value.toFixed(2);
        this.audioNode.setParameterValues({
          [id]: { id, value, normalized: false }
        });
      };
    });
    
    // Get modulation display element
    this.modulationDisplay = this.root.getElementById('modulationDisplay');
    
    // Setup XY pad
    this.xyPad = this.root.getElementById('xyPad');
    this.xyCursor = this.root.getElementById('xyCursor');
    this.xValue = this.root.getElementById('xValue');
    this.yValue = this.root.getElementById('yValue');
    
    this.mouseActive = false;
    
    this.xyPad.addEventListener('mousedown', (e) => {
      this.mouseActive = true;
      this.updatePosition(e);
    });
    
    document.addEventListener('mousemove', (e) => {
      if (this.mouseActive) {
        this.updatePosition(e);
      }
    });
    
    document.addEventListener('mouseup', () => {
      this.mouseActive = false;
    });
    
    // Setup parameter dropdown
    this.paramDropdown = this.root.getElementById("paramDropdown");
    this.paramDropdown.onchange = (e) => {
      const targetParam = e.target.value;
      if (this.audioNode.setTargetParameter) {
        this.audioNode.setTargetParameter(targetParam);
      }
    };
    console.log("Dropdown element:", this.paramDropdown);

    // Define message handler for processor messages
    this.handleProcessorMessage = (event) => {
      const { data } = event;
      if (data.type === 'modulationValue') {
        console.log('Modulation value:', data.value);
        this.modulationDisplay.textContent = `Modulation: ${data.value.toFixed(2)}`;
      }
    };
    
    // Initialize parameter list
    this.initializeParameterList();
    
    // Setup animation frame handler
    this.handleAnimationFrame = async () => {
      if (!this.isConnected || !this.audioNode) {
        this.raf = window.requestAnimationFrame(this.handleAnimationFrame);
        return;
      }
      
      if (this.audioNode.getParameterValues) {
        try {
          const values = await this.audioNode.getParameterValues();
          
          // Update sliders
          for (const id of this.sliderIds) {
            if (values[id]) {
              const slider = this.sliders[id];
              const value = values[id].value;
              if (slider && +slider.value !== value) {
                slider.value = value;
                slider.nextElementSibling.textContent = value.toFixed(2);
              }
            }
          }
          
          // Update XY cursor position
          if (values.positionX && values.positionY && !this.mouseActive) {
            const x = values.positionX.value;
            const y = values.positionY.value;
            this.xyCursor.style.left = `${x * 100}%`;
            this.xyCursor.style.top = `${(1 - y) * 100}%`;
            this.xValue.textContent = x.toFixed(2);
            this.yValue.textContent = y.toFixed(2);
          }
        } catch (err) {
          console.error('Error getting parameter values:', err);
        }
      }
      
      this.raf = window.requestAnimationFrame(this.handleAnimationFrame);
    };
  }
  
  async initializeParameterList() {
    // Add empty option
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "-- Select Parameter --";
    this.paramDropdown.appendChild(emptyOption);
    
    // Try to get parameter info from synth or connected nodes
    try {
      let paramInfo = await window.synth.audioNode.getParameterInfo();
      
      if (paramInfo) {
        for (const [id, param] of Object.entries(paramInfo)) {
          const option = document.createElement("option");
          option.value = id;
          option.textContent = id;
          this.paramDropdown.appendChild(option);
        }
      }
    } catch (err) {
      console.error('Error initializing parameter list:', err);
    }
  }
  
  updatePosition(e) {
    const rect = this.xyPad.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - ((e.clientY - rect.top) / rect.height)));
    
    // Update UI
    this.xyCursor.style.left = `${x * 100}%`;
    this.xyCursor.style.top = `${(1-y) * 100}%`;
    this.xValue.textContent = x.toFixed(2);
    this.yValue.textContent = y.toFixed(2);
    
    // Send to audio node
    if (this.audioNode) {
      this.audioNode.setParameterValues({
        positionX: { id: 'positionX', value: x, normalized: false },
        positionY: { id: 'positionY', value: y, normalized: false }
      });
    }
  }
  
  connectedCallback() {
    this.raf = window.requestAnimationFrame(this.handleAnimationFrame);
    
    // Set initial position of cursor
    this.xyCursor.style.left = '50%';
    this.xyCursor.style.top = '50%';
    
    // Set up processor message listener
    if (this.audioNode && typeof this.audioNode.addMessageListener === 'function') {
      this.audioNode.addMessageListener(this.handleProcessorMessage);
    }
  }
  
  disconnectedCallback() {
    window.cancelAnimationFrame(this.raf);
    
    // Remove message listener
    if (this.audioNode && typeof this.audioNode.removeMessageListener === 'function') {
      this.audioNode.removeMessageListener(this.handleProcessorMessage);
    }
  }
}

if (!customElements.get(OrbiterWamElement.is())) {
  customElements.define(OrbiterWamElement.is(), OrbiterWamElement);
}

/** @param {import('./index.js').default} wam */
export default (wam) => {
  const container = new OrbiterWamElement();
  container.audioNode = wam.audioNode;
  return container;
};