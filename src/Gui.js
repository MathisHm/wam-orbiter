const template = `
<div class="container">
  <div class="controls">
    <div class="param-selector">
      <label for="targetDropdown">Target Module:</label>
      <select id="targetDropdown"></select>
    </div>
    <div class="param-selector">
      <label for="paramDropdown">Target Parameter:</label>
      <select id="paramDropdown"></select>
    </div>
    <div class="sliders">
      <div class="slider-group">
        <label for="freqX">Freq X: <span id="freqXValue">2.0</span></label>
        <input type="range" id="freqX" min="1" max="9" step="1" value="2">
      </div>
      <div class="slider-group">
        <label for="freqY">Freq Y: <span id="freqYValue">4.0</span></label>
        <input type="range" id="freqY" min="1" max="9" step="1" value="4">
      </div>
      <div class="slider-group">
        <label for="ampX">Amp X: <span id="ampXValue">0.8</span></label>
        <input type="range" id="ampX" min="0" max="1.0" step="0.01" value="0.8">
      </div>
      <div class="slider-group">
        <label for="ampY">Amp Y: <span id="ampYValue">0.8</span></label>
        <input type="range" id="ampY" min="0" max="1.0" step="0.01" value="0.8">
      </div>
      <div class="slider-group">
        <label for="phase">Phase: <span id="phaseValue">0</span></label>
        <input type="range" id="phase" min="0" max="6.28" step="0.01" value="0">
      </div>
    </div>
  </div>
  <canvas id="lissajousCanvas" width="400" height="400"></canvas>
</div>
`;

const style = `
.container {
  display: flex;
  gap: 1rem;
  background: #222;
  padding: 1rem;
  border-radius: 8px;
  color: #fff;
  align-items: flex-start;
  width: 40%;
}

canvas {
  background: #111;
  border: 1px solid #444;
  border-radius: 4px;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 200px;
}

.param-selector {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

select {
  padding: 0.3rem;
  background: #444;
  color: #fff;
  border: 1px solid #666;
  border-radius: 3px;
  cursor: pointer;
}

.sliders {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.slider-group {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
}

input[type=range] {
  width: 100%;
  cursor: pointer;
}

button {
  background: #4a65d5;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
  font-weight: bold;
}

button:hover {
  background: #3a55c5;
}

span {
  display: inline-block;
  min-width: 30px;
  text-align: right;
}

`;

export class OrbiterWamElement extends HTMLElement {
  static is() {
    return 'webaudiomodules-orbiter';
  }

  constructor() {
    super();
    this.audioNode = null;
    this.root = this.attachShadow({ mode: 'open' });
    this.root.innerHTML = `<style>${style}</style>${template}`;

    this.canvas = this.root.getElementById('lissajousCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.sliderIds = ["freqX", "freqY", "ampX", "ampY", "phase"];
    this.sliders = {};
    
    this.params = {
      freqX: 2.0,
      freqY: 4.0,
      ampX: 0.8,
      ampY: 0.8,
      phase: 0,
    };

    this.sliderIds.forEach(id => {
      const el = this.root.getElementById(id);
      const valueDisplay = this.root.getElementById(`${id}Value`);
      
      valueDisplay.textContent = this.params[id].toFixed(el.step < 1 ? 2 : 1);
      
      this.sliders[id] = el;

      el.addEventListener('input', () => {
        const value = +el.value;
        this.params[id] = value;

        valueDisplay.textContent = value.toFixed(el.step < 1 ? 2 : 1);

        this.drawLissajousCurve();

        if (this.audioNode?.setParameterValues) {
          this.audioNode.setParameterValues({
            [id]: { id, value, normalized: false }
          });
        }
      });
    });
    this.targetDropdown = this.root.getElementById("targetDropdown");
    this.targetDropdown.addEventListener('change', (e) => {
      const targetInstanceId = e.target.value;
      if (targetInstanceId) {
        this.setTargetInstance(targetInstanceId);
      }
    });
    this.paramDropdown = this.root.getElementById("paramDropdown");
    this.paramDropdown.addEventListener('change', (e) => {
      const targetParam = e.target.value;
      if (this.audioNode?.setTargetParameter) {
        this.audioNode.setTargetParameter(targetParam);
      }
      this.updateTargetParameter(targetParam);
    });
  }

  updateTargetParameter(paramId) {
    if (this.audioNode?.port) {
      this.audioNode.port.postMessage({
        type: 'setTarget',
        paramId
      });
    }
  }

  setTargetInstance(instanceId) {
    if (this.audioNode) {
      this.audioNode.setTargetInstance(instanceId);
      this.populateParameterList(instanceId);
    }
  }

  drawLissajousCurve() {
    const { freqX, freqY, ampX, ampY, phase } = this.params;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();

    const centerX = width / 2;
    const centerY = height / 2;
    const points = 1000;

    for (let i = 0; i <= points; i++) {
      const t = i / points * 2 * Math.PI;
      const x = centerX + ampX * centerX * Math.sin(freqX * t + phase);
      const y = centerY + ampY * centerY * Math.sin(freqY * t);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = '#6b88ff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  handleProcessorMessage = (event) => {
    const { data } = event;
    if (data.type === 'dotPosition') {
      this.drawDotOnCurve(data.x, data.y);
    } else if (data.type === 'log') {
      console.log('Processor:', data.message);
    }
  };

  drawDotOnCurve(x, y) {
    this.drawLissajousCurve();
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#ff3366';
    ctx.fill();
  }

  connectedCallback() {
    if (this.audioNode?.setParameterValues) {
      this.sliderIds.forEach(id => {
        this.audioNode.setParameterValues({
          [id]: { id, value: this.params[id], normalized: false }
        });
      });
    }
    
    this.drawLissajousCurve();

    if (typeof this.audioNode.addMessageListener === 'function') {
      this.audioNode.addMessageListener(this.handleProcessorMessage);
    }

    this.initializeTargetList();
  }

  disconnectedCallback() {
    if (this.audioNode?.removeMessageListener) {
      this.audioNode.removeMessageListener(this.handleProcessorMessage);
    }
  }

  async initializeTargetList() {
    this.targetDropdown.innerHTML = "";
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "-- Select Module --";
    this.targetDropdown.appendChild(emptyOption);

    if (window.WAMExtensions?.modulation) {
      const extension = window.WAMExtensions.modulation;
      if (extension.delegates && extension.delegates.size > 0) {
        for (const [instanceId, delegate] of extension.delegates) {
          const option = document.createElement("option");
          option.value = instanceId;
          option.textContent = `Module ${instanceId}`;
          this.targetDropdown.appendChild(option);
        }
      }
    }
  }

  async populateParameterList(instanceId) {
    this.paramDropdown.innerHTML = "";
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "-- Select Parameter --";
    this.paramDropdown.appendChild(emptyOption);

    if (window.WAMExtensions?.modulation) {
      const extension = window.WAMExtensions.modulation;
      const delegate = extension.getModulationTargetDelegate(instanceId);
      
      if (delegate) {
        const paramInfo = await delegate.connectModulation();
        if (paramInfo) {
          for (const id of Object.keys(paramInfo)) {
            const option = document.createElement("option");
            option.value = id;
            option.textContent = id;
            this.paramDropdown.appendChild(option);
          }
        }
      }
    }
  }
}

if (!customElements.get(OrbiterWamElement.is())) {
  customElements.define(OrbiterWamElement.is(), OrbiterWamElement);
}

export default (wam) => {
  const container = new OrbiterWamElement();
  container.audioNode = wam.audioNode;
  return container;
};