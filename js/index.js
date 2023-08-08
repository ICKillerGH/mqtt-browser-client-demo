const client = mqtt.connect("ws://3.23.172.84:8883", {
  username: "mqtt_client",
  password: "password",
});

const POWER_STATE = Object.freeze({
  OFF: false,
  ON: true,
});

const app = () => ({
  selectedUser: null,
  esp32s: [],
  sysState: POWER_STATE.OFF,
  mode: 1,
  targetTemperature: 0,
  temperature: 0,
  targetPower: 0,
  power: 0,
  temperatureMetrics: [0, 0, 0, 0, 0, 0],
  powerMetrics: [0, 0, 0, 0, 0, 0],
  async init() {
    const response = await fetch("../devices.json");
    this.esp32s = await response.json();
    this.selectedUser = this.esp32s?.[0]?.id ?? null;

    client.on("connect", () => {
      if (!this.selectedUser) {
        return;
      }

      client.subscribe(
        [
          this.sysStateTopic(this.selectedUser),
          this.modeTopic(this.selectedUser),
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
      let objectMessage = {};

      try {
        objectMessage = JSON.parse(stringMessage);
      } catch (e) {}
      const { from, value } = objectMessage;
      const isFromDevice = from === "device";

      if (!isFromDevice) {
        return;
      }

      switch (topic) {
        case this.sysStateTopic(this.selectedUser):
          this.sysState = Boolean(value);
          break;
        case this.modeTopic(this.selectedUser):
          this.mode = value;
          break;
        case this.temperatureSensorTopic(this.selectedUser):
          this.temperature = value;
          this.updateTemperatureMetrics(this.temperature);
          break;
        case this.targetTemperatureTopic(this.selectedUser):
          this.targetTemperature = value;
          break;
        case this.powerSensorTopic(this.selectedUser):
          this.power = value;
          this.updatePowerMetrics(this.power);
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
            this.sysStateTopic(prevValue),
            this.modeTopic(prevValue),
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
            this.sysStateTopic(value),
            this.modeTopic(value),
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
  sysStateTopic(id) {
    return `${id}/onoff`;
  },
  modeTopic(id) {
    return `${id}/mode`;
  },
  temperatureSensorTopic(id) {
    return `${id}/temperature_sensor`;
  },
  targetTemperatureTopic(id) {
    return `${id}/target_temperature`;
  },
  powerSensorTopic(id) {
    return `${id}/power`;
  },
  targetPowerTopic(id) {
    return `${id}/target_power`;
  },
  get sysStateIsOff() {
    return this.sysState === POWER_STATE.OFF;
  },
  sendMqttMessage(topic) {
    return (value) => {
      const message = JSON.stringify({
        from: "app",
        message: "Lo que sea",
        value,
      });

      client.publish(topic, message);
    };
  },
  toggleSysState() {
    this.sendMqttMessage(this.sysStateTopic(this.selectedUser))(!this.sysState);
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
    this.temperature = value;
  },
  updateTemperatureMetrics: _.debounce(
    function (temperature) {
      this.temperatureMetrics.shift();
      this.temperatureMetrics.push(temperature);
    },
    900,
    { maxWait: "5000" }
  ),
  updatePowerMetrics: _.debounce(
    function (power) {
      this.powerMetrics.shift();
      this.powerMetrics.push(power);
    },
    900,
    { maxWait: "5000" }
  ),
});

const rangeSlider = ({
  min = 0,
  max = 100,
  value = 0,
  readonly = false,
  textScale = 0.65,
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
    knob.setProperty("readonly", readonly);
    knob.setProperty("fnValueToString", (value) => {
      return `${value.toFixed(2)}${suffix}`;
    });

    knob.setValue(this.value);

    const listener = (knob, value) => {
      this.value = value;
    };

    knob.addListener(listener);

    const node = knob.node();

    this.$root.appendChild(node);

    this.$watch("value", (value) => {
      knob.setValue(value);
    });
  },
});

const chart = () => ({
  data: [],
  chart: null,
  init() {
    var options = {
      chart: {
        type: "line",
        animations: {
          enabled: true,
          easing: "linear",
          dynamicAnimation: {
            speed: 1000,
          },
        },
        toolbar: {
          show: false,
        },
      },
      stroke: {
        curve: "smooth",
      },
      series: [
        {
          name: "sales",
          data: [...this.data],
        },
      ],
      xaxis: {
        categories: ["", "", "", "", "", ""],
      },
    };

    this.chart = new ApexCharts(this.$root, options);

    this.$nextTick(() => this.chart.render());

    this.$watch("data", (metrics) => {
      this.chart.updateSeries([
        {
          data: [...metrics],
        },
      ]);
    });
  },
});
