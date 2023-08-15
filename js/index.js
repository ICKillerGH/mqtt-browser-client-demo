const client = mqtt.connect("ws://3.23.172.84:8883", {
  username: "mqtt_client",
  password: "password",
});

const POWER_STATE = Object.freeze({
  OFF: false,
  ON: true,
});

const MODES = [
  {
    name: "Temperatura",
    icon: `
      <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-16 h-16"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
          <path d="M10 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 0 0 -4 0v8.5"></path>
          <path d="M10 9l4 0"></path>
      </svg>
    `,
  },
  {
    name: "Smart",
    icon: `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-16 h-16"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <path
          d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7"
        ></path>
        <path
          d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3"
        ></path>
        <path d="M9.7 17l4.6 0"></path>
      </svg>
    `,
  },
  {
    name: "Eco",
    icon: `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-16 h-16"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <path d="M18.364 19.364a9 9 0 1 0 -12.728 0"></path>
        <path d="M15.536 16.536a5 5 0 1 0 -7.072 0"></path>
        <path d="M12 13m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path>
      </svg>
    `,
  },
  {
    name: "Potencia",
    icon: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="w-16 h-16"
      viewBox="0 0 24 24"
      stroke-width="2"
      stroke="currentColor"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
      <path
        d="M6 7h11a2 2 0 0 1 2 2v.5a.5 .5 0 0 0 .5 .5a.5 .5 0 0 1 .5 .5v3a.5 .5 0 0 1 -.5 .5a.5 .5 0 0 0 -.5 .5v.5a2 2 0 0 1 -2 2h-11a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2"
      ></path>
      <path d="M7 10l0 4"></path>
      <path d="M10 10l0 4"></path>
      <path d="M13 10l0 4"></path>
      <path d="M16 10l0 4"></path>
    </svg>  
    `,
  },
];

const app = () => ({
  selectedUser: null,
  esp32s: [],
  sysState: POWER_STATE.OFF,
  mode: MODES[0].name,
  temperature: 0,
  targetTemperature: 0,
  targetSmart: 0,
  targetEco: 0,
  power: 0,
  targetPower: 0,
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

      client.subscribe(this.allTopics(this.selectedUser), (err) => {
        if (err) console.error(err);
      });
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
        client.unsubscribe(this.allTopics(prevValue), (err) => {
          if (err) console.error(err);
        });
      }

      if (value) {
        client.subscribe(this.allTopics(id), (err) => {
          if (err) console.error(err);
        });
      }
    });

    this.$watch("targetTemperature", (value, prevValue) => {
      if (value === prevValue) return;

      this.sendMqttMessage(this.targetTemperatureTopic(this.selectedUser))(
        value
      );
    });

    this.$watch("targetPower", (value, prevValue) => {
      if (value === prevValue) return;

      this.sendMqttMessage(this.targetPowerTopic(this.selectedUser))(value);
    });

    this.$watch("targetSmart", (value, prevValue) => {
      if (value === prevValue) return;

      this.sendMqttMessage(this.targetSmartTopic(this.selectedUser))(value);
    });

    this.$watch("targetEco", (value, prevValue) => {
      if (value === prevValue) return;

      this.sendMqttMessage(this.targetEcoTopic(this.selectedUser))(value);
    });

    this.$watch("mode", (value, prevValue) => {
      if (value === prevValue) return;

      this.sendMqttMessage(this.targetEcoTopic(this.selectedUser))(value);
    });
  },
  allTopics(id) {
    return [
      this.sysStateTopic(id),
      this.modeTopic(id),
      this.temperatureSensorTopic(id),
      this.targetTemperatureTopic(id),
      this.targetEcoTopic(id),
      this.targetPowerTopic(id),
      this.targetPowerTopic(id),
      this.powerSensorTopic(id),
    ];
  },
  sysStateTopic(id) {
    return `${id}/onoff`;
  },
  modeTopic(id) {
    return `${id}/mode`;
  },
  temperatureSensorTopic(id) {
    return `${id}/temperature`;
  },
  targetTemperatureTopic(id) {
    return `${id}/target_temperature`;
  },
  targetSmartTopic(id) {
    return `${id}/target_smart`;
  },
  targetEcoTopic(id) {
    return `${id}/target_eco`;
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
  get modes() {
    return MODES;
  },
  sendMqttMessage(topic) {
    return (value) => {
      console.log({ value, topic });
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
  isModeSelected(mode) {
    return mode === this.mode;
  },
  setMode(mode) {
    this.mode = mode;
  },
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
