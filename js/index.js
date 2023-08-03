const client = mqtt.connect("ws://3.23.172.84:8883");

const LED_STATE = Object.freeze({
  OFF: 0,
  ON: 1,
});

const app = () => ({
  esp32s: [],
  init() {
    fetch("../devices.json")
      .then((res) => res.json())
      .then((devices) => (this.esp32s = devices));
  },
});

const esp32Controller = (id) => ({
  deviceTemperature: 0,
  deviceHumidity: 0,
  localtemperature: "50",
  localHumidity: "50",
  localServoPosition: 0,
  ledState: LED_STATE.OFF,
  init() {
    client.on("connect", () => {
      client.subscribe(this.tempTopic, (err) => {
        if (err) console.error(err);
      });
      client.subscribe(this.humidityDeviceTopic, (err) => {
        if (err) console.error(err);
      });
      client.subscribe(this.ledTopic, (err) => {
        if (err) console.error(err);
      });
    });

    client.on("message", (topic, message) => {
      const stringMessage = message.toString();
      const { from, value } = JSON.parse(stringMessage);
      const isFromDevice = from === "device";

      if (!isFromDevice) {
        return;
      }

      switch (topic) {
        case this.tempTopic:
          this.deviceTemperature = value;
          break;
        case this.humidityDeviceTopic:
          this.deviceHumidity = value;
          break;
        case this.ledTopic:
          this.ledState = value;
      }
    });

    this.$watch("localtemperature", (value) => {
      client.publish(
        this.tempTopic,
        JSON.stringify({
          from: "external",
          value: Number(value),
          message: "Actualizar temperatura",
        })
      );
    });

    this.$watch("localHumidity", (value) => {
      client.publish(
        this.humidityDeviceTopic,
        JSON.stringify({
          from: "external",
          value: Number(value),
          message: "Actualizar humedad",
        })
      );
    });

    this.$watch("localServoPosition", (value) => {
      client.publish(
        this.servoTopic,
        JSON.stringify({
          from: "external",
          value: Number(value),
          message: "Actualizar servo",
        })
      );
    });

    this.$watch("ledState", (value) => {
      const message = JSON.stringify({
        from: "external",
        value: Number(value),
        message: value === LED_STATE.OFF ? "Encender led" : "Apagar led",
      });

      client.publish(this.ledTopic, message);
    });
  },
  get tempTopic() {
    return `${id}/temperature`;
  },
  get humidityDeviceTopic() {
    return `${id}/humidity`;
  },
  get ledTopic() {
    return `${id}/led`;
  },
  get servoTopic() {
    return `${id}/servo`;
  },
  get ledIsOff() {
    return this.ledState === LED_STATE.OFF;
  },
  get ledButtonText() {
    return this.ledIsOff ? "Encender led" : "Apagar led";
  },
  toggleLed() {
    this.ledState = this.ledIsOff ? LED_STATE.ON : LED_STATE.OFF;
  },
});
