const client = mqtt.connect("ws://3.23.172.84:8883");

const POWER_STATE = Object.freeze({
  OFF: false,
  ON: true,
});

const app = () => ({
  selectedUser: "feb0903f-6d43-4fe6-a23b-5eca1ab8efe2",
  esp32s: [],
  displayState: POWER_STATE.OFF,
  mode: 1,
  current: 0,
  voltage: 0,
  targetTemperature: 0,
  temperature: 0,
  targetPower: 0,
  power: 0,
  async init() {
    const response = await fetch("../devices.json");
    this.esp32s = await response.json();

    client.on("connect", () => {
      if (!this.selectedUser) {
        return;
      }

      client.subscribe(
        [
          this.displayStateTopic(this.selectedUser),
          this.modeTopic(this.selectedUser),
          this.currentTopic(this.selectedUser),
          this.voltageTopic(this.selectedUser),
          this.targetTemperatureTopic(this.selectedUser),
          this.temperatureSensorTopic(this.selectedUser),
          this.targetPowerTopic(this.selectedUser),
          this.powerSensorTopic(this.selectedUser),
        ],
        (err) => {
          if (err) console.error(err);
        }
      );
    });

    client.on("message", (topic, message) => {
      const stringMessage = message.toString();
      const { from, value } = JSON.parse(stringMessage);
      const isFromDevice = from === "device";

      if (!isFromDevice) {
        return;
      }

      switch (topic) {
        case this.displayStateTopic(this.selectedUser):
          this.displayState = Boolean(value);
          break;
        case this.modeTopic(this.selectedUser):
          this.mode = value;
          break;
        case this.temperatureSensorTopic(this.selectedUser):
          this.temperature = parseInt(value);
          break;
        case this.targetTemperatureTopic(this.selectedUser):
          this.targetTemperature = value;
          break;
        case this.powerSensorTopic(this.selectedUser):
          this.power = value;
          break;
        case this.targetPowerTopic(this.selectedUser):
          this.targetPower = value;
          break;
      }
    });

    this.$watch("selectedUser", (value, prevValue) => {
      if (prevValue) {
        client.unsubscribe(
          [
            this.displayStateTopic(prevValue),
            this.modeTopic(prevValue),
            this.currentTopic(prevValue),
            this.voltageTopic(prevValue),
            this.targetTemperatureTopic(prevValue),
            this.temperatureSensorTopic(prevValue),
            this.targetPowerTopic(prevValue),
            this.powerSensorTopic(prevValue),
          ],
          (err) => {
            if (err) console.error(err);
          }
        );
      }

      if (value) {
        client.subscribe(
          [
            this.displayStateTopic(value),
            this.modeTopic(value),
            this.currentTopic(value),
            this.voltageTopic(value),
            this.targetTemperatureTopic(value),
            this.temperatureSensorTopic(value),
            this.targetPowerTopic(value),
            this.powerSensorTopic(value),
          ],
          (err) => {
            if (err) console.error(err);
          }
        );
      }
    });

    this.$watch("targetTemperature", (value) => {
      this.sendMqttMessage(this.targetTemperatureTopic(this.selectedUser))(
        value
      );
    });

    this.$watch("targetPower", (value) => {
      this.sendMqttMessage(this.targetPowerTopic(this.selectedUser))(value);
    });
  },
  displayStateTopic(id) {
    return `${id}/display`;
  },
  modeTopic(id) {
    return `${id}/mode`;
  },
  currentTopic(id) {
    return `${id}/current`;
  },
  voltageTopic(id) {
    return `${id}/voltage`;
  },
  temperatureSensorTopic(id) {
    return `${id}/temperature_sensor`;
  },
  targetTemperatureTopic(id) {
    return `${id}/target_temperature`;
  },
  powerSensorTopic(id) {
    return `${id}/power_sensor`;
  },
  targetPowerTopic(id) {
    return `${id}/target_power`;
  },
  get displayStateIsOff() {
    return this.displayState === POWER_STATE.OFF;
  },
  sendMqttMessage(topic) {
    return (value) => {
      const message = JSON.stringify({
        from: "app",
        value,
      });

      client.publish(topic, message);
    };
  },
  toggleDisplayState() {
    this.sendMqttMessage(this.displayStateTopic(this.selectedUser))(
      !this.displayState
    );
  },
  handleModeChange(event) {
    this.sendMqttMessage(this.modeTopic(this.selectedUser))(
      event.target.valueAsNumber
    );
  },
  handleTargetPower(event) {
    this.sendMqttMessage(this.targetPowerTopic(this.selectedUser))(
      event.target.valueAsNumber
    );
  },
  handleTempChange(value) {
    console.log(value);
    this.temperature = value;
  },
});

const rangeSlider = ({
  min = 0,
  max = 100,
  value = 0,
  readonly = false,
  textScale = 0.7,
  colorFG = "#fce303",
  suffix = "",
} = {}) => ({
  value,
  init() {
    const knob = pureknob.createKnob(180, 180);

    knob.setProperty("angleStart", -0.75 * Math.PI);
    knob.setProperty("angleEnd", 0.75 * Math.PI);
    knob.setProperty("colorFG", colorFG);
    knob.setProperty("colorBG", "#e0e0e0");
    knob.setProperty("trackWidth", 0.3);
    knob.setProperty("textScale", textScale);
    knob.setProperty("valMin", min);
    knob.setProperty("valMax", max);
    knob.setProperty(
      "fnValueToString",
      (value) => `${value.toString()}${suffix}`
    );

    knob.setValue(this.value);

    const listener = (knob, value) => {
      this.value = value;
    };

    knob.addListener(listener);

    const node = knob.node();

    this.$root.appendChild(node);

    if (readonly) {
      const div = document.createElement("div");

      div.classList.add("absolute", "inset-0", "z-10", "opacity-0");

      this.$root.appendChild(div);
    }

    this.$watch("value", (value) => {
      knob.setValue(value);
    });
  },
});
